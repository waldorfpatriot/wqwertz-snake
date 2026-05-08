const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const STATS_FILE = path.join(__dirname, 'statistics.json');
const LEVELS_FILE = path.join(__dirname, 'levels.json');
const LOGS_FILE = path.join(__dirname, 'game-logs.txt');
const LEVEL_GRID_SIZES = { small: 20, medium: 30, big: 40 };
const LEGACY_LEVEL_GRID_SIZE = 'big';
const LEVEL_GRID_SIZE = LEVEL_GRID_SIZES.big;
const MAX_LEVEL_BARRIERS = LEVEL_GRID_SIZE * LEVEL_GRID_SIZE;

// Admin password - set via environment variable for security
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Znake';

// Maximum request body size (1MB)
const MAX_BODY_SIZE = 1024 * 1024;

// Allowed origins for CORS (set to your domain in production)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3080', 'http://127.0.0.1:3000', 'http://127.0.0.1:3080'];

// Initialize statistics file if it doesn't exist
function initStatsFile() {
    if (!fs.existsSync(STATS_FILE)) {
        fs.writeFileSync(STATS_FILE, JSON.stringify({ games: [] }, null, 2));
    }
}

// Initialize levels file if it doesn't exist
function initLevelsFile() {
    if (!fs.existsSync(LEVELS_FILE)) {
        fs.writeFileSync(LEVELS_FILE, JSON.stringify({ levels: [] }, null, 2));
    }
}

// Load levels from file
function loadLevels() {
    try {
        const data = fs.readFileSync(LEVELS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { levels: [] };
    }
}

// Save levels to file
function saveLevels(levels) {
    fs.writeFileSync(LEVELS_FILE, JSON.stringify(levels, null, 2));
}

function normalizeLevelGridSize(value) {
    return Object.prototype.hasOwnProperty.call(LEVEL_GRID_SIZES, value) ? value : LEGACY_LEVEL_GRID_SIZE;
}

function levelsWithGridSize(levelsData) {
    const levels = levelsData && Array.isArray(levelsData.levels) ? levelsData.levels : [];
    return levels.map(level => Object.assign({}, level, {
        gridSize: normalizeLevelGridSize(level.gridSize)
    }));
}

function normalizeLevelPayload(levelData) {
    if (!levelData || typeof levelData !== 'object') {
        return { error: 'Invalid level data' };
    }

    if (typeof levelData.name !== 'string') {
        return { error: 'Invalid level name' };
    }

    const name = levelData.name.trim();
    if (!name || name.length > 50) {
        return { error: 'Invalid level name' };
    }

    if (levelData.gridSize != null && !Object.prototype.hasOwnProperty.call(LEVEL_GRID_SIZES, levelData.gridSize)) {
        return { error: 'Invalid grid size' };
    }

    const gridSize = normalizeLevelGridSize(levelData.gridSize);
    const gridDimension = LEVEL_GRID_SIZES[gridSize];
    const maxBarriers = gridDimension * gridDimension;

    if (!Array.isArray(levelData.barriers) || levelData.barriers.length > maxBarriers) {
        return { error: 'Invalid barriers' };
    }

    const barriers = [];
    for (const barrier of levelData.barriers) {
        if (!barrier || !Number.isFinite(barrier.x) || !Number.isFinite(barrier.y)) {
            return { error: 'Invalid barrier coordinates' };
        }

        const x = Math.floor(barrier.x);
        const y = Math.floor(barrier.y);
        if (x < 0 || x >= gridDimension || y < 0 || y >= gridDimension) {
            return { error: 'Invalid barrier coordinates' };
        }

        barriers.push({ x, y });
    }

    return {
        level: {
            name: name.substring(0, 50).replace(/[<>]/g, ''),
            gridSize,
            barriers
        }
    };
}

// Load statistics from file
function loadStats() {
    try {
        const data = fs.readFileSync(STATS_FILE, 'utf8');
        const stats = JSON.parse(data);
        const count = (stats && stats.games) ? stats.games.length : 0;
        console.log('[stats] loadStats: read', STATS_FILE, '->', count, 'games');
        return stats;
    } catch (error) {
        console.log('[stats] loadStats: error', error.message, '-> returning { games: [] }');
        return { games: [] };
    }
}

// Save statistics to file
function saveStats(stats) {
    const count = (stats && stats.games) ? stats.games.length : 0;
    console.log('[stats] saveStats: writing', count, 'games to', STATS_FILE);
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    console.log('[stats] saveStats: done');
}

function cleanText(value, fallback, maxLength) {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.trim().substring(0, maxLength || 80).replace(/[<>]/g, '');
    return cleaned || fallback;
}

function numberOrNull(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberOrZero(value) {
    const number = numberOrNull(value);
    return number == null ? 0 : number;
}

function inferGame(record) {
    const explicit = cleanText(record.game, '', 50);
    if (explicit) return explicit;

    const source = String(record.source || '').toLowerCase();
    if (source.includes('tetris') || source.includes('qwertzis')) return 'qwertzis';
    if (source.includes('pong')) return 'qwertzPong';
    if (source.includes('snake') || source.includes('znake') || source.includes('index')) return 'qwertZnake';
    if (numberOrNull(record.lines) != null) return 'qwertzis';
    if (numberOrNull(record.rally) != null || record.winner) return 'qwertzPong';
    return 'qwertZnake';
}

function inferSource(record) {
    const explicit = cleanText(record.source, '', 80);
    if (explicit) return explicit;
    return 'legacy-statistics.json';
}

function inferGameFromRequest(req, gameData) {
    const explicit = cleanText(gameData.game, '', 50);
    if (explicit) return explicit;

    const referrer = req.headers.referer || req.headers.referrer || '';
    const pathname = referrer.split('?')[0].split('#')[0].toLowerCase();
    if (pathname.endsWith('/tetris.html') || pathname.includes('qwertzis')) return 'qwertzis';
    if (pathname.endsWith('/pong.html') || pathname.includes('pong')) return 'qwertzPong';
    return 'qwertZnake';
}

function inferSourceFromRequest(req, gameData) {
    const explicit = cleanText(gameData.source, '', 80);
    if (explicit) return explicit;

    const referrer = req.headers.referer || req.headers.referrer || '';
    const referrerPath = referrer.split('?')[0].split('#')[0];
    const sourceFile = referrerPath.split('/').pop();
    return cleanText(sourceFile, 'api/statistics', 80);
}

function normalizeStatisticsRecord(record, index) {
    const rawTimestamp = cleanText(record.timestamp, '', 40);
    const timestampMs = rawTimestamp ? Date.parse(rawTimestamp) : NaN;
    const timestamp = Number.isNaN(timestampMs) ? null : new Date(timestampMs).toISOString();
    const date = timestamp ? timestamp.substring(0, 10) : 'unknown';
    const durationSeconds = Math.max(0, Math.floor(numberOrZero(record.duration)));
    const accuracy = numberOrNull(record.accuracy);
    const wpm = numberOrNull(record.wpm);
    const lines = numberOrNull(record.lines);

    return {
        id: record.id || index + 1,
        timestamp: timestamp,
        timestampMs: Number.isNaN(timestampMs) ? 0 : timestampMs,
        date: date,
        player: cleanText(record.name, 'Anonym', 50),
        game: inferGame(record),
        source: inferSource(record),
        points: Math.floor(Math.max(0, numberOrZero(record.points))),
        kpm: Math.floor(Math.max(0, numberOrZero(record.kpm))),
        accuracy: accuracy == null ? null : Math.round(accuracy * 10) / 10,
        wpm: wpm == null ? null : Math.floor(Math.max(0, wpm)),
        level: Math.floor(Math.max(0, numberOrZero(record.level))),
        lines: lines == null ? null : Math.floor(Math.max(0, lines)),
        durationSeconds: durationSeconds,
        durationMinutes: Math.round((durationSeconds / 60) * 10) / 10,
        difficulty: cleanText(record.difficulty, '', 30) || null,
        gridSize: cleanText(record.gridSize, '', 30) || null,
        fingersUsed: record.fingersUsed && typeof record.fingersUsed === 'object' ? record.fingersUsed : {}
    };
}

function createAnalyticsBucket(extra) {
    return Object.assign({
        sessions: 0,
        durationSeconds: 0,
        points: 0,
        bestPoints: 0,
        bestKpm: 0,
        bestAccuracy: null,
        bestWpm: 0,
        kpmTotal: 0,
        accuracyTotal: 0,
        accuracyCount: 0,
        wpmTotal: 0,
        wpmCount: 0,
        firstPlayedAt: null,
        lastPlayedAt: null,
        players: new Set()
    }, extra || {});
}

function addRecordToBucket(bucket, record) {
    bucket.sessions += 1;
    bucket.durationSeconds += record.durationSeconds;
    bucket.points += record.points;
    bucket.bestPoints = Math.max(bucket.bestPoints, record.points);
    bucket.bestKpm = Math.max(bucket.bestKpm, record.kpm);
    bucket.kpmTotal += record.kpm;
    bucket.players.add(record.player);

    if (record.accuracy != null) {
        bucket.bestAccuracy = bucket.bestAccuracy == null ? record.accuracy : Math.max(bucket.bestAccuracy, record.accuracy);
        bucket.accuracyTotal += record.accuracy;
        bucket.accuracyCount += 1;
    }
    if (record.wpm != null) {
        bucket.bestWpm = Math.max(bucket.bestWpm, record.wpm);
        bucket.wpmTotal += record.wpm;
        bucket.wpmCount += 1;
    }
    if (record.timestamp) {
        if (!bucket.firstPlayedAt || record.timestamp < bucket.firstPlayedAt) bucket.firstPlayedAt = record.timestamp;
        if (!bucket.lastPlayedAt || record.timestamp > bucket.lastPlayedAt) bucket.lastPlayedAt = record.timestamp;
    }
}

function roundMetric(value) {
    return Math.round(value * 10) / 10;
}

function finalizeAnalyticsBucket(bucket) {
    const sessions = bucket.sessions || 0;
    return {
        game: bucket.game,
        source: bucket.source,
        date: bucket.date,
        sessions: sessions,
        durationSeconds: bucket.durationSeconds,
        durationMinutes: roundMetric(bucket.durationSeconds / 60),
        averageDurationSeconds: sessions ? roundMetric(bucket.durationSeconds / sessions) : 0,
        points: bucket.points,
        averagePoints: sessions ? roundMetric(bucket.points / sessions) : 0,
        bestPoints: bucket.bestPoints,
        averageKpm: sessions ? roundMetric(bucket.kpmTotal / sessions) : 0,
        bestKpm: bucket.bestKpm,
        averageAccuracy: bucket.accuracyCount ? roundMetric(bucket.accuracyTotal / bucket.accuracyCount) : null,
        bestAccuracy: bucket.bestAccuracy,
        averageWpm: bucket.wpmCount ? roundMetric(bucket.wpmTotal / bucket.wpmCount) : null,
        bestWpm: bucket.bestWpm,
        uniquePlayers: bucket.players ? bucket.players.size : 0,
        firstPlayedAt: bucket.firstPlayedAt,
        lastPlayedAt: bucket.lastPlayedAt
    };
}

function buildAnalyticsResponse(stats) {
    const sourceGames = Array.isArray(stats && stats.games) ? stats.games : [];
    const records = sourceGames.map(normalizeStatisticsRecord).sort((a, b) => a.timestampMs - b.timestampMs);
    const totals = createAnalyticsBucket();
    const byGame = new Map();
    const bySource = new Map();
    const bySourceGame = new Map();
    const dailyOverall = new Map();
    const dailyByGame = new Map();

    records.forEach(record => {
        addRecordToBucket(totals, record);

        if (!byGame.has(record.game)) byGame.set(record.game, createAnalyticsBucket({ game: record.game }));
        addRecordToBucket(byGame.get(record.game), record);

        if (!bySource.has(record.source)) bySource.set(record.source, createAnalyticsBucket({ source: record.source }));
        addRecordToBucket(bySource.get(record.source), record);

        const sourceGameKey = record.source + '\u0000' + record.game;
        if (!bySourceGame.has(sourceGameKey)) {
            bySourceGame.set(sourceGameKey, createAnalyticsBucket({ source: record.source, game: record.game }));
        }
        addRecordToBucket(bySourceGame.get(sourceGameKey), record);

        if (!dailyOverall.has(record.date)) dailyOverall.set(record.date, createAnalyticsBucket({ date: record.date }));
        addRecordToBucket(dailyOverall.get(record.date), record);

        if (!dailyByGame.has(record.game)) dailyByGame.set(record.game, new Map());
        const gameDays = dailyByGame.get(record.game);
        if (!gameDays.has(record.date)) gameDays.set(record.date, createAnalyticsBucket({ date: record.date, game: record.game }));
        addRecordToBucket(gameDays.get(record.date), record);
    });

    const latestRecords = records.slice().sort((a, b) => b.timestampMs - a.timestampMs).slice(0, 250);
    const dailyByGameObject = {};
    Array.from(dailyByGame.keys()).sort().forEach(game => {
        dailyByGameObject[game] = Array.from(dailyByGame.get(game).values())
            .map(finalizeAnalyticsBucket)
            .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    });

    return {
        generatedAt: new Date().toISOString(),
        totals: finalizeAnalyticsBucket(totals),
        byGame: Array.from(byGame.values()).map(finalizeAnalyticsBucket).sort((a, b) => b.durationSeconds - a.durationSeconds),
        bySource: Array.from(bySource.values()).map(finalizeAnalyticsBucket).sort((a, b) => b.durationSeconds - a.durationSeconds),
        bySourceGame: Array.from(bySourceGame.values()).map(finalizeAnalyticsBucket).sort((a, b) => b.durationSeconds - a.durationSeconds),
        series: {
            overall: Array.from(dailyOverall.values()).map(finalizeAnalyticsBucket).sort((a, b) => String(a.date).localeCompare(String(b.date))),
            byGame: dailyByGameObject
        },
        records: latestRecords
    };
}

function isValidAdminPassword(password) {
    return typeof password === 'string' &&
        password.length === ADMIN_PASSWORD.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD));
}

// MIME types for static files
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf'
};

// Helper function to get CORS origin
function getCorsOrigin(req) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        return origin || '*';
    }
    return ALLOWED_ORIGINS[0];
}

// Helper to read request body with size limit
function readBody(req, maxSize = MAX_BODY_SIZE) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        
        req.on('data', chunk => {
            size += chunk.length;
            if (size > maxSize) {
                req.destroy();
                reject(new Error('Request body too large'));
                return;
            }
            body += chunk.toString();
        });
        
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

// Sanitize file path to prevent path traversal
function sanitizePath(requestPath) {
    // Decode URL and normalize
    let decodedPath = decodeURIComponent(requestPath);
    
    // Remove query string
    decodedPath = decodedPath.split('?')[0];
    
    // Normalize path (resolves .. and .)
    const normalized = path.normalize(decodedPath);
    
    // Ensure path doesn't escape the web root
    // Remove leading slashes and any remaining ..
    const cleaned = normalized.replace(/^[/\\]+/, '').replace(/\.\./g, '');
    
    return cleaned;
}

// Create HTTP server
const server = http.createServer((req, res) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', getCorsOrigin(req));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const pathname = (req.url || '').split('?')[0];

    // API endpoints
    if (pathname === '/api/statistics' && req.method === 'GET') {
        console.log('[stats] GET /api/statistics', pathname);
        const stats = loadStats();
        const games = (Array.isArray(stats.games) ? stats.games : []).map(function (g) {
            return Object.assign({}, g, { difficulty: g.difficulty || 'medium' });
        });
        console.log('[stats] GET sending', games.length, 'games');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(games));
        return;
    }

    if (pathname === '/api/analytics' && req.method === 'GET') {
        if (!isValidAdminPassword(req.headers['x-admin-password'])) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }
        const stats = loadStats();
        const analytics = buildAnalyticsResponse(stats);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(analytics));
        return;
    }

    if (pathname === '/api/statistics' && req.method === 'POST') {
        console.log('[stats] POST /api/statistics', pathname);
        readBody(req).then(body => {
            try {
                console.log('[stats] POST body length:', body.length, 'bytes');
                const gameData = JSON.parse(body);
                console.log('[stats] POST parsed gameData:', { name: gameData.name, points: gameData.points, kpm: gameData.kpm, difficulty: gameData.difficulty, gridSize: gameData.gridSize });

                // Input validation
                if (typeof gameData.name !== 'string' || gameData.name.length > 50) {
                    console.log('[stats] POST validation failed: invalid name');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid name' }));
                    return;
                }
                if (typeof gameData.points !== 'number' || gameData.points < 0 || gameData.points > 10000) {
                    console.log('[stats] POST validation failed: invalid points');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid points' }));
                    return;
                }
                if (typeof gameData.kpm !== 'number' || gameData.kpm < 0 || gameData.kpm > 1000) {
                    console.log('[stats] POST validation failed: invalid kpm');
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid kpm' }));
                    return;
                }

                const stats = loadStats();
                if (!Array.isArray(stats.games)) stats.games = [];
                console.log('[stats] POST loadStats: had', stats.games.length, 'games');

                const allowedDifficulty = ['simple', 'medium', 'hard', 'ultra'].includes(gameData.difficulty) ? gameData.difficulty : 'medium';
                const allowedGridSize = ['small', 'medium', 'big'].includes(gameData.gridSize) ? gameData.gridSize : 'medium';
                console.log('[stats] POST allowedDifficulty:', allowedDifficulty, 'allowedGridSize:', allowedGridSize);

                const sanitizedData = {
                    id: Date.now(),
                    timestamp: new Date().toISOString(),
                    name: gameData.name.substring(0, 50).replace(/[<>]/g, ''),
                    points: Math.floor(gameData.points),
                    kpm: Math.floor(gameData.kpm),
                    accuracy: typeof gameData.accuracy === 'number' ? Math.round(gameData.accuracy * 10) / 10 : 100,
                    wpm: typeof gameData.wpm === 'number' ? Math.floor(gameData.wpm) : 0,
                    level: typeof gameData.level === 'number' ? Math.floor(gameData.level) : 0,
                    lines: typeof gameData.lines === 'number' ? Math.floor(gameData.lines) : undefined,
                    duration: typeof gameData.duration === 'number' ? Math.floor(gameData.duration) : 0,
                    fingersUsed: gameData.fingersUsed && typeof gameData.fingersUsed === 'object' ? gameData.fingersUsed : {},
                    difficulty: allowedDifficulty,
                    gridSize: allowedGridSize,
                    game: inferGameFromRequest(req, gameData),
                    source: inferSourceFromRequest(req, gameData)
                };
                console.log('[stats] POST sanitizedData:', { id: sanitizedData.id, name: sanitizedData.name, difficulty: sanitizedData.difficulty, gridSize: sanitizedData.gridSize });

                stats.games.push(sanitizedData);
                console.log('[stats] POST after push:', stats.games.length, 'games');

                stats.games.sort((a, b) => b.points - a.points);
                stats.games = stats.games.slice(0, 1000);

                saveStats(stats);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: sanitizedData.id }));
                console.log('[stats] POST response 201, id:', sanitizedData.id);
            } catch (error) {
                console.log('[stats] POST error:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        }).catch(error => {
            console.log('[stats] POST readBody error:', error.message);
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request too large' }));
        });
        return;
    }

    // Level API endpoints
    if (pathname === '/api/levels' && req.method === 'GET') {
        // Get all levels
        const levelsData = loadLevels();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(levelsWithGridSize(levelsData)));
        return;
    }

    // Password verification endpoint
    if (pathname === '/api/verify-password' && req.method === 'POST') {
        readBody(req).then(body => {
            try {
                const { password } = JSON.parse(body);
                // Use timing-safe comparison to prevent timing attacks
                const isValid = isValidAdminPassword(password);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ valid: isValid }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        }).catch(() => {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request too large' }));
        });
        return;
    }

    if (pathname === '/api/levels' && req.method === 'POST') {
        // Add new level
        readBody(req).then(body => {
            try {
                const levelData = JSON.parse(body);
                const normalized = normalizeLevelPayload(levelData);
                if (normalized.error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: normalized.error }));
                    return;
                }
                
                const levelsData = loadLevels();
                if (!Array.isArray(levelsData.levels)) levelsData.levels = [];
                
                // Limit total number of levels per grid size
                const levelsInGrid = levelsWithGridSize(levelsData)
                    .filter(level => level.gridSize === normalized.level.gridSize);
                if (levelsInGrid.length >= 100) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Maximum levels reached' }));
                    return;
                }
                
                // Sanitize and store
                const sanitizedLevel = {
                    id: Date.now(),
                    createdAt: new Date().toISOString(),
                    name: normalized.level.name,
                    gridSize: normalized.level.gridSize,
                    barriers: normalized.level.barriers
                };
                
                levelsData.levels.push(sanitizedLevel);
                saveLevels(levelsData);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: sanitizedLevel.id }));
            } catch (error) {
                const status = error instanceof SyntaxError ? 400 : 500;
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: status === 400 ? 'Invalid JSON' : 'Failed to save level' }));
            }
        }).catch(() => {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request too large' }));
        });
        return;
    }

    // Update level endpoint
    if (pathname.startsWith('/api/levels/') && req.method === 'PUT') {
        const levelId = parseInt(pathname.split('/').pop(), 10);
        if (!Number.isFinite(levelId)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Level not found' }));
            return;
        }

        readBody(req).then(body => {
            try {
                const levelData = JSON.parse(body);
                const normalized = normalizeLevelPayload(levelData);
                if (normalized.error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: normalized.error }));
                    return;
                }

                const levelsData = loadLevels();
                if (!Array.isArray(levelsData.levels)) levelsData.levels = [];

                const index = levelsData.levels.findIndex(l => l.id === levelId);
                if (index === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Level not found' }));
                    return;
                }

                levelsData.levels[index] = Object.assign({}, levelsData.levels[index], {
                    name: normalized.level.name,
                    gridSize: normalized.level.gridSize,
                    barriers: normalized.level.barriers,
                    updatedAt: new Date().toISOString()
                });
                saveLevels(levelsData);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: levelId }));
            } catch (error) {
                const status = error instanceof SyntaxError ? 400 : 500;
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: status === 400 ? 'Invalid JSON' : 'Failed to save level' }));
            }
        }).catch(() => {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request too large' }));
        });
        return;
    }

    // Delete level endpoint
    if (pathname.startsWith('/api/levels/') && req.method === 'DELETE') {
        const levelId = parseInt(pathname.split('/').pop(), 10);
        const levelsData = loadLevels();
        
        const index = levelsData.levels.findIndex(l => l.id === levelId);
        if (index === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Level not found' }));
            return;
        }
        
        levelsData.levels.splice(index, 1);
        saveLevels(levelsData);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // Logs endpoint
    if (pathname === '/api/logs' && req.method === 'POST') {
        readBody(req, MAX_BODY_SIZE).then(body => {
            try {
                let logData;
                
                // Handle both JSON and sendBeacon (plain text) formats
                const contentType = req.headers['content-type'] || '';
                if (contentType.includes('application/json')) {
                    logData = JSON.parse(body);
                } else {
                    // sendBeacon sends plain text, try to parse as JSON
                    try {
                        logData = JSON.parse(body);
                    } catch (e) {
                        // If not JSON, treat as single log entry
                        logData = { logs: [{ raw: body, timestamp: new Date().toISOString() }] };
                    }
                }
                
                // Validate log data
                if (!logData || !Array.isArray(logData.logs)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid log data format' }));
                    return;
                }
                
                // Limit number of logs per request
                if (logData.logs.length > 1000) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Too many logs in request' }));
                    return;
                }
                
                // Format and append logs to file
                const logLines = logData.logs.map(log => {
                    const logString = typeof log === 'string' ? log : JSON.stringify(log);
                    return `${new Date().toISOString()} | ${logString}\n`;
                }).join('');
                
                // Append to log file (create if doesn't exist)
                fs.appendFileSync(LOGS_FILE, logLines, 'utf8');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, logged: logData.logs.length }));
            } catch (error) {
                console.error('Error processing logs:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        }).catch(() => {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request too large' }));
        });
        return;
    }

    // Serve static files with path traversal protection
    let requestedPath = pathname === '/' ? 'index.html' : sanitizePath(pathname);
    
    // Only allow specific file extensions
    const extname = path.extname(requestedPath).toLowerCase();
    if (!mimeTypes[extname]) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    const filePath = path.join(__dirname, requestedPath);
    
    // Ensure the resolved path is within __dirname
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(__dirname))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const contentType = mimeTypes[extname];

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            // Add caching headers for static assets
            if (extname !== '.html') {
                res.setHeader('Cache-Control', 'public, max-age=86400');
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

if (require.main === module) {
    initStatsFile();
    initLevelsFile();

    // Initialize logs file (create empty file if doesn't exist)
    if (!fs.existsSync(LOGS_FILE)) {
        fs.writeFileSync(LOGS_FILE, `=== Game Logs Started at ${new Date().toISOString()} ===\n`, 'utf8');
    }

    server.listen(PORT, HOST, () => {
        console.log(`🐍 qwertZnake server running at http://localhost:${PORT}`);
        console.log(`📝 Logs will be saved to: ${LOGS_FILE}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Try: PORT=${Number(PORT) + 1} npm start`);
        } else if (err.code === 'EPERM') {
            console.error(`Cannot bind to ${HOST}:${PORT} (${err.message}). Try: PORT=3080 npm start`);
        } else {
            console.error('Server error:', err.message);
        }
        process.exit(1);
    });
}

module.exports = {
    server,
    buildAnalyticsResponse,
    normalizeStatisticsRecord,
    normalizeLevelPayload,
    normalizeLevelGridSize,
    levelsWithGridSize,
    inferGame,
    inferSource,
    isValidAdminPassword,
    LEVEL_GRID_SIZE,
    MAX_LEVEL_BARRIERS,
    LEVEL_GRID_SIZES,
    LEGACY_LEVEL_GRID_SIZE
};

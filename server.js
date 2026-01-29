const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const STATS_FILE = path.join(__dirname, 'statistics.json');
const LEVELS_FILE = path.join(__dirname, 'levels.json');
const LOGS_FILE = path.join(__dirname, 'game-logs.txt');

// Admin password - set via environment variable for security
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Znake';

// Maximum request body size (1MB)
const MAX_BODY_SIZE = 1024 * 1024;

// Allowed origins for CORS (set to your domain in production)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];

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
    '.ico': 'image/x-icon'
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        const games = (stats.games || []).map(function (g) {
            return Object.assign({}, g, { difficulty: g.difficulty || 'medium' });
        });
        console.log('[stats] GET sending', games.length, 'games');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(games));
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
                    level: typeof gameData.level === 'number' ? Math.floor(gameData.level) : 0,
                    duration: typeof gameData.duration === 'number' ? Math.floor(gameData.duration) : 0,
                    fingersUsed: gameData.fingersUsed && typeof gameData.fingersUsed === 'object' ? gameData.fingersUsed : {},
                    difficulty: allowedDifficulty,
                    gridSize: allowedGridSize
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
        res.end(JSON.stringify(levelsData.levels));
        return;
    }

    // Password verification endpoint
    if (pathname === '/api/verify-password' && req.method === 'POST') {
        readBody(req).then(body => {
            try {
                const { password } = JSON.parse(body);
                // Use timing-safe comparison to prevent timing attacks
                const isValid = password && password.length === ADMIN_PASSWORD.length &&
                    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD));
                
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
                
                // Validate level data
                if (typeof levelData.name !== 'string' || !levelData.name || levelData.name.length > 50) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid level name' }));
                    return;
                }
                if (!Array.isArray(levelData.barriers) || levelData.barriers.length > 400) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid barriers' }));
                    return;
                }
                
                // Validate each barrier
                const validBarriers = levelData.barriers.every(b => 
                    typeof b.x === 'number' && typeof b.y === 'number' &&
                    b.x >= 0 && b.x < 20 && b.y >= 0 && b.y < 20
                );
                if (!validBarriers) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid barrier coordinates' }));
                    return;
                }
                
                const levelsData = loadLevels();
                
                // Limit total number of levels
                if (levelsData.levels.length >= 100) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Maximum levels reached' }));
                    return;
                }
                
                // Sanitize and store
                const sanitizedLevel = {
                    id: Date.now(),
                    createdAt: new Date().toISOString(),
                    name: levelData.name.substring(0, 50).replace(/[<>]/g, ''),
                    barriers: levelData.barriers.map(b => ({ x: Math.floor(b.x), y: Math.floor(b.y) }))
                };
                
                levelsData.levels.push(sanitizedLevel);
                saveLevels(levelsData);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: sanitizedLevel.id }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
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

initStatsFile();
initLevelsFile();

// Initialize logs file (create empty file if doesn't exist)
if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, `=== Game Logs Started at ${new Date().toISOString()} ===\n`, 'utf8');
}

server.listen(PORT, () => {
    console.log(`🐍 qwertZnake server running at http://localhost:${PORT}`);
    console.log(`📝 Logs will be saved to: ${LOGS_FILE}`);
});


const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const STATS_FILE = path.join(__dirname, 'statistics.json');
const LEVELS_FILE = path.join(__dirname, 'levels.json');

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
        return JSON.parse(data);
    } catch (error) {
        return { games: [] };
    }
}

// Save statistics to file
function saveStats(stats) {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
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

    // API endpoints
    if (req.url === '/api/statistics' && req.method === 'GET') {
        // Get all statistics
        const stats = loadStats();
        // Sort by points (descending) and return top 50
        stats.games.sort((a, b) => b.points - a.points);
        const topGames = stats.games.slice(0, 50);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(topGames));
        return;
    }

    if (req.url === '/api/statistics' && req.method === 'POST') {
        // Add new game statistics
        readBody(req).then(body => {
            try {
                const gameData = JSON.parse(body);
                
                // Input validation
                if (typeof gameData.name !== 'string' || gameData.name.length > 50) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid name' }));
                    return;
                }
                if (typeof gameData.points !== 'number' || gameData.points < 0 || gameData.points > 10000) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid points' }));
                    return;
                }
                if (typeof gameData.kpm !== 'number' || gameData.kpm < 0 || gameData.kpm > 1000) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid kpm' }));
                    return;
                }
                
                const stats = loadStats();
                
                // Sanitize and add only allowed fields
                const sanitizedData = {
                    id: Date.now(),
                    timestamp: new Date().toISOString(),
                    name: gameData.name.substring(0, 50).replace(/[<>]/g, ''),
                    points: Math.floor(gameData.points),
                    kpm: Math.floor(gameData.kpm),
                    level: typeof gameData.level === 'number' ? Math.floor(gameData.level) : 0,
                    duration: typeof gameData.duration === 'number' ? Math.floor(gameData.duration) : 0,
                    fingersUsed: gameData.fingersUsed || {}
                };
                
                stats.games.push(sanitizedData);
                
                // Keep only top 1000 games to prevent file from growing too large
                stats.games.sort((a, b) => b.points - a.points);
                stats.games = stats.games.slice(0, 1000);
                
                saveStats(stats);
                
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, id: sanitizedData.id }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        }).catch(error => {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request too large' }));
        });
        return;
    }

    // Level API endpoints
    if (req.url === '/api/levels' && req.method === 'GET') {
        // Get all levels
        const levelsData = loadLevels();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(levelsData.levels));
        return;
    }

    // Password verification endpoint
    if (req.url === '/api/verify-password' && req.method === 'POST') {
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

    if (req.url === '/api/levels' && req.method === 'POST') {
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
    if (req.url.startsWith('/api/levels/') && req.method === 'DELETE') {
        const levelId = parseInt(req.url.split('/').pop());
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

    // Serve static files with path traversal protection
    let requestedPath = req.url === '/' ? 'index.html' : sanitizePath(req.url);
    
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

server.listen(PORT, () => {
    console.log(`🐍 qwertZnake server running at http://localhost:${PORT}`);
});


(function (root, factory) {
    const config = factory();
    if (typeof module === 'object' && module.exports) module.exports = config;
    else root.QwertzLearningTetris = config;
}(typeof window === 'undefined' ? globalThis : window, function () {
    'use strict';

    const WIDTH = 10;
    const HEIGHT = 20;
    const CELL = 18;
    const BOARD_X = 120;
    const BOARD_Y = 24;
    const SHAPES = {
        I: { shape: [[1, 1, 1, 1]], color: '#22d3ee' },
        O: { shape: [[1, 1], [1, 1]], color: '#facc15' },
        T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#c084fc' },
        S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#4ade80' },
        Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#fb7185' },
        J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#60a5fa' },
        L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#fb923c' }
    };
    const ACTIONS = ['left', 'right', 'down', 'rotate'];
    const REPEAT_DELAY = { left: 0.2, right: 0.2, down: 0.08 };
    const REPEAT_INTERVAL = { left: 0.09, right: 0.09, down: 0.06 };

    function refillBag(game) {
        game.bag = Object.keys(SHAPES);
        for (let i = game.bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [game.bag[i], game.bag[j]] = [game.bag[j], game.bag[i]];
        }
    }

    function nextPiece(game) {
        if (!game.bag.length) refillBag(game);
        const type = game.bag.pop();
        const definition = SHAPES[type];
        return {
            type,
            shape: definition.shape.map(row => row.slice()),
            color: definition.color,
            x: Math.floor((WIDTH - definition.shape[0].length) / 2),
            y: 0,
            rotation: 0
        };
    }

    function collides(game, piece, dx, dy, shape) {
        shape = shape || piece.shape;
        dx = dx || 0;
        dy = dy || 0;
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (!shape[row][col]) continue;
                const x = piece.x + col + dx;
                const y = piece.y + row + dy;
                if (x < 0 || x >= WIDTH || y >= HEIGHT || y >= 0 && game.board[y][x]) return true;
            }
        }
        return false;
    }

    function lose(game, finish) {
        if (game.lost) return;
        game.lost = true;
        game.pending.length = 0;
        finish.lose('Das Spielfeld ist voll.');
    }

    function lock(game, finish) {
        const piece = game.currentPiece;
        for (let row = 0; row < piece.shape.length; row++) {
            for (let col = 0; col < piece.shape[row].length; col++) {
                if (piece.shape[row][col] && piece.y + row < 0) {
                    lose(game, finish);
                    return;
                }
            }
        }
        piece.shape.forEach((row, r) => row.forEach((cell, c) => {
            if (cell) game.board[piece.y + r][piece.x + c] = piece.color;
        }));
        let cleared = 0;
        for (let row = HEIGHT - 1; row >= 0; row--) {
            if (game.board[row].some(cell => !cell)) continue;
            game.board.splice(row, 1);
            game.board.unshift(Array(WIDTH).fill(0));
            cleared++;
            row++;
        }
        if (cleared) {
            game.lines += cleared;
            finish.addScore(100 * cleared);
        }
        game.currentPiece = game.nextPiece;
        game.nextPiece = nextPiece(game);
        game.gravityTimer = 0;
        if (collides(game, game.currentPiece)) lose(game, finish);
    }

    function drop(game, finish, soft) {
        if (collides(game, game.currentPiece, 0, 1)) {
            lock(game, finish);
            return;
        }
        game.currentPiece.y++;
        if (soft) finish.addScore(1);
    }

    function command(game, action, finish) {
        if (game.lost) return;
        const piece = game.currentPiece;
        if (action === 'down') drop(game, finish, true);
        else if (action === 'rotate') {
            const rotated = Array.from({ length: piece.shape[0].length }, (_, col) =>
                Array.from({ length: piece.shape.length }, (_, row) => piece.shape[piece.shape.length - 1 - row][col]));
            if (!collides(game, piece, 0, 0, rotated)) {
                piece.shape = rotated;
                piece.rotation = (piece.rotation + 1) % 4;
            }
        } else {
            const dx = action === 'left' ? -1 : 1;
            if (!collides(game, piece, dx, 0)) piece.x += dx;
        }
    }

    function create() {
        const game = {
            board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0)),
            bag: [],
            currentPiece: null,
            nextPiece: null,
            gravityTimer: 0,
            gravityInterval: 1,
            held: {},
            repeatTimers: {},
            pending: [],
            lines: 0,
            lost: false
        };
        game.currentPiece = nextPiece(game);
        game.nextPiece = nextPiece(game);
        return game;
    }

    function onPress(game, action) {
        if (!game.lost && ACTIONS.includes(action)) game.pending.push(action);
    }

    function clearInputs(game) {
        game.pending.length = 0;
        game.held = {};
        game.repeatTimers = {};
    }

    function update(game, dt, keys, finish) {
        if (game.lost) return;
        if (collides(game, game.currentPiece)) {
            lose(game, finish);
            return;
        }
        dt = Number.isFinite(dt) ? Math.max(0, Math.min(1, dt)) : 0;
        keys = keys || {};
        const pending = game.pending.splice(0);
        const pressed = new Set(pending);
        pending.forEach(action => command(game, action, finish));
        for (const action of ['left', 'right', 'down']) {
            if (game.lost) return;
            if (!keys[action]) {
                game.held[action] = false;
                game.repeatTimers[action] = REPEAT_DELAY[action];
                continue;
            }
            const fresh = pressed.has(action) || !game.held[action];
            if (fresh) {
                if (!pressed.has(action)) command(game, action, finish);
                game.repeatTimers[action] = REPEAT_DELAY[action];
            } else if (action === 'down' || !keys.left || !keys.right) {
                game.repeatTimers[action] -= dt;
                while (game.repeatTimers[action] <= 0 && !game.lost) {
                    command(game, action, finish);
                    game.repeatTimers[action] += REPEAT_INTERVAL[action];
                }
            }
            game.held[action] = true;
        }
        game.gravityTimer += dt;
        while (game.gravityTimer >= game.gravityInterval && !game.lost) {
            game.gravityTimer -= game.gravityInterval;
            drop(game, finish, false);
        }
    }

    function drawCell(ctx, x, y, color, size) {
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    }

    function drawPiece(ctx, piece, color) {
        piece.shape.forEach((row, r) => row.forEach((cell, c) => {
            const y = piece.y + r;
            if (cell && y >= 0 && y < HEIGHT) {
                drawCell(ctx, BOARD_X + (piece.x + c) * CELL, BOARD_Y + y * CELL, color || piece.color, CELL);
            }
        }));
    }

    function draw(ctx, game) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 420, 420);
        ctx.fillStyle = '#172033';
        ctx.fillRect(BOARD_X, BOARD_Y, WIDTH * CELL, HEIGHT * CELL);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        for (let row = 0; row <= HEIGHT; row++) {
            ctx.beginPath();
            ctx.moveTo(BOARD_X, BOARD_Y + row * CELL);
            ctx.lineTo(BOARD_X + WIDTH * CELL, BOARD_Y + row * CELL);
            ctx.stroke();
        }
        for (let col = 0; col <= WIDTH; col++) {
            ctx.beginPath();
            ctx.moveTo(BOARD_X + col * CELL, BOARD_Y);
            ctx.lineTo(BOARD_X + col * CELL, BOARD_Y + HEIGHT * CELL);
            ctx.stroke();
        }
        game.board.forEach((row, r) => row.forEach((color, c) => {
            if (color) drawCell(ctx, BOARD_X + c * CELL, BOARD_Y + r * CELL, color, CELL);
        }));
        if (!game.lost) {
            const ghost = { ...game.currentPiece };
            while (!collides(game, ghost, 0, 1)) ghost.y++;
            drawPiece(ctx, ghost, 'rgba(226,232,240,0.17)');
        }
        drawPiece(ctx, game.currentPiece);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('Nächster', 24, 56);
        ctx.fillText('Reihen: ' + game.lines, 312, 56);
        game.nextPiece.shape.forEach((row, r) => row.forEach((cell, c) => {
            if (cell) drawCell(ctx, 24 + c * 16, 72 + r * 16, game.nextPiece.color, 16);
        }));
    }

    return {
        id: 'tetris',
        title: 'qwertzris',
        summary: 'Fülle eine Reihe mit Bausteinen. Schnelleres Fallen gibt einen Punkt pro Feld, eine volle Reihe gibt 100 Punkte.',
        actions: [
            { id: 'left', label: 'Links', arrow: '←', pool: 'left' },
            { id: 'right', label: 'Rechts', arrow: '→', pool: 'right' },
            { id: 'down', label: 'Schneller fallen', arrow: '↓', pool: 'down' },
            { id: 'rotate', label: 'Drehen', arrow: '↻', pool: 'action' }
        ],
        usesLevels: false,
        create, update, draw, onPress, clearInputs
    };
}));

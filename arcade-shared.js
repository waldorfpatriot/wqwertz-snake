(function () {
    const WIDTH = 420;
    const HEIGHT = 420;
    const PRESSES_PER_CHANGE = 10;
    const STORAGE_PREFIX = 'qwertz_arcade_levels_';

    const KEYBOARD_ROWS = [
        ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
        ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
        [' ']
    ];

    const FINGER_MAP = {
        q: 'finger-pinky', a: 'finger-pinky', y: 'finger-pinky',
        w: 'finger-ring', s: 'finger-ring', x: 'finger-ring',
        e: 'finger-middle', d: 'finger-middle', c: 'finger-middle',
        r: 'finger-index', f: 'finger-index', v: 'finger-index',
        t: 'finger-index', g: 'finger-index', b: 'finger-index',
        p: 'finger-pinky', 'ü': 'finger-pinky', 'ö': 'finger-pinky', 'ä': 'finger-pinky', '-': 'finger-pinky',
        o: 'finger-ring', l: 'finger-ring', '.': 'finger-ring',
        i: 'finger-middle', k: 'finger-middle', ',': 'finger-middle',
        z: 'finger-index', h: 'finger-index', n: 'finger-index', u: 'finger-index', j: 'finger-index', m: 'finger-index'
    };

    const FINGER_NAMES = {
        'finger-pinky': 'Kleiner Finger',
        'finger-ring': 'Ringfinger',
        'finger-middle': 'Mittelfinger',
        'finger-index': 'Zeigefinger'
    };

    const ALL_KEYS = KEYBOARD_ROWS.flat();
    const KEY_POOLS = {
        left: ['q', 'a', 'y', 'w', 's', 'x', 'e', 'd', 'c', 'r', 'f', 'v', 't', 'g', 'b'],
        right: ['z', 'u', 'i', 'o', 'p', 'ü', 'h', 'j', 'k', 'l', 'ö', 'ä', 'n', 'm', ',', '.', '-'],
        up: ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
        down: ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
        action: ALL_KEYS.filter(key => key !== ' ')
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function intersects(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function circleRect(circle, rect) {
        const x = clamp(circle.x, rect.x, rect.x + rect.w);
        const y = clamp(circle.y, rect.y, rect.y + rect.h);
        const dx = circle.x - x;
        const dy = circle.y - y;
        return dx * dx + dy * dy <= circle.r * circle.r;
    }

    function displayKey(key) {
        return key === ' ' ? 'SPACE' : String(key).toUpperCase();
    }

    function safeText(value, fallback) {
        return String(value || fallback || '').replace(/[<>]/g, '').trim();
    }

    function makeControlKeys(actions) {
        const used = new Set();
        const result = {};
        actions.forEach((action, index) => {
            const pool = KEY_POOLS[action.pool || action.id] || KEY_POOLS.action;
            let key = pool[index % pool.length];
            for (let i = 0; i < pool.length; i += 1) {
                const candidate = pool[(index + i) % pool.length];
                if (!used.has(candidate)) {
                    key = candidate;
                    break;
                }
            }
            used.add(key);
            result[action.id] = key;
        });
        return result;
    }

    function nextKeyFor(action, current, used, index) {
        const pool = KEY_POOLS[action.pool || action.id] || KEY_POOLS.action;
        for (let i = 1; i <= pool.length; i += 1) {
            const candidate = pool[(index + i) % pool.length];
            if (candidate !== current && !used.has(candidate)) return candidate;
        }
        return pool[(index + 1) % pool.length] || current;
    }

    function saveArcadeStatistics(config, state) {
        if (!state.startedAt) return;
        const duration = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
        const kpm = Math.round((state.totalKeystrokes / duration) * 60);
        const payload = {
            name: localStorage.getItem('qwertz_arcade_name') || 'Anonym',
            points: Math.max(0, Math.floor(state.score || 0)),
            kpm: kpm,
            level: 1,
            duration: duration,
            fingersUsed: state.fingersUsed,
            game: config.title,
            source: config.id + '.html'
        };

        fetch('/api/statistics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(function () {});
    }

    function loadCustomLevels(gameId) {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_PREFIX + gameId) || '[]');
            return Array.isArray(stored) ? stored : [];
        } catch (error) {
            return [];
        }
    }

    function persistCustomLevels(gameId, levels) {
        localStorage.setItem(STORAGE_PREFIX + gameId, JSON.stringify(levels.slice(-12)));
    }

    function cellRectsFromGrid(grid, cols, rows) {
        const cellW = WIDTH / cols;
        const cellH = HEIGHT / rows;
        const rects = [];
        grid.forEach(function (active, index) {
            if (!active) return;
            const x = index % cols;
            const y = Math.floor(index / cols);
            rects.push({ x: x * cellW, y: y * cellH, w: cellW, h: cellH });
        });
        return rects;
    }

    function makeCustomCredits(ctx, level) {
        if (!level || !level.creator) return;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(36, 36, WIDTH - 72, 70);
        ctx.strokeStyle = '#111827';
        ctx.strokeRect(36, 36, WIDTH - 72, 70);
        ctx.fillStyle = '#111827';
        ctx.font = '700 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Custom level by ' + level.creator, WIDTH / 2, 65);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(level.name || 'Untitled level', WIDTH / 2, 88);
        ctx.restore();
    }

    const GAMES = {
        breakout: {
            id: 'breakout',
            title: 'qwertz Breakout',
            summary: 'Break all bricks, keep the ball alive, and let changing movement keys train left/right precision.',
            actions: [
                { id: 'left', label: 'Links', arrow: '<', pool: 'left' },
                { id: 'right', label: 'Rechts', arrow: '>', pool: 'right' }
            ],
            usesLevels: true,
            create: function (customLevel) {
                const customBlocks = customLevel ? cellRectsFromGrid(customLevel.grid, 14, 14)
                    .filter(rect => rect.y < 180 && rect.x > 25 && rect.x < WIDTH - 50) : [];
                const bricks = customBlocks.length ? customBlocks.map(function (rect, index) {
                    return { x: rect.x + 3, y: rect.y + 3, w: rect.w - 6, h: rect.h - 6, hp: 1, points: 8 + (index % 4) * 2 };
                }) : Array.from({ length: 30 }, function (_, index) {
                    const col = index % 10;
                    const row = Math.floor(index / 10);
                    return { x: 28 + col * 37, y: 44 + row * 23, w: 32, h: 16, hp: 1, points: (3 - row) * 10 };
                });
                return {
                    paddle: { x: 160, y: 374, w: 92, h: 12, speed: 300 },
                    ball: { x: 210, y: 260, vx: 125, vy: -185, r: 7 },
                    bricks: bricks,
                    lives: 3,
                    levelComplete: false,
                    creatorLevel: customLevel || null
                };
            },
            update: function (game, dt, keys, finish) {
                if (keys.left) game.paddle.x -= game.paddle.speed * dt;
                if (keys.right) game.paddle.x += game.paddle.speed * dt;
                game.paddle.x = clamp(game.paddle.x, 0, WIDTH - game.paddle.w);

                const ball = game.ball;
                ball.x += ball.vx * dt;
                ball.y += ball.vy * dt;
                if (ball.x < ball.r || ball.x > WIDTH - ball.r) ball.vx *= -1;
                if (ball.y < ball.r) ball.vy *= -1;
                if (circleRect(ball, game.paddle) && ball.vy > 0) {
                    const hit = (ball.x - (game.paddle.x + game.paddle.w / 2)) / (game.paddle.w / 2);
                    ball.vx = hit * 230;
                    ball.vy = -Math.abs(ball.vy) - 8;
                }
                game.bricks.forEach(function (brick) {
                    if (brick.hp <= 0 || !circleRect(ball, brick)) return;
                    brick.hp = 0;
                    ball.vy *= -1;
                    finish.addScore(brick.points);
                });
                if (ball.y > HEIGHT + 16) {
                    game.lives -= 1;
                    ball.x = 210;
                    ball.y = 260;
                    ball.vx = 120;
                    ball.vy = -175;
                }
                if (game.lives <= 0) finish.lose('Game over');
                if (game.bricks.every(brick => brick.hp <= 0)) finish.win('Level complete');
            },
            draw: function (ctx, game) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.fillStyle = '#475569';
                ctx.fillRect(game.paddle.x, game.paddle.y, game.paddle.w, game.paddle.h);
                ctx.fillStyle = '#111827';
                ctx.beginPath();
                ctx.arc(game.ball.x, game.ball.y, game.ball.r, 0, Math.PI * 2);
                ctx.fill();
                game.bricks.forEach(function (brick, index) {
                    if (brick.hp <= 0) return;
                    ctx.fillStyle = ['#287d68', '#2b6cb0', '#b54b4b'][index % 3];
                    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
                });
                ctx.fillStyle = '#334155';
                ctx.font = '14px system-ui, sans-serif';
                ctx.fillText('Lives: ' + game.lives, 16, HEIGHT - 18);
                makeCustomCredits(ctx, game.creatorLevel);
            }
        },
        invaders: {
            id: 'invaders',
            title: 'qwertz Invaders',
            summary: 'Move, shoot, and clear the first alien wave while typing action keys on purpose.',
            actions: [
                { id: 'left', label: 'Links', arrow: '<', pool: 'left' },
                { id: 'right', label: 'Rechts', arrow: '>', pool: 'right' },
                { id: 'shoot', label: 'Schuss', arrow: '^', pool: 'up' }
            ],
            usesLevels: true,
            create: function (customLevel) {
                const customAliens = customLevel ? cellRectsFromGrid(customLevel.grid, 14, 14)
                    .filter(rect => rect.y < 220).map(rect => ({ x: rect.x + 8, y: rect.y + 8, w: 18, h: 14, alive: true })) : [];
                const aliens = customAliens.length ? customAliens : Array.from({ length: 24 }, function (_, index) {
                    return { x: 58 + (index % 8) * 39, y: 52 + Math.floor(index / 8) * 30, w: 22, h: 16, alive: true };
                });
                return { player: { x: 194, y: 374, w: 34, h: 16 }, aliens: aliens, direction: 1, bullet: null, lives: 3, alienTimer: 0, creatorLevel: customLevel || null };
            },
            update: function (game, dt, keys, finish) {
                if (keys.left) game.player.x -= 240 * dt;
                if (keys.right) game.player.x += 240 * dt;
                game.player.x = clamp(game.player.x, 0, WIDTH - game.player.w);
                if (keys.shoot && !game.bullet) game.bullet = { x: game.player.x + game.player.w / 2, y: game.player.y, w: 4, h: 10 };
                if (game.bullet) {
                    game.bullet.y -= 330 * dt;
                    game.aliens.forEach(function (alien) {
                        if (game.bullet && alien.alive && intersects(game.bullet, alien)) {
                            alien.alive = false;
                            game.bullet = null;
                            finish.addScore(25);
                        }
                    });
                    if (game.bullet && game.bullet.y < -20) game.bullet = null;
                }
                game.alienTimer += dt;
                if (game.alienTimer > 0.45) {
                    game.alienTimer = 0;
                    let edge = false;
                    game.aliens.forEach(function (alien) {
                        if (!alien.alive) return;
                        alien.x += game.direction * 12;
                        if (alien.x < 16 || alien.x > WIDTH - 38) edge = true;
                    });
                    if (edge) {
                        game.direction *= -1;
                        game.aliens.forEach(function (alien) {
                            alien.y += 16;
                        });
                    }
                }
                if (game.aliens.some(alien => alien.alive && alien.y > 330)) finish.lose('The invaders landed');
                if (game.aliens.every(alien => !alien.alive)) finish.win('Wave cleared');
            },
            draw: function (ctx, game) {
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);
                ctx.fillStyle = '#a7f3d0';
                game.aliens.forEach(function (alien) {
                    if (alien.alive) ctx.fillRect(alien.x, alien.y, alien.w, alien.h);
                });
                if (game.bullet) {
                    ctx.fillStyle = '#f8fafc';
                    ctx.fillRect(game.bullet.x, game.bullet.y, game.bullet.w, game.bullet.h);
                }
                makeCustomCredits(ctx, game.creatorLevel);
            }
        },
        pinball: {
            id: 'pinball',
            title: 'qwertz Pinball',
            summary: 'Use both flippers and launch timing to keep the ball alive and hit writing-practice targets.',
            actions: [
                { id: 'leftFlip', label: 'Links', arrow: '/', pool: 'left' },
                { id: 'rightFlip', label: 'Rechts', arrow: '\\', pool: 'right' },
                { id: 'launch', label: 'Start', arrow: '^', pool: 'up' }
            ],
            usesLevels: true,
            create: function (customLevel) {
                const bumpers = customLevel ? cellRectsFromGrid(customLevel.grid, 14, 14)
                    .filter(rect => rect.y > 60 && rect.y < 300).slice(0, 12)
                    .map(rect => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, r: 13 })) : [
                    { x: 130, y: 120, r: 18 },
                    { x: 280, y: 130, r: 18 },
                    { x: 210, y: 210, r: 20 }
                ];
                return { ball: { x: 355, y: 338, vx: 0, vy: 0, r: 8 }, launched: false, balls: 3, bumpers: bumpers, creatorLevel: customLevel || null };
            },
            update: function (game, dt, keys, finish) {
                const ball = game.ball;
                if (!game.launched) {
                    ball.x = 355;
                    ball.y = 338;
                    if (keys.launch) {
                        game.launched = true;
                        ball.vx = -70;
                        ball.vy = -335;
                    }
                    return;
                }
                ball.vy += 360 * dt;
                ball.x += ball.vx * dt;
                ball.y += ball.vy * dt;
                if (ball.x < ball.r || ball.x > WIDTH - ball.r) ball.vx *= -0.9;
                if (ball.y < ball.r) ball.vy *= -0.9;
                if (keys.leftFlip && ball.x < 210 && ball.y > 330) {
                    ball.vx += 95;
                    ball.vy = -285;
                }
                if (keys.rightFlip && ball.x > 210 && ball.y > 330) {
                    ball.vx -= 95;
                    ball.vy = -285;
                }
                game.bumpers.forEach(function (bumper) {
                    const dx = ball.x - bumper.x;
                    const dy = ball.y - bumper.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < ball.r + bumper.r) {
                        const nx = dx / (dist || 1);
                        const ny = dy / (dist || 1);
                        ball.vx = nx * 230;
                        ball.vy = ny * 230;
                        finish.addScore(15);
                    }
                });
                if (ball.y > HEIGHT + 20) {
                    game.balls -= 1;
                    game.launched = false;
                    ball.vx = 0;
                    ball.vy = 0;
                }
                if (game.balls <= 0) finish.lose('All balls drained');
                if (finish.score >= 250) finish.win('Table cleared');
            },
            draw: function (ctx, game) {
                ctx.fillStyle = '#111827';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 3;
                ctx.strokeRect(28, 22, WIDTH - 56, HEIGHT - 38);
                game.bumpers.forEach(function (bumper) {
                    ctx.fillStyle = '#b54b4b';
                    ctx.beginPath();
                    ctx.arc(bumper.x, bumper.y, bumper.r, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.strokeStyle = '#f8fafc';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(100, 370);
                ctx.lineTo(185, 346);
                ctx.moveTo(320, 370);
                ctx.lineTo(235, 346);
                ctx.stroke();
                ctx.fillStyle = '#e0f2fe';
                ctx.beginPath();
                ctx.arc(game.ball.x, game.ball.y, game.ball.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#e2e8f0';
                ctx.font = '14px system-ui, sans-serif';
                ctx.fillText('Balls: ' + game.balls, 18, HEIGHT - 14);
                makeCustomCredits(ctx, game.creatorLevel);
            }
        },
        mario: {
            id: 'mario',
            title: 'qwertz Plummer',
            summary: 'Run, jump, collect coins, and reach the flag with deliberate three-key typing rhythm.',
            actions: [
                { id: 'left', label: 'Links', arrow: '<', pool: 'left' },
                { id: 'right', label: 'Rechts', arrow: '>', pool: 'right' },
                { id: 'jump', label: 'Sprung', arrow: '^', pool: 'up' }
            ],
            usesLevels: true,
            create: function (customLevel) {
                const customPlatforms = customLevel ? cellRectsFromGrid(customLevel.grid, 14, 14)
                    .filter(rect => rect.y > 110).map(rect => ({ x: rect.x, y: rect.y, w: rect.w, h: rect.h })) : [];
                return {
                    player: { x: 28, y: 326, w: 20, h: 28, vx: 0, vy: 0, ground: false },
                    platforms: [{ x: 0, y: 390, w: WIDTH, h: 30 }, { x: 95, y: 315, w: 80, h: 14 }, { x: 210, y: 260, w: 80, h: 14 }, { x: 318, y: 214, w: 70, h: 14 }].concat(customPlatforms),
                    coins: [{ x: 122, y: 285, r: 7, got: false }, { x: 238, y: 230, r: 7, got: false }, { x: 346, y: 184, r: 7, got: false }],
                    goal: { x: 388, y: 168, w: 16, h: 222 },
                    creatorLevel: customLevel || null
                };
            },
            update: function (game, dt, keys, finish) {
                const player = game.player;
                player.vx = (keys.left ? -145 : 0) + (keys.right ? 145 : 0);
                if (keys.jump && player.ground) {
                    player.vy = -275;
                    player.ground = false;
                }
                player.vy += 620 * dt;
                player.x = clamp(player.x + player.vx * dt, 0, WIDTH - player.w);
                player.y += player.vy * dt;
                player.ground = false;
                game.platforms.forEach(function (platform) {
                    if (intersects(player, platform) && player.vy >= 0 && player.y + player.h - platform.y < 22) {
                        player.y = platform.y - player.h;
                        player.vy = 0;
                        player.ground = true;
                    }
                });
                game.coins.forEach(function (coin) {
                    if (!coin.got && Math.abs(player.x + player.w / 2 - coin.x) < 24 && Math.abs(player.y + player.h / 2 - coin.y) < 28) {
                        coin.got = true;
                        finish.addScore(15);
                    }
                });
                if (intersects(player, game.goal)) finish.win('Flag reached');
                if (player.y > HEIGHT) finish.lose('You fell');
            },
            draw: function (ctx, game) {
                ctx.fillStyle = '#dbeafe';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.fillStyle = '#166534';
                game.platforms.forEach(p => ctx.fillRect(p.x, p.y, p.w, p.h));
                ctx.fillStyle = '#facc15';
                game.coins.forEach(function (coin) {
                    if (coin.got) return;
                    ctx.beginPath();
                    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.fillStyle = '#b91c1c';
                ctx.fillRect(game.goal.x, game.goal.y, game.goal.w, game.goal.h);
                ctx.fillStyle = '#1d4ed8';
                ctx.fillRect(game.player.x, game.player.y, game.player.w, game.player.h);
                makeCustomCredits(ctx, game.creatorLevel);
            }
        },
        qwertzman: {
            id: 'qwertzman',
            title: 'qwertz-man',
            summary: 'Eat dots in a small maze, avoid the ghost, and practice precise four-direction writing control.',
            actions: [
                { id: 'left', label: 'Links', arrow: '<', pool: 'left' },
                { id: 'right', label: 'Rechts', arrow: '>', pool: 'right' },
                { id: 'up', label: 'Hoch', arrow: '^', pool: 'up' },
                { id: 'down', label: 'Runter', arrow: 'v', pool: 'down' }
            ],
            usesLevels: true,
            create: function (customLevel) {
                const walls = customLevel ? cellRectsFromGrid(customLevel.grid, 14, 14)
                    .map(rect => ({ x: rect.x, y: rect.y, w: rect.w, h: rect.h })) : [
                    { x: 80, y: 70, w: 260, h: 16 }, { x: 80, y: 334, w: 260, h: 16 },
                    { x: 80, y: 70, w: 16, h: 116 }, { x: 324, y: 234, w: 16, h: 116 },
                    { x: 150, y: 150, w: 120, h: 18 }, { x: 150, y: 250, w: 120, h: 18 }
                ];
                const dots = [];
                for (let y = 42; y < 380; y += 42) {
                    for (let x = 42; x < 380; x += 42) {
                        const dot = { x: x, y: y, r: 4, got: false };
                        if (!walls.some(wall => circleRect({ x: dot.x, y: dot.y, r: 5 }, wall))) dots.push(dot);
                    }
                }
                return { player: { x: 38, y: 38, r: 10 }, ghost: { x: 360, y: 360, r: 11, vx: -60, vy: -45 }, walls: walls, dots: dots, creatorLevel: customLevel || null };
            },
            update: function (game, dt, keys, finish) {
                const player = game.player;
                const old = { x: player.x, y: player.y };
                player.x += ((keys.left ? -1 : 0) + (keys.right ? 1 : 0)) * 130 * dt;
                player.y += ((keys.up ? -1 : 0) + (keys.down ? 1 : 0)) * 130 * dt;
                player.x = clamp(player.x, player.r, WIDTH - player.r);
                player.y = clamp(player.y, player.r, HEIGHT - player.r);
                if (game.walls.some(wall => circleRect(player, wall))) {
                    player.x = old.x;
                    player.y = old.y;
                }
                const ghost = game.ghost;
                ghost.x += ghost.vx * dt;
                ghost.y += ghost.vy * dt;
                if (ghost.x < ghost.r || ghost.x > WIDTH - ghost.r) ghost.vx *= -1;
                if (ghost.y < ghost.r || ghost.y > HEIGHT - ghost.r) ghost.vy *= -1;
                game.dots.forEach(function (dot) {
                    if (!dot.got && Math.hypot(player.x - dot.x, player.y - dot.y) < 16) {
                        dot.got = true;
                        finish.addScore(3);
                    }
                });
                if (Math.hypot(player.x - ghost.x, player.y - ghost.y) < player.r + ghost.r) finish.lose('Ghost collision');
                if (game.dots.every(dot => dot.got)) finish.win('Maze cleared');
            },
            draw: function (ctx, game) {
                ctx.fillStyle = '#111827';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.fillStyle = '#1d4ed8';
                game.walls.forEach(wall => ctx.fillRect(wall.x, wall.y, wall.w, wall.h));
                ctx.fillStyle = '#facc15';
                game.dots.forEach(function (dot) {
                    if (!dot.got) {
                        ctx.beginPath();
                        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
                        ctx.fill();
                    }
                });
                ctx.fillStyle = '#fde047';
                ctx.beginPath();
                ctx.arc(game.player.x, game.player.y, game.player.r, 0.2, Math.PI * 1.8);
                ctx.lineTo(game.player.x, game.player.y);
                ctx.fill();
                ctx.fillStyle = '#f43f5e';
                ctx.beginPath();
                ctx.arc(game.ghost.x, game.ghost.y, game.ghost.r, 0, Math.PI * 2);
                ctx.fill();
                makeCustomCredits(ctx, game.creatorLevel);
            }
        },
        qwertzoids: {
            id: 'qwertzoids',
            title: 'qwertzoids',
            summary: 'Rotate, thrust, and shoot through asteroids while the keyboard keeps changing under your fingers.',
            actions: [
                { id: 'rotateLeft', label: 'Links drehen', arrow: '<', pool: 'left' },
                { id: 'rotateRight', label: 'Rechts drehen', arrow: '>', pool: 'right' },
                { id: 'thrust', label: 'Schub', arrow: '^', pool: 'up' },
                { id: 'shoot', label: 'Schuss', arrow: '*', pool: 'action' }
            ],
            usesLevels: true,
            create: function (customLevel) {
                const asteroids = customLevel ? cellRectsFromGrid(customLevel.grid, 14, 14)
                    .filter(rect => Math.hypot(rect.x - 210, rect.y - 210) > 70).slice(0, 10)
                    .map(rect => ({ x: rect.x + 15, y: rect.y + 15, r: 17, vx: 35 - rect.x % 70, vy: 25 - rect.y % 50, alive: true })) : [
                    { x: 70, y: 80, r: 25, vx: 36, vy: 22, alive: true },
                    { x: 330, y: 100, r: 22, vx: -32, vy: 28, alive: true },
                    { x: 260, y: 330, r: 28, vx: -22, vy: -25, alive: true }
                ];
                return { ship: { x: 210, y: 210, vx: 0, vy: 0, angle: -Math.PI / 2 }, bullets: [], asteroids: asteroids, creatorLevel: customLevel || null };
            },
            update: function (game, dt, keys, finish) {
                const ship = game.ship;
                if (keys.rotateLeft) ship.angle -= 4 * dt;
                if (keys.rotateRight) ship.angle += 4 * dt;
                if (keys.thrust) {
                    ship.vx += Math.cos(ship.angle) * 150 * dt;
                    ship.vy += Math.sin(ship.angle) * 150 * dt;
                }
                if (keys.shoot && game.bullets.length < 4) {
                    game.bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(ship.angle) * 260, vy: Math.sin(ship.angle) * 260, life: 1.1 });
                }
                ship.x = (ship.x + ship.vx * dt + WIDTH) % WIDTH;
                ship.y = (ship.y + ship.vy * dt + HEIGHT) % HEIGHT;
                ship.vx *= 0.992;
                ship.vy *= 0.992;
                game.bullets.forEach(function (bullet) {
                    bullet.x = (bullet.x + bullet.vx * dt + WIDTH) % WIDTH;
                    bullet.y = (bullet.y + bullet.vy * dt + HEIGHT) % HEIGHT;
                    bullet.life -= dt;
                });
                game.bullets = game.bullets.filter(bullet => bullet.life > 0);
                game.asteroids.forEach(function (asteroid) {
                    if (!asteroid.alive) return;
                    asteroid.x = (asteroid.x + asteroid.vx * dt + WIDTH) % WIDTH;
                    asteroid.y = (asteroid.y + asteroid.vy * dt + HEIGHT) % HEIGHT;
                    if (Math.hypot(ship.x - asteroid.x, ship.y - asteroid.y) < asteroid.r + 12) finish.lose('Ship hit');
                    game.bullets.forEach(function (bullet) {
                        if (asteroid.alive && Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y) < asteroid.r) {
                            asteroid.alive = false;
                            bullet.life = 0;
                            finish.addScore(40);
                        }
                    });
                });
                if (game.asteroids.every(asteroid => !asteroid.alive)) finish.win('Asteroids cleared');
            },
            draw: function (ctx, game) {
                ctx.fillStyle = '#020617';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 2;
                ctx.save();
                ctx.translate(game.ship.x, game.ship.y);
                ctx.rotate(game.ship.angle);
                ctx.beginPath();
                ctx.moveTo(16, 0);
                ctx.lineTo(-12, -10);
                ctx.lineTo(-8, 0);
                ctx.lineTo(-12, 10);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
                ctx.fillStyle = '#e2e8f0';
                game.bullets.forEach(bullet => ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4));
                ctx.strokeStyle = '#94a3b8';
                game.asteroids.forEach(function (asteroid) {
                    if (!asteroid.alive) return;
                    ctx.beginPath();
                    ctx.arc(asteroid.x, asteroid.y, asteroid.r, 0, Math.PI * 2);
                    ctx.stroke();
                });
                makeCustomCredits(ctx, game.creatorLevel);
            }
        },
        frogqwertz: {
            id: 'frogqwertz',
            title: 'frogqwertz',
            summary: 'Hop one tile at a time through traffic and water to train exact directional key choices.',
            actions: [
                { id: 'left', label: 'Links', arrow: '<', pool: 'left' },
                { id: 'right', label: 'Rechts', arrow: '>', pool: 'right' },
                { id: 'up', label: 'Hoch', arrow: '^', pool: 'up' },
                { id: 'down', label: 'Runter', arrow: 'v', pool: 'down' }
            ],
            usesLevels: true,
            create: function (customLevel) {
                const extraHazards = customLevel ? cellRectsFromGrid(customLevel.grid, 14, 14)
                    .filter(rect => rect.y > 90 && rect.y < 330).map(rect => ({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, custom: true })) : [];
                return {
                    frog: { x: 198, y: 380, w: 20, h: 20 },
                    cars: [{ x: 34, y: 300, w: 56, h: 18, vx: 0 }, { x: 316, y: 254, w: 70, h: 18, vx: 0 }, { x: 42, y: 208, w: 48, h: 18, vx: 0 }].concat(extraHazards),
                    logs: [{ x: 0, y: 128, w: WIDTH, h: 20, vx: 0 }, { x: 0, y: 100, w: WIDTH, h: 20, vx: 0 }],
                    creatorLevel: customLevel || null
                };
            },
            onPress: function (game, action) {
                const step = 28;
                if (action === 'left') game.frog.x -= step;
                if (action === 'right') game.frog.x += step;
                if (action === 'up') game.frog.y -= step;
                if (action === 'down') game.frog.y += step;
                game.frog.x = clamp(game.frog.x, 0, WIDTH - game.frog.w);
                game.frog.y = clamp(game.frog.y, 0, HEIGHT - game.frog.h);
            },
            update: function (game, dt, keys, finish) {
                game.cars.forEach(function (car) {
                    if (car.custom) return;
                    car.x += car.vx * dt;
                    if (car.x > WIDTH + 40) car.x = -car.w;
                    if (car.x < -car.w - 40) car.x = WIDTH;
                });
                game.logs.forEach(function (log) {
                    log.x += log.vx * dt;
                    if (log.x > WIDTH + 40) log.x = -log.w;
                    if (log.x < -log.w - 40) log.x = WIDTH;
                });
                if (game.cars.some(car => intersects(game.frog, car))) finish.lose('Traffic hit');
                const inWater = (game.frog.y >= 124 && game.frog.y <= 132) || (game.frog.y >= 96 && game.frog.y <= 104);
                const onLog = game.logs.find(log => intersects(game.frog, log));
                if (inWater && !onLog) finish.lose('Water fall');
                if (onLog) game.frog.x += onLog.vx * dt;
                if (game.frog.y < 36) finish.win('Home reached');
            },
            draw: function (ctx, game) {
                ctx.fillStyle = '#dcfce7';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                ctx.fillStyle = '#bae6fd';
                ctx.fillRect(0, 92, WIDTH, 64);
                ctx.fillStyle = '#475569';
                ctx.fillRect(0, 190, WIDTH, 146);
                ctx.fillStyle = '#854d0e';
                game.logs.forEach(log => ctx.fillRect(log.x, log.y, log.w, log.h));
                ctx.fillStyle = '#ef4444';
                game.cars.forEach(car => ctx.fillRect(car.x, car.y, car.w, car.h));
                ctx.fillStyle = '#16a34a';
                ctx.fillRect(game.frog.x, game.frog.y, game.frog.w, game.frog.h);
                ctx.fillStyle = '#14532d';
                ctx.fillRect(0, 0, WIDTH, 36);
                makeCustomCredits(ctx, game.creatorLevel);
            }
        }
    };

    function QwertzArcade(config) {
        this.config = config;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.scoreEl = document.getElementById('score');
        this.kpmEl = document.getElementById('kpm');
        this.statusEl = document.getElementById('gameStatus');
        this.overlay = document.getElementById('gameOverlay');
        this.overlayTitle = document.getElementById('overlayTitle');
        this.overlayMessage = document.getElementById('overlayMessage');
        this.overlayStats = document.getElementById('overlayStats');
        this.restartButton = document.getElementById('restartButton');
        this.levelDesigner = document.getElementById('levelDesigner');
        this.levelGrid = document.getElementById('levelGrid');
        this.levelName = document.getElementById('levelName');
        this.creatorName = document.getElementById('creatorName');
        this.testLevelButton = document.getElementById('testLevelButton');
        this.publishLevelButton = document.getElementById('publishLevelButton');
        this.savedLevels = document.getElementById('savedLevels');
        this.keyboardEl = document.getElementById('virtualKeyboard');
        this.controlsEl = document.getElementById('directionInfo');
        this.keyChangeModal = document.getElementById('keyChangeModal');
        this.keyChangeDirection = document.getElementById('keyChangeDirection');
        this.keyChangeFingerName = document.getElementById('keyChangeFingerName');
        this.keysDown = {};
        this.keyElements = {};
        this.controlKeys = makeControlKeys(config.actions);
        this.counters = {};
        this.keyIndexes = {};
        this.finished = false;
        this.running = false;
        this.pendingConfirmation = null;
        this.keyChangeStartedAt = null;
        this.customGrid = Array(14 * 14).fill(false);
        this.activeCustomLevel = null;
        this.resetSession();
    }

    QwertzArcade.prototype.resetSession = function () {
        this.state = {
            score: 0,
            totalKeystrokes: 0,
            startedAt: 0,
            fingersUsed: {
                'finger-pinky': 0,
                'finger-ring': 0,
                'finger-middle': 0,
                'finger-index': 0
            }
        };
        this.config.actions.forEach(action => {
            this.counters[action.id] = 0;
            this.keyIndexes[action.id] = this.keyIndexes[action.id] || 0;
        });
    };

    QwertzArcade.prototype.renderControls = function () {
        this.controlsEl.innerHTML = this.config.actions.map(action => (
            '<div class="direction-item">' +
            '<span class="direction-arrow">' + action.arrow + '</span>' +
            '<span class="direction-label">' + action.label + '</span>' +
            '<span class="direction-counter" id="counter-' + action.id + '">0/' + PRESSES_PER_CHANGE + '</span>' +
            '</div>'
        )).join('');
    };

    QwertzArcade.prototype.renderKeyboard = function () {
        this.keyboardEl.innerHTML = '';
        this.keyElements = {};
        KEYBOARD_ROWS.forEach((row, rowIndex) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'keyboard-row' + (rowIndex === 0 ? ' keyboard-row-top' : '');
            row.forEach(key => {
                const keyEl = document.createElement('div');
                keyEl.className = key === ' ' ? 'keyboard-key keyboard-space' : 'keyboard-key ' + (FINGER_MAP[key] || '');
                keyEl.textContent = key === ' ' ? 'SPACE' : displayKey(key);
                keyEl.dataset.key = key;
                this.keyElements[key] = keyEl;
                rowEl.appendChild(keyEl);
            });
            this.keyboardEl.appendChild(rowEl);
        });
        this.updateKeyboard();
    };

    QwertzArcade.prototype.updateKeyboard = function () {
        Object.keys(this.keyElements).forEach(key => {
            this.keyElements[key].classList.remove('active-control', 'active');
            this.keyElements[key].removeAttribute('data-arrow');
        });
        this.config.actions.forEach(action => {
            const key = this.controlKeys[action.id];
            const keyEl = this.keyElements[key];
            if (!keyEl) return;
            keyEl.classList.add('active-control');
            keyEl.dataset.arrow = action.arrow;
        });
    };

    QwertzArcade.prototype.updateCounters = function () {
        this.config.actions.forEach(action => {
            const el = document.getElementById('counter-' + action.id);
            if (el) el.textContent = this.counters[action.id] + '/' + PRESSES_PER_CHANGE;
        });
    };

    QwertzArcade.prototype.showOverlay = function (title, message, showDesigner) {
        this.overlayTitle.textContent = title;
        this.overlayMessage.textContent = message;
        this.overlayStats.innerHTML = '<div class="overlay-stat-item">Punkte: ' + this.state.score + '</div>';
        this.levelDesigner.style.display = showDesigner ? 'block' : 'none';
        this.overlay.classList.remove('hidden');
        this.renderSavedLevels();
    };

    QwertzArcade.prototype.hideOverlay = function () {
        this.overlay.classList.add('hidden');
    };

    QwertzArcade.prototype.start = function (customLevel) {
        if (this.pendingConfirmation) return;
        if (this.frame) cancelAnimationFrame(this.frame);
        this.keysDown = {};
        this.resetSession();
        this.activeCustomLevel = customLevel || null;
        this.game = this.config.create(customLevel || null);
        this.running = true;
        this.finished = false;
        this.state.startedAt = Date.now();
        this.lastFrame = performance.now();
        this.hideOverlay();
        this.updateCounters();
        this.updateKeyboard();
        this.frame = requestAnimationFrame(this.loop.bind(this));
    };

    QwertzArcade.prototype.finish = function (won, message) {
        if (this.finished) return;
        this.finished = true;
        this.running = false;
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = null;
        saveArcadeStatistics(this.config, this.state);
        this.showOverlay(won ? 'Geschafft' : 'Game Over', message, won && this.config.usesLevels);
    };

    QwertzArcade.prototype.loop = function (now) {
        if (!this.running || this.finished || this.pendingConfirmation) return;
        const dt = Math.min(0.032, (now - this.lastFrame) / 1000 || 0.016);
        this.lastFrame = now;
        const finish = {
            score: this.state.score,
            addScore: points => {
                this.state.score += points;
                finish.score = this.state.score;
            },
            win: message => this.finish(true, message),
            lose: message => this.finish(false, message)
        };
        this.config.update(this.game, dt, this.keysDown, finish);
        this.draw();
        this.scoreEl.textContent = this.state.score;
        const minutes = Math.max(0.01, (Date.now() - this.state.startedAt) / 60000);
        this.kpmEl.textContent = Math.round(this.state.totalKeystrokes / minutes);
        if (this.running && !this.finished && !this.pendingConfirmation) {
            this.frame = requestAnimationFrame(this.loop.bind(this));
        }
    };

    QwertzArcade.prototype.draw = function () {
        this.config.draw(this.ctx, this.game);
    };

    QwertzArcade.prototype.actionForKey = function (key) {
        return this.config.actions.find(action => this.controlKeys[action.id] === key);
    };

    QwertzArcade.prototype.recordPress = function (action, key) {
        this.state.totalKeystrokes += 1;
        const finger = FINGER_MAP[key];
        if (finger && this.state.fingersUsed[finger] != null) this.state.fingersUsed[finger] += 1;
        this.counters[action.id] += 1;
        if (this.config.onPress) this.config.onPress(this.game, action.id);
        if (this.counters[action.id] >= PRESSES_PER_CHANGE) {
            const used = new Set(Object.values(this.controlKeys));
            used.delete(this.controlKeys[action.id]);
            const nextKey = nextKeyFor(action, this.controlKeys[action.id], used, this.keyIndexes[action.id]);
            this.keyIndexes[action.id] += 1;
            this.controlKeys[action.id] = nextKey;
            this.counters[action.id] = 0;
            this.showKeyChange(action, nextKey);
        }
        this.updateCounters();
        this.updateKeyboard();
    };

    QwertzArcade.prototype.showKeyChange = function (action, key) {
        if (!this.pendingConfirmation) this.keyChangeStartedAt = Date.now();
        this.pendingConfirmation = key;
        this.keysDown = {};
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.keyChangeDirection.textContent = action.label + ': ' + displayKey(key);
        this.keyChangeFingerName.textContent = FINGER_NAMES[FINGER_MAP[key]] || 'Finger';
        this.keyChangeModal.classList.add('visible');
    };

    QwertzArcade.prototype.handleKeyDown = function (event) {
        const key = event.key === ' ' ? ' ' : event.key.toLowerCase();
        if (this.pendingConfirmation) {
            if (!event.repeat && key === this.pendingConfirmation) {
                if (this.running && this.keyChangeStartedAt !== null) {
                    this.state.startedAt += Date.now() - this.keyChangeStartedAt;
                }
                this.pendingConfirmation = null;
                this.keyChangeStartedAt = null;
                this.keyChangeModal.classList.remove('visible');
                this.lastFrame = performance.now();
                if (this.running && !this.finished) {
                    this.frame = requestAnimationFrame(this.loop.bind(this));
                }
            }
            event.preventDefault();
            return;
        }
        if (key === ' ' && !this.running) {
            this.start(this.activeCustomLevel);
            event.preventDefault();
            return;
        }
        const action = this.actionForKey(key);
        if (!action) return;
        event.preventDefault();
        if (!this.running) this.start(this.activeCustomLevel);
        this.keysDown[action.id] = true;
        if (this.keyElements[key]) this.keyElements[key].classList.add('active');
        if (!event.repeat) this.recordPress(action, key);
    };

    QwertzArcade.prototype.handleKeyUp = function (event) {
        const key = event.key === ' ' ? ' ' : event.key.toLowerCase();
        const action = this.actionForKey(key);
        if (action) this.keysDown[action.id] = false;
        if (this.keyElements[key]) this.keyElements[key].classList.remove('active');
    };

    QwertzArcade.prototype.renderDesigner = function () {
        if (!this.config.usesLevels) return;
        this.levelGrid.innerHTML = '';
        this.customGrid.forEach((active, index) => {
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'designer-cell' + (active ? ' active' : '');
            cell.setAttribute('aria-label', 'Level tile');
            cell.addEventListener('click', () => {
                this.customGrid[index] = !this.customGrid[index];
                cell.classList.toggle('active', this.customGrid[index]);
            });
            this.levelGrid.appendChild(cell);
        });
    };

    QwertzArcade.prototype.makeLevelFromDesigner = function () {
        return {
            id: Date.now(),
            name: safeText(this.levelName.value, 'Custom level'),
            creator: safeText(this.creatorName.value || localStorage.getItem('qwertz_arcade_name'), 'Anonymous'),
            grid: this.customGrid.slice()
        };
    };

    QwertzArcade.prototype.renderSavedLevels = function () {
        if (!this.config.usesLevels || !this.savedLevels) return;
        const levels = loadCustomLevels(this.config.id);
        if (!levels.length) {
            this.savedLevels.innerHTML = '<p class="arcade-muted">Noch keine eigenen Levels.</p>';
            return;
        }
        this.savedLevels.innerHTML = levels.map(level => (
            '<button type="button" class="custom-level-start" data-id="' + level.id + '">' +
            safeText(level.name, 'Custom level') + '<span>von ' + safeText(level.creator, 'Anonymous') + '</span></button>'
        )).join('');
        this.savedLevels.querySelectorAll('.custom-level-start').forEach(button => {
            button.addEventListener('click', () => {
                const level = levels.find(item => String(item.id) === button.dataset.id);
                this.start(level);
            });
        });
    };

    QwertzArcade.prototype.bind = function () {
        this.restartButton.addEventListener('click', () => this.start(this.activeCustomLevel));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
        if (this.config.usesLevels) {
            this.testLevelButton.addEventListener('click', () => this.start(this.makeLevelFromDesigner()));
            this.publishLevelButton.addEventListener('click', () => {
                const levels = loadCustomLevels(this.config.id);
                const level = this.makeLevelFromDesigner();
                levels.push(level);
                persistCustomLevels(this.config.id, levels);
                this.renderSavedLevels();
                this.statusEl.textContent = 'Level published with creator credit for ' + level.creator + '.';
            });
        }
    };

    QwertzArcade.prototype.init = function () {
        document.getElementById('gameTitle').textContent = this.config.title;
        document.getElementById('gameSummary').textContent = this.config.summary;
        this.canvas.width = WIDTH;
        this.canvas.height = HEIGHT;
        this.renderControls();
        this.renderKeyboard();
        this.renderDesigner();
        this.bind();
        this.game = this.config.create(null);
        this.draw();
        this.showOverlay(this.config.title, 'Drücke eine Steuerungstaste oder SPACE zum Starten.', false);
    };

    function init() {
        const gameId = document.body.dataset.game;
        const config = GAMES[gameId];
        if (!config) return;
        const arcade = new QwertzArcade(config);
        arcade.init();
        window.qwertzArcade = arcade;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            GAMES: GAMES,
            makeControlKeys: makeControlKeys,
            nextKeyFor: nextKeyFor,
            cellRectsFromGrid: cellRectsFromGrid
        };
    }

    if (typeof window !== 'undefined') {
        window.QwertzArcadeGames = GAMES;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }
})();

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Tetris = require('./learning-tetris');

function piece(shape = [[1, 1], [1, 1]], x = 4, y = 0) {
    return { type: 'O', shape: shape.map(row => row.slice()), color: '#facc15', x, y, rotation: 0 };
}

function round() {
    const game = Tetris.create(null);
    const scores = [];
    const losses = [];
    const finish = {
        score: 0,
        addScore(points) { scores.push(points); this.score += points; },
        lose(message) { losses.push(message); },
        win() { assert.fail('Tetris never bypasses the lesson goal with an independent win'); }
    };
    return { game, scores, losses, finish,
        update(dt = 0, keys = {}) { Tetris.update(game, dt, keys, finish); },
        press(action, keys = {}) { Tetris.onPress(game, action); Tetris.update(game, 0, keys, finish); }
    };
}

test('qwertzris exports a four-control game with a 10 by 20 board and seven four-cell pieces', () => {
    assert.equal(Tetris.id, 'tetris');
    assert.equal(Tetris.title, 'qwertzris');
    assert.deepEqual(Tetris.actions.map(action => action.id), ['left', 'right', 'down', 'rotate']);
    const r = round();
    assert.equal(r.game.board.length, 20);
    r.game.board.forEach(row => assert.deepEqual(row, Array(10).fill(0)));
    assert.notEqual(r.game.board[0], r.game.board[1]);
    const types = new Set();
    for (let i = 0; i < 7; i++) {
        const current = r.game.currentPiece;
        types.add(current.type);
        assert.equal(current.shape.flat().filter(Boolean).length, 4);
        assert.ok(current.x >= 0 && current.x + current.shape[0].length <= 10);
        r.game.board.forEach(row => row.fill(0));
        current.y = 20 - current.shape.length;
        r.press('down');
    }
    assert.deepEqual([...types].sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
    assert.equal(r.game.lost, false);
});

test('browser export is isolated and does not initialize the standalone game or listeners', () => {
    const window = {};
    vm.runInNewContext(fs.readFileSync(require.resolve('./learning-tetris'), 'utf8'), { window });
    assert.equal(window.QwertzLearningTetris.id, 'tetris');
    assert.equal(typeof window.QwertzLearningTetris.create, 'function');
    assert.equal(window.qwertzArcade, undefined);
});

test('fresh presses queue movement and scoring until update; rotation never repeats from a held key', () => {
    const r = round();
    r.game.currentPiece = piece([[0, 1, 0], [1, 1, 1]], 3, 0);
    const original = r.game.currentPiece.shape.map(row => row.slice());
    Tetris.onPress(r.game, 'rotate');
    Tetris.onPress(r.game, 'down');
    assert.deepEqual(r.game.currentPiece.shape, original);
    assert.equal(r.game.currentPiece.y, 0);
    assert.equal(r.finish.score, 0);
    r.update(0, { rotate: true, down: true });
    assert.equal(r.game.currentPiece.rotation, 1);
    assert.equal(r.game.currentPiece.y, 1);
    assert.deepEqual(r.scores, [1]);
    r.update(0.1, { rotate: true });
    r.update(0.1, { rotate: true });
    assert.equal(r.game.currentPiece.rotation, 1);
    r.press('rotate');
    assert.equal(r.game.currentPiece.rotation, 2);
});

test('four legal clockwise turns restore the original piece shape', () => {
    const r = round();
    r.game.currentPiece = piece([[0, 1, 0], [1, 1, 1]], 3, 3);
    const original = r.game.currentPiece.shape.map(row => row.slice());
    for (let i = 0; i < 4; i++) r.press('rotate');
    assert.deepEqual(r.game.currentPiece.shape, original);
    assert.equal(r.game.currentPiece.rotation, 0);
    assert.equal(r.finish.score, 0);
});

test('movement respects side walls and placed blocks', () => {
    const r = round();
    r.game.currentPiece = piece();
    for (let i = 0; i < 20; i++) r.press('left');
    assert.equal(r.game.currentPiece.x, 0);
    for (let i = 0; i < 20; i++) r.press('right');
    assert.equal(r.game.currentPiece.x, 8);
    r.game.currentPiece.x = 4;
    r.game.board[0][3] = '#fb7185';
    r.press('left');
    assert.equal(r.game.currentPiece.x, 4);
    assert.equal(r.finish.score, 0);
});

test('rotation refuses wall, floor, and occupied-cell collisions', () => {
    const r = round();
    const vertical = [[1], [1], [1], [1]];
    r.game.currentPiece = piece(vertical, 9, 0);
    r.press('rotate');
    assert.deepEqual(r.game.currentPiece.shape, vertical);
    r.game.currentPiece = piece([[1, 1, 1, 1]], 3, 19);
    r.press('rotate');
    assert.deepEqual(r.game.currentPiece.shape, [[1, 1, 1, 1]]);
    r.game.currentPiece = piece(vertical, 3, 0);
    r.game.board[0][4] = '#fb7185';
    r.press('rotate');
    assert.deepEqual(r.game.currentPiece.shape, vertical);
});

test('held movement repeats after a short delay and releasing stops lateral motion', () => {
    const r = round();
    r.game.currentPiece = piece();
    r.update(0.016, { right: true });
    assert.equal(r.game.currentPiece.x, 5);
    r.update(0.1, { right: true });
    assert.equal(r.game.currentPiece.x, 5);
    r.update(0.11, { right: true });
    assert.equal(r.game.currentPiece.x, 6);
    r.update(0.1);
    assert.equal(r.game.currentPiece.x, 6);
    r.update(0.016, { left: true });
    assert.equal(r.game.currentPiece.x, 5);
});

test('held soft drop awards one point for each traversed cell; natural gravity awards none', () => {
    const r = round();
    r.game.currentPiece = piece();
    r.press('down', { down: true });
    assert.equal(r.game.currentPiece.y, 1);
    assert.equal(r.finish.score, 1);
    r.update(0.06, { down: true });
    assert.equal(r.game.currentPiece.y, 1);
    r.update(0.03, { down: true });
    assert.equal(r.game.currentPiece.y, 2);
    assert.equal(r.finish.score, 2);
    r.game.gravityTimer = 0;
    r.update(0.5);
    r.update(0.5);
    assert.equal(r.game.currentPiece.y, 3);
    assert.equal(r.finish.score, 2);
});

test('a blocked soft drop locks above the stack, spawns the next piece, and awards no movement point', () => {
    const r = round();
    const locked = piece(undefined, 4, 16);
    r.game.currentPiece = locked;
    const next = r.game.nextPiece;
    r.game.board[18][4] = '#fb7185';
    r.press('down');
    assert.equal(r.game.board[16][4], locked.color);
    assert.equal(r.game.board[17][5], locked.color);
    assert.equal(r.game.board[18][4], '#fb7185');
    assert.equal(r.game.currentPiece, next);
    assert.equal(r.game.currentPiece.y, 0);
    assert.equal(r.finish.score, 0);
    assert.equal(r.game.lost, false);
});

test('a full row scores 100 points and rows above it descend without changing board dimensions', () => {
    const r = round();
    r.game.board[19].fill('#60a5fa');
    r.game.board[19][9] = 0;
    r.game.board[17][0] = '#4ade80';
    r.game.currentPiece = piece([[1]], 9, 19);
    Tetris.onPress(r.game, 'down');
    assert.equal(r.finish.score, 0);
    r.update();
    assert.deepEqual(r.scores, [100]);
    assert.equal(r.game.lines, 1);
    assert.equal(r.game.board[18][0], '#4ade80');
    assert.deepEqual(r.game.board[0], Array(10).fill(0));
    assert.equal(r.game.board.length, 20);
    r.game.board.forEach(row => assert.equal(row.length, 10));
});

test('two simultaneous full rows each score 100 points and are both removed', () => {
    const r = round();
    for (const row of [18, 19]) {
        r.game.board[row].fill('#60a5fa');
        r.game.board[row][4] = 0;
        r.game.board[row][5] = 0;
    }
    r.game.currentPiece = piece(undefined, 4, 18);
    r.press('down');
    assert.deepEqual(r.scores, [200]);
    assert.equal(r.game.lines, 2);
    assert.ok(r.game.board.every(row => row.every(cell => cell === 0)));
});

test('spawn collision loses once and further queued or held actions cannot score', () => {
    const r = round();
    r.game.currentPiece = piece([[1]], 0, 19);
    r.game.nextPiece = piece(undefined, 4, 0);
    r.game.board[0][4] = '#fb7185';
    r.press('down');
    assert.equal(r.game.lost, true);
    assert.equal(r.losses.length, 1);
    assert.match(r.losses[0], /voll/);
    r.press('down');
    r.update(1, { down: true });
    assert.equal(r.finish.score, 0);
    assert.equal(r.losses.length, 1);
});

test('locking a piece above the top loses without writing outside the board', () => {
    const r = round();
    r.game.currentPiece = piece(undefined, 4, -1);
    r.game.board[1][4] = '#fb7185';
    r.press('down');
    assert.equal(r.game.lost, true);
    assert.equal(r.losses.length, 1);
    assert.equal(r.game.board[-1], undefined);
    assert.equal(r.game.board[0][4], 0);
});

test('unassigned hard-drop commands have no effect and input cleanup discards queued presses', () => {
    const r = round();
    r.game.currentPiece = piece();
    Tetris.onPress(r.game, 'hardDrop');
    r.update(0, { hardDrop: true });
    assert.equal(r.game.currentPiece.y, 0);
    assert.equal(r.finish.score, 0);
    Tetris.onPress(r.game, 'down');
    Tetris.onPress(r.game, 'rotate');
    Tetris.clearInputs(r.game);
    r.update();
    assert.equal(r.game.currentPiece.y, 0);
    assert.equal(r.game.currentPiece.rotation, 0);
    assert.equal(r.finish.score, 0);
    assert.deepEqual(r.game.pending, []);
});

test('all board, next-piece, and ghost cells fit the 420 by 420 learning canvas', () => {
    const r = round();
    r.game.currentPiece = piece(undefined, 4, 0);
    r.game.board[19][0] = '#4ade80';
    const rectangles = [];
    const text = [];
    const context = {
        fillRect(...values) { rectangles.push(values); },
        fillText(...values) { text.push(values); },
        beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}
    };
    Tetris.draw(context, r.game);
    assert.deepEqual(rectangles[0], [0, 0, 420, 420]);
    assert.ok(rectangles.length >= 14, 'board, piece, ghost and preview are drawn');
    rectangles.forEach(([x, y, width, height]) => {
        assert.ok(x >= 0 && y >= 0 && x + width <= 420 && y + height <= 420);
    });
    assert.ok(text.some(values => values[0] === 'Nächster'));
    assert.ok(text.some(values => values[0] === 'Reihen: 0'));
    assert.equal(r.finish.score, 0);
});

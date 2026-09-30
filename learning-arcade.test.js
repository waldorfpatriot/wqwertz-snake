const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Arcade = require('./learning-arcade');
const GAMES = { ...require('./arcade-shared').GAMES, tetris: require('./learning-tetris') };
const { LESSONS } = require('./learning-engine');

function harness(callbacks = {}) {
    let nextId = 1;
    let time = 0;
    const frames = new Map();
    const scheduled = [];
    const drawing = [];
    const context = {};
    ['save', 'restore', 'clearRect', 'scale', 'fillRect', 'strokeRect', 'beginPath', 'arc', 'fill', 'stroke', 'fillText', 'moveTo', 'lineTo', 'closePath', 'translate', 'rotate'].forEach(method => {
        context[method] = (...args) => drawing.push([method, ...args]);
    });
    const canvas = { width: 630, height: 210, getContext: () => context };
    const changes = [];
    const completions = [];
    const runtime = Arcade.mount({
        canvas,
        requestFrame(callback) {
            const id = nextId++;
            frames.set(id, callback);
            scheduled.push(callback);
            return id;
        },
        cancelFrame(id) { frames.delete(id); },
        onChange(state) { changes.push(state); if (callbacks.onChange) callbacks.onChange(state); },
        onComplete(state) { completions.push(state); if (callbacks.onComplete) callbacks.onComplete(state); }
    });
    function advance(milliseconds = 16) {
        const next = frames.entries().next().value;
        assert.ok(next, 'a playing round has a scheduled frame');
        frames.delete(next[0]);
        time += milliseconds;
        next[1](time);
    }
    return { runtime, frames, scheduled, changes, completions, drawing, advance };
}

function key(key, overrides = {}) {
    return { key, prevented: false, preventDefault() { this.prevented = true; }, ...overrides };
}

function withGame(id, overrides, run) {
    const config = GAMES[id];
    const originals = Object.fromEntries(Object.keys(overrides).map(name => [name, config[name]]));
    Object.assign(config, overrides);
    try { run(); } finally { Object.assign(config, originals); }
}

function withActualGame(id, run) {
    const create = GAMES[id].create;
    const created = [];
    withGame(id, { create(...args) {
        const game = create.apply(this, args);
        created.push(game);
        return game;
    } }, () => run(() => created[created.length - 1]));
}

test('every third lesson gets the rotating arcade game with unique learned controls', () => {
    const expected = ['breakout', 'tetris', 'qwertzman', 'breakout', 'tetris', 'qwertzman'];
    LESSONS.forEach(lesson => {
        const challenge = Arcade.getChallenge(lesson);
        if (lesson.number % 3) return assert.equal(challenge, null);
        assert.equal(challenge.gameId, expected[lesson.number / 3 - 1]);
        assert.equal(challenge.lessonId, lesson.id);
        assert.equal(challenge.number, lesson.number);
        assert.equal(challenge.target, ['breakout', 'tetris'].includes(challenge.gameId) ? 100 : 10);
        assert.equal(['mario', 'pinball', 'invaders', 'qwertzoids'].includes(challenge.gameId), false);
        assert.equal(challenge.controls[challenge.actions[0].id], 'f');
        assert.equal(challenge.controls[challenge.actions[1].id], 'j');
        const assigned = Object.values(challenge.controls);
        assert.equal(new Set(assigned).size, challenge.actions.length);
        assigned.forEach(assignedKey => assert.ok(lesson.taughtKeys.includes(assignedKey)));
        assert.ok(challenge.instructions.includes(challenge.target + ' Punkte'));
    });
    assert.equal(Arcade.getChallenge(null), null);
    assert.equal(Arcade.getChallenge({ number: 0 }), null);
});

test('up and down controls fall back to distinct taught keys when those rows are not taught', () => {
    const challenge = Arcade.getChallenge({ id: 'home-only', number: 9, taughtKeys: ['f', 'j', 'd', 'k'] });
    assert.deepEqual(challenge.controls, { left: 'f', right: 'j', up: 'd', down: 'k' });
    const tetris = Arcade.getChallenge({ id: 'no-space', number: 6, taughtKeys: ['f', 'j', 'd', 'k'] });
    assert.deepEqual(tetris.controls, { left: 'f', right: 'j', down: 'd', rotate: 'k' });
    assert.equal(Arcade.getChallenge(LESSONS[5]).controls.rotate, ' ');
    assert.equal(Arcade.getChallenge(LESSONS[14]).controls.rotate, ' ');
});

test('browser script exports the existing games without mounting arcade on the learning page', () => {
    const listeners = [];
    const window = {};
    const document = { readyState: 'loading', body: { dataset: {} }, addEventListener(name, handler) { listeners.push([name, handler]); } };
    vm.runInNewContext(fs.readFileSync(require.resolve('./arcade-shared'), 'utf8'), { window, document });
    assert.ok(window.QwertzArcadeGames.breakout);
    listeners.forEach(([, handler]) => handler());
    assert.equal(window.qwertzArcade, undefined);
    vm.runInNewContext(fs.readFileSync(require.resolve('./learning-tetris'), 'utf8'), { window });
    vm.runInNewContext(fs.readFileSync(require.resolve('./learning-arcade'), 'utf8'), { window });
    assert.equal(typeof window.QwertzLearningArcade.mount, 'function');
});

test('a ready round starts only from Play or a learned assigned control', () => {
    const h = harness();
    h.runtime.start(LESSONS[2]);
    assert.equal(h.runtime.getState().status, 'ready');
    assert.equal(h.frames.size, 0);
    [' ', 'Enter', 'ArrowLeft', 'q', 'Backspace'].forEach(value => {
        const event = key(value);
        assert.equal(h.runtime.handleKey(event), false);
        assert.equal(event.prevented, false);
    });
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing']) {
        assert.equal(h.runtime.handleKey(key('f', { [modifier]: true })), false);
    }
    h.runtime.handleKey(key('f', { repeat: true }));
    assert.equal(h.runtime.getState().status, 'ready');
    const event = key('F');
    assert.equal(h.runtime.handleKey(event), true);
    assert.equal(event.prevented, true);
    assert.equal(h.runtime.getState().status, 'playing');
    assert.equal(h.frames.size, 1);
    assert.equal(h.runtime.play(), false);
    assert.equal(h.frames.size, 1);
    h.runtime.destroy();
});

test('held controls move the actual game until released; repeats never invoke onPress again', () => {
    let presses = 0;
    withGame('breakout', { onPress() { presses++; } }, () => withActualGame('breakout', currentGame => {
        const h = harness();
        h.runtime.start(LESSONS[2]);
        const initialX = currentGame().paddle.x;
        h.runtime.handleKey(key('f'));
        h.runtime.handleKey(key('f', { repeat: true }));
        h.advance();
        assert.ok(currentGame().paddle.x < initialX);
        assert.equal(presses, 1);
        h.runtime.handleKeyUp(key('F', { ctrlKey: true }));
        const releasedX = currentGame().paddle.x;
        h.advance();
        assert.equal(currentGame().paddle.x, releasedX);
        assert.equal(h.runtime.handleKeyUp(key('q')), false);
        h.runtime.destroy();
    }));
});

test('pause clears held controls, stops frames, and requires an explicit resume', () => {
    withActualGame('breakout', currentGame => {
        const h = harness();
        h.runtime.start(LESSONS[2]);
        h.runtime.handleKey(key('j'));
        h.advance();
        const stale = h.scheduled[h.scheduled.length - 1];
        h.runtime.pause(true);
        assert.equal(h.runtime.getState().status, 'paused');
        assert.equal(h.frames.size, 0);
        assert.equal(h.runtime.handleKey(key('j')), false);
        const pausedX = currentGame().paddle.x;
        stale(1000);
        assert.equal(currentGame().paddle.x, pausedX);
        h.runtime.pause(false);
        assert.equal(h.runtime.getState().status, 'playing');
        h.advance();
        assert.equal(currentGame().paddle.x, pausedX);
        h.runtime.pause();
        assert.equal(h.runtime.getState().status, 'paused');
        h.runtime.destroy();
    });
});

test('score is capped at its game target and completion wins over a later loss or win in the same frame', () => {
    [LESSONS[2], LESSONS[5], LESSONS[8]].forEach(lesson => {
        const challenge = Arcade.getChallenge(lesson);
        withGame(challenge.gameId, { update(game, dt, held, finish) {
            finish.addScore(-4);
            finish.addScore(NaN);
            finish.addScore(Infinity);
            finish.addScore(0);
            assert.equal(finish.score, 0);
            finish.addScore(challenge.target + 15);
            assert.equal(finish.score, challenge.target);
            finish.lose('late collision');
            finish.win('late win');
        } }, () => {
            const h = harness();
            h.runtime.start(lesson);
            h.runtime.play();
            const stale = h.scheduled[0];
            h.advance();
            assert.equal(h.runtime.getState().score, challenge.target);
            assert.equal(h.runtime.getState().status, 'complete');
            assert.equal(h.runtime.getState().message, challenge.target + ' Punkte geschafft!');
            assert.equal(h.frames.size, 0);
            assert.equal(h.completions.length, 1);
            assert.equal(h.completions[0].status, 'complete');
            assert.equal(h.completions[0].challenge.lessonId, lesson.id);
            stale(1000);
            h.runtime.handleKey(key('f'));
            h.runtime.play();
            assert.equal(h.completions.length, 1);
            assert.equal(h.frames.size, 0);
            h.runtime.destroy();
        });
    });
});

test('clearing a level below ten continues playing with a new level and retained score', () => {
    withGame('qwertzman', { update(game, dt, held, finish) {
        finish.addScore(3);
        finish.win('tiny level');
    } }, () => withActualGame('qwertzman', currentGame => {
        const h = harness();
        h.runtime.start(LESSONS[8]);
        const firstGame = currentGame();
        const controls = h.runtime.getState().challenge.controls;
        h.runtime.play();
        h.advance();
        assert.notEqual(currentGame(), firstGame);
        assert.equal(h.runtime.getState().score, 3);
        assert.equal(h.runtime.getState().status, 'playing');
        assert.equal(h.completions.length, 0);
        h.advance();
        h.advance();
        assert.equal(h.runtime.getState().score, 9);
        assert.equal(h.runtime.getState().challenge.controls, controls);
        h.advance();
        assert.equal(h.runtime.getState().status, 'complete');
        assert.equal(h.runtime.getState().score, 10);
        assert.equal(h.completions.length, 1);
        h.runtime.destroy();
    }));
});

test('a loss below ten permits a clean retry while retaining its learned mapping', () => {
    withGame('breakout', { update(game, dt, held, finish) {
        finish.addScore(3);
        finish.lose('missed ball');
    } }, () => {
        const h = harness();
        h.runtime.start(LESSONS[2]);
        const controls = h.runtime.getState().challenge.controls;
        h.runtime.play();
        h.advance();
        assert.equal(h.runtime.getState().score, 3);
        assert.equal(h.runtime.getState().status, 'lost');
        assert.equal(h.frames.size, 0);
        assert.equal(h.completions.length, 0);
        h.runtime.restart();
        assert.equal(h.runtime.getState().status, 'ready');
        assert.equal(h.runtime.getState().score, 0);
        assert.equal(h.runtime.getState().challenge.controls, controls);
        h.runtime.handleKey(key('j'));
        assert.equal(h.runtime.getState().status, 'playing');
        h.runtime.destroy();
    });
});

test('cancel, switching lessons, and destroy prevent stale callbacks from affecting another round', () => {
    const h = harness();
    h.runtime.start(LESSONS[2]);
    h.runtime.play();
    const firstFrame = h.scheduled[0];
    h.runtime.cancel();
    assert.equal(h.runtime.getState().challenge, null);
    assert.equal(h.frames.size, 0);
    firstFrame(1000);
    assert.equal(h.frames.size, 0);
    h.runtime.start(LESSONS[5]);
    h.runtime.play();
    const newFrame = h.scheduled[1];
    firstFrame(2000);
    assert.equal(h.runtime.getState().challenge.gameId, 'tetris');
    assert.equal(h.runtime.getState().score, 0);
    assert.equal(h.frames.size, 1);
    h.runtime.destroy();
    const changeCount = h.changes.length;
    newFrame(3000);
    h.runtime.start(LESSONS[8]);
    assert.equal(h.changes.length, changeCount);
    assert.equal(h.runtime.play(), false);
    assert.equal(h.frames.size, 0);
});

test('drawing uses the real game renderer scaled from 420 and never emits state changes', () => {
    const h = harness();
    h.runtime.start(LESSONS[2]);
    const changeCount = h.changes.length;
    h.drawing.length = 0;
    h.runtime.draw();
    assert.deepEqual(h.drawing[0], ['save']);
    assert.deepEqual(h.drawing[1], ['clearRect', 0, 0, 630, 210]);
    assert.deepEqual(h.drawing[2], ['scale', 1.5, 0.5]);
    assert.ok(h.drawing.some(call => call[0] === 'fillRect' && call[3] === 420 && call[4] === 420));
    assert.deepEqual(h.drawing[h.drawing.length - 1], ['restore']);
    assert.equal(h.changes.length, changeCount);
    h.runtime.destroy();
});

test('every selected real arcade game can earn the learning goal through its native scoring path', () => {
    const setups = {
        breakout(game) {
            const brick = game.bricks.find(brick => brick.hp > 0);
            Object.assign(game.ball, { x: brick.x + 16, y: brick.y + 8, vx: 0, vy: 0 });
        },
        tetris(game) {
            game.board[19] = Array(10).fill('#123456');
            game.board[19][9] = 0;
            game.currentPiece = { type: 'test', shape: [[1]], color: '#abcdef', x: 9, y: 19, rotation: 0 };
            GAMES.tetris.onPress(game, 'down');
        },
        qwertzman(game) {
            game.dots = Array.from({ length: 4 }, () => ({ x: game.player.x, y: game.player.y, r: 4, got: false }));
            Object.assign(game.ghost, { x: game.player.x, y: game.player.y });
        }
    };
    [3, 6, 9, 12, 15, 18].forEach(number => {
        const lesson = LESSONS[number - 1];
        const gameId = Arcade.getChallenge(lesson).gameId;
        withActualGame(gameId, currentGame => {
            const h = harness();
            h.runtime.start(lesson);
            setups[gameId](currentGame());
            h.runtime.play();
            h.advance();
            if (gameId === 'breakout') {
                assert.equal(h.runtime.getState().score, 30, 'one brick preserves its native 30 points');
                assert.equal(h.runtime.getState().status, 'playing', 'Breakout continues toward its 100-point goal');
                for (let i = 0; i < 3; i++) {
                    setups.breakout(currentGame());
                    h.advance();
                }
            }
            assert.equal(h.runtime.getState().status, 'complete', gameId + ' completes from native points');
            assert.equal(h.runtime.getState().score, Arcade.getChallenge(lesson).target);
            assert.equal(h.completions.length, 1);
            h.runtime.destroy();
        });
    });
});

test('a queued Tetris move cannot leak through pause and an untaught key cannot rotate or drop', () => {
    withActualGame('tetris', currentGame => {
        const h = harness();
        h.runtime.start(LESSONS[5]);
        const originalX = currentGame().currentPiece.x;
        const originalShape = JSON.stringify(currentGame().currentPiece.shape);
        h.runtime.handleKey(key('f'));
        assert.equal(currentGame().pending.length, 1);
        h.runtime.pause(true);
        assert.equal(currentGame().pending.length, 0);
        h.runtime.pause(false);
        for (const value of ['q', 'ArrowDown', 'ArrowUp', 'Enter']) assert.equal(h.runtime.handleKey(key(value)), false);
        h.advance();
        assert.equal(currentGame().currentPiece.x, originalX);
        assert.equal(JSON.stringify(currentGame().currentPiece.shape), originalShape);
        assert.equal(h.runtime.getState().score, 0);
        h.runtime.destroy();
    });
});

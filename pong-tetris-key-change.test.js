const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function gameContext(script) {
    let now = 10000;
    let nextId = 1;
    const frames = new Map();
    const intervals = new Map();
    const elements = new Map();
    function element() {
        const classes = new Set();
        return {
            textContent: '', innerHTML: '', style: {},
            classList: { add: (...items) => items.forEach(item => classes.add(item)), remove: (...items) => items.forEach(item => classes.delete(item)) },
            setAttribute() {}, removeAttribute() {}, querySelector: () => null
        };
    }
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        Date: { now: () => now },
        performance: { now: () => now },
        localStorage: { getItem: () => null },
        window: { location: { hash: '' }, addEventListener() {} },
        document: {
            readyState: 'loading',
            addEventListener() {},
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, element());
                return elements.get(id);
            }
        },
        requestAnimationFrame(callback) { const id = nextId++; frames.set(id, callback); return id; },
        cancelAnimationFrame(id) { frames.delete(id); },
        setInterval(callback) { const id = nextId++; intervals.set(id, callback); return id; },
        clearInterval(id) { intervals.delete(id); },
        setTimeout() { return nextId++; }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, script), 'utf8'), context);
    const isPong = script.endsWith('pong.js');
    vm.runInContext(`
        keyChangeModal = document.getElementById('keyChangeModal');
        keyChangeDirection = document.getElementById('keyChangeDirection');
        keyChangeFingerName = document.getElementById('keyChangeFingerName');
        kpmElement = document.getElementById('kpm');
        renderKeyChangeKeyboard = createConfetti = draw = hideOverlay = () => {};
        gameRunning = true; gamePaused = false; gameStartTime = 1000;
        totalKeystrokes = 18;
        gameLoop = requestAnimationFrame(update);
        ${isPong ? `
            leftScoreElement = document.getElementById('leftScore');
            rightScoreElement = document.getElementById('rightScore');
            rallyElement = document.getElementById('rally');
            lastFrameTime = performance.now();
        ` : `
            scoreElement = document.getElementById('score');
            levelElement = document.getElementById('level');
            linesElement = document.getElementById('lines');
            counterLeftElement = document.getElementById('left');
            counterRightElement = document.getElementById('right');
            counterDownElement = document.getElementById('down');
            counterRotateElement = document.getElementById('rotate');
            initBoard();
            currentPiece = { shape: [[1]], color: 'blue', x: 4, y: 0 };
            lastUpdate = Date.now(); dropTimer = 900;
            kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
        `}
    `, context);
    return {
        context, frames, intervals,
        run: source => vm.runInContext(source, context),
        advance(ms) { now += ms; },
        frame() {
            const [id, callback] = frames.entries().next().value;
            frames.delete(id);
            callback(now);
        },
        announce() {
            vm.runInContext(isPong
                ? "controlKeys.leftUp = 'f'; showKeyChangeModal('leftUp', 'r', 'f');"
                : "controlKeys.left = 'f'; showKeyChangeModal('left', 'a', 'f');", context);
        }
    };
}

for (const script of ['pong.js', 'tetris.js', 'iPad/Web/pong.js', 'iPad/Web/tetris.js']) {
    const isPong = script.endsWith('pong.js');
    const snapshot = isPong ? 'JSON.stringify(state)' : 'JSON.stringify({ board, currentPiece, score, dropTimer })';

    test(`${script}: announcement freezes gameplay, timers and input until a fresh confirmation`, () => {
        const game = gameContext(script);
        game.run("handleKeyDown({ key: 'd', repeat: false, preventDefault() {} });");
        game.announce();
        const before = game.run(snapshot);
        assert.equal(game.frames.size, 0);
        assert.equal(game.intervals.size, 0);
        game.advance(20000);
        game.run("update(performance.now()); handleKeyDown({ key: ' ', repeat: false, preventDefault() {} }); handleKeyDown({ key: 'f', repeat: true, preventDefault() {} }); updateKPMDisplay();");
        assert.equal(game.run(snapshot), before);
        assert.equal(game.run('keyChangeModalVisible && gamePaused'), true);
        assert.equal(game.frames.size, 0);
        game.run("handleKeyDown({ key: 'f', repeat: false, preventDefault() {} });");
        assert.equal(game.run('keyChangeModalVisible || gamePaused'), false);
        assert.equal(game.frames.size, 1);
        assert.equal(game.intervals.size, isPong ? 0 : 1);
        game.run('updateKPMDisplay();');
        assert.equal(Number(game.run('kpmElement.textContent')), Math.round(game.run('totalKeystrokes') / (9000 / 60000)));
        game.run("handleKeyDown({ key: 'f', repeat: true, preventDefault() {} }); handleKeyDown({ key: 'd', repeat: true, preventDefault() {} });");
        assert.equal(game.run(snapshot), before);
        assert.equal(game.run('keysHeld.size'), isPong ? 0 : 2);
        game.advance(16);
        game.frame();
        assert.equal(game.frames.size, 1);
        if (isPong) {
            assert.notEqual(game.run(snapshot), before);
            assert.equal(game.run('state.leftPaddle.y'), 166);
        } else {
            assert.equal(game.run('currentPiece.y'), 0);
            assert.equal(game.run('dropTimer'), 916);
        }
        game.run("handleKeyUp({ key: 'f' }); handleKeyDown({ key: 'f', repeat: false, preventDefault() {} });");
        assert.equal(game.run(isPong ? "keysHeld.has('f')" : 'currentPiece.x'), isPong ? true : 4);
    });

    test(`${script}: repeated announcements resume one loop and preserve a previous pause`, () => {
        const game = gameContext(script);
        for (let i = 0; i < 3; i++) {
            game.announce();
            assert.equal(game.frames.size, 0);
            assert.equal(game.intervals.size, 0);
            game.run('hideKeyChangeModal(); hideKeyChangeModal();');
            assert.equal(game.frames.size, 1);
            assert.equal(game.intervals.size, isPong ? 0 : 1);
            game.advance(16);
            game.frame();
            assert.equal(game.frames.size, 1);
        }
        game.run("handleKeyDown({ key: ' ', repeat: false, preventDefault() {} });");
        game.announce();
        game.run('hideKeyChangeModal();');
        assert.equal(game.run('gamePaused'), true);
        assert.equal(game.frames.size, 0);
        assert.equal(game.intervals.size, 0);
    });

    test(`${script}: restarting during an announcement clears it and keeps one loop`, async () => {
        const game = gameContext(script);
        game.announce();
        await game.run('startGame();');
        await game.run('startGame();');
        assert.equal(game.run('keyChangeModalVisible || gamePaused'), false);
        assert.equal(game.run('pendingKeyConfirmation'), null);
        assert.equal(game.frames.size, 1);
        assert.equal(game.intervals.size, isPong ? 0 : 1);
    });
}

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
    const classes = new Set();
    return {
        innerHTML: '', textContent: '', style: {}, dataset: {},
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name)
        },
        appendChild() {}, setAttribute() {},
        querySelector: () => element(), querySelectorAll: () => []
    };
}

function gameContext(sourcePath) {
    const clock = { now: 1000 };
    const frames = new Map();
    const intervals = new Map();
    const timeouts = new Map();
    let nextId = 1;
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        Date: class extends Date { static now() { return clock.now; } },
        localStorage: { getItem: () => null, setItem() {} },
        window: { location: { hash: '' }, addEventListener() {} },
        document: {
            activeElement: null, createElement: element,
            getElementById: () => element(), querySelector: () => null, querySelectorAll: () => []
        },
        requestAnimationFrame(callback) { const id = nextId++; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        setInterval(callback) { const id = nextId++; intervals.set(id, callback); return id; },
        clearInterval: id => intervals.delete(id),
        setTimeout(callback) { const id = nextId++; timeouts.set(id, callback); return id; },
        clearTimeout: id => timeouts.delete(id),
        element, calls: []
    });
    const source = fs.readFileSync(require.resolve(sourcePath), 'utf8').replace(/init\(\);\s*$/, '');
    vm.runInContext(source, context);
    intervals.clear();
    vm.runInContext(`
        scoreElement = element();
        keyChangeModal = element(); keyChangeDirection = element(); keyChangeFingerName = element();
        endgameModal = element(); endgameTitle = element(); endgameMessage = element(); endgamePrimaryBtn = element();
        draw = updateKeyboardDisplay = () => {};
        gameRunning = true; gamePaused = false; lastUpdate = 0;
        snake = [{x: 4, y: 4}, {x: 3, y: 4}, {x: 2, y: 4}];
        direction = nextDirection = {x: 1, y: 0};
        food = {x: 20, y: 21};
        letterFoods = {up: {x: 5, y: 4, letter: 'r', spawnTime: 700}};
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    `, context);
    const runFrame = () => {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback();
    };
    return { context, clock, frames, intervals, timeouts, runFrame };
}

for (const sourcePath of ['./game.js', './iPad/Web/game.js']) {
    test(`${sourcePath}: collecting a new key freezes movement and expiry until a fresh confirmation`, () => {
        const { context, clock, frames, intervals, runFrame } = gameContext(sourcePath);
        vm.runInContext(`letterFoods.down = {x: 20, y: 20, letter: 'v', spawnTime: 700};`, context);
        runFrame();
        assert.equal(vm.runInContext('keyChangeModalVisible && gamePaused', context), true);
        assert.equal(frames.size, 0);
        assert.equal(intervals.size, 0);
        const frozen = vm.runInContext('JSON.stringify({snake, score, direction, nextDirection, totalKeystrokes, letterFoods})', context);
        clock.now = 50000;
        vm.runInContext(`
            handleKeyPress({key: 'j', preventDefault() {}});
            handleKeyPress({key: ' ', code: 'Space', preventDefault() {}});
            handleKeyPress({key: 'r', repeat: true, preventDefault() {}});
            togglePause(); update();
        `, context);
        assert.equal(vm.runInContext('JSON.stringify({snake, score, direction, nextDirection, totalKeystrokes, letterFoods})', context), frozen);
        assert.equal(frames.size, 0);
        vm.runInContext(`handleKeyPress({key: 'r', preventDefault() {}}); hideKeyChangeModal();`, context);
        assert.equal(vm.runInContext('keyChangeModalVisible || gamePaused', context), false);
        assert.equal(vm.runInContext('letterFoods.down.spawnTime', context), 49700);
        assert.equal(frames.size, 1);
        assert.equal(intervals.size, 1);
        assert.equal(vm.runInContext('totalKeystrokes', context), 0);
        clock.now += 200;
        runFrame();
        assert.equal(vm.runInContext('snake[0].x', context), 6);
        assert.equal(vm.runInContext('!!letterFoods.down', context), true);
    });

    test(`${sourcePath}: opening the announcement cancels an already queued movement frame`, () => {
        const { context, frames, intervals } = gameContext(sourcePath);
        vm.runInContext(`showKeyChangeModal('up', 't', 'r');`, context);
        assert.equal(frames.size, 0);
        assert.equal(intervals.size, 0);
        // A late resume from another UI action cannot move through the visible announcement.
        vm.runInContext('gamePaused = false; update();', context);
        assert.equal(vm.runInContext('snake[0].x', context), 4);
        assert.equal(frames.size, 0);
    });

    test(`${sourcePath}: a waiting level begins only after the new key is confirmed`, () => {
        const { context, frames, timeouts, runFrame } = gameContext(sourcePath);
        vm.runInContext(`
            availableLevels = [{name: 'Next', barriers: []}];
            pendingLevelAdvance = true;
            showLevelChangeModal = () => { calls.push('level'); levelChangeModalVisible = true; };
        `, context);
        runFrame();
        assert.equal(vm.runInContext('currentLevelIndex', context), 0);
        assert.equal(timeouts.size, 0);
        vm.runInContext(`handleKeyPress({key: 'r', preventDefault() {}});`, context);
        assert.equal(vm.runInContext('currentLevelIndex', context), 1);
        assert.equal(vm.runInContext('gamePaused', context), true);
        assert.equal(frames.size, 0);
        for (const callback of timeouts.values()) callback();
        assert.deepEqual(Array.from(context.calls), ['level']);
    });

    test(`${sourcePath}: a waiting endgame dialog cannot bypass the new key confirmation`, () => {
        const { context, frames, runFrame } = gameContext(sourcePath);
        vm.runInContext('pendingEndgameProgression = true;', context);
        runFrame();
        assert.equal(vm.runInContext("endgameModal.classList.contains('visible')", context), false);
        vm.runInContext(`handleKeyPress({key: ' ', code: 'Space', preventDefault() {}});`, context);
        assert.equal(vm.runInContext('keyChangeModalVisible', context), true);
        vm.runInContext(`handleKeyPress({key: 'r', preventDefault() {}});`, context);
        assert.equal(vm.runInContext("endgameModal.classList.contains('visible') && gamePaused", context), true);
        assert.equal(frames.size, 0);
    });

    test(`${sourcePath}: announcing a key while already paused preserves the existing pause`, () => {
        const { context, frames, intervals } = gameContext(sourcePath);
        vm.runInContext(`gamePaused = true; showKeyChangeModal('up', 't', 'r'); hideKeyChangeModal();`, context);
        assert.equal(vm.runInContext('gamePaused', context), true);
        assert.equal(frames.size, 0);
        assert.equal(intervals.size, 0);
    });
}

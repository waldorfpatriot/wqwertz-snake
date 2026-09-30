const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function gameContext() {
    const scheduled = new Set();
    const intervals = new Set();
    let nextId = 1;
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        localStorage: { getItem: () => null, setItem() {} },
        window: { location: { hash: '' }, addEventListener() {} },
        document: { activeElement: null, querySelector: () => null, querySelectorAll: () => [] },
        requestAnimationFrame() { const id = nextId++; scheduled.add(id); return id; },
        cancelAnimationFrame(id) { scheduled.delete(id); },
        setInterval() { const id = nextId++; intervals.add(id); return id; },
        clearInterval(id) { intervals.delete(id); },
        setTimeout() { return nextId++; },
        clearTimeout() {},
        eventCalls: [],
        scheduled,
        intervals
    });
    // Exercise the actual game router without booting its network/DOM initialization.
    const source = fs.readFileSync(require.resolve('./game.js'), 'utf8').replace(/init\(\);\s*$/, '');
    vm.runInContext(source, context);
    // The existing background logging timer is unrelated to either game mode.
    scheduled.clear();
    intervals.clear();
    return context;
}

test('learning receives letters, space and key releases even after an unsaved arcade result', () => {
    const context = gameContext();
    vm.runInContext(`
        lastGameScore = 12;
        gameStatsSaved = false;
        learningController = {
            isActive: () => true,
            handleKey: event => eventCalls.push(event.key),
            handleKeyUp: event => eventCalls.push('up:' + event.key)
        };
        handleKeyPress({ key: 'f' });
        handleKeyPress({ key: ' ', code: 'Space' });
        handleKeyUp({ key: 'f' });
    `, context);
    assert.deepEqual(Array.from(context.eventCalls), ['f', ' ', 'up:f']);
    assert.equal(vm.runInContext('totalInputs', context), 0);
});

test('editable fields and native button activation are not captured by learning', () => {
    const context = gameContext();
    vm.runInContext(`
        learningController = { isActive: () => true, handleKey: event => eventCalls.push(event.key) };
        handleKeyPress({ key: 'f', target: { closest: selector => selector.startsWith('input') ? {} : null } });
        handleKeyPress({ key: ' ', target: { closest: selector => selector.startsWith('button') ? {} : null } });
        handleKeyPress({ key: 'Escape', target: { closest: selector => selector.startsWith('button') ? {} : null } });
    `, context);
    assert.deepEqual(Array.from(context.eventCalls), ['Escape']);
});

test('arcade movement and late practice overlays cannot run during learning', () => {
    const context = gameContext();
    vm.runInContext(`
        learningController = { isActive: () => true };
        gameRunning = true;
        gamePaused = false;
        update();
        draw();
        showPracticeMode();
    `, context);
    assert.equal(context.scheduled.size, 0);
    assert.equal(context.intervals.size, 0);
});

test('starting arcade repeatedly retains only one movement loop and statistics timer', async () => {
    const context = gameContext();
    vm.runInContext(`
        resetGame = () => {};
        hideOverlay = () => {};
        gameStatsSaved = true;
        learningController = { isActive: () => false };
    `, context);
    await vm.runInContext('startGame()', context);
    await vm.runInContext('startGame()', context);
    assert.equal(context.scheduled.size, 1);
    assert.equal(context.intervals.size, 1);
    assert.equal(context.window.location.hash, 'game');
});

test('entering learning cancels an arcade start waiting on a previous result save', async () => {
    const context = gameContext();
    vm.runInContext(`
        let resolveSave;
        submitStatistics = () => new Promise(resolve => { resolveSave = resolve; });
        resetGame = () => eventCalls.push('reset');
        hideOverlay = () => {};
        lastGameScore = 4;
        gameStatsSaved = false;
        learningController = { isActive: () => false };
    `, context);
    const pending = vm.runInContext('startGame()', context);
    vm.runInContext('suspendArcadeForLearning(); resolveSave(true);', context);
    await pending;
    assert.equal(context.scheduled.size, 0);
    assert.deepEqual(Array.from(context.eventCalls), []);
});

test('an arcade direction press is counted once', () => {
    const context = gameContext();
    vm.runInContext(`
        learningController = null;
        gameRunning = true;
        gamePaused = false;
        highlightKey = updateAccuracyDisplay = adjustGameSpeedBasedOnAccuracy = updateCounters = () => {};
        handleKeyPress({ key: 't', preventDefault() {} });
    `, context);
    assert.equal(vm.runInContext('totalKeystrokes', context), 1);
});

test('the classroom matrix blocks arcade input and routes back to learning without changing results', () => {
    const context = gameContext();
    vm.runInContext(`
        learningLeaderboardController = { isActive: () => true };
        learningController = { isActive: () => false, handleKey: () => eventCalls.push('lesson'), handleKeyUp: () => eventCalls.push('release') };
        gameRunning = true; gamePaused = false;
        handleKeyPress({ key: 't' }); handleKeyUp({ key: 't' }); update(); draw();
    `, context);
    assert.equal(vm.runInContext('totalKeystrokes', context), 0);
    assert.equal(context.scheduled.size, 0);
    assert.deepEqual(Array.from(context.eventCalls), []);
});

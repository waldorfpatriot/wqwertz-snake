const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIRECTIONS = ['left', 'right', 'down', 'rotate'];
const ARROWS = { left: '←', right: '→', down: '↓', rotate: '↻' };
const sequence = fs.readFileSync(path.join(__dirname, 'key_sequence.txt'), 'utf8');

function element() {
    const classes = new Set();
    const attributes = new Map();
    const children = [];
    let html = '';
    return {
        children, dataset: {}, style: {}, textContent: '', value: '', width: 400, height: 600,
        get className() { return [...classes].join(' '); },
        set className(value) {
            classes.clear();
            value.split(/\s+/).filter(Boolean).forEach(name => classes.add(name));
        },
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; children.length = 0; },
        classList: {
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name)
        },
        appendChild(child) { children.push(child); return child; },
        setAttribute(name, value) { attributes.set(name, String(value)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        removeAttribute(name) { attributes.delete(name); },
        addEventListener() {},
        querySelector() { return null; },
        getContext() {
            return { fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
        }
    };
}

async function gameContext(script, random = 0) {
    const elements = new Map();
    const listeners = new Map();
    let nextId = 1;
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        Math: Object.assign(Object.create(Math), { random: () => random }),
        localStorage: { getItem: () => null, setItem() {} },
        fetch: async () => ({ text: async () => sequence }),
        window: { location: { hash: '' }, addEventListener() {} },
        document: {
            readyState: 'loading',
            createElement: element,
            getElementById(id) {
                if (!elements.has(id)) elements.set(id, element());
                return elements.get(id);
            },
            addEventListener(type, listener) { listeners.set(type, listener); }
        },
        requestAnimationFrame() { return nextId++; },
        cancelAnimationFrame() {},
        setInterval() { return nextId++; },
        clearInterval() {}
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, script), 'utf8'), context);
    await vm.runInContext('init()', context);
    return {
        run: source => vm.runInContext(source, context),
        read: source => JSON.parse(vm.runInContext(`JSON.stringify(${source})`, context)),
        elements,
        press(key) {
            listeners.get('keydown')({ key, repeat: false, preventDefault() {} });
            listeners.get('keyup')({ key });
        }
    };
}

function keyboardKeys(game, id) {
    return game.elements.get(id).children.flatMap(row => row.children);
}

function assertVisibleControls(game, id = 'virtualKeyboard') {
    const controls = game.read('controlKeys');
    assert.equal(new Set(Object.values(controls)).size, 4, 'all four actions have separate keys');
    const activeKeys = keyboardKeys(game, id).filter(key => key.classList.contains('active-control'));
    assert.equal(activeKeys.length, 4, 'the keyboard displays all four controls');
    DIRECTIONS.forEach(direction => {
        const keys = activeKeys.filter(key => key.getAttribute('data-direction') === direction);
        assert.equal(keys.length, 1, direction + ' has one visible control');
        assert.equal(keys[0].getAttribute('data-arrow'), ARROWS[direction]);
        assert.equal(keys[0].textContent, controls[direction].toUpperCase());
    });
}

for (const script of ['tetris.js', 'iPad/Web/tetris.js']) {
    test(`${script}: initialization keeps four controls visible even with collision-prone random choices`, async () => {
        for (const random of [0, 0.07, 0.15, 0.2, 0.5, 0.99]) {
            const game = await gameContext(script, random);
            assertVisibleControls(game);
        }
    });

    test(`${script}: every displayed control independently performs its action`, async () => {
        const game = await gameContext(script);
        await game.run('startGame()');
        const controls = game.read('controlKeys');
        const shape = [[0, 1, 0], [1, 1, 1]];
        for (const direction of DIRECTIONS) {
            game.run(`
                initBoard(); score = 0;
                currentPiece = { shape: [[0, 1, 0], [1, 1, 1]], color: 'blue', x: 4, y: 4 };
                keyPressCounters = { left: 0, right: 0, down: 0, rotate: 0 };
            `);
            game.press(controls[direction].toUpperCase());
            assert.deepEqual(game.read('keyPressCounters'), {
                left: direction === 'left' ? 1 : 0,
                right: direction === 'right' ? 1 : 0,
                down: direction === 'down' ? 1 : 0,
                rotate: direction === 'rotate' ? 1 : 0
            }, 'a press reaches only its displayed action');
            assert.equal(game.run('currentPiece.x'), direction === 'left' ? 3 : direction === 'right' ? 5 : 4);
            assert.equal(game.run('currentPiece.y'), direction === 'down' ? 5 : 4);
            assert.deepEqual(game.read('currentPiece.shape'), direction === 'rotate' ? [[1, 0], [1, 1], [1, 0]] : shape);
            assert.equal(game.run('score'), direction === 'down' ? 1 : 0);
        }
    });

    test(`${script}: repeated changes keep every control available on both keyboards`, async () => {
        const game = await gameContext(script);
        await game.run('startGame()');
        for (let round = 0; round < 12; round++) {
            for (const direction of DIRECTIONS) {
                const previous = game.read('controlKeys');
                game.run(`changeSingleKey('${direction}')`);
                const next = game.read('controlKeys');
                assert.notEqual(next[direction], previous[direction], 'a change selects a different key');
                DIRECTIONS.filter(other => other !== direction).forEach(other => {
                    assert.equal(next[other], previous[other], 'other actions retain their keys');
                });
                assertVisibleControls(game);
                assertVisibleControls(game, 'keyChangeKeyboard');
                assert.equal(game.run('keyChangeModalVisible'), true);
                game.press(next[direction]);
                assert.equal(game.run('keyChangeModalVisible || gamePaused'), false);
            }
        }
    });

    test(`${script}: an occupied finger group falls back to another free group`, async () => {
        const game = await gameContext(script);
        game.run(`
            controlKeys = { left: 'r', right: 'p', down: 'v', rotate: 'f' };
            keySequence = 'rfvwsx';
            updateKeyboardDisplay();
            changeSingleKey('left');
        `);
        const controls = game.read('controlKeys');
        assert.ok(['w', 's', 'x'].includes(controls.left), 'left chooses a free ring-finger key');
        assert.equal(game.run('getFingerClass(controlKeys.left)'), 'finger-ring');
        assert.deepEqual({ right: controls.right, down: controls.down, rotate: controls.rotate }, { right: 'p', down: 'v', rotate: 'f' });
        assertVisibleControls(game);
        assertVisibleControls(game, 'keyChangeKeyboard');
        assert.equal(game.run('keyChangeModalVisible'), true);
    });

    test(`${script}: an exhausted custom sequence keeps its controls without announcing a change`, async () => {
        const game = await gameContext(script);
        await game.run('startGame()');
        game.run(`
            controlKeys = { left: 'r', right: 'p', down: 'v', rotate: 'f' };
            keySequence = 'rfv';
            updateKeyboardDisplay();
            changeSingleKey('left');
        `);
        assert.deepEqual(game.read('controlKeys'), { left: 'r', right: 'p', down: 'v', rotate: 'f' });
        assertVisibleControls(game);
        assert.equal(game.run('keyChangeModalVisible || gamePaused'), false);
        assert.equal(game.run('pendingKeyConfirmation'), null);
        assert.equal(game.elements.get('keyChangeModal').classList.contains('visible'), false);
    });
}

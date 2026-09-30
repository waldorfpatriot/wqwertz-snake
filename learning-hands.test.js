const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { geometry } = require('./learning-hands');

const rows = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnm,.-'];
const fingerMap = {};
[
    ['links', 'finger-pinky', 'qay'], ['links', 'finger-ring', 'wsx'],
    ['links', 'finger-middle', 'edc'], ['links', 'finger-index', 'rftgvb'],
    ['rechts', 'finger-index', 'zhnumj'], ['rechts', 'finger-middle', 'ik,'],
    ['rechts', 'finger-ring', 'ol.'], ['rechts', 'finger-pinky', 'püöä-']
].forEach(([hand, finger, keys]) => [...keys].forEach(key => { fingerMap[key] = { hand, finger }; }));

function keyFixture(keyWidth, includeBackspace = false) {
    const pitch = keyWidth + 4;
    const keyHeight = keyWidth * 1.125;
    const keys = {};
    rows.forEach((row, rowIndex) => [...row].forEach((key, index) => {
        keys[key] = { x: 10 + keyWidth / 2 + index * pitch + (rowIndex === 0 ? -keyWidth / 8 : rowIndex === 2 ? pitch / 2 : 0),
            y: 10 + keyHeight / 2 + rowIndex * (keyHeight + 6), width: keyWidth, height: keyHeight };
    }));
    keys[' '] = { x: 10 + 11 * pitch / 2, y: 10 + keyHeight / 2 + 3 * (keyHeight + 6), width: keyWidth * 6.25, height: keyHeight };
    if (includeBackspace) {
        const lastKey = keys['ü'];
        keys.backspace = { x: lastKey.x + lastKey.width / 2 + 4 + keyWidth * 1.25 / 2, y: lastKey.y, width: keyWidth * 1.25, height: keyHeight };
    }
    return { keys, width: 20 + (includeBackspace ? 12.25 : 11) * pitch, height: 85 + 4 * (keyHeight + 6) };
}

test('every QWERTZ target lands on its real key at narrow and wide sizes', () => {
    for (const width of [16, 22, 32, 54]) {
        const fixture = keyFixture(width);
        for (const key of Object.keys(fixture.keys)) {
            const pose = geometry.poseForKeys(fixture.keys, fingerMap, key, fixture);
            const mapping = key === ' ' ? { hand: 'rechts', finger: 'finger-thumb' } : fingerMap[key];
            const target = fixture.keys[key];
            const chain = pose.hands[mapping.hand][mapping.finger];
            const tip = chain.projected[3];
            assert.ok(Math.hypot(tip.x - target.x, tip.y - target.y) < 1e-6, width + 'px target ' + key);
            assert.ok(chain.error < 1e-6);
        }
    }
});

test('reaching rotates fixed bones, arches above the keyboard, and keeps other tips at home', () => {
    const fixture = keyFixture(32);
    const baseline = geometry.poseForKeys(fixture.keys, fingerMap, null, fixture);
    for (const key of Object.keys(fixture.keys)) {
        const pose = geometry.poseForKeys(fixture.keys, fingerMap, key, fixture);
        const mapping = key === ' ' ? { hand: 'rechts', finger: 'finger-thumb' } : fingerMap[key];
        for (const [hand, fingers] of Object.entries(pose.hands)) {
            for (const [finger, chain] of Object.entries(fingers)) {
                assert.deepEqual(chain.lengths, baseline.hands[hand][finger].lengths, key + ' cannot stretch ' + finger);
                chain.segmentLengths.forEach((length, index) => assert.ok(Math.abs(length - chain.lengths[index]) < 1e-8));
                chain.joints.forEach(joint => assert.ok(joint.z >= -1e-6, key + ' joint cannot pass through keyboard'));
                assert.ok(chain.error < 1e-6, key + ' other fingers remain reachable');
                if (mapping.hand !== hand || mapping.finger !== finger) {
                    assert.ok(geometry.distance(chain.projected[3], baseline.hands[hand][finger].projected[3]) < 1e-6, key + ' resting ' + finger);
                }
                // PIP and DIP hinge in one shared flexion plane; sideways aiming is at MCP.
                const base = chain.joints[0];
                const tip = chain.joints[3];
                chain.joints.forEach(joint => assert.ok(Math.abs((joint.x - base.x) * (tip.y - base.y) - (joint.y - base.y) * (tip.x - base.x)) < 1e-6));
            }
        }
    }
});

test('Backspace uses the right pinky and reaches its far top-row key without stretching bones', () => {
    const arcadeMap = { ...fingerMap, backspace: { hand: 'links', finger: 'finger-index' } };
    for (const width of [16, 22, 32, 54]) {
        const fixture = keyFixture(width, true);
        const baseline = geometry.poseForKeys(fixture.keys, arcadeMap, null, fixture);
        const pose = geometry.poseForKeys(fixture.keys, arcadeMap, 'backspace', fixture);
        const target = fixture.keys.backspace;
        const active = pose.hands.rechts['finger-pinky'];
        assert.ok(geometry.distance(active.projected[3], target) < 1e-6, width + 'px Backspace reaches its center');
        assert.ok(geometry.distance(pose.rig.rechts.offset, { x: 0, y: 0, z: 0 }) > 0, 'the hand moves instead of elongating the pinky');
        for (const [hand, fingers] of Object.entries(pose.hands)) {
            for (const [finger, chain] of Object.entries(fingers)) {
                assert.deepEqual(chain.lengths, baseline.hands[hand][finger].lengths);
                chain.segmentLengths.forEach((length, index) => assert.ok(Math.abs(length - chain.lengths[index]) < 1e-8));
                chain.joints.forEach(joint => assert.ok(joint.z >= -1e-6, width + 'px ' + finger + ' stays above the keyboard'));
                assert.ok(chain.error < 1e-6, width + 'px ' + hand + ' ' + finger + ' remains reachable');
                if (hand !== 'rechts' || finger !== 'finger-pinky') {
                    assert.ok(geometry.distance(chain.projected[3], baseline.hands[hand][finger].projected[3]) < 1e-6);
                }
            }
        }
    }
});

class Node {
    constructor(tag) { this.tag = tag; this.attributes = new Map(); this.children = []; this.parentNode = null; this.style = {}; this.hidden = false; this.textContent = ''; this.listeners = new Map(); }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    hasAttribute(key) { return this.attributes.has(key); }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    replaceChildren() { this.children.forEach(child => { child.parentNode = null; }); this.children = []; }
    insertAdjacentElement(_, child) { this.parentNode.appendChild(child); }
    contains(target) { return this === target || this.children.some(child => child.contains(target)); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode = null; }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    removeEventListener(name) { this.listeners.delete(name); }
}

function browserFixture(reducedMotion, includeBackspace = false) {
    let fixture = keyFixture(32, includeBackspace);
    let nextId = 0;
    const frames = new Map();
    const observers = [];
    const globals = new Map();
    const parent = new Node('section');
    const keyboard = parent.appendChild(new Node('keyboard'));
    const document = { createElement: tag => new Node(tag), createElementNS: (_, tag) => new Node(tag) };
    keyboard.ownerDocument = document;
    keyboard.getBoundingClientRect = () => ({ left: 80, top: 140, width: fixture.width, height: fixture.height });
    keyboard.querySelectorAll = () => Object.entries(fixture.keys).map(([key, rect]) => ({ dataset: { key }, getBoundingClientRect: () => ({ left: rect.x + 80 - rect.width / 2, top: rect.y + 140 - rect.height / 2, width: rect.width, height: rect.height }) }));
    class Observer {
        constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
        observe() {}
        disconnect() { this.disconnected = true; }
    }
    const window = { document, requestAnimationFrame: callback => { const id = ++nextId; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
        addEventListener: (name, callback) => globals.set(name, callback), removeEventListener: name => globals.delete(name),
        ResizeObserver: Observer, MutationObserver: Observer, matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }) };
    vm.runInNewContext(fs.readFileSync(require.resolve('./learning-hands'), 'utf8'), { window, globalThis: window });
    const controller = window.QwertzLearningHands.mount({ keyboard, fingerMap });
    return { controller, keyboard, parent, observers, globals, frames,
        tick(time) { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(time)); },
        resize(width) { fixture = keyFixture(width, includeBackspace); observers[0].callback(); } };
}

test('reduced motion is a static accurate pose; pause and hide cancel pending work', () => {
    const browser = browserFixture(true);
    browser.controller.update({ expectedKey: 'ü', showHint: true, targetToken: 'one' });
    assert.equal(browser.controller.getState().phase, 'reached');
    assert.equal(browser.controller.getState().targetDistance, 0);
    assert.equal(browser.frames.size, 0);
    browser.controller.update({ paused: true });
    assert.equal(browser.controller.getState().phase, 'paused');
    assert.equal(browser.frames.size, 0);
    browser.controller.hide();
    assert.equal(browser.controller.getState().active, false);
    assert.equal(browser.controller.getState().phase, 'hidden');
    browser.controller.destroy();
    assert.equal(browser.parent.children.length, 1);
    assert.ok(browser.observers.every(observer => observer.disconnected));
    assert.equal(browser.globals.size, 0);
    assert.ok(!browser.keyboard.listeners.has('keydown'));
});

test('new target tokens replay home-to-reach, highlights preserve motion, and resize remeasures', () => {
    const browser = browserFixture(false);
    browser.controller.update({ expectedKey: 't', showHint: true, targetToken: 'one' });
    browser.tick(0);
    assert.equal(browser.controller.getState().phase, 'returning');
    // Same geometry after a key-highlight class mutation must not teleport to the target.
    browser.observers[1].callback([{ target: browser.keyboard }]);
    browser.tick(180);
    assert.equal(browser.controller.getState().phase, 'reaching');
    browser.tick(500);
    assert.equal(browser.controller.getState().phase, 'reached');
    assert.equal(browser.controller.getState().targetDistance, 0);
    browser.controller.update({ targetToken: 'two' });
    assert.ok(browser.controller.getState().animationPending);
    browser.tick(510);
    assert.equal(browser.controller.getState().phase, 'returning');
    browser.controller.update({ paused: true });
    assert.equal(browser.frames.size, 0);
    browser.controller.update({ paused: false });
    browser.resize(22);
    browser.tick(600);
    assert.equal(browser.controller.getState().phase, 'reached');
    assert.equal(browser.controller.getState().targetDistance, 0);
    assert.equal(browser.controller.getState().target.width, 22);
    browser.controller.hide();
    assert.equal(browser.frames.size, 0);
    browser.controller.destroy();
});

test('the mounted Backspace guide highlights the right pinky, explains Delete, and remeasures on resize', () => {
    const browser = browserFixture(true, true);
    browser.controller.update({ expectedKey: 'backspace', showHint: true, targetToken: 'delete-one' });
    const overlay = browser.keyboard.children[0];
    assert.equal(overlay.getAttribute('data-active-hand'), 'rechts');
    assert.equal(overlay.getAttribute('data-active-finger'), 'finger-pinky');
    assert.equal(browser.controller.getState().targetDistance, 0);
    assert.match(browser.parent.children[1].textContent, /Rechter kleiner Finger · Löschen \(⌫\)/);
    browser.resize(16); browser.tick(500);
    assert.equal(browser.controller.getState().targetDistance, 0);
    assert.equal(browser.controller.getState().target.width, 20);
    browser.controller.update({ paused: true });
    assert.equal(browser.controller.getState().phase, 'paused');
    assert.equal(browser.frames.size, 0);
    browser.controller.destroy();
});

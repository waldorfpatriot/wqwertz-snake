const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const reward = require('./learning-reward');

test('the apple stays at the last dot and each correct target moves exactly one square', () => {
    for (const total of [0, 2, 4, 8, 12, 19, 24, 28, 60]) {
        const route = reward.buildRoute(total);
        assert.equal(route.path.length, total + 3);
        assert.equal(route.startIndex, 2);
        assert.equal(route.endIndex, total + 2);
        assert.deepEqual(route.apple, route.path.at(-1));
        for (let completed = 0; completed <= total; completed++) {
            const state = reward.progress(route, completed);
            assert.deepEqual(state.apple, route.apple);
            assert.equal(state.headIndex, completed + 2);
            assert.equal(state.atEnd, completed === total);
            if (completed) {
                const previous = reward.progress(route, completed - 1).head;
                assert.equal(Math.abs(previous.x - state.head.x) + Math.abs(previous.y - state.head.y), 1);
            }
            const snake = route.path.slice(Math.max(0, state.headIndex - 2), state.headIndex + 1);
            assert.equal(new Set(snake.map(point => point.x + ',' + point.y)).size, snake.length, 'a short snake never hits itself');
            assert.ok(state.head.x >= 0 && state.head.x < 13 && state.head.y >= 0 && state.head.y < 13);
        }
        assert.deepEqual(reward.progress(route, total).head, route.apple);
        assert.equal(reward.progress(route, total + 100).headIndex, route.endIndex);
    }
});

test('the four apple assets are distinct, with a green-only final remnant', () => {
    const sources = Object.values(reward.assets).map(name => fs.readFileSync(path.join(__dirname, name), 'utf8'));
    assert.equal(new Set(sources).size, 4);
    sources.forEach(source => assert.match(source, /viewBox="0 0 256 256"/));
    assert.match(sources[1], /#ffedcf/);
    assert.match(sources[2], /#ffedcf/);
    assert.match(sources[3], /#65a855/);
    assert.doesNotMatch(sources[3], /#(?:ed6359|cf4848|ffedcf)/);
});

class Element {
    constructor(tag, document) {
        this.tag = tag; this.ownerDocument = document; this.children = []; this.parentNode = null;
        this.hidden = false; this.style = {}; this.dataset = {}; this.attrs = new Map(); this.listeners = new Map();
        const classes = new Set();
        this.classList = { toggle(name, value) { if (value) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) };
    }
    setAttribute(name, value) { this.attrs.set(name, String(value)); }
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    removeEventListener(name) { this.listeners.delete(name); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
    get isConnected() { return this === this.ownerDocument.body || Boolean(this.parentNode && this.parentNode.isConnected); }
    getClientRects() { return this.isConnected ? [{}] : []; }
    focus() { this.ownerDocument.activeElement = this; const callback = this.ownerDocument.listeners.get('focusin'); if (callback) callback({ target: this }); }
}

function fixture(reducedMotion = false) {
    let time = 0;
    let serial = 0;
    const timers = new Map();
    const allCallbacks = [];
    const windowListeners = new Map();
    const document = { hidden: false, activeElement: null, listeners: new Map(), createElement(tag) { return new Element(tag, this); },
        addEventListener(name, callback) { this.listeners.set(name, callback); }, removeEventListener(name) { this.listeners.delete(name); } };
    document.body = new Element('body', document);
    const canvas = document.body.appendChild(new Element('canvas', document));
    canvas.focus();
    const window = { document, Date: { now: () => time }, matchMedia: () => ({ matches: reducedMotion }),
        setTimeout(callback, delay) { const id = ++serial; timers.set(id, { callback, due: time + delay }); allCallbacks.push(callback); return id; },
        clearTimeout: id => timers.delete(id), addEventListener: (name, callback) => windowListeners.set(name, callback), removeEventListener: name => windowListeners.delete(name) };
    vm.runInNewContext(fs.readFileSync(require.resolve('./learning-reward'), 'utf8'), { window, globalThis: window });
    const events = [];
    const finishes = [];
    const controller = window.QwertzLearningReward.mount({ onPhase: (phase, meta) => events.push({ phase, meta }), onFinish: result => finishes.push(result) });
    return { controller, document, canvas, timers, allCallbacks, events, finishes, windowListeners,
        get overlay() { return document.body.children.at(-1); },
        advance(milliseconds) {
            const until = time + milliseconds;
            while (true) {
                const next = [...timers.entries()].filter(([, job]) => job.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
                if (!next) break;
                time = next[1].due; timers.delete(next[0]); next[1].callback();
            }
            time = until;
        },
        visibility(hidden) { document.hidden = hidden; document.listeners.get('visibilitychange')(); }
    };
}

test('three board bites precede the fullscreen success and finish exactly once', () => {
    const browser = fixture();
    browser.controller.start({ id: 'demo', title: 'Geschafft!' });
    assert.equal(browser.controller.getPhase(), 'bite-one');
    assert.equal(browser.overlay.hidden, true);
    browser.advance(400);
    assert.equal(browser.controller.getPhase(), 'bite-two');
    assert.equal(browser.overlay.hidden, true);
    browser.advance(400);
    assert.equal(browser.controller.getPhase(), 'apple-top');
    assert.equal(browser.overlay.hidden, true);
    browser.advance(400);
    assert.equal(browser.controller.getPhase(), 'celebration');
    assert.equal(browser.overlay.hidden, false);
    assert.equal(browser.document.activeElement.tag, 'button');
    browser.canvas.focus();
    assert.equal(browser.document.activeElement.tag, 'button', 'fullscreen dialog retains focus');
    browser.advance(1400);
    assert.equal(browser.controller.isActive(), false);
    assert.equal(browser.finishes.length, 1);
    assert.equal(browser.finishes[0].id, 'demo');
    assert.equal(browser.finishes[0].lastPhase, 'celebration');
    assert.equal(browser.document.activeElement, browser.canvas);
    assert.deepEqual(browser.events.map(event => event.phase), [...reward.biteOrder, 'celebration']);
    browser.controller.finish();
    assert.equal(browser.finishes.length, 1);
    browser.controller.destroy();
});

test('restart/cancel invalidate stale callbacks and visibility/manual pause preserve remaining time', () => {
    const browser = fixture();
    browser.controller.start({ id: 'old' });
    const stale = browser.allCallbacks[0];
    browser.advance(150);
    browser.visibility(true);
    browser.advance(10000);
    assert.equal(browser.controller.getPhase(), 'bite-one');
    browser.visibility(false);
    browser.advance(249);
    assert.equal(browser.controller.getPhase(), 'bite-one');
    browser.advance(1);
    assert.equal(browser.controller.getPhase(), 'bite-two');
    browser.controller.pause();
    browser.advance(10000);
    assert.equal(browser.controller.getPhase(), 'bite-two');
    browser.controller.resume();
    browser.controller.pause();
    assert.ok(browser.overlay.classList.contains('learning-reward-paused'));
    browser.controller.start({ id: 'new' });
    assert.ok(!browser.overlay.classList.contains('learning-reward-paused'), 'a restarted celebration can animate again');
    const count = browser.events.length;
    stale();
    assert.equal(browser.events.length, count);
    assert.equal(browser.controller.getPhase(), 'bite-one');
    browser.controller.cancel();
    browser.advance(10000);
    assert.equal(browser.finishes.length, 0);
    assert.equal(browser.controller.getPhase(), 'idle');
    assert.equal(browser.timers.size, 0);
    browser.controller.destroy();
    assert.equal(browser.document.body.children.length, 1);
    assert.equal(browser.document.listeners.size, 0);
    assert.equal(browser.windowListeners.size, 0);
});

test('reduced motion retains distinct static bite stages and permits immediate skip', () => {
    const browser = fixture(true);
    browser.controller.start({ id: 'static' });
    assert.ok(browser.overlay.classList.contains('learning-reward-reduced-motion'));
    browser.advance(800);
    assert.equal(browser.controller.getPhase(), 'apple-top');
    browser.controller.finish();
    assert.equal(browser.finishes[0].reason, 'skip');
    assert.equal(browser.finishes[0].lastPhase, 'apple-top');
    assert.equal(browser.overlay.hidden, true);
    browser.advance(10000);
    assert.equal(browser.finishes.length, 1);
    assert.ok(!browser.document.listeners.has('keydown'));
    assert.ok(!browser.windowListeners.has('keydown'));
    browser.controller.destroy();
});

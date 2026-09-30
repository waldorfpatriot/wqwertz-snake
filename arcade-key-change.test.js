const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameIds = ['breakout', 'invaders', 'pinball', 'mario', 'qwertzman', 'qwertzoids', 'frogqwertz'];
const copy = value => JSON.parse(JSON.stringify(value));

function harness(sourcePath, gameId) {
    let now = 1000;
    let nextFrameId = 0;
    const frames = new Map();
    const listeners = new Map();
    const elements = new Map();
    const statistics = [];
    const context2d = new Proxy({}, {
        get: (target, key) => target[key] || (() => {}),
        set: (target, key, value) => { target[key] = value; return true; }
    });

    function element() {
        const classes = new Set();
        const events = new Map();
        return {
            dataset: {}, style: {}, innerHTML: '', textContent: '', value: '',
            classList: {
                add: (...names) => names.forEach(name => classes.add(name)),
                remove: (...names) => names.forEach(name => classes.delete(name)),
                contains: name => classes.has(name),
                toggle(name, force) {
                    const active = force === undefined ? !classes.has(name) : force;
                    if (active) classes.add(name);
                    else classes.delete(name);
                }
            },
            appendChild() {}, setAttribute() {}, removeAttribute() {},
            querySelectorAll: () => [],
            addEventListener: (name, callback) => events.set(name, callback),
            click: () => events.get('click')?.(),
            getContext: () => context2d
        };
    }

    const document = {
        readyState: 'complete',
        body: { dataset: { game: gameId } },
        createElement: element,
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, element());
            return elements.get(id);
        },
        addEventListener: (name, callback) => listeners.set(name, callback)
    };
    const window = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, sourcePath), 'utf8'), {
        window, document,
        Date: { now: () => now },
        performance: { now: () => now },
        localStorage: { getItem: () => null, setItem() {} },
        fetch(url, options) {
            statistics.push({ url, payload: JSON.parse(options.body) });
            return Promise.resolve();
        },
        requestAnimationFrame(callback) {
            const id = ++nextFrameId;
            frames.set(id, callback);
            return id;
        },
        cancelAnimationFrame: id => frames.delete(id)
    }, { filename: sourcePath });

    assert.ok(window.qwertzArcade, 'the page initializes the real controller');
    return {
        arcade: window.qwertzArcade, frames, elements, statistics,
        get now() { return now; },
        advance(ms) { now += ms; },
        down(key, repeat = false) {
            listeners.get('keydown')({ key, repeat, preventDefault() {} });
        },
        up(key) { listeners.get('keyup')({ key }); },
        frame(ms = 16) {
            assert.equal(frames.size, 1, 'exactly one animation callback is queued');
            now += ms;
            const [id, callback] = frames.entries().next().value;
            frames.delete(id);
            callback(now);
        }
    };
}

function snapshot(arcade) {
    return copy({
        game: arcade.game,
        state: arcade.state,
        counters: arcade.counters,
        controls: arcade.controlKeys,
        keyIndexes: arcade.keyIndexes,
        lastFrame: arcade.lastFrame,
        running: arcade.running,
        finished: arcade.finished
    });
}

for (const sourcePath of ['arcade-shared.js', 'iPad/Web/arcade-shared.js']) {
    for (const gameId of gameIds) {
        test(`${sourcePath}: ${gameId} pauses until the announced key is freshly pressed`, () => {
            const h = harness(sourcePath, gameId);
            const arcade = h.arcade;
            const action = arcade.config.actions[0];
            const otherAction = arcade.config.actions.at(-1);
            const oldKey = arcade.controlKeys[action.id];
            const otherKey = arcade.controlKeys[otherAction.id];

            h.down(' ');
            h.down(otherKey);
            h.frame();
            h.advance(1984);
            for (let press = 0; press < 9; press++) {
                h.down(oldKey);
                h.up(oldKey);
            }
            assert.equal(arcade.pendingConfirmation, null, 'nine presses keep the game active');
            const staleFrame = h.frames.values().next().value;
            h.down(oldKey);

            const announcedKey = arcade.controlKeys[action.id];
            assert.notEqual(announcedKey, oldKey);
            assert.equal(arcade.pendingConfirmation, announcedKey);
            assert.equal(h.elements.get('keyChangeModal').classList.contains('visible'), true);
            assert.equal(arcade.state.totalKeystrokes, 11);
            assert.equal(h.frames.size, 0, 'showing the announcement cancels the next frame');
            assert.deepEqual(copy(arcade.keysDown), {}, 'all held actions are cleared');
            const frozen = snapshot(arcade);
            const frozenKpm = h.elements.get('kpm').textContent;

            h.advance(60000);
            h.down(oldKey);
            h.down(otherKey);
            h.down('!');
            h.down(' ');
            h.down(announcedKey, true);
            h.elements.get('restartButton').click();
            h.elements.get('testLevelButton').click();
            staleFrame(h.now);
            staleFrame(h.now + 16);

            assert.deepEqual(snapshot(arcade), frozen, 'game physics, score and typing progress stay frozen');
            assert.equal(h.elements.get('kpm').textContent, frozenKpm, 'the displayed rate stays frozen');
            assert.equal(arcade.pendingConfirmation, announcedKey, 'a repeated key cannot dismiss the announcement');
            assert.equal(h.frames.size, 0, 'stale callbacks and ignored inputs cannot restart the loop');
            assert.deepEqual(copy(arcade.keysDown), {}, 'ignored inputs do not hold any action');

            h.down(announcedKey.toUpperCase());
            assert.equal(arcade.pendingConfirmation, null);
            assert.equal(h.elements.get('keyChangeModal').classList.contains('visible'), false);
            assert.equal(arcade.state.totalKeystrokes, 11, 'confirmation does not count as a gameplay press');
            assert.equal(h.now - arcade.state.startedAt, 2000, 'the minute spent reading is excluded from play time');
            assert.equal(h.frames.size, 1, 'confirmation schedules only one resumed loop');
            assert.deepEqual(copy(arcade.keysDown), {}, 'old held actions stay released on resume');

            const expectedGame = copy(arcade.game);
            let expectedScore = arcade.state.score;
            arcade.config.update(expectedGame, 0.005, {}, {
                score: expectedScore,
                addScore(points) { expectedScore += points; this.score = expectedScore; },
                win() { assert.fail('the resumed fixture unexpectedly wins'); },
                lose() { assert.fail('the resumed fixture unexpectedly loses'); }
            });
            h.frame(5);
            assert.deepEqual(copy(arcade.game), expectedGame, 'the resumed update uses a fresh 5 ms frame with released controls');
            assert.equal(arcade.state.score, expectedScore);
            assert.equal(Number(h.elements.get('kpm').textContent), Math.round(11 * 60000 / 2005));
            assert.equal(h.frames.size, 1, 'the next frame preserves a single animation loop');

            arcade.finish(false, 'test complete');
            assert.equal(h.statistics.length, 1);
            assert.equal(h.statistics[0].payload.duration, 2, 'saved duration excludes time reading the key');
            assert.equal(h.statistics[0].payload.kpm, 330, 'saved typing rate excludes time reading the key');
        });
    }
}

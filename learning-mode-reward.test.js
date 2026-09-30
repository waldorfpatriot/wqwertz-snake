const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('./learning-engine');
const progress = require('./learning-progress');
const rewardModule = require('./learning-reward');

function harness(options = {}) {
    const clock = { now: 1000 };
    const listeners = new Map();
    const timers = new Map();
    const events = [];
    let timerId = 0;
    let session;
    let store;
    let completions = 0;
    let rewardOptions;
    let rewardCurrent = null;
    let rewardCancels = 0;
    const rewardStarts = [];
    const values = new Map();
    const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
    function element() {
        return {
            dataset: {}, hidden: false, innerHTML: '', textContent: '',
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
            addEventListener(name, fn) { listeners.set(this === shell ? 'shell:' + name : name, fn); },
            removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
            insertBefore() {}, remove() {}, focus() {}
        };
    }
    const shell = element();
    const nameInput = element();
    nameInput.value = '';
    shell.querySelector = selector => {
        if (selector === '#learningName') return nameInput;
        if (selector !== '.learning-result-card .learning-primary') return null;
        const button = shell.innerHTML.match(/<button\b[^>]*class="[^"]*\blearning-primary\b[^"]*"[^>]*>/);
        if (!button) return null;
        const action = button[0].match(/data-action="([^"]+)"/);
        const lesson = button[0].match(/data-lesson="([^"]+)"/);
        return { click: () => click(action[1], lesson && lesson[1]) };
    };
    const keyboard = element();
    const container = element();
    const canvas = element();
    canvas.width = canvas.height = 390;
    canvas.closest = () => container;
    const drawing = new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
    canvas.getContext = () => drawing;
    const document = {
        body: element(), hidden: false, createElement: () => shell,
        getElementById: () => element(),
        dispatchEvent: event => events.push(event),
        addEventListener: (name, fn) => listeners.set('document:' + name, fn), removeEventListener() {}
    };
    const reward = {
        start(value) { rewardCurrent = value; rewardStarts.push(value); },
        finish() { if (rewardCurrent) { const value = rewardCurrent; rewardCurrent = null; rewardOptions.onFinish(value); } },
        cancel() { rewardCurrent = null; rewardCancels++; }, destroy() { this.cancel(); }
    };
    const window = {
        QwertzLearningEngine: { ...engine, createSession(id, options) { session = engine.createSession(id, { ...options, now: () => clock.now }); return session; } },
        QwertzLearningProgress: { createStore() {
            store = progress.createStore({ storage, now: () => clock.now });
            if (options.named !== false) store.renameProfile('Mia');
            const complete = store.completeLesson;
            for (const id of options.completed || []) {
                const lesson = engine.createSession(id, { now: () => clock.now });
                while (lesson.getState().stage !== 'result') {
                    const current = lesson.getState();
                    if (current.needsBackspace) lesson.backspace();
                    else lesson.submitKey(current.expectedKey);
                }
                complete(lesson.getState().result);
            }
            store.completeLesson = result => { completions++; return complete(result); };
            return store;
        } },
        QwertzLearningReward: {
            assets: rewardModule.assets,
            mount(options) { rewardOptions = options; return reward; },
            geometry: rewardModule.geometry
        },
        addEventListener: (name, fn) => listeners.set('window:' + name, fn), removeEventListener() {}
    };
    if (options.classroom) window.QwertzLearningClassroom = { createClient: () => options.classroom, cleanName: require('./learning-classroom-client').cleanName };
    const context = vm.createContext({
        window, document,
        Image: class { constructor() { this.complete = true; this.naturalWidth = 100; } },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
        clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(fs.readFileSync(require.resolve('./learning-mode'), 'utf8'), context);
    const mode = window.QwertzLearningMode.mount({ canvas, keyboard });
    function click(action, lesson) { listeners.get('shell:click')({ target: { closest: () => ({ disabled: false, dataset: { action, lesson } }) } }); }
    function down(key, repeat = false) { mode.handleKey({ key, code: key === ' ' ? 'Space' : '', repeat, preventDefault() {} }); }
    function up(key) { mode.handleKeyUp({ key, code: key === ' ' ? 'Space' : '' }); }
    function type(key) { clock.now += 10; down(key); up(key); }
    function finishStage() {
        const stage = session.getState().stage;
        while (session.getState().stage === stage) type(session.getState().needsBackspace ? 'Backspace' : session.getState().expectedKey);
    }
    function timer() {
        const first = timers.entries().next().value;
        assert.ok(first, 'a bridge movement should be scheduled');
        timers.delete(first[0]); clock.now += first[1].delay; first[1].fn();
    }
    function flushTimers() { while (timers.size) timer(); }
    return {
        mode, canvas, shell, clock, reward, rewardStarts, rewardOptions, events, storage,
        submitName(name) { nameInput.value = name; return listeners.get('shell:submit')({ target: { id: 'learningNameForm' }, preventDefault() {} }); },
        click, down, up, type, finishStage, timer, flushTimers,
        blur() { listeners.get('window:blur')(); },
        get session() { return session; }, get store() { return store; },
        get completions() { return completions; }, get rewardCancels() { return rewardCancels; }, get timerCount() { return timers.size; }
    };
}

test('an unnamed pupil must enter a name before learning, and blur safely preserves the name screen', async () => {
    const h = harness({ named: false });
    h.mode.open();
    assert.match(h.shell.innerHTML, /Wie heißt du/);
    h.down('f'); h.down('Escape'); h.blur();
    assert.equal(h.session, undefined);
    await h.submitName('   ');
    assert.equal(h.session, undefined);
    await h.submitName('  Änne K.  ');
    assert.equal(h.store.getCurrentProfile().nickname, 'Änne K.');
    assert.equal(h.session.getState().lessonId, 'home-fj');
});

test('closing during enrollment excludes late lesson starts and preserves the entered local name', async () => {
    let resolveEnrollment;
    const classroom = { syncProfiles() {}, syncProfile: () => new Promise(resolve => { resolveEnrollment = resolve; }), destroy() {} };
    const h = harness({ named: false, classroom });
    h.mode.open();
    const submitted = h.submitName('Noah M.');
    h.mode.close();
    resolveEnrollment({ status: 'online' });
    await submitted;
    assert.equal(h.session, undefined);
    assert.equal(h.store.getCurrentProfile().nickname, 'Noah M.');
    assert.equal(h.mode.isActive(), false);
});

test('a completed demo stays at its apple while next-stage input and reward time are excluded', () => {
    const h = harness();
    h.mode.open(); h.click('lesson', 'home-fj');
    h.finishStage();
    assert.equal(h.session.getState().stage, 'feed');
    assert.equal(h.session.getState().paused, true);
    assert.equal(h.canvas.dataset.learningHeadIndex, h.canvas.dataset.learningEndIndex);
    assert.equal(h.canvas.dataset.learningEndIndex, engine.getLesson('home-fj').demoTargets.length + 2);
    assert.match(h.shell.innerHTML, /4 \/ 4 Tasten gefunden/);
    const frozen = h.session.exportSnapshot();
    h.clock.now += 12000;
    h.type('x'); h.type('f');
    assert.deepEqual(h.session.exportSnapshot().stageData, frozen.stageData);
    h.reward.finish();
    assert.equal(h.session.getState().paused, false);
    assert.equal(h.session.getState().targetIndex, 0);
    assert.equal(h.session.getState().stageStats.activeMs, 0);
    h.type(h.session.getState().expectedKey);
    assert.equal(h.session.getState().stageStats.activeMs, 10);
    assert.equal(h.session.getState().stageStats.characterAttempts, 1);
});

test('wrong final writing input and correction keep the apple fixed, then save exactly one durable result', () => {
    const h = harness({ completed: ['home-fj', 'home-backspace'] });
    h.mode.open(); h.click('lesson', 'home-dk');
    h.finishStage(); h.reward.finish();
    h.finishStage(); h.reward.finish();
    while (h.session.getState().targetIndex < h.session.getState().targets.length - 1) h.type(h.session.getState().expectedKey);
    const apple = [h.canvas.dataset.learningAppleX, h.canvas.dataset.learningAppleY];
    const head = h.canvas.dataset.learningHeadIndex;
    const final = h.session.getState().expectedKey;
    h.type('x');
    assert.equal(h.rewardStarts.length, 2);
    assert.equal(h.canvas.dataset.learningHeadIndex, head);
    assert.deepEqual([h.canvas.dataset.learningAppleX, h.canvas.dataset.learningAppleY], apple);
    assert.equal(h.session.getState().needsBackspace, true);
    h.type('Backspace');
    assert.equal(h.canvas.dataset.learningHeadIndex, head);
    h.type(final);
    assert.equal(h.rewardStarts.length, 3);
    assert.equal(h.canvas.dataset.learningHeadIndex, h.canvas.dataset.learningEndIndex);
    assert.deepEqual([h.canvas.dataset.learningAppleX, h.canvas.dataset.learningAppleY], apple);
    assert.equal(h.completions, 1);
    const result = h.session.getState().result;
    assert.equal(result.errors, 1); assert.equal(result.corrections, 1);
    const reloaded = progress.createStore({ storage: h.storage });
    assert.equal(reloaded.getCurrentProfile().results.at(-1).id, result.id);
    assert.equal(reloaded.getResume(), null);
    h.reward.finish(); h.up(final); h.mode.open();
    assert.equal(h.completions, 1);
    assert.equal(h.events.filter(event => event.type === 'qwertz-learning-complete').length, 1);
});

test('leaving or restarting a mission cancels rewards and stale completion cannot unpause the new mission', () => {
    const h = harness();
    h.mode.open(); h.click('lesson', 'home-fj'); h.finishStage();
    const old = h.rewardStarts[0];
    h.mode.open();
    assert.ok(h.rewardCancels >= 2);
    assert.equal(h.store.getResume().stage, 'feed');
    h.click('lesson', 'home-fj'); h.finishStage();
    const currentId = h.rewardStarts[1].id;
    assert.notEqual(currentId, old.id);
    h.rewardOptions.onFinish(old);
    assert.equal(h.session.getState().paused, true);
    assert.match(h.shell.innerHTML, /4 \/ 4 Tasten gefunden/);
    h.reward.finish();
    assert.equal(h.session.getState().paused, false);
});

test('a held final key cannot leak into the next stage, and leaving the window keeps it paused', () => {
    const h = harness();
    h.mode.open(); h.click('lesson', 'home-fj');
    for (let index = 0; index < 3; index++) h.type(h.session.getState().expectedKey);
    h.down(h.session.getState().expectedKey);
    h.reward.finish();
    h.down('f'); h.up('f');
    assert.equal(h.session.getState().stageStats.characterAttempts, 0);
    h.up('j');
    h.finishStage();
    assert.equal(h.session.getState().stage, 'write');
    h.blur(); h.clock.now += 5000; h.reward.finish();
    assert.equal(h.session.getState().paused, true);
    h.type('f');
    assert.equal(h.session.getState().stageStats.characterAttempts, 0);
    assert.equal(h.session.getState().stageStats.activeMs, 0);
    h.click('pause'); h.type(h.session.getState().expectedKey);
    assert.equal(h.session.getState().stageStats.characterAttempts, 1);
    assert.equal(h.session.getState().stageStats.activeMs, 10);
});

test('the bridge rewards arrival after the final straight segment, with no extra lesson result', () => {
    const h = harness();
    const prerequisite = engine.createSession('home-fj', { now: () => h.clock.now });
    while (prerequisite.getState().stage !== 'result') prerequisite.submitKey(prerequisite.getState().expectedKey);
    h.store.completeLesson(prerequisite.getState().result);
    const correction = engine.createSession('home-backspace', { now: () => h.clock.now });
    while (correction.getState().stage !== 'result') {
        if (correction.getState().needsBackspace) correction.backspace();
        else correction.submitKey(correction.getState().expectedKey);
    }
    h.store.completeLesson(correction.getState().result);
    h.mode.open(); h.click('lesson', 'home-dk');
    for (let stage = 0; stage < 3; stage++) { h.finishStage(); h.reward.finish(); }
    const completions = h.completions;
    h.click('bridge');
    for (const key of ['j', 'd', 'f', 'k', 'j', 'd']) { h.type(key); h.flushTimers(); }
    assert.equal(h.rewardStarts.length, 3);
    h.type('f');
    assert.equal(h.rewardStarts.length, 3);
    for (let step = 0; step < 3; step++) { h.timer(); assert.equal(h.rewardStarts.length, 3); }
    h.timer();
    assert.equal(h.timerCount, 0);
    assert.equal(h.rewardStarts.length, 4);
    assert.match(h.rewardStarts[3].title, /Alle Kurven/);
    assert.equal(h.canvas.dataset.learningHeadIndex, h.canvas.dataset.learningEndIndex);
    assert.equal(h.store.getCurrentProfile().preferences.bridgeComplete, true);
    assert.equal(h.completions, completions);
    h.reward.finish();
    assert.equal(h.completions, completions);
});

test('the Rücktaste mission teaches deletion before replacement without scoring example errors', () => {
    const h = harness({ completed: ['home-fj'] });
    h.mode.open();
    assert.match(h.shell.innerHTML, /Die Rücktaste/);
    assert.match(h.shell.innerHTML, /⌫ Rücktaste/);
    h.click('lesson', 'home-backspace');
    assert.equal(h.session.getState().expectedKey, 'backspace');
    assert.match(h.shell.innerHTML, /Beispiel-Tippfehler/);
    h.type('Delete'); h.type('f');
    assert.equal(h.session.getState().guidedCorrectionPending, true);
    assert.equal(h.session.getState().stats.errors, 0);
    h.type('Backspace');
    assert.equal(h.session.getState().guidedCorrectionPending, false);
    assert.equal(h.session.getState().expectedKey, 'f');
    assert.match(h.shell.innerHTML, /Gelöscht! Tippe jetzt F/);
    const saved = progress.createStore({ storage: h.storage }).getResume();
    assert.equal(saved.stageData.demo.guidedDeleted[0], true);
    h.mode.open(); h.click('continue');
    assert.equal(h.session.getState().guidedCorrectionPending, false);
    assert.match(h.shell.innerHTML, /id="learningFeedback"[^>]*>Tippe jetzt F\./);
    h.type('f');
    assert.equal(h.session.getState().guidedCorrectionPending, true);
    for (let stage = 0; stage < 3; stage++) { h.finishStage(); h.reward.finish(); }
    const result = h.session.getState().result;
    assert.equal(result.errors, 0);
    assert.equal(result.corrections, 0);
    assert.equal(result.backspaces, 0);
    assert.equal(result.accuracyPercent, 100);
    assert.equal(h.store.getCurrentProfile().completedLessons['home-backspace'].bestResult.id, result.id);
});

test('inserting the Rücktaste lesson keeps previously completed missions playable', () => {
    const h = harness({ completed: ['home-fj', 'home-dk'] });
    h.mode.open(); h.click('lesson', 'home-dk');
    assert.equal(h.session.getState().lessonId, 'home-dk');
});

test('Space continues the success screen once and must be released before the next lesson accepts input', () => {
    const h = harness();
    h.mode.open(); h.click('lesson', 'home-fj');
    for (let stage = 0; stage < 2; stage++) { h.finishStage(); h.reward.finish(); }
    h.finishStage();
    h.mode.handleKey({ key: 'Unidentified', code: 'Space', preventDefault() {} });
    assert.equal(h.session.getState().stage, 'result');
    assert.match(h.shell.innerHTML, /Mit der Leertaste geht es weiter/);
    h.down(' ', true); h.down(' ');
    assert.equal(h.session.getState().lessonId, 'home-fj');
    h.up(' ');
    h.type('f');
    assert.equal(h.session.getState().stage, 'result');
    let prevented = false;
    h.mode.handleKey({ key: 'Unidentified', code: 'Space', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(h.session.getState().lessonId, 'home-backspace');
    assert.equal(h.session.getState().stage, 'demo');
    h.down(' ', true); h.down(' '); h.type('Backspace');
    assert.equal(h.session.getState().guidedCorrectionPending, true);
    assert.equal(h.session.getState().stats.errors, 0);
    h.up(' '); h.type('Backspace');
    assert.equal(h.session.getState().guidedCorrectionPending, false);
    assert.equal(h.completions, 1);
});

test('Space follows the success screen’s primary bridge action', () => {
    const h = harness({ completed: ['home-fj', 'home-backspace'] });
    h.mode.open(); h.click('lesson', 'home-dk');
    for (let stage = 0; stage < 3; stage++) { h.finishStage(); h.reward.finish(); }
    h.type(' ');
    assert.match(h.shell.innerHTML, /Erste Kurven/);
    assert.equal(h.timerCount, 0);
    h.type('j');
    assert.equal(h.timerCount, 1);
});

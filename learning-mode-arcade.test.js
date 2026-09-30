const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('./learning-engine');
const progress = require('./learning-progress');
const rewardModule = require('./learning-reward');

const copy = value => JSON.parse(JSON.stringify(value));
const arcadeRotation = ['breakout', 'tetris', 'qwertzman', 'breakout', 'tetris', 'qwertzman'];
const gameFor = lesson => arcadeRotation[(lesson.number / 3 - 1) % arcadeRotation.length];
const targetFor = lesson => ['breakout', 'tetris'].includes(gameFor(lesson)) ? 100 : 10;

function completedResult(lessonId, now) {
    const session = engine.createSession(lessonId, { now });
    while (session.getState().stage !== 'result') {
        const current = session.getState();
        if (current.needsBackspace) session.backspace();
        else session.submitKey(current.expectedKey);
    }
    return session.getState().result;
}

function harness(options = {}) {
    const clock = { now: 1000 };
    const listeners = new Map();
    const timers = new Map();
    const events = [];
    const classroomProfiles = [];
    const values = new Map();
    const storage = options.storage || {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value)
    };
    let timerId = 0;
    let store;
    let session;
    let lessonCompletions = 0;
    let rewardOptions;
    let rewardCurrent = null;
    let arcadeOptions;
    let arcadeCurrent = null;
    let arcadeCancels = 0;
    let arcadePlays = 0;
    let arcadeRestarts = 0;
    const arcadeStarts = [];
    const arcadeKeys = [];
    const arcadeKeyUps = [];

    function element() {
        return {
            dataset: {}, hidden: false, innerHTML: '', textContent: '', value: '',
            classList: { add() {}, remove() {}, toggle() {} },
            setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
            addEventListener(name, fn) { listeners.set(this === shell ? 'shell:' + name : name, fn); },
            removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
            insertBefore() {}, remove() {}, focus() {}
        };
    }
    const shell = element();
    const nameInput = element();
    const nicknameInput = element();
    shell.querySelector = selector => selector === '#learningName' ? nameInput : selector === '#learningNickname' ? nicknameInput : null;
    const keyboard = element();
    const container = element();
    const canvas = element();
    canvas.width = canvas.height = 390;
    canvas.closest = () => container;
    canvas.getContext = () => new Proxy({}, {
        get: (target, key) => target[key] || (() => {}),
        set: (target, key, value) => { target[key] = value; return true; }
    });
    const document = {
        body: element(), hidden: false, createElement: () => shell,
        getElementById: () => element(),
        dispatchEvent: event => events.push(event),
        addEventListener: (name, fn) => listeners.set('document:' + name, fn), removeEventListener() {}
    };
    const reward = {
        start(value) { rewardCurrent = value; },
        finish() {
            if (!rewardCurrent) return;
            const value = rewardCurrent;
            rewardCurrent = null;
            rewardOptions.onFinish(value);
        },
        cancel() { rewardCurrent = null; },
        destroy() { this.cancel(); }
    };
    const arcade = {
        start(lesson) {
            const current = typeof lesson === 'string' ? engine.getLesson(lesson) : lesson;
            assert.ok(current && current.id, 'the arcade receives a curriculum lesson');
            const gameId = gameFor(current);
            const target = targetFor(current);
            arcadeStarts.push(current);
            arcadeCurrent = {
                challenge: {
                    lessonId: current.id, number: current.number, gameId,
                    title: gameId === 'breakout' ? 'Breakout' : gameId, target, taughtKeys: current.taughtKeys.slice(),
                    actions: [{ id: 'left', label: 'Links', arrow: '←' }, { id: 'right', label: 'Rechts', arrow: '→' }],
                    controls: { left: 'f', right: 'j' }, instructions: `Erreiche ${target} Punkte mit F und J.`
                },
                score: 0, status: 'ready'
            };
            arcadeOptions.onChange(this.getState());
            return this.getState();
        },
        play() { arcadePlays++; arcadeCurrent.status = 'playing'; arcadeOptions.onChange(this.getState()); },
        restart() { arcadeRestarts++; arcadeCurrent.score = 0; arcadeCurrent.status = 'playing'; arcadeOptions.onChange(this.getState()); },
        pause(force) {
            if (!arcadeCurrent || !['playing', 'paused'].includes(arcadeCurrent.status)) return;
            const paused = force === undefined ? arcadeCurrent.status !== 'paused' : force;
            arcadeCurrent.status = paused ? 'paused' : 'playing';
            arcadeOptions.onChange(this.getState());
        },
        handleKey(event) { arcadeKeys.push(event.key); return true; },
        handleKeyUp(event) { arcadeKeyUps.push(event.key); return true; },
        getState() { return arcadeCurrent ? copy(arcadeCurrent) : null; },
        draw() {},
        cancel() { arcadeCancels++; arcadeCurrent = null; arcadeOptions.onChange(this.getState()); },
        destroy() { this.cancel(); },
        score(value, status = 'playing') {
            arcadeCurrent.score = value;
            arcadeCurrent.status = status;
            arcadeOptions.onChange(this.getState());
        },
        complete(value = arcadeCurrent.challenge.target) {
            this.score(value, 'complete');
            arcadeOptions.onComplete(this.getState());
        },
        staleComplete(state) { arcadeOptions.onComplete(copy(state)); }
    };
    const classroom = {
        getStatus: () => ({ status: 'offline', message: '' }),
        syncProfiles() { return Promise.resolve(); },
        syncProfile(profile) { classroomProfiles.push(copy(profile)); return Promise.resolve({ status: 'online' }); },
        destroy() {}
    };
    const window = {
        QwertzLearningEngine: {
            ...engine,
            createSession(id, settings) {
                session = engine.createSession(id, { ...settings, now: () => clock.now });
                return session;
            }
        },
        QwertzLearningProgress: {
            createStore() {
                store = progress.createStore({ storage, now: () => clock.now });
                if (!store.getCurrentProfile().nickname) store.renameProfile('Mia');
                for (const lesson of engine.getLessons().slice(0, options.completed || 0)) {
                    const result = completedResult(lesson.id, () => clock.now);
                    store.completeLesson(result);
                    if (lesson.number % 3 === 0) {
                        store.completeArcadeChallenge({ lessonId: lesson.id, resultId: result.id, score: targetFor(lesson) });
                    }
                }
                const complete = store.completeLesson;
                store.completeLesson = result => { lessonCompletions++; return complete(result); };
                return store;
            }
        },
        QwertzLearningReward: {
            assets: rewardModule.assets, geometry: rewardModule.geometry,
            mount(settings) { rewardOptions = settings; return reward; }
        },
        QwertzLearningArcade: { getChallenge: require('./learning-arcade').getChallenge, mount(settings) { arcadeOptions = settings; return arcade; } },
        addEventListener: (name, fn) => listeners.set('window:' + name, fn), removeEventListener() {}
    };
    if (options.classroom) window.QwertzLearningClassroom = {
        createClient: () => classroom,
        cleanName: require('./learning-classroom-client').cleanName
    };
    const context = vm.createContext({
        window, document,
        Image: class { constructor() { this.complete = true; this.naturalWidth = 100; } },
        CustomEvent: class { constructor(type, settings) { this.type = type; this.detail = settings.detail; } },
        setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
        clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(fs.readFileSync(require.resolve('./learning-mode'), 'utf8'), context);
    const mode = window.QwertzLearningMode.mount({ canvas, keyboard });
    function click(action, lesson) {
        listeners.get('shell:click')({ target: { closest: () => ({ disabled: false, dataset: { action, lesson } }) } });
    }
    function down(key) { mode.handleKey({ key, code: key === ' ' ? 'Space' : '', repeat: false, preventDefault() {} }); }
    function up(key) { mode.handleKeyUp({ key, code: key === ' ' ? 'Space' : '' }); }
    function type(key) { clock.now += 10; down(key); up(key); }
    function finishStage() {
        const stage = session.getState().stage;
        while (session.getState().stage === stage) {
            const current = session.getState();
            type(current.needsBackspace ? 'Backspace' : current.expectedKey);
        }
    }
    function finishLesson() {
        for (let stage = 0; stage < 3; stage++) {
            finishStage();
            reward.finish();
        }
        return store.getCurrentProfile().results.at(-1);
    }
    return {
        mode, shell, canvas, storage, clock, reward, arcade, arcadeStarts, arcadeKeys, arcadeKeyUps,
        events, classroomProfiles, click, down, up, type, finishStage, finishLesson,
        blur() { listeners.get('window:blur')(); },
        switchProfile(id) { listeners.get('shell:change')({ target: { id: 'learningProfileSelect', value: id } }); },
        createProfile(name) { nicknameInput.value = name; click('create-profile'); return store.getCurrentProfile(); },
        get store() { return store; }, get session() { return session; },
        get lessonCompletions() { return lessonCompletions; }, get arcadeCancels() { return arcadeCancels; },
        get arcadePlays() { return arcadePlays; }, get arcadeRestarts() { return arcadeRestarts; }
    };
}

test('finishing a lesson outside the third-lesson milestones leaves normal learning available', () => {
    const h = harness({ completed: 1 });
    h.mode.open(); h.click('lesson', 'home-backspace');
    h.finishLesson();
    assert.equal(h.arcadeStarts.length, 0);
    assert.equal(h.store.getCurrentProfile().arcadeChallenge, null);
    h.click('lesson', 'home-dk');
    assert.equal(h.session.getState().lessonId, 'home-dk');
    assert.equal(h.session.getState().stage, 'demo');
});

test('each third lesson opens an arcade challenge after its final apple reward with only its taught keys', () => {
    for (const number of [3, 6, 9, 12, 15, 18]) {
        const lesson = engine.getLessons()[number - 1];
        const h = harness({ completed: number - 1 });
        h.mode.open(); h.click('lesson', lesson.id);
        h.finishStage(); h.reward.finish();
        h.finishStage(); h.reward.finish();
        h.finishStage();
        const result = h.session.getState().result;
        assert.equal(h.arcadeStarts.length, 0, 'the final apple reward finishes first');
        assert.deepEqual(h.store.getCurrentProfile().arcadeChallenge, { lessonId: lesson.id, resultId: result.id });
        h.reward.finish();
        assert.equal(h.arcadeStarts.length, 1);
        assert.equal(h.arcadeStarts[0].id, lesson.id);
        assert.deepEqual(h.arcadeStarts[0].taughtKeys, lesson.taughtKeys);
        const target = [100, 100, 10, 100, 100, 10][number / 3 - 1];
        assert.equal(h.arcade.getState().challenge.gameId, arcadeRotation[number / 3 - 1]);
        assert.equal(h.arcade.getState().challenge.target, target);
        assert.match(h.shell.innerHTML, new RegExp(`Sammle ${target} Punkte`));
        assert.match(h.shell.innerHTML, new RegExp(`aria-valuemax="${target}"`));
        assert.match(h.shell.innerHTML, /data-action="challenge-start"/);
        h.arcade.complete(target - 1);
        h.click('challenge-continue');
        assert.ok(h.store.getCurrentProfile().arcadeChallenge, 'one point below the game target keeps the lesson gate');
        assert.equal(h.session.getState().lessonId, lesson.id);
        h.arcade.complete(target);
        assert.equal(h.store.getCurrentProfile().arcadeChallenge, null);
        assert.match(h.shell.innerHTML, new RegExp(`${target} / ${target} Punkte`));
        assert.equal(h.lessonCompletions, 1);
        h.mode.destroy();
    }
});

test('a pending challenge blocks next lessons through both their buttons and the home continue action', () => {
    const h = harness({ completed: 2 });
    h.mode.open(); h.click('lesson', 'home-dk');
    h.finishLesson();
    const pending = h.store.getCurrentProfile().arcadeChallenge;
    h.click('lesson', 'home-sl');
    assert.equal(h.session.getState().lessonId, 'home-dk');
    assert.match(h.shell.innerHTML, /data-action="challenge-start"/);
    h.click('home');
    assert.ok(h.arcadeCancels > 0);
    assert.deepEqual(h.store.getCurrentProfile().arcadeChallenge, pending);
    h.click('continue');
    assert.equal(h.arcade.getState().challenge.lessonId, 'home-dk');
    h.click('home'); h.click('lesson', 'home-fj');
    assert.equal(h.session.getState().lessonId, 'home-fj', 'earlier lessons remain playable');
    assert.deepEqual(h.store.getCurrentProfile().arcadeChallenge, pending);
    h.click('home'); h.click('lesson', 'home-sl');
    assert.equal(h.arcade.getState().challenge.lessonId, 'home-dk');
});

test('replaying an earlier milestone preserves the later pending arcade challenge', () => {
    const h = harness({ completed: 5 });
    h.mode.open(); h.click('lesson', 'home-space');
    const sixth = h.finishLesson();
    const pending = { lessonId: 'home-space', resultId: sixth.id };
    h.click('home'); h.click('lesson', 'home-dk');
    h.finishLesson();
    assert.deepEqual(h.store.getCurrentProfile().arcadeChallenge, pending);
    assert.equal(h.arcade.getState().challenge.lessonId, 'home-space');
    assert.equal(h.arcade.getState().challenge.gameId, 'tetris');
    assert.equal(h.arcade.getState().challenge.target, 100);
    h.arcade.complete(99); h.click('challenge-continue');
    assert.deepEqual(h.store.getCurrentProfile().arcadeChallenge, pending);
    assert.equal(h.session.getState().lessonId, 'home-dk');
    h.arcade.complete(); h.click('challenge-continue');
    assert.equal(h.session.getState().lessonId, 'reach-gh');
});

test('a failed Breakout round can retry, 99 points keep the gate, and 100 points unlock lesson four', () => {
    const h = harness({ completed: 2 });
    h.mode.open(); h.click('lesson', 'home-dk');
    h.finishLesson();
    h.click('challenge-start');
    assert.equal(h.arcadePlays, 1);
    h.arcade.score(4, 'lost');
    assert.match(h.shell.innerHTML, /data-action="challenge-retry"/);
    h.click('challenge-retry');
    assert.equal(h.arcadeRestarts, 1);
    assert.equal(h.arcade.getState().score, 0);
    assert.equal(h.arcade.getState().status, 'playing');
    h.arcade.complete(99);
    h.click('challenge-continue');
    assert.ok(h.store.getCurrentProfile().arcadeChallenge);
    assert.equal(h.session.getState().lessonId, 'home-dk');
    h.arcade.complete(100);
    assert.equal(h.store.getCurrentProfile().arcadeChallenge, null);
    assert.match(h.shell.innerHTML, /data-action="challenge-continue"/);
    h.click('challenge-continue');
    assert.equal(h.session.getState().lessonId, 'home-sl');
    assert.equal(h.session.getState().stage, 'demo');
});

test('arcade keyboard input and blur are routed to the game without changing the lesson result', () => {
    const h = harness({ completed: 2 });
    h.mode.open(); h.click('lesson', 'home-dk');
    const result = h.finishLesson();
    const metrics = copy(h.store.getCurrentProfile().keyMetrics);
    h.click('challenge-start');
    h.clock.now += 20000;
    h.type('f'); h.type('j'); h.type('x');
    assert.deepEqual(h.arcadeKeys, ['f', 'j', 'x']);
    assert.deepEqual(h.arcadeKeyUps, ['f', 'j', 'x']);
    h.blur();
    assert.equal(h.arcade.getState().status, 'paused');
    assert.deepEqual(h.store.getCurrentProfile().results.at(-1), result);
    assert.deepEqual(h.store.getCurrentProfile().keyMetrics, metrics);
    h.arcade.complete();
    assert.deepEqual(h.store.getCurrentProfile().results.at(-1), result);
    assert.equal(h.lessonCompletions, 1);
    assert.equal(h.events.filter(event => event.type === 'qwertz-learning-complete').length, 1);
});

test('pending challenges survive closing and reload and stay isolated between pupil profiles', () => {
    const h = harness({ completed: 2 });
    h.mode.open(); h.click('lesson', 'home-dk');
    h.finishLesson();
    const mia = h.store.getCurrentProfile();
    const oldGame = h.arcade.getState();
    h.mode.close();
    assert.equal(h.arcade.getState(), null);
    h.arcade.staleComplete({ ...oldGame, score: oldGame.challenge.target, status: 'complete' });
    assert.deepEqual(h.store.getCurrentProfile().arcadeChallenge, mia.arcadeChallenge);
    const reloaded = harness({ storage: h.storage });
    reloaded.mode.open(); reloaded.click('continue');
    assert.equal(reloaded.arcade.getState().challenge.lessonId, 'home-dk');
    assert.deepEqual(reloaded.store.getCurrentProfile().arcadeChallenge, mia.arcadeChallenge);
    reloaded.click('home');
    const noah = reloaded.createProfile('Noah');
    assert.equal(noah.arcadeChallenge, null);
    reloaded.arcade.staleComplete({ ...oldGame, score: oldGame.challenge.target, status: 'complete' });
    assert.equal(reloaded.store.getCurrentProfile().arcadeChallenge, null);
    reloaded.click('continue');
    assert.equal(reloaded.session.getState().lessonId, 'home-fj');
    reloaded.click('home'); reloaded.switchProfile(mia.id);
    assert.deepEqual(reloaded.store.getCurrentProfile().arcadeChallenge, mia.arcadeChallenge);
    reloaded.click('continue');
    assert.equal(reloaded.arcade.getState().challenge.lessonId, 'home-dk');
    reloaded.arcade.complete();
    assert.equal(reloaded.store.getCurrentProfile().arcadeChallenge, null);
    reloaded.click('home'); reloaded.switchProfile(noah.id);
    assert.equal(reloaded.store.getCurrentProfile().results.length, 0);
});

test('a stale finish from an earlier attempt cannot complete a replayed milestone challenge', () => {
    const h = harness({ completed: 2 });
    h.mode.open(); h.click('lesson', 'home-dk');
    const first = h.finishLesson();
    const oldGame = h.arcade.getState();
    const stale = { ...oldGame, score: oldGame.challenge.target, status: 'complete' };
    h.click('home'); h.click('lesson', 'home-dk');
    const second = h.finishLesson();
    assert.notEqual(second.id, first.id);
    assert.equal(h.arcade.getState().status, 'ready');
    h.arcade.staleComplete(stale);
    assert.deepEqual(h.store.getCurrentProfile().arcadeChallenge, { lessonId: second.lessonId, resultId: second.id });
    h.click('challenge-continue');
    assert.equal(h.session.getState().lessonId, 'home-dk');
    h.arcade.complete();
    assert.equal(h.store.getCurrentProfile().arcadeChallenge, null);
});

test('completing the last arcade challenge returns to the garden without creating another lesson result', () => {
    const h = harness({ completed: 17 });
    const last = engine.getLessons().at(-1);
    h.mode.open(); h.click('lesson', last.id);
    const result = h.finishLesson();
    assert.equal(h.arcade.getState().challenge.number, 18);
    h.arcade.complete(); h.click('challenge-continue');
    assert.match(h.shell.innerHTML, /id="learningPrimaryAction"/);
    assert.equal(h.store.getCurrentProfile().arcadeChallenge, null);
    assert.equal(h.store.getCurrentProfile().results.length, 18);
    assert.deepEqual(h.store.getCurrentProfile().results.at(-1), result);
    assert.equal(h.lessonCompletions, 1);
});

test('Space continues a completed arcade challenge once without leaking input into the next lesson', () => {
    const h = harness({ completed: 2 });
    h.mode.open(); h.click('lesson', 'home-dk');
    const result = h.finishLesson();
    h.arcade.complete();
    assert.match(h.shell.innerHTML, /Mit der Leertaste geht es weiter/);
    h.down(' ');
    assert.equal(h.session.getState().lessonId, 'home-sl');
    h.down(' '); h.type('s');
    assert.equal(h.session.getState().targetIndex, 0);
    assert.equal(h.session.getState().stats.errors, 0);
    h.up(' '); h.type('s');
    assert.equal(h.session.getState().targetIndex, 1);
    assert.equal(h.lessonCompletions, 1);
    assert.deepEqual(h.store.getCurrentProfile().results.at(-1), result);
});

test('arcade completion preserves the canonical classroom lesson result', async () => {
    const h = harness({ completed: 2, classroom: true });
    h.mode.open(); h.click('lesson', 'home-dk');
    await new Promise(resolve => setImmediate(resolve));
    const result = h.finishLesson();
    const before = h.classroomProfiles.flatMap(profile => profile.results).find(item => item.id === result.id);
    assert.deepEqual(before, result);
    h.click('challenge-start'); h.type('f'); h.arcade.complete();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.store.getCurrentProfile().results.at(-1), result);
    for (const profile of h.classroomProfiles) {
        const submitted = profile.results.find(item => item.id === result.id);
        if (submitted) assert.deepEqual(submitted, result);
    }
    assert.equal(h.events.filter(event => event.type === 'qwertz-learning-complete').length, 1);
});

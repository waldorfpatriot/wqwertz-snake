const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = require('./learning-engine');
const progress = require('./learning-progress');
const leaderboard = require('./learning-leaderboard');

function storage() {
    const data = new Map();
    return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
}
function result(lessonId = 'home-fj', mistakes = 0) {
    const session = engine.createSession(lessonId);
    session.advanceStage();
    for (let index = 0; index < mistakes; index++) { session.submitKey('!'); session.submitKey(session.getState().expectedKey); }
    while (session.getState().stage !== 'result') {
        if (session.getState().needsBackspace) session.backspace();
        else session.submitKey(session.getState().expectedKey);
    }
    return session.getState().result;
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

function browserHarness() {
    const listeners = new Map();
    const timers = new Map();
    const requests = [];
    let timerId = 0;
    let document;
    function element() {
        return {
            hidden: false, innerHTML: '', value: '', dataset: {},
            classList: { add() {}, remove() {} },
            appendChild() {}, setAttribute() {}, remove() {}, closest() { return null; },
            addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
            querySelector(selector) { return selector.includes('password') ? passwordInput : heading; }, querySelectorAll() { return []; },
            focus() { document.activeElement = this; }
        };
    }
    const shell = element();
    const heading = element();
    const passwordInput = element();
    document = {
        hidden: false, activeElement: null, body: element(), querySelector: () => element(), createElement: () => shell,
        addEventListener: (name, fn) => listeners.set('document:' + name, fn), removeEventListener: name => listeners.delete('document:' + name)
    };
    const window = {
        document, QwertzLearningEngine: engine, QwertzLearningProgress: progress, AbortController,
        setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
        fetch(url, options) { const pending = deferred(); requests.push({ url, options, pending }); return pending.promise; }
    };
    const context = vm.createContext({ window });
    vm.runInContext(fs.readFileSync(require.resolve('./learning-leaderboard'), 'utf8'), context);
    const view = window.QwertzLearningLeaderboard.mount();
    function login(password) {
        passwordInput.value = password;
        listeners.get('submit')({ target: { matches: () => true }, preventDefault() {} });
    }
    function respond(index, payload, status = 200) {
        requests[index].pending.resolve({ status, ok: status >= 200 && status < 300, json: async () => payload });
    }
    function visibility(hidden) { document.hidden = hidden; listeners.get('document:visibilitychange')(); }
    return { shell, view, requests, timers, login, respond, visibility };
}

test('durable best keeps the exact stronger attempt after history eviction and reload', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    store.renameProfile('Mia');
    const perfect = result();
    const alsoThreeStars = result('home-fj', 1);
    assert.equal(perfect.stars, alsoThreeStars.stars);
    store.completeLesson(perfect); store.completeLesson(alsoThreeStars);
    for (let index = 0; index < progress.HISTORY_LIMIT; index++) store.completeLesson(result('home-dk'));
    const reloaded = progress.createStore({ storage: saved });
    const profile = reloaded.getCurrentProfile();
    assert.equal(profile.results.some(item => item.lessonId === 'home-fj'), false);
    assert.equal(profile.completedLessons['home-fj'].bestResult.id, perfect.id);
    assert.ok(progress.normalizeResult(profile.completedLessons['home-fj'].bestResult), 'durable best remains importable as a full canonical result');
    const matrix = leaderboard.buildMatrix(reloaded.getState());
    assert.equal(matrix.rows[0].cells['home-fj'].accuracyPercent, 100);
    assert.equal(matrix.rows[0].cells['home-fj'].attemptCount, 2);
    assert.equal(matrix.rows[0].cells['home-fj'].correctFirstTry, perfect.correctFirstTry);
});

test('legacy results migrate to best attempts, named empty rows and all ordered lessons remain visible', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    store.renameProfile('Ömer');
    store.completeLesson(result('home-fj', 2)); store.completeLesson(result('home-fj', 1));
    store.createProfile('Anna');
    const legacy = JSON.parse(saved.getItem(progress.STORAGE_KEY));
    const former = legacy.profiles.find(profile => profile.nickname === 'Ömer');
    delete former.completedLessons['home-fj'].bestResult;
    former.completedLessons['home-fj'].completionCount = 7;
    saved.setItem(progress.STORAGE_KEY, JSON.stringify(legacy));
    const restored = progress.createStore({ storage: saved });
    const matrix = leaderboard.buildMatrix(restored.getState());
    assert.deepEqual(matrix.lessons.map(lesson => lesson.id), engine.getLessons().map(lesson => lesson.id));
    assert.deepEqual(matrix.rows.map(row => row.name), ['Anna', 'Ömer']);
    assert.deepEqual(matrix.rows[0].cells, {});
    assert.equal(matrix.rows[1].cells['home-fj'].accuracyPercent, 95);
    assert.equal(matrix.rows[1].cells['home-fj'].attemptCount, 7);
    assert.equal(matrix.rows[1].cells['home-dk'], undefined);
    const unnamed = progress.createStore({ storage: storage() });
    unnamed.completeLesson(result());
    assert.equal(leaderboard.buildMatrix(unnamed.getState()).rows.length, 0);
});

test('normalization recomputes grades and rejects impossible completed typing counters', () => {
    const forged = JSON.parse(JSON.stringify(result()));
    forged.stars = 1; forged.accuracy = 0; forged.accuracyPercent = 0;
    assert.equal(progress.normalizeResult(forged).accuracyPercent, 100);
    const metric = forged.stages.feed.perKey.f;
    metric.correct--; metric.errors++; metric.correctFirstTry--; metric.streak--;
    forged.stages.feed.errors++; forged.stages.feed.correctFirstTry--;
    forged.errors++; forged.correctFirstTry--;
    assert.equal(progress.normalizeResult(forged), null);
    const matrix = leaderboard.normalizeMatrix({ curriculumVersion: engine.CURRICULUM_VERSION, rows: [{ pupilId: 'mia', name: 'Mia', cells: {
        'home-fj': { correctFirstTry: 19, targets: 20, accuracyPercent: 100, errors: 1, corrections: 0, activeMs: 50, attemptCount: 1 }
    } }] });
    assert.equal(matrix.rows[0].cells['home-fj'].accuracyPercent, 95);
});

test('teacher authentication gates all names and uses only the password header; failure clears prior data', async () => {
    const h = browserHarness();
    h.view.open();
    assert.equal(h.requests.length, 0);
    assert.match(h.shell.innerHTML, /Lehrerpasswort/);
    h.login('secret-password');
    assert.equal(h.requests[0].url, '/api/learning/leaderboard');
    assert.equal(h.requests[0].options.headers['x-admin-password'], 'secret-password');
    assert.equal(h.shell.innerHTML.includes('secret-password'), false);
    h.respond(0, { curriculumVersion: engine.CURRICULUM_VERSION, rows: [{ pupilId: 'mia', name: '<Mia>', cells: {} }] });
    await settled();
    assert.match(h.shell.innerHTML, /&lt;Mia&gt;/);
    assert.match(h.shell.innerHTML, /Noch keine abgeschlossene Runde/);
    assert.match(h.shell.innerHTML, /⌫ Rücktaste/);
    assert.equal(h.timers.size, 1);
    const refresh = h.view.refresh();
    h.respond(1, {}, 403); await refresh;
    assert.equal(h.shell.innerHTML.includes('&lt;Mia&gt;'), false);
    assert.match(h.shell.innerHTML, /Lehrerpasswort stimmt nicht/);
    assert.equal(h.timers.size, 0);
    await h.view.refresh();
    assert.equal(h.requests.length, 2);
});

test('hidden or closed views abort refreshes and stale responses cannot restore pupil names', async () => {
    const h = browserHarness();
    h.view.open(); h.login('teacher');
    h.respond(0, { curriculumVersion: engine.CURRICULUM_VERSION, rows: [{ pupilId: 'mia', name: 'Mia', cells: {} }] });
    await settled();
    assert.equal([...h.timers.values()][0].delay, leaderboard.REFRESH_MS);
    const refreshing = h.view.refresh();
    h.visibility(true);
    assert.equal(h.requests[1].options.signal.aborted, true);
    assert.equal(h.timers.size, 0);
    h.respond(1, { curriculumVersion: engine.CURRICULUM_VERSION, rows: [{ pupilId: 'stale', name: 'Stale', cells: {} }] });
    await refreshing;
    assert.equal(h.shell.innerHTML.includes('Stale'), false);
    h.visibility(false);
    assert.equal(h.requests.length, 3);
    h.view.close();
    assert.equal(h.requests[2].options.signal.aborted, true);
    h.respond(2, { curriculumVersion: engine.CURRICULUM_VERSION, rows: [{ pupilId: 'stale', name: 'Stale', cells: {} }] });
    await settled();
    assert.equal(h.shell.innerHTML, '');
    h.view.open(); await h.view.refresh();
    assert.equal(h.requests.length, 3, 'opening again requires a new teacher password');
    assert.match(h.shell.innerHTML, /Lehrerpasswort/);
    h.view.destroy();
});

test('the Rücktaste receives its own ordered column with actual typing accuracy', () => {
    const completed = result('home-backspace');
    const matrix = leaderboard.buildMatrix([{ id: 'mia', nickname: 'Mia', results: [completed] }]);
    assert.equal(matrix.lessons.length, 18);
    assert.equal(matrix.lessons[1].id, 'home-backspace');
    assert.deepEqual(matrix.lessons[1].newControlKeys, ['backspace']);
    assert.deepEqual(matrix.lessons[1].newKeys, []);
    assert.equal(matrix.rows[0].cells['home-backspace'].accuracyPercent, 100);
    assert.equal(matrix.rows[0].cells['home-backspace'].errors, 0);
    assert.equal(matrix.rows[0].cells['home-backspace'].corrections, 0);
});

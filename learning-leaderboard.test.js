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
    const decode = value => String(value || '').replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity]));
    function element(tagName = 'div', attributes = {}) {
        let html = '';
        const item = {
            tagName, attributes, children: [], parentElement: null, hidden: 'hidden' in attributes,
            name: attributes.name || '', value: decode(attributes.value), disabled: 'disabled' in attributes, dataset: {},
            classList: { add() {}, remove() {} },
            appendChild(child) { this.children.push(child); child.parentElement = this; },
            setAttribute(name, value) { this.attributes[name] = String(value); },
            getAttribute(name) { return this.attributes[name] ?? null; },
            hasAttribute(name) { return name in this.attributes; }, remove() {},
            matches(selector) {
                return selector.split(',').some(part => {
                    const tag = part.trim().match(/^[a-z][a-z0-9-]*/i);
                    if (tag && tag[0] !== this.tagName) return false;
                    const id = part.match(/#([\w-]+)/);
                    if (id && this.attributes.id !== id[1]) return false;
                    const classes = [...part.matchAll(/\.([\w-]+)/g)];
                    if (classes.some(match => !(this.attributes.class || '').split(/\s+/).includes(match[1]))) return false;
                    return [...part.matchAll(/\[([^\]=\s]+)(?:=["']?([^\]"']*)["']?)?\]/g)].every(match =>
                        match[1] in this.attributes && (match[2] === undefined || this.attributes[match[1]] === match[2]));
                });
            },
            closest(selector) { return this.matches(selector) ? this : this.parentElement && this.parentElement.closest(selector); },
            addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
            querySelectorAll(selector) {
                const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
                return descendants.filter(child => child.matches(selector));
            },
            focus() { if (!this.disabled) document.activeElement = this; },
            setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
        };
        Object.keys(attributes).filter(name => name.startsWith('data-')).forEach(name => {
            item.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = decode(attributes[name]);
        });
        Object.defineProperty(item, 'innerHTML', {
            get: () => html,
            set(value) {
                html = value;
                if (document && this.querySelectorAll('*').includes(document.activeElement)) document.activeElement = document.body;
                this.children = [];
                const stack = [this];
                for (const match of html.matchAll(/<(\/)?([a-z][a-z0-9-]*)([^>]*)>/gi)) {
                    const [, closing, tag, rawAttributes] = match;
                    if (closing) { if (stack.length > 1) stack.pop(); continue; }
                    const attributes = {};
                    for (const attr of rawAttributes.matchAll(/([^\s=\/]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
                        attributes[attr[1]] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
                    }
                    const child = element(tag, attributes);
                    stack[stack.length - 1].appendChild(child);
                    if (!['input', 'br', 'hr', 'img', 'meta', 'link'].includes(tag)) stack.push(child);
                }
                for (const select of this.querySelectorAll('select')) {
                    const options = select.querySelectorAll('option');
                    const option = options.find(item => item.hasAttribute('selected')) || options[0];
                    select.value = option ? option.value : '';
                }
            }
        });
        return item;
    }
    const shell = element('section');
    const host = element();
    document = {
        hidden: false, activeElement: null, body: element('body'), querySelector: () => host, createElement: () => shell,
        addEventListener: (name, fn) => listeners.set('document:' + name, fn), removeEventListener: name => listeners.delete('document:' + name)
    };
    document.activeElement = document.body;
    const window = {
        document, QwertzLearningEngine: engine, QwertzLearningProgress: progress, AbortController,
        setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
        fetch(url, options) { const pending = deferred(); requests.push({ url, options, pending }); return pending.promise; }
    };
    const context = vm.createContext({ window });
    vm.runInContext(fs.readFileSync(require.resolve('./learning-leaderboard'), 'utf8'), context);
    const view = window.QwertzLearningLeaderboard.mount();
    function login(password) {
        shell.querySelector('[name="password"]').value = password;
        submit('[data-password-form]');
    }
    function respond(index, payload, status = 200) {
        requests[index].pending.resolve({ status, ok: status >= 200 && status < 300, json: async () => payload });
    }
    function visibility(hidden) { document.hidden = hidden; listeners.get('document:visibilitychange')(); }
    function dispatch(name, selector) {
        const target = typeof selector === 'string' ? shell.querySelector(selector) : selector;
        assert.ok(target, `the view contains ${selector}`);
        listeners.get(name)({ target, preventDefault() {} });
    }
    function input(selector, value) {
        const target = shell.querySelector(selector);
        assert.ok(target, `the view contains ${selector}`);
        target.value = value;
        dispatch('input', selector);
    }
    function change(selector, value) {
        const target = shell.querySelector(selector);
        assert.ok(target, `the view contains ${selector}`);
        target.value = value;
        dispatch('change', selector);
    }
    function submit(selector) { dispatch('submit', selector); }
    function click(selector) { dispatch('click', selector); }
    function focus(selector) {
        const target = shell.querySelector(selector);
        assert.ok(target, `the view contains ${selector}`);
        target.focus();
        return target;
    }
    function poll() {
        assert.equal(timers.size, 1, 'one automatic refresh is scheduled');
        const [id, timer] = [...timers.entries()][0];
        timers.delete(id);
        timer.fn();
    }
    return { shell, view, requests, timers, login, respond, visibility, input, change, submit, click, poll, focus, document };
}

const MORNING = 'class-morning';
const AFTERNOON = 'class-afternoon';
function classBoard(classId = MORNING, rows = [], classes = [
    { id: MORNING, name: 'Vormittag 1. Trimester', pupilCount: classId === MORNING ? rows.length : 1 },
    { id: AFTERNOON, name: 'Nachmittag 1. Trimester', pupilCount: classId === AFTERNOON ? rows.length : 1 }
]) {
    return { curriculumVersion: engine.CURRICULUM_VERSION, classes, activeClassId: classId, classId, rows };
}
function pupilRow(pupilId, name, lessonId) {
    return lessonId ? leaderboard.buildMatrix([{ id: pupilId, nickname: name, results: [result(lessonId)] }]).rows[0] : { pupilId, name, cells: {} };
}
async function authenticatedBoard(h, payload = classBoard(MORNING, [pupilRow('mia', 'Mia')])) {
    h.view.open();
    h.login('teacher-password');
    h.respond(0, payload);
    await settled();
}
function assertMutation(request, method, path, body) {
    assert.equal(request.url, '/api/learning' + path);
    assert.equal(request.options.method, method);
    assert.equal(request.options.headers['x-admin-password'], 'teacher-password');
    assert.equal(request.options.credentials, 'same-origin');
    assert.equal(request.url.includes('teacher-password'), false);
    if (body === undefined) assert.equal(request.options.body, undefined);
    else {
        assert.deepEqual(JSON.parse(request.options.body), body);
        const headers = Object.fromEntries(Object.entries(request.options.headers).map(([key, value]) => [key.toLowerCase(), value]));
        assert.equal(headers['content-type'], 'application/json');
    }
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

test('class metadata must identify the same displayed and registration class and use valid unique counts', () => {
    const raw = classBoard(MORNING, [pupilRow('mia', 'Mia')]);
    const normalized = leaderboard.normalizeMatrix(raw);
    assert.deepEqual(normalized.classes, raw.classes);
    assert.equal(normalized.classId, MORNING);
    assert.equal(normalized.activeClassId, MORNING);
    assert.throws(() => leaderboard.normalizeMatrix({ ...raw, activeClassId: AFTERNOON }), /classes/);
    assert.throws(() => leaderboard.normalizeMatrix({ ...raw, classId: 'missing', activeClassId: 'missing' }), /classes/);
    assert.throws(() => leaderboard.normalizeMatrix({ ...raw, classes: [raw.classes[0], raw.classes[0]] }), /classes/);
    assert.throws(() => leaderboard.normalizeMatrix({ ...raw, classes: [{ ...raw.classes[0], pupilCount: -1 }] }), /classes/);
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

test('switching class also selects the registration class and replaces pupils and result details', async () => {
    const h = browserHarness();
    await authenticatedBoard(h, classBoard(MORNING, [pupilRow('mia', 'Mia', 'home-fj')]));
    assert.equal(h.shell.querySelector('[data-class-select]').value, MORNING);
    assert.match(h.shell.innerHTML, /Vormittag 1\. Trimester/);
    assert.match(h.shell.innerHTML, /Nachmittag 1\. Trimester/);
    h.click('[data-cell][data-pupil="mia"][data-lesson="home-fj"]');
    assert.match(h.shell.innerHTML, /Ausgewählte Lektion/);
    h.change('[data-class-select]', AFTERNOON);
    assertMutation(h.requests[1], 'PATCH', '/classes/active', { classId: AFTERNOON });
    assert.equal(h.timers.size, 0, 'automatic refresh pauses during a mutation');
    await h.view.refresh();
    h.change('[data-class-select]', MORNING);
    assert.equal(h.requests.length, 2, 'refresh and repeated switches do not interrupt or duplicate a mutation');
    h.respond(1, classBoard(AFTERNOON, [pupilRow('noah', 'Noah', 'home-dk')]));
    await settled();
    assert.equal(h.shell.querySelector('[data-class-select]').value, AFTERNOON);
    assert.equal(h.shell.innerHTML.includes('Mia'), false);
    assert.equal(h.shell.innerHTML.includes('data-lesson="home-fj"'), false);
    assert.match(h.shell.innerHTML, /Noah/);
    assert.match(h.shell.innerHTML, /data-lesson="home-dk"/);
    assert.equal(h.shell.innerHTML.includes('Ausgewählte Lektion'), false);
    assert.equal(h.timers.size, 1);
});

test('new class draft survives polling and authenticated creation selects the empty class', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.click('[data-action="new-class"]');
    h.input('[name="className"]', 'Abend <2. Trimester>');
    h.poll();
    assert.equal(h.requests[1].url, '/api/learning/leaderboard');
    assert.equal(h.shell.querySelector('[name="className"]').value, 'Abend <2. Trimester>');
    h.respond(1, classBoard(MORNING, [pupilRow('mia', 'Mia')]));
    await settled();
    assert.equal(h.shell.querySelector('[name="className"]').value, 'Abend <2. Trimester>');
    assert.equal(h.shell.innerHTML.includes('value="Abend <2. Trimester>"'), false, 'class drafts are escaped when rendered');
    const form = h.shell.querySelector('[data-class-form]');
    h.submit(form);
    assertMutation(h.requests[2], 'POST', '/classes', { name: 'Abend <2. Trimester>' });
    h.submit(form);
    await h.view.refresh();
    assert.equal(h.requests.length, 3, 'class creation cannot submit twice while pending');
    const evening = 'class-evening';
    h.respond(2, classBoard(evening, [], [
        { id: MORNING, name: 'Vormittag 1. Trimester', pupilCount: 1 },
        { id: AFTERNOON, name: 'Nachmittag 1. Trimester', pupilCount: 1 },
        { id: evening, name: 'Abend <2. Trimester>', pupilCount: 0 }
    ]), 201);
    await settled();
    assert.equal(h.shell.querySelector('[data-class-select]').value, evening);
    assert.match(h.shell.innerHTML, /Abend &lt;2\. Trimester&gt;/);
    assert.equal(h.shell.innerHTML.includes('Mia'), false);
    assert.equal(h.timers.size, 1);
});

test('automatic refresh restores class-name focus and text selection after replacing a disabled input', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.click('[data-action="new-class"]');
    h.input('[name="className"]', 'Nachmittag 2. Trimester');
    const original = h.focus('[name="className"]');
    original.setSelectionRange(4, 9);
    h.poll();
    const disabled = h.shell.querySelector('[name="className"]');
    assert.notEqual(disabled, original, 'rendering replaces the focused DOM node');
    assert.equal(disabled.disabled, true);
    assert.equal(h.document.activeElement, h.document.body, 'removing a focused node sends browser focus to the body');
    disabled.focus();
    assert.equal(h.document.activeElement, h.document.body, 'a disabled replacement cannot receive browser focus');
    h.respond(1, classBoard(MORNING, [pupilRow('mia', 'Mia')]));
    await settled();
    const restored = h.shell.querySelector('[name="className"]');
    assert.equal(h.document.activeElement, restored);
    assert.equal(restored.disabled, false);
    assert.equal(restored.value, 'Nachmittag 2. Trimester');
    assert.equal(restored.selectionStart, 4);
    assert.equal(restored.selectionEnd, 9);
});

test('automatic refresh restores the same pupil management button when rows reorder', async () => {
    const h = browserHarness();
    await authenticatedBoard(h, classBoard(MORNING, [pupilRow('mia', 'Mia'), pupilRow('noah', 'Noah')]));
    const original = h.focus('[data-action="manage-pupil"][data-pupil="mia"]');
    h.poll();
    assert.equal(h.document.activeElement, h.document.body);
    h.respond(1, classBoard(MORNING, [pupilRow('aaron', 'Aaron'), pupilRow('mia', 'Mia'), pupilRow('noah', 'Noah')]));
    await settled();
    const restored = h.shell.querySelector('[data-action="manage-pupil"][data-pupil="mia"]');
    assert.notEqual(restored, original);
    assert.equal(h.document.activeElement, restored, 'focus follows the pupil identity rather than the row position');
    assert.equal(restored.disabled, false);
});

test('automatic refresh keeps deletion confirmation focused on its cancellation control', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.click('[data-action="manage-pupil"][data-pupil="mia"]');
    h.click('[data-action="delete-pupil"]');
    const original = h.shell.querySelector('[data-action="cancel-delete"]');
    assert.equal(h.document.activeElement, original, 'opening confirmation chooses the safe cancellation control');
    h.poll();
    assert.equal(h.document.activeElement, h.document.body);
    h.respond(1, classBoard(MORNING, [pupilRow('mia', 'Mia')]));
    await settled();
    const restored = h.shell.querySelector('[data-action="cancel-delete"]');
    assert.notEqual(restored, original);
    assert.equal(h.document.activeElement, restored);
    assert.equal(restored.disabled, false);
    h.click(restored);
    assert.equal(h.requests.length, 2, 'refresh and cancellation never send a deletion request');
    assert.equal(h.shell.querySelector('[data-action="confirm-delete"]'), null);
});

test('a failed pupil mutation restores its enabled submit button for keyboard retry', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.click('[data-action="manage-pupil"][data-pupil="mia"]');
    h.change('[name="destinationClass"]', AFTERNOON);
    const original = h.focus('[data-action="move-pupil"]');
    h.submit('[data-move-form]');
    assert.equal(h.document.activeElement, h.document.body);
    h.respond(1, { error: 'Verschieben fehlgeschlagen.' }, 503);
    await settled();
    const restored = h.shell.querySelector('[data-action="move-pupil"]');
    assert.notEqual(restored, original);
    assert.equal(h.document.activeElement, restored);
    assert.equal(restored.disabled, false);
    assert.equal(h.shell.querySelector('[name="destinationClass"]').value, AFTERNOON);
    assert.match(h.shell.innerHTML, /Mia/);
    h.submit('[data-move-form]');
    assertMutation(h.requests[2], 'PATCH', '/pupils/mia', { classId: AFTERNOON });
    h.respond(2, classBoard(MORNING, []));
    await settled();
    assert.equal(h.shell.innerHTML.includes('Mia'), false);
});

test('moving a pupil preserves the chosen destination across polling and removes the pupil from this class', async () => {
    const h = browserHarness();
    await authenticatedBoard(h, classBoard(MORNING, [pupilRow('mia', 'Mia', 'home-fj'), pupilRow('noah', 'Noah')]));
    h.click('[data-action="manage-pupil"][data-pupil="mia"]');
    h.change('[name="destinationClass"]', AFTERNOON);
    h.poll();
    h.respond(1, classBoard(MORNING, [pupilRow('mia', 'Mia', 'home-fj'), pupilRow('noah', 'Noah')]));
    await settled();
    assert.equal(h.shell.querySelector('[name="destinationClass"]').value, AFTERNOON);
    const form = h.shell.querySelector('[data-move-form]');
    h.submit(form);
    assertMutation(h.requests[2], 'PATCH', '/pupils/mia', { classId: AFTERNOON });
    h.submit(form);
    assert.equal(h.requests.length, 3, 'a move cannot submit twice while pending');
    h.respond(2, classBoard(MORNING, [pupilRow('noah', 'Noah')], [
        { id: MORNING, name: 'Vormittag 1. Trimester', pupilCount: 1 },
        { id: AFTERNOON, name: 'Nachmittag 1. Trimester', pupilCount: 2 }
    ]));
    await settled();
    assert.equal(h.shell.innerHTML.includes('Mia'), false);
    assert.match(h.shell.innerHTML, /Noah/);
    assert.equal(h.shell.querySelector('[data-move-form]'), null);
    assert.equal(h.shell.querySelector('[data-class-select]').value, MORNING, 'moving does not switch the registration class');
    h.change('[data-class-select]', AFTERNOON);
    h.respond(3, classBoard(AFTERNOON, [pupilRow('mia', 'Mia', 'home-fj')]));
    await settled();
    assert.match(h.shell.innerHTML, /Mia/);
    assert.match(h.shell.innerHTML, /data-pupil="mia" data-lesson="home-fj"/);
});

test('the initial single class supports pupil deletion and offers creating a destination class', async () => {
    const h = browserHarness();
    await authenticatedBoard(h, classBoard(MORNING, [pupilRow('mia', 'Mia')], [
        { id: MORNING, name: 'Vormittag 1. Trimester', pupilCount: 1 }
    ]));
    assert.ok(h.shell.querySelector('[data-action="new-class"]'));
    h.click('[data-action="manage-pupil"][data-pupil="mia"]');
    assert.equal(h.shell.querySelector('[data-move-form]'), null);
    assert.ok(h.shell.querySelector('[data-action="delete-pupil"]'));
    assert.match(h.shell.innerHTML, /weitere Klasse/);
    h.click('[data-action="close-management"]');
    assert.equal(h.shell.querySelector('[data-action="delete-pupil"]'), null);
    assert.equal(h.requests.length, 1);
});

test('pupil deletion needs confirmation, cancellation sends nothing and pending confirmation cannot duplicate it', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.click('[data-action="manage-pupil"][data-pupil="mia"]');
    h.click('[data-action="delete-pupil"]');
    assert.equal(h.requests.length, 1, 'opening confirmation does not delete');
    assert.ok(h.shell.querySelector('[data-action="confirm-delete"]'));
    h.click('[data-action="cancel-delete"]');
    assert.equal(h.requests.length, 1, 'cancelling confirmation does not delete');
    assert.equal(h.shell.querySelector('[data-action="confirm-delete"]'), null);
    assert.match(h.shell.innerHTML, /Mia/);
    h.click('[data-action="delete-pupil"]');
    const confirm = h.shell.querySelector('[data-action="confirm-delete"]');
    h.click(confirm);
    assertMutation(h.requests[1], 'DELETE', '/pupils/mia');
    h.click(confirm);
    await h.view.refresh();
    assert.equal(h.requests.length, 2, 'deletion cannot run twice or be replaced by refresh');
    h.respond(1, classBoard(MORNING, []));
    await settled();
    assert.equal(h.shell.innerHTML.includes('Mia'), false);
    assert.equal(h.shell.querySelector('[data-action="confirm-delete"]'), null);
    assert.equal(h.timers.size, 1);
});

test('failed class switches and pupil mutations retain the last saved board and allow retry', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.change('[data-class-select]', AFTERNOON);
    h.respond(1, { error: 'server-error' }, 500);
    await settled();
    assert.equal(h.shell.querySelector('[data-class-select]').value, MORNING);
    assert.match(h.shell.innerHTML, /Mia/);
    assert.equal(h.timers.size, 1);
    h.click('[data-action="manage-pupil"][data-pupil="mia"]');
    h.change('[name="destinationClass"]', AFTERNOON);
    h.submit('[data-move-form]');
    h.respond(2, { error: 'server-error' }, 500);
    await settled();
    assert.match(h.shell.innerHTML, /Mia/);
    assert.equal(h.shell.querySelector('[name="destinationClass"]').value, AFTERNOON);
    h.submit('[data-move-form]');
    assertMutation(h.requests[3], 'PATCH', '/pupils/mia', { classId: AFTERNOON });
    h.respond(3, classBoard(MORNING, []));
    await settled();
    assert.equal(h.shell.innerHTML.includes('Mia'), false);
});

test('lost teacher authorization during a mutation clears names, class controls and polling', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.click('[data-action="manage-pupil"][data-pupil="mia"]');
    h.click('[data-action="delete-pupil"]');
    h.click('[data-action="confirm-delete"]');
    h.respond(1, { error: 'unauthorized' }, 403);
    await settled();
    assert.equal(h.shell.innerHTML.includes('Mia'), false);
    assert.equal(h.shell.innerHTML.includes('Vormittag 1. Trimester'), false);
    assert.equal(h.shell.querySelector('[data-class-select]'), null);
    assert.match(h.shell.innerHTML, /Lehrerpasswort stimmt nicht/);
    assert.equal(h.timers.size, 0);
    await h.view.refresh();
    assert.equal(h.requests.length, 2);
});

test('closing an in-flight class mutation aborts it and a stale success cannot restore private data', async () => {
    const h = browserHarness();
    await authenticatedBoard(h);
    h.change('[data-class-select]', AFTERNOON);
    h.view.close();
    assert.equal(h.requests[1].options.signal.aborted, true);
    assert.equal(h.shell.innerHTML, '');
    assert.equal(h.timers.size, 0);
    h.respond(1, classBoard(AFTERNOON, [pupilRow('stale', 'Stale pupil')]));
    await settled();
    assert.equal(h.shell.innerHTML, '');
    h.view.open();
    assert.match(h.shell.innerHTML, /Lehrerpasswort/);
    assert.equal(h.shell.innerHTML.includes('Stale pupil'), false);
    assert.equal(h.shell.querySelector('[data-class-select]'), null);
    await h.view.refresh();
    assert.equal(h.requests.length, 2, 'a closed view forgets the teacher password');
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

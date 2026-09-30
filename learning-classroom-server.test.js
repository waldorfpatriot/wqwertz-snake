'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const engine = require('./learning-engine');
const { createClassroomService, MAX_BODY_BYTES, DEFAULT_CLASS_ID, DEFAULT_CLASS_NAME } = require('./learning-classroom-server');

const copy = value => JSON.parse(JSON.stringify(value));

function completeResult({ lessonId = 'home-fj', feedErrors = 0, writeError = false } = {}) {
    let clock = 1700000000000;
    const session = engine.createSession(lessonId, { now: () => ++clock });
    session.advanceStage();
    let mistakes = feedErrors;
    let writingMistake = writeError;
    for (let guard = 0; guard < 300; guard++) {
        const state = session.getState();
        if (state.stage === 'result') return { ...state.result, id: 'test-' + crypto.randomUUID() };
        if (state.needsBackspace) { session.backspace(); continue; }
        if (state.stage === 'feed' && mistakes > 0) { session.submitKey('x'); mistakes--; }
        if (state.stage === 'write' && writingMistake) { session.submitKey('x'); session.backspace(); writingMistake = false; }
        session.submitKey(session.getState().expectedKey);
    }
    throw new Error('Lesson did not complete');
}

function request(port, pathname, { method = 'GET', token, admin, body, raw, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const data = raw === undefined ? body === undefined ? undefined : JSON.stringify(body) : raw;
        const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method,
            headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }),
                ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(admin ? { 'X-Admin-Password': admin } : {}), ...headers } }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let json;
                try { json = JSON.parse(text); } catch (error) { json = null; }
                resolve({ status: res.statusCode, headers: res.headers, json, text });
            });
            res.on('error', reject);
        });
        req.on('error', reject); req.end(data);
    });
}

async function host(dataDir) {
    const service = createClassroomService({ dataDir, webRoot: __dirname, isValidAdminPassword: value => value === 'teacher-test' });
    const server = http.createServer((req, res) => service.handle(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return { service, port: server.address().port, async close() { await new Promise(resolve => server.close(resolve)); await service.flush(); } };
}

async function fixture(t) {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qwertz-classroom-test-'));
    const running = await host(dataDir);
    t.after(async () => { await running.close(); await fs.rm(dataDir, { recursive: true, force: true }); });
    return { ...running, dataDir, req: (url, options) => request(running.port, '/api/learning/' + url, options) };
}

async function register(server, name = 'Mia K.') {
    const response = await server.req('pupils', { method: 'POST', body: { name } });
    assert.equal(response.status, 201, response.text);
    return response.json;
}

async function createClass(server, name) {
    const response = await server.req('classes', { method: 'POST', admin: 'teacher-test', body: { name } });
    assert.equal(response.status, 201, response.text);
    return response.json;
}

async function selectClass(server, classId) {
    const response = await server.req('classes/active', { method: 'PATCH', admin: 'teacher-test', body: { classId } });
    assert.equal(response.status, 200, response.text);
    return response.json;
}

test('version 1 migration puts existing pupils in Vormittag 1. Trimester and preserves their credentials and results', async t => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qwertz-classroom-migrate-'));
    let running = await host(dataDir);
    t.after(async () => { await running.close(); await fs.rm(dataDir, { recursive: true, force: true }); });
    const server = { req: (url, options) => request(running.port, '/api/learning/' + url, options) };
    const pupil = await register(server, 'Lotte');
    const result = completeResult({ feedErrors: 2 });
    const receipt = await server.req('results', { method: 'POST', token: pupil.token, body: { result } });
    await running.close();
    const legacy = JSON.parse(await fs.readFile(running.service.dataFile, 'utf8'));
    legacy.schemaVersion = 1;
    delete legacy.classes; delete legacy.activeClassId; delete legacy.deletedTokenHashes;
    for (const entry of legacy.pupils) delete entry.classId;
    const legacyPupil = copy(legacy.pupils[0]);
    await fs.writeFile(running.service.dataFile, JSON.stringify(legacy));
    running = await host(dataDir);
    const board = await server.req('leaderboard', { admin: 'teacher-test' });
    assert.equal(board.status, 200);
    assert.equal(board.json.activeClassId, DEFAULT_CLASS_ID); assert.equal(board.json.classId, DEFAULT_CLASS_ID);
    assert.deepEqual(board.json.classes, [{ id: DEFAULT_CLASS_ID, name: DEFAULT_CLASS_NAME, pupilCount: 1 }]);
    assert.equal(board.json.rows[0].cells['home-fj'].resultId, result.id);
    const upgraded = JSON.parse(await fs.readFile(running.service.dataFile, 'utf8'));
    assert.equal(upgraded.schemaVersion, 2);
    assert.deepEqual(upgraded.pupils[0], { ...legacyPupil, classId: DEFAULT_CLASS_ID });
    assert.deepEqual(upgraded.deletedTokenHashes, []);
    assert.equal((await server.req('me', { token: pupil.token })).json.classId, DEFAULT_CLASS_ID);
    await running.close(); running = await host(dataDir);
    const retried = await server.req('results', { method: 'POST', token: pupil.token, body: { result } });
    assert.equal(retried.status, 200); assert.equal(retried.json.receiptId, receipt.json.receiptId);
    assert.equal((await server.req('leaderboard', { admin: 'teacher-test' })).json.rows[0].pupilId, pupil.pupilId);
});

test('the selected class receives new registrations while enrollment retries retain their original class across restart', async t => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qwertz-classroom-selection-'));
    let running = await host(dataDir);
    t.after(async () => { await running.close(); await fs.rm(dataDir, { recursive: true, force: true }); });
    const server = { req: (url, options) => request(running.port, '/api/learning/' + url, options) };
    const enrollmentKey = crypto.randomBytes(32).toString('hex');
    const original = await server.req('pupils', { method: 'POST', body: { name: 'Anna', enrollmentKey } });
    assert.equal(original.status, 201); assert.equal(original.json.classId, DEFAULT_CLASS_ID);
    const created = await createClass(server, '  Nachmittag\u00a02. Trimester (2026/27)  ');
    const nextId = created.activeClassId;
    assert.equal(created.classId, nextId); assert.notEqual(nextId, DEFAULT_CLASS_ID);
    assert.equal(created.classes[1].name, 'Nachmittag 2. Trimester (2026/27)'); assert.deepEqual(created.rows, []);
    const next = await register(server, 'ANNA');
    assert.equal(next.classId, nextId);
    const recovered = await server.req('pupils', { method: 'POST', body: { name: 'Anna', enrollmentKey } });
    assert.equal(recovered.status, 200); assert.deepEqual(recovered.json, original.json);
    assert.equal((await server.req('pupils', { method: 'POST', body: { name: 'anna' } })).status, 409);
    assert.deepEqual((await server.req('leaderboard', { admin: 'teacher-test' })).json.rows.map(row => row.pupilId), [next.pupilId]);
    // Renaming an existing profile is scoped to its own class, even while another
    // class is selected by the teacher.
    assert.equal((await server.req('me', { method: 'PATCH', token: original.json.token, body: { name: 'Anna' } })).status, 200);
    await running.close(); running = await host(dataDir);
    assert.equal((await register(server, 'Ben')).classId, nextId);
    const firstBoard = await selectClass(server, DEFAULT_CLASS_ID);
    assert.deepEqual(firstBoard.rows.map(row => row.pupilId), [original.json.pupilId]);
    assert.deepEqual(firstBoard.classes.map(entry => entry.pupilCount), [1, 2]);
    assert.equal((await register(server, 'Clara')).classId, DEFAULT_CLASS_ID);
    const replay = await server.req('pupils', { method: 'POST', body: { name: 'Unused retry name', enrollmentKey } });
    assert.equal(replay.status, 200); assert.equal(replay.json.pupilId, original.json.pupilId); assert.equal(replay.json.classId, DEFAULT_CLASS_ID);
});

test('moving pupils preserves their profile and results and rejects target-class name conflicts', async t => {
    const server = await fixture(t);
    const first = await register(server, 'Mia');
    const result = completeResult({ feedErrors: 1 });
    const receipt = await server.req('results', { method: 'POST', token: first.token, body: { result } });
    const target = await createClass(server, 'Nachmittag 1. Trimester');
    const targetId = target.activeClassId;
    const second = await register(server, 'MIA');
    const move = classId => server.req('pupils/' + first.pupilId, { method: 'PATCH', admin: 'teacher-test', body: { classId } });
    const conflict = await move(targetId);
    assert.equal(conflict.status, 409); assert.equal(conflict.json.code, 'NAME_TAKEN');
    assert.equal((await server.req('me', { token: first.token })).json.classId, DEFAULT_CLASS_ID);
    await server.req('me', { method: 'PATCH', token: second.token, body: { name: 'Ben' } });
    const moved = await move(targetId);
    assert.equal(moved.status, 200); assert.equal(moved.json.activeClassId, targetId);
    assert.deepEqual(moved.json.classes.map(entry => entry.pupilCount), [0, 2]);
    const own = (await server.req('me', { token: first.token })).json;
    assert.equal(own.pupilId, first.pupilId); assert.equal(own.name, first.name); assert.equal(own.classId, targetId);
    assert.equal(own.cells['home-fj'].resultId, result.id); assert.equal(own.cells['home-fj'].attemptCount, 1);
    assert.equal(own.recentResults[0].id, result.id);
    const retried = await server.req('results', { method: 'POST', token: first.token, body: { result } });
    assert.equal(retried.status, 200); assert.equal(retried.json.receiptId, receipt.json.receiptId);
    const renameConflict = await server.req('me', { method: 'PATCH', token: first.token, body: { name: 'BEN' } });
    assert.equal(renameConflict.status, 409); assert.equal(renameConflict.json.code, 'NAME_TAKEN');
    const same = await move(targetId);
    assert.equal(same.status, 200); assert.deepEqual(same.json.rows.map(row => row.pupilId).sort(), [first.pupilId, second.pupilId].sort());
    await selectClass(server, DEFAULT_CLASS_ID);
    const back = await move(DEFAULT_CLASS_ID);
    assert.equal(back.status, 200); assert.deepEqual(back.json.rows.map(row => row.pupilId), [first.pupilId]);
    assert.equal((await server.req('me', { token: first.token })).json.cells['home-fj'].attemptCount, 1);
});

test('deleting a pupil removes results and revokes credentials and enrollment replay durably', async t => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qwertz-classroom-deletion-'));
    let running = await host(dataDir);
    t.after(async () => { await running.close(); await fs.rm(dataDir, { recursive: true, force: true }); });
    const server = { req: (url, options) => request(running.port, '/api/learning/' + url, options) };
    const enrollmentKey = crypto.randomBytes(32).toString('hex');
    const registration = await server.req('pupils', { method: 'POST', body: { name: 'Deleted Pupil', enrollmentKey } });
    const pupil = registration.json;
    const result = completeResult();
    const saved = await server.req('results', { method: 'POST', token: pupil.token, body: { result } });
    const removed = await server.req('pupils/' + pupil.pupilId, { method: 'DELETE', admin: 'teacher-test' });
    assert.equal(removed.status, 200); assert.deepEqual(removed.json.rows, []); assert.equal(removed.json.classes[0].pupilCount, 0);
    const storedText = await fs.readFile(running.service.dataFile, 'utf8');
    for (const privateValue of [pupil.name, pupil.pupilId, pupil.token, result.id, saved.json.receiptId, enrollmentKey]) assert.equal(storedText.includes(privateValue), false, privateValue);
    const stored = JSON.parse(storedText);
    assert.deepEqual(stored.pupils, []);
    assert.deepEqual(stored.deletedTokenHashes, [crypto.createHash('sha256').update(pupil.token).digest('hex')]);
    await running.close(); running = await host(dataDir);
    assert.equal((await server.req('me', { token: pupil.token })).status, 401);
    assert.equal((await server.req('me', { method: 'PATCH', token: pupil.token, body: { name: 'Return' } })).status, 401);
    assert.equal((await server.req('results', { method: 'POST', token: pupil.token, body: { result } })).status, 401);
    await createClass(server, 'New class');
    for (const name of ['Deleted Pupil', 'Different name']) {
        const replay = await server.req('pupils', { method: 'POST', body: { name, enrollmentKey } });
        assert.equal(replay.status, 401); assert.equal(replay.json.code, 'ENROLLMENT_REVOKED');
    }
    const fresh = await register(server, 'Deleted Pupil');
    assert.notEqual(fresh.pupilId, pupil.pupilId); assert.notEqual(fresh.token, pupil.token);
    assert.equal((await server.req('me', { token: fresh.token })).json.recentResults.length, 0);
    const again = await server.req('pupils/' + pupil.pupilId, { method: 'DELETE', admin: 'teacher-test' });
    assert.equal(again.status, 404); assert.equal(again.json.code, 'PUPIL_NOT_FOUND');
});

test('teacher mutations authenticate before parsing bodies or reading storage and validate classes and pupils', async t => {
    const server = await fixture(t);
    const pupil = await register(server);
    const routes = [['classes', 'POST'], ['classes/active', 'PATCH'], ['pupils/' + pupil.pupilId, 'PATCH'], ['pupils/' + pupil.pupilId, 'DELETE'], ['pupils/invalid', 'DELETE']];
    const untouched = await fs.readFile(server.service.dataFile, 'utf8');
    for (const [route, method] of routes) {
        for (const admin of [undefined, 'wrong']) {
            const response = await server.req(route, { method, admin, raw: '{' });
            assert.equal(response.status, 403); assert.equal(response.json.code, 'TEACHER_AUTH_REQUIRED');
        }
    }
    assert.equal(await fs.readFile(server.service.dataFile, 'utf8'), untouched);
    await fs.writeFile(server.service.dataFile, '{invalid storage');
    for (const [route, method] of routes) assert.equal((await server.req(route, { method, admin: 'wrong', raw: '{' })).status, 403);
    await fs.writeFile(server.service.dataFile, untouched);
    for (const name of ['', null, '..', '<script>', 'x'.repeat(81)]) {
        const response = await server.req('classes', { method: 'POST', admin: 'teacher-test', body: { name } });
        assert.equal(response.status, 400); assert.equal(response.json.code, 'INVALID_CLASS_NAME');
    }
    const duplicate = await server.req('classes', { method: 'POST', admin: 'teacher-test', body: { name: DEFAULT_CLASS_NAME.toUpperCase() } });
    assert.equal(duplicate.status, 409); assert.equal(duplicate.json.code, 'CLASS_NAME_TAKEN');
    for (const classId of [undefined, null, 12, '../private', 'class-' + 'x'.repeat(81)]) {
        const response = await server.req('classes/active', { method: 'PATCH', admin: 'teacher-test', body: { classId } });
        assert.equal(response.status, 400); assert.equal(response.json.code, 'INVALID_CLASS_ID');
    }
    const missingClass = 'class-' + crypto.randomUUID();
    for (const route of ['classes/active', 'pupils/' + pupil.pupilId]) {
        const response = await server.req(route, { method: 'PATCH', admin: 'teacher-test', body: { classId: missingClass } });
        assert.equal(response.status, 404); assert.equal(response.json.code, 'CLASS_NOT_FOUND');
    }
    for (const method of ['PATCH', 'DELETE']) {
        const invalid = await server.req('pupils/invalid', { method, admin: 'teacher-test', body: { classId: DEFAULT_CLASS_ID } });
        assert.equal(invalid.status, 400); assert.equal(invalid.json.code, 'INVALID_PUPIL_ID');
        const missing = await server.req('pupils/pupil-' + crypto.randomUUID(), { method, admin: 'teacher-test', body: { classId: DEFAULT_CLASS_ID } });
        assert.equal(missing.status, 404); assert.equal(missing.json.code, 'PUPIL_NOT_FOUND');
    }
    assert.equal(await fs.readFile(server.service.dataFile, 'utf8'), untouched);
});

test('concurrent services serialize class selection, enrollment, moves, and result writes', async t => {
    const server = await fixture(t);
    const second = await host(server.dataDir); t.after(() => second.close());
    const targetId = (await createClass(server, 'Nachmittag')).activeClassId;
    const call = (index, endpoint, options) => request(index % 2 ? second.port : server.port, '/api/learning/' + endpoint, options);
    const selections = Array.from({ length: 20 }, (_, index) => call(index, 'classes/active', { method: 'PATCH', admin: 'teacher-test', body: { classId: index % 3 ? targetId : DEFAULT_CLASS_ID } }));
    const registrations = Array.from({ length: 20 }, (_, index) => call(index, 'pupils', { method: 'POST', body: { name: 'Pupil ' + index } }));
    const [selected, registered] = await Promise.all([Promise.all(selections), Promise.all(registrations)]);
    assert.ok(selected.every(response => response.status === 200)); assert.ok(registered.every(response => response.status === 201));
    const persisted = JSON.parse(await fs.readFile(server.service.dataFile, 'utf8'));
    assert.equal(persisted.pupils.length, 20);
    for (const response of registered) assert.equal(persisted.pupils.find(pupil => pupil.id === response.json.pupilId).classId, response.json.classId);
    const pupil = registered[0].json;
    const moved = Array.from({ length: 12 }, (_, index) => call(index, 'pupils/' + pupil.pupilId, { method: 'PATCH', admin: 'teacher-test', body: { classId: index % 2 ? targetId : DEFAULT_CLASS_ID } }));
    const results = Array.from({ length: 12 }, (_, index) => call(index, 'results', { method: 'POST', token: pupil.token, body: { result: completeResult({ feedErrors: 1 }) } }));
    const [moves, writes] = await Promise.all([Promise.all(moved), Promise.all(results)]);
    assert.ok(moves.every(response => response.status === 200)); assert.ok(writes.every(response => response.status === 201));
    const own = (await server.req('me', { token: pupil.token })).json;
    assert.equal(own.cells['home-fj'].attemptCount, 12);
    const board = await selectClass(server, own.classId);
    assert.equal(board.rows.find(row => row.pupilId === pupil.pupilId).cells['home-fj'].attemptCount, 12);
    assert.equal(board.classes.reduce((count, entry) => count + entry.pupilCount, 0), 20);
    assert.deepEqual(await fs.readdir(server.dataDir), ['classroom.json']);
});

test('registration normalizes names, keeps zero-result pupils, and protects the teacher matrix', async t => {
    const server = await fixture(t);
    const pupil = await register(server, '  Mía\u00a0K.  ');
    assert.equal(pupil.name, 'Mía K.');
    assert.match(pupil.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal((await server.req('pupils', { method: 'POST', body: { name: 'ＭI\u0301A K.' } })).status, 409);
    for (const name of ['', ' '.repeat(2), '<script>', 'a'.repeat(51), '..', null]) {
        const response = await server.req('pupils', { method: 'POST', body: { name } });
        assert.equal(response.status, 400); assert.equal(response.json.code, 'INVALID_NAME');
    }
    for (const admin of [undefined, 'wrong']) {
        const response = await server.req('leaderboard', { admin });
        assert.equal(response.status, 403); assert.equal(response.json.code, 'TEACHER_AUTH_REQUIRED');
        assert.equal(response.text.includes(pupil.name), false);
    }
    const board = await server.req('leaderboard', { admin: 'teacher-test' });
    assert.equal(board.status, 200);
    assert.equal(board.json.lessons.length, engine.getLessons().length);
    assert.deepEqual(board.json.lessons.map(lesson => lesson.number), Array.from({ length: engine.getLessons().length }, (_, index) => index + 1));
    assert.equal(board.json.lessons[1].id, 'home-backspace');
    assert.deepEqual(board.json.lessons[1].newControlKeys, ['backspace']);
    assert.deepEqual(board.json.rows, [{ pupilId: pupil.pupilId, name: pupil.name, cells: {} }]);
    assert.match(board.headers['cache-control'], /no-store/);
    assert.equal((await server.req('pupils')).status, 404);
    const stored = await fs.readFile(server.service.dataFile, 'utf8');
    assert.equal(stored.includes(pupil.token), false);
    assert.match(JSON.parse(stored).pupils[0].tokenHash, /^[a-f0-9]{64}$/);
    assert.equal((await fs.stat(server.service.dataFile)).mode & 0o777, 0o600);
});

test('pupil credentials select only their own profile and rename preserves credentials', async t => {
    const server = await fixture(t);
    const first = await register(server, 'Anna');
    const second = await register(server, 'Ben');
    for (const token of [undefined, 'bad', crypto.randomBytes(32).toString('base64url')]) {
        const response = await server.req('me', { token });
        assert.equal(response.status, 401); assert.equal(response.json.code, 'PUPIL_AUTH_REQUIRED');
    }
    const own = await server.req('me', { token: first.token });
    assert.equal(own.json.name, 'Anna'); assert.equal(own.json.pupilId, first.pupilId);
    assert.equal(own.text.includes('token'), false); assert.equal(own.text.includes('Ben'), false);
    const conflict = await server.req('me', { method: 'PATCH', token: first.token, body: { name: 'BEN' } });
    assert.equal(conflict.status, 409); assert.equal(conflict.json.code, 'NAME_TAKEN');
    const renamed = await server.req('me', { method: 'PATCH', token: first.token, body: { name: 'Anna P.', pupilId: second.pupilId } });
    assert.equal(renamed.status, 200); assert.equal(renamed.json.pupilId, first.pupilId);
    assert.equal((await server.req('me', { token: second.token })).json.name, 'Ben');
    assert.equal((await server.req('me', { token: first.token })).json.name, 'Anna P.');
});

test('persisted enrollment secrets recover a lost registration response across retry and restart', async t => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qwertz-enrollment-retry-'));
    let running = await host(dataDir);
    t.after(async () => { await running.close(); await fs.rm(dataDir, { recursive: true, force: true }); });
    const enroll = body => request(running.port, '/api/learning/pupils', { method: 'POST', body });
    const enrollmentKey = crypto.randomBytes(32).toString('hex');
    // The application receives neither identity nor token from this first response.
    assert.equal((await enroll({ name: 'Frieda', enrollmentKey })).status, 201);
    const recovered = await enroll({ name: 'Frieda', enrollmentKey });
    assert.equal(recovered.status, 200);
    assert.equal(recovered.json.token, Buffer.from(enrollmentKey, 'hex').toString('base64url'));
    const pupil = recovered.json;
    const rename = await request(running.port, '/api/learning/me', { method: 'PATCH', token: pupil.token, body: { name: 'Frieda T.' } });
    assert.equal(rename.status, 200);
    await running.close(); running = await host(dataDir);
    const retried = await enroll({ name: 'Frieda', enrollmentKey });
    assert.equal(retried.status, 200); assert.equal(retried.json.pupilId, pupil.pupilId);
    assert.equal(retried.json.name, 'Frieda T.'); assert.equal(retried.json.token, pupil.token);
    const conflict = await enroll({ name: 'Frieda T.', enrollmentKey: crypto.randomBytes(32).toString('hex') });
    assert.equal(conflict.status, 409); assert.equal(conflict.json.code, 'NAME_TAKEN');
    for (const invalid of ['', 'x'.repeat(64), pupil.token, 123]) {
        const response = await enroll({ name: 'Ben', enrollmentKey: invalid });
        assert.equal(response.status, 400); assert.equal(response.json.code, 'INVALID_ENROLLMENT_KEY');
    }
    const stored = await fs.readFile(running.service.dataFile, 'utf8');
    assert.equal(stored.includes(enrollmentKey), false); assert.equal(stored.includes(pupil.token), false);
    const board = await request(running.port, '/api/learning/leaderboard', { admin: 'teacher-test' });
    assert.equal(board.json.rows.length, 1); assert.equal(board.text.includes(enrollmentKey), false);
});

test('real mistakes and backspaces are canonical, best accuracy persists, and retry receipts are idempotent', async t => {
    const server = await fixture(t);
    const lessonResult = options => completeResult({ lessonId: 'home-dk', ...options });
    const pupil = await register(server);
    const result = lessonResult({ feedErrors: 1, writeError: true });
    result.accuracy = 1; result.accuracyPercent = 100; result.stars = 999;
    const submit = value => server.req('results', { method: 'POST', token: pupil.token, body: { result: value } });
    const receipt = await submit(result);
    assert.equal(receipt.status, 201, receipt.text);
    assert.equal(receipt.json.duplicate, false);
    const retry = await submit({ ...result, accuracy: -5, stars: 1 });
    assert.equal(retry.status, 200); assert.equal(retry.json.duplicate, true);
    assert.equal(retry.json.receiptId, receipt.json.receiptId);
    assert.equal((await submit({ ...result, completedAt: result.completedAt + 1 })).status, 409);
    const own = await server.req('me', { token: pupil.token });
    const firstCell = own.json.cells['home-dk'];
    assert.equal(firstCell.accuracyPercent, Math.round((result.targets - 2) / result.targets * 100));
    assert.equal(firstCell.correctFirstTry, result.targets - 2); assert.equal(firstCell.targets, result.targets);
    assert.equal(firstCell.errors, 2); assert.equal(firstCell.corrections, 1);
    assert.equal(firstCell.attemptCount, 1);
    const perfect = lessonResult();
    await submit(perfect);
    await submit(lessonResult({ feedErrors: 3 }));
    const tie = lessonResult(); await submit(tie);
    const board = (await server.req('leaderboard', { admin: 'teacher-test' })).json;
    const cell = board.rows[0].cells['home-dk'];
    assert.equal(cell.resultId, perfect.id); assert.equal(cell.accuracyPercent, 100);
    assert.equal(cell.errors, 0); assert.equal(cell.attemptCount, 4);
    assert.equal(cell.latest.id, tie.id); assert.ok(Number.isSafeInteger(cell.lastCompletedAt));
    assert.equal((await server.req('results', { method: 'POST', body: { result: perfect } })).status, 401);
});

test('all curriculum lesson payloads can be submitted and incomplete or malicious totals are rejected', async t => {
    const server = await fixture(t);
    const pupil = await register(server);
    for (const lesson of engine.getLessons()) {
        const response = await server.req('results', { method: 'POST', token: pupil.token, body: { result: completeResult({ lessonId: lesson.id }) } });
        assert.equal(response.status, 201, lesson.id + ': ' + response.text);
    }
    const valid = completeResult();
    const mutations = [
        value => { value.targets--; }, value => { value.stages.write.completedTargets--; },
        value => { value.characterAttempts = -1; }, value => { value.stages.feed.activeMs = 1e30; },
        value => { value.completedAt = Date.now() + 3600000; }, value => { value.completedAt = 1.5; },
        value => { value.id = '__proto__'; }, value => { value.curriculumVersion = 'future'; },
        value => { value.stages.write.perKey.f.correct = 0; }, value => { value.correctFirstTry = 1e20; },
        value => { value.stages.write.corrections = 1; value.stages.write.backspaces = 1; value.corrections = 1; value.backspaces = 1; }
    ];
    for (const mutate of mutations) {
        const bad = copy(valid); mutate(bad);
        const response = await server.req('results', { method: 'POST', token: pupil.token, body: { result: bad } });
        assert.equal(response.status, 400, response.text); assert.equal(response.json.code, 'INVALID_RESULT');
    }
    const own = (await server.req('me', { token: pupil.token })).json;
    assert.equal(Object.keys(own.cells).length, engine.getLessons().length);
    assert.equal(own.recentResults.length, engine.getLessons().length);
    assert.equal(own.cells['home-backspace'].accuracyPercent, 100);
    assert.equal(own.cells['home-backspace'].errors, 0);
    assert.equal(own.cells['home-backspace'].corrections, 0);
});

test('best results and old receipts survive history eviction and a service restart', async t => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qwertz-classroom-restart-'));
    let running = await host(dataDir);
    t.after(async () => { await running.close(); await fs.rm(dataDir, { recursive: true, force: true }); });
    let server = { req: (url, options) => request(running.port, '/api/learning/' + url, options) };
    const pupil = await register(server);
    const best = completeResult();
    const initial = await server.req('results', { method: 'POST', token: pupil.token, body: { result: best } });
    for (let index = 0; index < 51; index++) {
        const response = await server.req('results', { method: 'POST', token: pupil.token, body: { result: completeResult({ feedErrors: 2 }) } });
        assert.equal(response.status, 201);
    }
    await running.close(); running = await host(dataDir);
    const own = (await server.req('me', { token: pupil.token })).json;
    assert.equal(own.recentResults.length, 50); assert.equal(own.recentResults.some(entry => entry.id === best.id), false);
    assert.equal(own.cells['home-fj'].resultId, best.id); assert.equal(own.cells['home-fj'].accuracyPercent, 100);
    assert.equal(own.cells['home-fj'].attemptCount, 52);
    const retry = await server.req('results', { method: 'POST', token: pupil.token, body: { result: best } });
    assert.equal(retry.status, 200); assert.equal(retry.json.receiptId, initial.json.receiptId);
    assert.equal((await server.req('me', { token: pupil.token })).json.cells['home-fj'].attemptCount, 52);
});

test('concurrent services serialize registrations and result writes without dropping attempts', async t => {
    const server = await fixture(t);
    const second = await host(server.dataDir); t.after(() => second.close());
    const call = (index, endpoint, options) => request(index % 2 ? second.port : server.port, '/api/learning/' + endpoint, options);
    const sameName = await Promise.all(Array.from({ length: 6 }, (_, index) => call(index, 'pupils', { method: 'POST', body: { name: 'Lina' } })));
    assert.equal(sameName.filter(response => response.status === 201).length, 1);
    assert.equal(sameName.filter(response => response.status === 409).length, 5);
    const pupil = sameName.find(response => response.status === 201).json;
    const result = completeResult();
    const retries = await Promise.all(Array.from({ length: 8 }, (_, index) => call(index, 'results', { method: 'POST', token: pupil.token, body: { result } })));
    assert.equal(retries.filter(response => response.status === 201).length, 1);
    assert.equal(new Set(retries.map(response => response.json.receiptId)).size, 1);
    const writes = await Promise.all(Array.from({ length: 15 }, (_, index) => call(index, 'results', { method: 'POST', token: pupil.token, body: { result: completeResult({ feedErrors: 1 }) } })));
    assert.ok(writes.every(response => response.status === 201));
    assert.equal((await server.req('me', { token: pupil.token })).json.cells['home-fj'].attemptCount, 16);
    assert.deepEqual((await fs.readdir(server.dataDir)), ['classroom.json']);
});

test('body limits, corrupt storage, and unsafe data locations fail without leaking or overwriting data', async t => {
    const server = await fixture(t);
    for (const raw of ['{', '[]']) {
        const response = await server.req('pupils', { method: 'POST', raw });
        assert.equal(response.status, 400); assert.equal(response.json.code, 'INVALID_JSON');
    }
    const response = await server.req('pupils', { method: 'POST', raw: JSON.stringify({ name: 'x'.repeat(MAX_BODY_BYTES) }) });
    assert.equal(response.status, 413); assert.equal(response.json.code, 'BODY_TOO_LARGE');
    await register(server);
    await fs.writeFile(server.service.dataFile, '{broken private content');
    const broken = await server.req('leaderboard', { admin: 'teacher-test' });
    assert.equal(broken.status, 503); assert.equal(broken.json.code, 'CLASSROOM_UNAVAILABLE');
    assert.equal(broken.text.includes('private content'), false);
    assert.equal((await server.req('pupils', { method: 'POST', body: { name: 'Ben' } })).status, 503);
    assert.equal(await fs.readFile(server.service.dataFile, 'utf8'), '{broken private content');
    assert.throws(() => createClassroomService({ dataDir: path.join(__dirname, 'classroom-data') }), /outside/);
});

test('the existing server routes the API, rejects private static paths, and handles Unicode passwords safely', async t => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qwertz-server-integration-'));
    const child = spawn(process.execPath, ['-e', "const m = require('./server'); m.server.listen(0, '127.0.0.1', () => console.log(m.server.address().port));"], {
        cwd: __dirname, env: { ...process.env, LEARNING_DATA_DIR: dataDir, ADMIN_PASSWORD: 'Znake' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk.toString(); });
    const port = await new Promise((resolve, reject) => {
        let output = '';
        child.stdout.on('data', chunk => { output += chunk.toString(); if (/^\d+\n/.test(output)) resolve(Number(output.trim())); });
        child.on('error', reject); child.on('exit', code => { if (!output) reject(new Error('Server exited ' + code + ': ' + errors)); });
    });
    const link = path.join(__dirname, 'classroom-test-link-' + crypto.randomUUID() + '.json');
    t.after(async () => {
        await fs.unlink(link).catch(() => {});
        const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited;
        await fs.rm(dataDir, { recursive: true, force: true });
    });
    const registration = await request(port, '/api/learning/pupils', { method: 'POST', body: { name: 'Ella' } });
    assert.equal(registration.status, 201);
    assert.equal((await request(port, '/api/learning/leaderboard', { admin: 'Znaké' })).status, 403);
    assert.equal((await request(port, '/api/learning/leaderboard', { admin: 'Znake' })).status, 200);
    const cors = await request(port, '/api/learning/me', { method: 'OPTIONS' });
    assert.match(cors.headers['access-control-allow-headers'], /Authorization/);
    assert.match(cors.headers['access-control-allow-methods'], /PATCH/);
    assert.match(cors.headers['access-control-allow-methods'], /DELETE/);
    const newClass = await request(port, '/api/learning/classes', { method: 'POST', admin: 'Znake', body: { name: 'Nachmittag 1. Trimester' } });
    assert.equal(newClass.status, 201); assert.deepEqual(newClass.json.rows, []);
    assert.equal(newClass.json.classes[0].pupilCount, 1);
    const moved = await request(port, '/api/learning/pupils/' + registration.json.pupilId, { method: 'PATCH', admin: 'Znake', body: { classId: newClass.json.activeClassId } });
    assert.equal(moved.status, 200); assert.equal(moved.json.rows[0].pupilId, registration.json.pupilId);
    const selected = await request(port, '/api/learning/classes/active', { method: 'PATCH', admin: 'Znake', body: { classId: DEFAULT_CLASS_ID } });
    assert.equal(selected.status, 200); assert.deepEqual(selected.json.rows, []);
    const deleted = await request(port, '/api/learning/pupils/' + registration.json.pupilId, { method: 'DELETE', admin: 'Znake' });
    assert.equal(deleted.status, 200); assert.deepEqual(deleted.json.classes.map(entry => entry.pupilCount), [0, 0]);
    assert.equal((await request(port, '/api/learning/me', { token: registration.json.token })).status, 401);
    for (const pathname of ['/server.js', '/learning-classroom-server.js', '/learning-classroom-server.test.js', '/classroom.json', '/%2eserver.js', '/.git/config', '/%zz']) {
        assert.equal((await request(port, pathname)).status, 403, pathname);
    }
    await fs.symlink(path.join(dataDir, 'classroom.json'), link);
    assert.equal((await request(port, '/' + path.basename(link))).status, 403);
    assert.equal((await request(port, '/learning-engine.js')).status, 200);
    assert.equal((await request(port, '/')).status, 200);
});

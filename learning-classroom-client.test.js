const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const engine = require('./learning-engine');
const progress = require('./learning-progress');

function storage() {
    const values = new Map();
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}
function result() {
    const session = engine.createSession('home-fj');
    session.advanceStage();
    while (session.getState().stage !== 'result') session.submitKey(session.getState().expectedKey);
    return session.getState().result;
}
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const settled = () => new Promise(resolve => setImmediate(resolve));

function server() {
    const pupils = new Map();
    const results = new Map();
    const calls = [];
    let hook = null;
    async function fetch(url, options) {
        const body = options.body ? JSON.parse(options.body) : {};
        const call = { url, options, body };
        calls.push(call);
        if (hook) {
            const overridden = await hook(call);
            if (overridden) return overridden;
        }
        if (url.endsWith('/pupils')) {
            const existing = pupils.get(body.enrollmentKey);
            if (existing) return response(200, existing);
            if ([...pupils.values()].some(pupil => pupil.name === body.name)) return response(409, { error: 'Name vergeben.' });
            const pupil = { pupilId: 'server-' + (pupils.size + 1), name: body.name, token: Buffer.from(body.enrollmentKey, 'hex').toString('base64url') };
            pupils.set(body.enrollmentKey, pupil);
            return response(201, pupil);
        }
        const token = (options.headers.Authorization || '').replace('Bearer ', '');
        const pupil = [...pupils.values()].find(item => item.token === token);
        if (!pupil) return response(401, { error: 'Anmeldung fehlt.' });
        if (url.endsWith('/me')) {
            if ([...pupils.values()].some(item => item.pupilId !== pupil.pupilId && item.name === body.name)) return response(409, { error: 'Name vergeben.' });
            pupil.name = body.name;
            return response(200, pupil);
        }
        if (url.endsWith('/results')) {
            const key = pupil.pupilId + ':' + body.result.id;
            const duplicate = results.has(key);
            if (!duplicate) results.set(key, { pupilId: pupil.pupilId, result: body.result });
            return response(duplicate ? 200 : 201, { resultId: body.result.id, receiptId: 'receipt-' + key, duplicate });
        }
        throw new Error('Unexpected request');
    }
    return { fetch, pupils, results, calls, setHook(value) { hook = value; } };
}

function clientHarness(saved, fetcher) {
    const timers = new Map();
    const listeners = new Map();
    const statuses = [];
    let timerId = 0;
    const document = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
    const window = {
        QwertzLearningProgress: progress, crypto: webcrypto, AbortController, document,
        addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
        setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id)
    };
    const context = vm.createContext({ window });
    vm.runInContext(fs.readFileSync(require.resolve('./learning-classroom-client'), 'utf8'), context);
    const client = window.QwertzLearningClassroom.createClient({ storage: saved, fetch: fetcher, onStatus: status => statuses.push(status) });
    return { client, timers, listeners, statuses, read: () => JSON.parse(saved.getItem(window.QwertzLearningClassroom.STORAGE_KEY)) };
}

test('a lost result receipt retries the same attempt without double-counting and survives reload', async () => {
    const saved = storage();
    const api = server();
    const profile = { id: 'local-mia', nickname: 'Mia' };
    const completed = result();
    let loseReceipt = true;
    const fetcher = async (url, options) => {
        const answer = await api.fetch(url, options);
        if (url.endsWith('/results') && loseReceipt) { loseReceipt = false; throw new Error('Antwort verloren'); }
        return answer;
    };
    const first = clientHarness(saved, fetcher);
    await first.client.ensureProfile(profile);
    first.client.enqueueResult(profile, completed); await settled();
    assert.equal(first.client.getPendingCount(), 1);
    assert.equal(api.results.size, 1);
    first.client.destroy();
    const reloaded = clientHarness(saved, fetcher);
    await reloaded.client.flush();
    assert.equal(reloaded.client.getPendingCount(), 0);
    assert.equal(api.results.size, 1);
    assert.equal(api.calls.filter(call => call.url.endsWith('/results')).length, 2);
    assert.equal(reloaded.read().profiles[profile.id].acknowledged.includes(completed.id), true);
    await reloaded.client.syncProfile({ ...profile, results: [completed] }); await reloaded.client.flush();
    assert.equal(api.calls.filter(call => call.url.endsWith('/results')).length, 2);
    reloaded.client.destroy();
});

test('a lost enrollment response retries its already-persisted secret after reload and preserves queued work', async () => {
    const saved = storage();
    const api = server();
    const profile = { id: 'local-mia', nickname: 'Mia', results: [result()] };
    let loseRegistration = true;
    let secretAtSend;
    const fetcher = async (url, options) => {
        if (url.endsWith('/pupils')) {
            const body = JSON.parse(options.body);
            const persisted = JSON.parse(saved.getItem('qwertznake-classroom-client-v1'));
            assert.equal(persisted.profiles[profile.id].enrollmentKey, body.enrollmentKey);
            assert.match(body.enrollmentKey, /^[a-f0-9]{64}$/);
            secretAtSend = secretAtSend || body.enrollmentKey;
            assert.equal(body.enrollmentKey, secretAtSend);
        }
        const answer = await api.fetch(url, options);
        if (url.endsWith('/pupils') && loseRegistration) { loseRegistration = false; throw new Error('Antwort verloren'); }
        return answer;
    };
    const first = clientHarness(saved, fetcher);
    assert.equal((await first.client.syncProfile(profile)).status, 'offline');
    assert.equal(first.client.getPendingCount(), 1);
    assert.equal(api.pupils.size, 1);
    first.client.destroy();
    const second = clientHarness(saved, fetcher);
    await second.client.flush();
    assert.equal(api.pupils.size, 1);
    assert.equal(api.results.size, 1);
    assert.equal(second.client.getPendingCount(), 0);
    assert.equal(second.read().profiles[profile.id].enrollmentKey, secretAtSend);
    second.client.destroy();
});

test('editing a name after a lost enrollment response renames the recovered identity before uploading', async () => {
    const saved = storage();
    const api = server();
    const original = { id: 'local-mia', nickname: 'Mia', results: [result()] };
    let loseRegistration = true;
    const fetcher = async (url, options) => {
        const answer = await api.fetch(url, options);
        if (url.endsWith('/pupils') && loseRegistration) { loseRegistration = false; throw new Error('Antwort verloren'); }
        return answer;
    };
    const first = clientHarness(saved, fetcher);
    assert.equal((await first.client.syncProfile(original)).status, 'offline');
    const secret = first.read().profiles[original.id].enrollmentKey;
    first.client.destroy();
    const next = clientHarness(saved, fetcher);
    assert.equal((await next.client.syncProfile({ ...original, nickname: 'Mia M.' })).status, 'online');
    await next.client.flush();
    assert.equal(api.pupils.size, 1);
    assert.equal(api.pupils.get(secret).name, 'Mia M.');
    assert.equal(next.read().profiles[original.id].name, 'Mia M.');
    assert.equal(next.read().profiles[original.id].pendingName, undefined);
    assert.equal(api.calls.filter(call => call.url.endsWith('/me')).length, 1);
    assert.equal(api.results.size, 1);
    assert.equal(next.client.getPendingCount(), 0);
    next.client.destroy();
});

test('different local profiles upload under separate persistent identities', async () => {
    const saved = storage();
    const api = server();
    const h = clientHarness(saved, api.fetch);
    const mia = { id: 'mia', nickname: 'Mia', results: [result()] };
    const leo = { id: 'leo', nickname: 'Leo', results: [result()] };
    await h.client.syncProfiles([mia, leo]); await h.client.flush();
    const cached = h.read().profiles;
    assert.notEqual(cached.mia.token, cached.leo.token);
    assert.notEqual(cached.mia.enrollmentKey, cached.leo.enrollmentKey);
    assert.equal(api.results.get(cached.mia.pupilId + ':' + mia.results[0].id).result.id, mia.results[0].id);
    assert.equal(api.results.get(cached.leo.pupilId + ':' + leo.results[0].id).result.id, leo.results[0].id);
    assert.equal(api.results.size, 2);
    assert.equal(h.client.getPendingCount(), 0);
    h.client.destroy();
});

test('a newly added pupil is drained when another pupil upload was already in flight', async () => {
    const saved = storage();
    const api = server();
    const h = clientHarness(saved, api.fetch);
    const mia = { id: 'mia', nickname: 'Mia' };
    const leo = { id: 'leo', nickname: 'Leo' };
    const first = result();
    const second = result();
    let release;
    let uploadStarted = false;
    const blocked = new Promise(resolve => { release = resolve; });
    api.setHook(async call => {
        if (call.url.endsWith('/results') && call.body.result.id === first.id) { uploadStarted = true; await blocked; }
        return null;
    });
    await h.client.ensureProfile(mia);
    h.client.enqueueResult(mia, first);
    await settled();
    assert.equal(uploadStarted, true);
    h.client.enqueueResult(leo, second);
    const draining = h.client.flush();
    release(); await draining;
    assert.equal(h.client.getPendingCount(), 0);
    assert.equal(api.results.size, 2);
    const cached = h.read().profiles;
    assert.ok(api.results.has(cached.mia.pupilId + ':' + first.id));
    assert.ok(api.results.has(cached.leo.pupilId + ':' + second.id));
    assert.equal(h.timers.size, 0);
    h.client.destroy();
});

test('offline reload keeps canonical pending results until the classroom becomes reachable', async () => {
    const saved = storage();
    const profile = { id: 'mia', nickname: 'Mia', results: [result()] };
    const first = clientHarness(saved, async () => { throw new Error('offline'); });
    assert.equal((await first.client.syncProfile(profile)).status, 'offline');
    const queued = first.read().profiles.mia.pending[0];
    assert.equal(queued.id, profile.results[0].id);
    assert.ok(progress.normalizeResult(queued));
    first.client.destroy();
    const api = server();
    const next = clientHarness(saved, api.fetch);
    assert.equal(next.client.getPendingCount(), 1);
    await next.client.flush();
    assert.equal(next.client.getPendingCount(), 0);
    assert.equal(api.results.size, 1);
    next.client.destroy();
});

test('empty or mismatched receipts leave the attempt pending instead of acknowledging it', async () => {
    const saved = storage();
    const api = server();
    const h = clientHarness(saved, api.fetch);
    const profile = { id: 'mia', nickname: 'Mia' };
    const completed = result();
    await h.client.ensureProfile(profile);
    let answer = { resultId: completed.id, receiptId: '' };
    api.setHook(call => call.url.endsWith('/results') ? response(200, answer) : null);
    h.client.enqueueResult(profile, completed); await h.client.flush();
    assert.equal(h.client.getPendingCount(), 1);
    assert.deepEqual(Array.from(h.read().profiles.mia.acknowledged), []);
    answer = { resultId: 'another-result', receiptId: 'receipt-valid' };
    await h.client.flush();
    assert.equal(h.client.getPendingCount(), 1);
    api.setHook(null); await h.client.flush();
    assert.equal(h.client.getPendingCount(), 0);
    h.client.destroy();
});

test('a permanent result conflict does not block later valid work or get re-enqueued from local history', async () => {
    const saved = storage();
    const api = server();
    const h = clientHarness(saved, api.fetch);
    const profile = { id: 'mia', nickname: 'Mia' };
    const rejected = result();
    const valid = result();
    let rejections = 0;
    api.setHook(call => {
        if (call.url.endsWith('/results') && call.body.result.id === rejected.id) { rejections++; return response(409, { error: 'Ergebnis-ID bereits anders gespeichert.' }); }
        return null;
    });
    await h.client.ensureProfile(profile);
    h.client.enqueueResult(profile, rejected); h.client.enqueueResult(profile, valid); await h.client.flush();
    assert.equal(h.client.getPendingCount(), 0);
    assert.equal(h.read().profiles.mia.rejected.includes(rejected.id), true);
    assert.equal(api.results.size, 1);
    assert.equal([...api.results.values()][0].result.id, valid.id);
    assert.ok(h.statuses.some(status => status.status === 'rejected'));
    await h.client.syncProfile({ ...profile, results: [rejected, valid] }); await h.client.flush();
    assert.equal(rejections, 1);
    assert.equal(h.client.getPendingCount(), 0);
    h.client.destroy();
});

test('name conflicts preserve identity and returning to the original name clears a stale rename', async () => {
    const saved = storage();
    const api = server();
    const h = clientHarness(saved, api.fetch);
    const mia = { id: 'mia', nickname: 'Mia' };
    const anna = { id: 'anna', nickname: 'Anna' };
    await h.client.ensureProfile(mia); await h.client.ensureProfile(anna);
    const originalToken = h.read().profiles.mia.token;
    assert.equal((await h.client.ensureProfile({ ...mia, nickname: 'Anna' })).status, 'conflict');
    assert.equal(h.read().profiles.mia.token, originalToken);
    assert.equal((await h.client.ensureProfile(mia)).status, 'online');
    assert.equal(h.read().profiles.mia.pendingName, undefined);
    h.client.enqueueResult(mia, result()); await h.client.flush();
    assert.equal(h.client.getPendingCount(), 0);
    assert.equal(api.results.size, 1);
    assert.equal((await h.client.ensureProfile({ id: 'other-device', nickname: 'Mia' })).status, 'conflict');
    assert.equal(h.read().profiles['other-device'].token, '');
    h.client.destroy();
});

test('invalid names and empty identity responses are not reported as a successful registration', async () => {
    const saved = storage();
    const invalid = clientHarness(saved, async () => response(400, { error: 'Name ungültig.' }));
    assert.equal((await invalid.client.ensureProfile({ id: 'mia', nickname: '🙂' })).status, 'invalid-name');
    assert.equal(invalid.read().profiles.mia.token, '');
    invalid.client.destroy();
    const empty = clientHarness(storage(), async () => response(201, { pupilId: '', token: '' }));
    assert.equal((await empty.client.ensureProfile({ id: 'mia', nickname: 'Mia' })).status, 'offline');
    assert.equal(empty.read().profiles.mia.token, '');
    empty.client.destroy();
});

test('destroy aborts outstanding uploads without discarding pending work or notifying a closed view', async () => {
    const saved = storage();
    const api = server();
    const h = clientHarness(saved, api.fetch);
    const profile = { id: 'mia', nickname: 'Mia' };
    await h.client.ensureProfile(profile);
    let upload;
    api.setHook(call => {
        if (!call.url.endsWith('/results')) return null;
        upload = call;
        return new Promise((resolve, reject) => call.options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }));
    });
    h.client.enqueueResult(profile, result());
    const running = h.client.flush();
    await settled();
    assert.ok(upload);
    const statusCount = h.statuses.length;
    h.client.destroy(); await running;
    assert.equal(upload.options.signal.aborted, true);
    assert.equal(h.client.getPendingCount(), 1);
    assert.equal(h.statuses.length, statusCount);
    assert.equal(h.timers.size, 0);
    assert.equal(h.listeners.size, 0);
    const requestCount = api.calls.length;
    await h.client.flush();
    assert.equal(api.calls.length, requestCount);
});

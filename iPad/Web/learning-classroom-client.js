/* Shared classroom identity and a retryable outbox; learning stays available offline. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./learning-progress'), root);
    else root.QwertzLearningClassroom = factory(root.QwertzLearningProgress, root);
}(typeof window === 'undefined' ? globalThis : window, function (progress, root) {
    'use strict';
    const STORAGE_KEY = 'qwertznake-classroom-client-v1';
    const MAX_PENDING = 500;
    const MAX_ACKNOWLEDGED = 250;
    const cleanName = value => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 40) : '';
    const clone = value => JSON.parse(JSON.stringify(value));

    function createClient(options = {}) {
        const fetcher = options.fetch || (root.fetch && root.fetch.bind(root));
        const apiBase = options.apiBase || '';
        const key = options.key || STORAGE_KEY;
        const onStatus = options.onStatus || (() => {});
        let storage;
        try { storage = Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : root.localStorage; } catch { storage = null; }
        let saved = { schemaVersion: 1, profiles: Object.create(null) };
        try {
            const data = JSON.parse(storage && storage.getItem(key) || 'null');
            if (data && data.schemaVersion === 1 && data.profiles && typeof data.profiles === 'object' && !Array.isArray(data.profiles)) {
                Object.entries(data.profiles).slice(0, 100).forEach(([id, entry]) => {
                    if (!entry || typeof entry !== 'object') return;
                    const pending = (Array.isArray(entry.pending) ? entry.pending : []).map(progress.normalizeResult).filter(Boolean).slice(-MAX_PENDING);
                    saved.profiles[id] = { name: cleanName(entry.name), pendingName: cleanName(entry.pendingName), enrollmentKey: /^[a-f0-9]{64}$/.test(entry.enrollmentKey || '') ? entry.enrollmentKey : '', pupilId: typeof entry.pupilId === 'string' ? entry.pupilId : '',
                        token: typeof entry.token === 'string' ? entry.token : '', pending,
                        acknowledged: (Array.isArray(entry.acknowledged) ? entry.acknowledged : []).filter(value => typeof value === 'string').slice(-MAX_ACKNOWLEDGED),
                        rejected: (Array.isArray(entry.rejected) ? entry.rejected : []).filter(value => typeof value === 'string').slice(-MAX_PENDING) };
                });
            }
        } catch { /* A damaged classroom cache does not overwrite local learning progress. */ }
        let destroyed = false;
        let running = null;
        let flushAgain = false;
        let retryTimer = null;
        let retryMs = 5000;
        let serial = Promise.resolve();
        const statuses = new Map();
        const timers = { set: options.setTimeout || root.setTimeout.bind(root), clear: options.clearTimeout || root.clearTimeout.bind(root) };
        const requests = new Set();
        let persistenceAvailable = Boolean(storage);

        function persist() {
            try { if (storage) storage.setItem(key, JSON.stringify(saved)); }
            catch { persistenceAvailable = false; }
        }
        function entryFor(profile) {
            if (!profile || typeof profile.id !== 'string' || !cleanName(profile.nickname)) return null;
            if (!Object.prototype.hasOwnProperty.call(saved.profiles, profile.id)) {
                if (Object.keys(saved.profiles).length >= 100) return null;
                saved.profiles[profile.id] = { name: cleanName(profile.nickname), pupilId: '', token: '', pending: [], acknowledged: [], rejected: [] };
            }
            const entry = saved.profiles[profile.id];
            const requestedName = cleanName(profile.nickname);
            if (!entry.token) entry.name = requestedName;
            else if (entry.name !== requestedName) entry.pendingName = requestedName;
            else if (entry.pendingName) { delete entry.pendingName; persist(); }
            return entry;
        }
        function notify(id, status, message) {
            const entry = saved.profiles[id];
            const value = { profileId: id, status, message, pending: entry ? entry.pending.length : 0, persistenceAvailable };
            statuses.set(id, value);
            if (!destroyed) onStatus({ ...value });
            return value;
        }
        async function request(path, { method = 'GET', token, body } = {}) {
            if (!fetcher || destroyed) throw new Error('offline');
            const controller = root.AbortController ? new root.AbortController() : null;
            if (controller) requests.add(controller);
            const timeout = controller ? timers.set(() => controller.abort(), 8000) : null;
            try {
                const response = await fetcher(apiBase + '/api/learning' + path, {
                    method, cache: 'no-store', signal: controller && controller.signal,
                    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
                    ...(body ? { body: JSON.stringify(body) } : {})
                });
                const data = await response.json();
                if (!response.ok) {
                    const error = new Error(typeof data.error === 'string' ? data.error : 'Die Klassenverbindung ist gerade nicht verfügbar.');
                    error.status = response.status;
                    throw error;
                }
                return data;
            } finally {
                if (timeout != null) timers.clear(timeout);
                if (controller) requests.delete(controller);
            }
        }
        async function identify(profile) {
            const entry = entryFor(profile);
            if (!entry) return { status: 'name-required', message: 'Trage zuerst deinen Namen ein.' };
            const name = cleanName(profile.nickname);
            try {
                if (!entry.token) {
                    if (!entry.enrollmentKey) {
                        const random = new Uint8Array(32);
                        if (!root.crypto || !root.crypto.getRandomValues) throw new Error('Sichere Anmeldung ist gerade nicht verfügbar.');
                        root.crypto.getRandomValues(random);
                        entry.enrollmentKey = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
                        persist();
                    }
                    const identity = await request('/pupils', { method: 'POST', body: { name, enrollmentKey: entry.enrollmentKey } });
                    if (typeof identity.pupilId !== 'string' || !identity.pupilId || typeof identity.token !== 'string' || !identity.token) throw new Error('Ungültige Klassenantwort.');
                    entry.pupilId = identity.pupilId;
                    entry.token = identity.token;
                    entry.name = identity.name || name;
                    delete entry.pendingName;
                    persist();
                }
                if (entry.name !== name) {
                    entry.pendingName = name;
                    persist();
                    const identity = await request('/me', { method: 'PATCH', token: entry.token, body: { name } });
                    entry.name = identity.name || name;
                    delete entry.pendingName;
                    persist();
                }
                return notify(profile.id, 'online', 'Mit der Klasse verbunden.');
            } catch (error) {
                persist();
                if (error.status === 400 || error.status === 422) return notify(profile.id, 'invalid-name', 'Verwende für deinen Namen Buchstaben, Zahlen, Leerzeichen oder einen Punkt.');
                if (error.status === 409) return notify(profile.id, 'conflict', 'Dieser Name ist in der Klasse schon vergeben. Ergänze zum Beispiel den Anfangsbuchstaben deines Nachnamens.');
                if (error.status === 401 || error.status === 403) return notify(profile.id, 'unauthorized', 'Die Klassenverbindung muss erneut eingerichtet werden. Dein Lernfortschritt bleibt erhalten.');
                return notify(profile.id, 'offline', 'Du kannst weiterüben. Deine Ergebnisse werden übertragen, sobald die Klasse wieder erreichbar ist.');
            }
        }
        function ensureProfile(profile) {
            const task = serial.then(() => identify(profile));
            serial = task.catch(() => {});
            return task;
        }
        function enqueue(profile, result) {
            const entry = entryFor(profile);
            const normalized = progress.normalizeResult(result);
            if (!entry || !normalized) return false;
            if (entry.acknowledged.includes(normalized.id) || entry.rejected.includes(normalized.id) || entry.pending.some(item => item.id === normalized.id)) return true;
            if (Object.values(saved.profiles).reduce((sum, item) => sum + item.pending.length, 0) >= MAX_PENDING) {
                notify(profile.id, 'full', 'Viele Ergebnisse warten auf die Klassenverbindung. Deine Fortschritte bleiben im Lernprofil gespeichert.');
                return false;
            }
            entry.pending.push(normalized);
            persist();
            return true;
        }
        function cancelRetry() { if (retryTimer != null) timers.clear(retryTimer); retryTimer = null; }
        function retry() {
            cancelRetry();
            if (destroyed || root.document && root.document.hidden || !Object.keys(saved.profiles).length) return;
            retryTimer = timers.set(() => { retryTimer = null; flush(); }, retryMs);
            retryMs = Math.min(60000, retryMs * 2);
        }
        async function drain() {
            let failed = false;
            for (const [id, entry] of Object.entries(saved.profiles)) {
                if (destroyed) return;
                const identity = await ensureProfile({ id, nickname: entry.pendingName || entry.name });
                if (identity.status !== 'online') { failed = failed || identity.status === 'offline'; continue; }
                while (entry.pending.length && !destroyed) {
                    const result = entry.pending[0];
                    try {
                        const receipt = await request('/results', { method: 'POST', token: entry.token, body: { result } });
                        if (!receipt || receipt.resultId !== result.id || typeof receipt.receiptId !== 'string' || !receipt.receiptId) throw new Error('Unbestätigtes Ergebnis.');
                        entry.pending = entry.pending.filter(item => item.id !== result.id);
                        entry.acknowledged = [...new Set([...entry.acknowledged, result.id])].slice(-MAX_ACKNOWLEDGED);
                        persist();
                        notify(id, 'online', 'Deine Ergebnisse sind in der Klassenübersicht.');
                    } catch (error) {
                        if ([400, 409, 413, 422].includes(error.status)) {
                            entry.pending.shift();
                            entry.rejected = [...new Set([...entry.rejected, result.id])].slice(-MAX_PENDING);
                            persist();
                            notify(id, 'rejected', 'Ein Ergebnis konnte nicht übertragen werden. Dein Lernfortschritt bleibt erhalten.');
                            continue;
                        } else if ([401, 403].includes(error.status)) {
                            notify(id, 'unauthorized', 'Die Klassenverbindung muss erneut eingerichtet werden. Dein Lernfortschritt bleibt erhalten.');
                        } else { failed = true; notify(id, 'offline', 'Deine Ergebnisse warten auf die Klassenverbindung. Du kannst weiterüben.'); }
                        break;
                    }
                }
            }
            if (failed) retry();
            else { retryMs = 5000; cancelRetry(); }
        }
        function flush() {
            if (destroyed) return Promise.resolve();
            if (running) { flushAgain = true; return running; }
            running = (async () => {
                do { flushAgain = false; await drain(); } while (flushAgain && !destroyed);
            })().finally(() => { running = null; });
            return running;
        }
        function syncProfile(profile) {
            const entry = entryFor(profile);
            if (!entry) return Promise.resolve({ status: 'name-required' });
            const results = [...(profile.results || []), ...Object.values(profile.completedLessons || {}).map(lesson => lesson.bestResult).filter(Boolean)];
            results.forEach(result => enqueue(profile, result));
            return ensureProfile(profile).then(status => { if (status.status === 'online') flush(); else if (status.status === 'offline') retry(); return status; });
        }
        function syncProfiles(profiles) {
            return Promise.all((profiles || []).filter(profile => cleanName(profile.nickname)).map(syncProfile));
        }
        function online() { retryMs = 5000; cancelRetry(); flush(); }
        function visibility() { if (root.document.hidden) cancelRetry(); else online(); }
        if (root.addEventListener) root.addEventListener('online', online);
        if (root.document && root.document.addEventListener) root.document.addEventListener('visibilitychange', visibility);
        function destroy() {
            destroyed = true; cancelRetry(); requests.forEach(controller => controller.abort());
            if (root.removeEventListener) root.removeEventListener('online', online);
            if (root.document && root.document.removeEventListener) root.document.removeEventListener('visibilitychange', visibility);
        }
        return { ensureProfile, syncProfile, syncProfiles, enqueueResult: (profile, result) => { const queued = enqueue(profile, result); if (queued) flush(); return queued; },
            flush, getStatus: profileId => statuses.get(profileId) || { profileId, status: 'idle', pending: saved.profiles[profileId]?.pending.length || 0 },
            getPendingCount: () => Object.values(saved.profiles).reduce((sum, entry) => sum + entry.pending.length, 0), destroy };
    }
    return { createClient, cleanName, STORAGE_KEY, MAX_PENDING };
}));

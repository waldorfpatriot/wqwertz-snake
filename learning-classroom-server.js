/* One classroom per server: private, durable pupil credentials and lesson results. */
'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const engine = require('./learning-engine');
const { normalizeResult } = require('./learning-progress');

const SCHEMA_VERSION = 1;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PUPILS = 1000;
const HISTORY_LIMIT = 50;
const queues = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const within = (parent, child) => { const relative = path.relative(parent, child); return relative === '' || !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); };

class ClassroomError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function normalizeName(value) {
    if (typeof value !== 'string') return null;
    const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
    if (!name || [...name].length > 50 || Buffer.byteLength(name) > 150 || !/^[\p{L}\p{M}\p{N} .’'\-]+$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) return null;
    return { name, key: name.toLocaleLowerCase('de') };
}

function validateResult(value, now) {
    const result = normalizeResult(value);
    if (!result || !/^[A-Za-z0-9][A-Za-z0-9._:\-]{0,199}$/.test(result.id) || ['constructor', 'prototype', '__proto__'].includes(result.id)) return null;
    if (!Number.isSafeInteger(result.completedAt) || result.completedAt > now + 5 * 60 * 1000) return null;
    for (const stage of Object.values(result.stages)) {
        if (stage.activeMs > 24 * 60 * 60 * 1000) return null;
        if (['characterAttempts', 'errors', 'corrections', 'backspaces', 'hintsUsed'].some(field => stage[field] > 1000000)) return null;
        if (stage.corrections > stage.errors || stage.corrections > stage.backspaces) return null;
    }
    for (const name of ['feed', 'write']) {
        if (Object.values(result.stages[name].perKey).some(metric => metric.correct < metric.targets || metric.errors < metric.targets - metric.correctFirstTry)) return null;
    }
    return result;
}

function summary(result) {
    return Object.fromEntries(['id', 'lessonId', 'curriculumVersion', 'completedAt', 'targets', 'correctFirstTry', 'characterAttempts', 'errors', 'corrections', 'backspaces', 'activeMs', 'hintsUsed', 'accuracy', 'accuracyPercent', 'stars'].map(key => [key, result[key]]));
}

function cellsOf(pupil) {
    const cells = {};
    for (const lesson of engine.getLessons()) {
        const entry = own(pupil.lessons, lesson.id) && pupil.lessons[lesson.id];
        if (!entry) continue;
        const best = entry.best;
        cells[lesson.id] = {
            resultId: best.id, accuracyPercent: Math.round(best.correctFirstTry / best.targets * 100),
            correctFirstTry: best.correctFirstTry, targets: best.targets, errors: best.errors,
            corrections: best.corrections, characterAttempts: best.characterAttempts, activeMs: best.activeMs,
            attemptCount: entry.attemptCount, lastCompletedAt: entry.lastCompletedAt,
            bestCompletedAt: best.completedAt, latest: { ...entry.latest }
        };
    }
    return cells;
}

function publicPupil(pupil) {
    return { pupilId: pupil.id, name: pupil.name, createdAt: pupil.createdAt, updatedAt: pupil.updatedAt,
        curriculumVersion: engine.CURRICULUM_VERSION, cells: cellsOf(pupil), recentResults: clone(pupil.recentResults) };
}

function readJSON(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        let tooLarge = false;
        const chunks = [];
        const declared = Number(req.headers['content-length']);
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
            req.resume(); reject(new ClassroomError(413, 'BODY_TOO_LARGE', 'Die Anfrage ist zu groß.')); return;
        }
        req.on('data', chunk => {
            if (tooLarge) return;
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                tooLarge = true; chunks.length = 0;
                reject(new ClassroomError(413, 'BODY_TOO_LARGE', 'Die Anfrage ist zu groß.')); return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (tooLarge) return;
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                if (!object(body)) throw new Error('Object required');
                resolve(body);
            } catch (error) { reject(new ClassroomError(400, 'INVALID_JSON', 'Die Anfrage enthält kein gültiges JSON.')); }
        });
        req.on('aborted', () => reject(new ClassroomError(400, 'REQUEST_ABORTED', 'Die Anfrage wurde unterbrochen.')));
        req.on('error', () => reject(new ClassroomError(400, 'REQUEST_ABORTED', 'Die Anfrage wurde unterbrochen.')));
    });
}

function createClassroomService(options = {}) {
    const dataDir = path.resolve(options.dataDir || process.env.LEARNING_DATA_DIR || path.join(os.homedir(), '.qwertznake', 'classroom'));
    const webRoot = path.resolve(options.webRoot || __dirname);
    const file = path.join(dataDir, 'classroom.json');
    if (within(webRoot, dataDir)) throw new Error('Learning classroom data must be outside the web root');
    const verifyAdmin = options.isValidAdminPassword || (() => false);
    const now = typeof options.now === 'function' ? options.now : Date.now;
    let readyPromise;

    function ready() {
        if (!readyPromise) readyPromise = (async () => {
            await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
            const resolved = await fs.realpath(dataDir);
            const resolvedWeb = await fs.realpath(webRoot);
            if (within(resolvedWeb, resolved)) throw new Error('Learning classroom data must be outside the web root');
        })();
        return readyPromise;
    }

    async function readData() {
        await ready();
        try {
            const stat = await fs.lstat(file);
            if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid private file');
            const data = JSON.parse(await fs.readFile(file, 'utf8'));
            if (!data || data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.pupils) || data.pupils.length > MAX_PUPILS) throw new Error('Invalid classroom data');
            for (const pupil of data.pupils) {
                if (!pupil || !/^pupil-[a-f0-9-]{36}$/.test(pupil.id) || !normalizeName(pupil.name) || !/^[a-f0-9]{64}$/.test(pupil.tokenHash) ||
                    !object(pupil.lessons) || !object(pupil.receipts) || !Array.isArray(pupil.recentResults)) throw new Error('Invalid pupil data');
            }
            return data;
        } catch (error) {
            if (error.code === 'ENOENT') return { schemaVersion: SCHEMA_VERSION, curriculumVersion: engine.CURRICULUM_VERSION, pupils: [] };
            throw new ClassroomError(503, 'CLASSROOM_UNAVAILABLE', 'Der Klassenfortschritt ist gerade nicht verfügbar. Bitte versuche es erneut.');
        }
    }

    async function writeData(data) {
        const temporary = path.join(dataDir, '.classroom-' + process.pid + '-' + crypto.randomUUID() + '.tmp');
        let handle;
        try {
            handle = await fs.open(temporary, 'wx', 0o600);
            await handle.writeFile(JSON.stringify(data), 'utf8');
            await handle.sync();
            await handle.close(); handle = null;
            await fs.rename(temporary, file);
            // Persist the rename before acknowledging a result receipt.
            const directory = await fs.open(dataDir, 'r');
            try { await directory.sync(); } catch (error) { if (!['EINVAL', 'ENOTSUP', 'EBADF'].includes(error.code)) throw error; }
            finally { await directory.close(); }
        } catch (error) {
            if (handle) await handle.close().catch(() => {});
            await fs.unlink(temporary).catch(() => {});
            throw new ClassroomError(503, 'CLASSROOM_UNAVAILABLE', 'Der Klassenfortschritt konnte nicht gespeichert werden. Bitte versuche es erneut.');
        }
    }

    function queued(operation, mutate) {
        const preceding = queues.get(file) || Promise.resolve();
        const job = preceding.catch(() => {}).then(async () => {
            const data = await readData();
            const result = await operation(data);
            if (mutate && !(result && result.skipWrite)) await writeData(data);
            return result;
        });
        queues.set(file, job.catch(() => {}));
        return job;
    }

    function pupilFor(data, token) {
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ClassroomError(401, 'PUPIL_AUTH_REQUIRED', 'Bitte melde dich mit deinem Schülerprofil an.');
        const digest = crypto.createHash('sha256').update(token).digest();
        const pupil = data.pupils.find(entry => crypto.timingSafeEqual(Buffer.from(entry.tokenHash, 'hex'), digest));
        if (!pupil) throw new ClassroomError(401, 'PUPIL_AUTH_REQUIRED', 'Bitte melde dich mit deinem Schülerprofil an.');
        return pupil;
    }

    function bearer(req) {
        const header = req.headers.authorization;
        const match = typeof header === 'string' && /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(header);
        return match && match[1];
    }

    function send(res, status, value) {
        if (res.destroyed || res.writableEnded) return;
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        res.end(JSON.stringify(value));
    }

    async function handle(req, res) {
        const pathname = (req.url || '').split('?')[0];
        if (!pathname.startsWith('/api/learning/')) return false;
        try {
            if (pathname === '/api/learning/pupils' && req.method === 'POST') {
                const body = await readJSON(req);
                if (body.enrollmentKey !== undefined && (typeof body.enrollmentKey !== 'string' || !/^[a-f0-9]{64}$/i.test(body.enrollmentKey))) {
                    throw new ClassroomError(400, 'INVALID_ENROLLMENT_KEY', 'Die Anmeldung konnte nicht vorbereitet werden. Bitte versuche es erneut.');
                }
                const normalized = normalizeName(body.name);
                // The browser saves these random bytes before enrollment. A lost response
                // can therefore be retried without losing the only copy of a credential.
                const token = body.enrollmentKey === undefined ? crypto.randomBytes(32).toString('base64url') : Buffer.from(body.enrollmentKey, 'hex').toString('base64url');
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                const created = await queued(data => {
                    const enrolled = data.pupils.find(pupil => pupil.tokenHash === tokenHash);
                    if (enrolled) return { pupilId: enrolled.id, token, name: enrolled.name, skipWrite: true };
                    if (!normalized) throw new ClassroomError(400, 'INVALID_NAME', 'Bitte gib einen Namen mit höchstens 50 Zeichen ein.');
                    if (data.pupils.some(pupil => normalizeName(pupil.name).key === normalized.key)) throw new ClassroomError(409, 'NAME_TAKEN', 'Dieser Name ist schon vergeben. Ergänze zum Beispiel den Anfangsbuchstaben deines Nachnamens.');
                    if (data.pupils.length >= MAX_PUPILS) throw new ClassroomError(409, 'CLASSROOM_FULL', 'In dieser Klasse können gerade keine weiteren Profile angelegt werden.');
                    const timestamp = now();
                    const pupil = { id: 'pupil-' + crypto.randomUUID(), name: normalized.name, tokenHash,
                        createdAt: timestamp, updatedAt: timestamp, lessons: {}, receipts: {}, recentResults: [] };
                    data.pupils.push(pupil);
                    return { pupilId: pupil.id, token, name: pupil.name };
                }, true);
                const { skipWrite, ...response } = created;
                send(res, skipWrite ? 200 : 201, response); return true;
            }
            if (pathname === '/api/learning/leaderboard' && req.method === 'GET') {
                if (!verifyAdmin(req.headers['x-admin-password'])) throw new ClassroomError(403, 'TEACHER_AUTH_REQUIRED', 'Bitte gib das Lehrerpasswort ein.');
                const board = await queued(data => ({ curriculumVersion: engine.CURRICULUM_VERSION,
                    lessons: engine.getLessons().map(lesson => ({ id: lesson.id, title: lesson.title, number: lesson.number, index: lesson.index, newKeys: lesson.newKeys, newControlKeys: lesson.newControlKeys || [], taughtKeys: lesson.taughtKeys })),
                    rows: data.pupils.map(pupil => ({ pupilId: pupil.id, name: pupil.name, cells: cellsOf(pupil) })).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true })) }), false);
                send(res, 200, board); return true;
            }
            if (pathname === '/api/learning/me' && ['GET', 'PATCH'].includes(req.method)) {
                const token = bearer(req);
                if (req.method === 'GET') {
                    const pupil = await queued(data => publicPupil(pupilFor(data, token)), false);
                    send(res, 200, pupil); return true;
                }
                await queued(data => pupilFor(data, token), false);
                const body = await readJSON(req);
                const normalized = normalizeName(body.name);
                if (!normalized) throw new ClassroomError(400, 'INVALID_NAME', 'Bitte gib einen Namen mit höchstens 50 Zeichen ein.');
                const pupil = await queued(data => {
                    const selected = pupilFor(data, token);
                    if (data.pupils.some(entry => entry.id !== selected.id && normalizeName(entry.name).key === normalized.key)) throw new ClassroomError(409, 'NAME_TAKEN', 'Dieser Name ist schon vergeben. Ergänze zum Beispiel den Anfangsbuchstaben deines Nachnamens.');
                    selected.name = normalized.name; selected.updatedAt = now(); return publicPupil(selected);
                }, true);
                send(res, 200, pupil); return true;
            }
            if (pathname === '/api/learning/results' && req.method === 'POST') {
                const token = bearer(req);
                await queued(data => pupilFor(data, token), false);
                const body = await readJSON(req);
                const completed = validateResult(body.result, now());
                if (!completed) throw new ClassroomError(400, 'INVALID_RESULT', 'Dieses Übungsergebnis ist unvollständig oder ungültig.');
                const hash = crypto.createHash('sha256').update(JSON.stringify(completed)).digest('hex');
                const receipt = await queued(data => {
                    const pupil = pupilFor(data, token);
                    const previous = own(pupil.receipts, completed.id) && pupil.receipts[completed.id];
                    if (previous) {
                        if (previous.hash !== hash) throw new ClassroomError(409, 'RESULT_ID_CONFLICT', 'Dieses Ergebnis wurde bereits mit anderen Daten gespeichert.');
                        return { receiptId: previous.receiptId, resultId: completed.id, duplicate: true, acceptedAt: previous.acceptedAt, skipWrite: true };
                    }
                    const acceptedAt = now();
                    const entry = summary(completed);
                    const aggregate = own(pupil.lessons, completed.lessonId) && pupil.lessons[completed.lessonId];
                    const best = aggregate && aggregate.best;
                    const isBetter = !best || completed.correctFirstTry * best.targets > best.correctFirstTry * completed.targets;
                    pupil.lessons[completed.lessonId] = { best: isBetter ? entry : best, latest: entry, attemptCount: (aggregate ? aggregate.attemptCount : 0) + 1, lastCompletedAt: acceptedAt };
                    pupil.recentResults.push(entry); pupil.recentResults = pupil.recentResults.slice(-HISTORY_LIMIT);
                    const saved = { receiptId: 'receipt-' + crypto.randomUUID(), acceptedAt, hash };
                    pupil.receipts[completed.id] = saved; pupil.updatedAt = acceptedAt;
                    return { receiptId: saved.receiptId, resultId: completed.id, duplicate: false, acceptedAt };
                }, true);
                const { skipWrite, ...response } = receipt;
                send(res, receipt.duplicate ? 200 : 201, response); return true;
            }
            throw new ClassroomError(404, 'ENDPOINT_NOT_FOUND', 'Diese Klassenfunktion wurde nicht gefunden.');
        } catch (error) {
            req.resume();
            const known = error instanceof ClassroomError;
            send(res, known ? error.status : 503, { error: known ? error.message : 'Der Klassenfortschritt ist gerade nicht verfügbar. Bitte versuche es erneut.', code: known ? error.code : 'CLASSROOM_UNAVAILABLE' });
            return true;
        }
    }

    return { handle, ready, flush: () => queues.get(file) || Promise.resolve(), dataDir, dataFile: file };
}

module.exports = { createClassroomService, normalizeName, validateResult, MAX_BODY_BYTES, HISTORY_LIMIT };

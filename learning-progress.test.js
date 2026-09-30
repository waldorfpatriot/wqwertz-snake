'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('./learning-engine');
const progress = require('./learning-progress');
const arcade = require('./learning-arcade');

function storage() {
    const values = new Map();
    return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}
function result(lessonId = 'home-fj', mistakes = 0) {
    const session = engine.createSession(lessonId);
    session.advanceStage();
    for (let index = 0; index < mistakes; index++) {
        session.submitKey('!');
        session.submitKey(session.getState().expectedKey);
    }
    while (session.getState().stage !== 'result') {
        if (session.getState().needsBackspace) session.backspace();
        else session.submitKey(session.getState().expectedKey);
    }
    return session.getState().result;
}

test('profiles are separate, unnamed by default, and nickname reuse switches the existing pupil', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    const unnamed = store.getCurrentProfile();
    assert.equal(unnamed.nickname, '');
    assert.ok(unnamed.id);
    store.completeLesson(result());
    const mia = store.createProfile(' Mia ');
    assert.equal(mia.nickname, 'Mia');
    assert.notEqual(mia.id, unnamed.id);
    assert.deepEqual(mia.completedLessons, {});
    assert.equal(store.createProfile('mia').id, mia.id);
    assert.equal(store.getState().profiles.length, 2);
    store.switchProfile(unnamed.id);
    assert.equal(store.getCurrentProfile().bestStars['home-fj'], 3);
    const reloaded = progress.createStore({ storage: saved });
    assert.equal(reloaded.getCurrentProfile().id, unnamed.id);
    assert.equal(reloaded.getCurrentProfile().bestStars['home-fj'], 3);
});

test('resumes survive reload and retain paused errors without mutable caller references', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    const session = engine.createSession('home-dk');
    session.advanceStage();
    session.submitKey('x');
    session.setPaused(true);
    assert.equal(store.saveSession(session), true);
    const resumed = progress.createStore({ storage: saved });
    const snapshot = resumed.getResume();
    assert.equal(snapshot.lessonId, 'home-dk');
    assert.equal(snapshot.stageData.feed.errors, 1);
    snapshot.stageData.feed.errors = 99;
    assert.equal(resumed.getResume().stageData.feed.errors, 1);
    assert.equal(resumed.getCurrentProfile().currentLessonId, 'home-dk');
    assert.equal(resumed.saveSession({ lessonId: 'invalid' }), false);
});

test('completion and decorations are idempotent; best stars do not regress on repeat practice', () => {
    const store = progress.createStore({ storage: storage() });
    const first = result();
    store.completeLesson(first);
    const before = store.getCurrentProfile();
    store.completeLesson(first);
    assert.deepEqual(store.getCurrentProfile(), before);
    store.completeLesson(result('home-fj', 3));
    const replayed = store.getCurrentProfile();
    assert.equal(replayed.bestStars['home-fj'], 3);
    assert.equal(replayed.completedLessons['home-fj'].completionCount, 2);
    assert.deepEqual(replayed.rewards, ['lesson:home-fj', 'garden:1']);
    assert.equal(replayed.keyMetrics.f.reliable, true);
    assert.equal(replayed.keyMetrics.j.reliable, true);
    store.completeLesson(result('home-dk'));
    assert.ok(store.getCurrentProfile().rewards.includes('hat:flower'));
    assert.equal(store.updatePreferences({ hat: 'flower', snakeColor: 'violet', bridgeComplete: true }).preferences.hat, 'flower');
    assert.equal(store.getCurrentProfile().preferences.snakeColor, 'mint');
    assert.equal(store.getCurrentProfile().preferences.bridgeComplete, true);
});

test('visible result history is bounded while an evicted completion remains idempotent after reload', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    const first = result();
    store.completeLesson(first);
    for (let index = 0; index < progress.HISTORY_LIMIT; index++) store.completeLesson(result());
    assert.equal(store.getCurrentProfile().results.length, progress.HISTORY_LIMIT);
    assert.equal(store.getCurrentProfile().results.some(item => item.id === first.id), false);
    const restored = progress.createStore({ storage: saved });
    const before = restored.getCurrentProfile();
    restored.completeLesson(first);
    assert.deepEqual(restored.getCurrentProfile(), before);
});

test('malformed saved data and unavailable storage leave a usable in-memory profile', () => {
    const malformed = { getItem: () => '{broken', setItem() {} };
    const store = progress.createStore({ storage: malformed });
    assert.equal(store.getState().profiles.length, 1);
    assert.ok(store.completeLesson(result()));
    const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
    const fallback = progress.createStore({ storage: unavailable });
    assert.equal(fallback.getState().persistenceAvailable, false);
    assert.ok(fallback.createProfile('Sam'));
    assert.ok(fallback.completeLesson(result()));
    const invalid = JSON.parse(JSON.stringify(result()));
    invalid.targets = 999;
    assert.equal(fallback.completeLesson(invalid), null);
    const bogus = storage();
    bogus.setItem(progress.STORAGE_KEY, JSON.stringify({ schemaVersion: 1, curriculumVersion: engine.CURRICULUM_VERSION, profiles: [null, { id: 'tampered', nickname: 4, resume: { stage: 'result' }, completedLessons: { bad: { bestStars: 100 } } }] }));
    const repaired = progress.createStore({ storage: bogus }).getCurrentProfile();
    assert.equal(repaired.resume, null);
    assert.deepEqual(repaired.rewards, []);
    assert.deepEqual(repaired.completedLessons, {});
});

test('Rücktaste results and guided resumes persist without planted errors affecting character statistics', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    store.renameProfile('Mia');
    const session = engine.createSession('home-backspace');
    session.backspace();
    session.setPaused(true);
    assert.equal(store.saveSession(session), true);
    const restored = progress.createStore({ storage: saved });
    assert.deepEqual(restored.getResume().stageData.demo.guidedDeleted, [true, false]);
    const completed = result('home-backspace');
    assert.ok(progress.normalizeResult(completed));
    assert.equal(completed.errors, 0);
    assert.equal(completed.corrections, 0);
    assert.equal(completed.backspaces, 0);
    restored.completeLesson(completed);
    assert.equal(restored.getCurrentProfile().completedLessons['home-backspace'].bestResult.accuracyPercent, 100);
    assert.equal(restored.getCurrentProfile().currentLessonId, 'home-dk');
    assert.deepEqual(Object.keys(restored.getCurrentProfile().keyMetrics).sort(), ['f', 'j']);
});

test('inserting the Rücktaste keeps existing results, rewards, and a later lesson resume usable', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    const first = result('home-fj');
    const second = result('home-dk');
    store.completeLesson(first);
    store.completeLesson(second);
    const session = engine.createSession('home-sl');
    session.advanceStage();
    session.submitKey(session.getState().expectedKey);
    session.setPaused(true);
    store.saveSession(session);
    const restored = progress.createStore({ storage: saved });
    assert.equal(restored.getCurrentProfile().completedLessons['home-fj'].bestResult.id, first.id);
    assert.equal(restored.getCurrentProfile().completedLessons['home-dk'].bestResult.id, second.id);
    assert.ok(restored.getCurrentProfile().rewards.includes('hat:flower'));
    assert.equal(restored.getResume().lessonId, 'home-sl');
    assert.equal(restored.getResume().stageData.feed.index, 1);
});

test('every third lesson queues a durable arcade goal, isolated by pupil and result', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    const pupilId = store.getCurrentProfile().id;
    for (const lesson of engine.getLessons()) {
        const completed = result(lesson.id);
        store.completeLesson(completed);
        const pending = store.getCurrentProfile().arcadeChallenge;
        if (lesson.number % 3 !== 0) {
            assert.equal(pending, null);
            continue;
        }
        assert.deepEqual(pending, { lessonId: lesson.id, resultId: completed.id });
        const restored = progress.createStore({ storage: saved });
        assert.deepEqual(restored.getCurrentProfile().arcadeChallenge, pending);
        const target = arcade.getChallenge(lesson).target;
        assert.equal(store.completeArcadeChallenge({ ...pending, score: target - 1 }), false);
        assert.equal(store.completeArcadeChallenge({ ...pending, resultId: 'stale', score: target }), false);
        store.createProfile('Other pupil');
        assert.equal(store.getCurrentProfile().arcadeChallenge, null);
        assert.equal(store.completeArcadeChallenge({ ...pending, score: target }), false);
        store.switchProfile(pupilId);
        const before = store.getCurrentProfile();
        assert.equal(store.completeArcadeChallenge({ ...pending, score: target }), true);
        const after = store.getCurrentProfile();
        assert.equal(after.arcadeChallenge, null);
        assert.deepEqual(after.results, before.results);
        assert.deepEqual(after.completedLessons, before.completedLessons);
        assert.deepEqual(after.keyMetrics, before.keyMetrics);
        store.completeLesson(completed);
        assert.equal(store.getCurrentProfile().arcadeChallenge, null, 'reapplying a saved lesson cannot reopen its goal');
        assert.equal(progress.createStore({ storage: saved }).getCurrentProfile().arcadeChallenge, null);
    }
});

test('legacy profiles have no retroactive arcade gate and invalid goals are discarded', () => {
    const saved = storage();
    const store = progress.createStore({ storage: saved });
    store.completeLesson(result('home-dk'));
    const data = JSON.parse(saved.getItem(progress.STORAGE_KEY));
    delete data.profiles[0].arcadeChallenge;
    saved.setItem(progress.STORAGE_KEY, JSON.stringify(data));
    assert.equal(progress.createStore({ storage: saved }).getCurrentProfile().arcadeChallenge, null);
    data.profiles[0].arcadeChallenge = { lessonId: 'home-dk', resultId: 'unknown' };
    saved.setItem(progress.STORAGE_KEY, JSON.stringify(data));
    assert.equal(progress.createStore({ storage: saved }).getCurrentProfile().arcadeChallenge, null);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const engine = require('./learning-engine');

function finish(session) {
    if (session.getState().stage === 'demo') session.advanceStage();
    for (let guard = 0; guard < 200; guard++) {
        const state = session.getState();
        if (state.stage === 'result') return state.result;
        if (state.needsBackspace) session.backspace();
        else session.submitKey(state.expectedKey);
    }
    throw new Error('Session did not complete');
}

test('every stable curriculum stage uses only keys taught by that lesson, including literal spaces', () => {
    const learned = new Set();
    const ids = new Set();
    engine.LESSONS.forEach((lesson, index) => {
        assert.equal(ids.has(lesson.id), false);
        ids.add(lesson.id);
        lesson.newKeys.forEach(key => { assert.equal(learned.has(key), false); learned.add(key); });
        assert.deepEqual(lesson.permittedKeys, [...learned]);
        assert.equal(lesson.curriculumVersion, engine.CURRICULUM_VERSION);
        for (const stage of ['demo', 'feed', 'write']) {
            assert.ok(lesson.sequences[stage].every(key => learned.has(key)), lesson.id + ' ' + stage);
        }
        assert.equal(lesson.feedTargets.length, lesson.kind === 'backspace' ? 3 : index === 0 ? 12 : 24);
        if (index > 0 && lesson.kind !== 'backspace') assert.equal(lesson.feedTargets.filter(key => lesson.newKeys.includes(key)).length, 16);
    });
    assert.deepEqual([...learned].sort(), 'abcdefghijklmnopqrstuvwxyzäöü,.- '.split('').sort());
    assert.ok(engine.getLesson('home-space').writeTargets.includes(' '));
    assert.equal(engine.validateCurriculum(), true);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(engine.LESSONS)));
});

test('a wrong feeding key stays on the target and raw attempts are retained after success', () => {
    const session = engine.createSession('home-fj');
    session.advanceStage();
    const first = session.getState().expectedKey;
    const wrong = session.submitKey('x');
    assert.equal(wrong.stage, 'feed');
    assert.equal(wrong.targetIndex, 0);
    assert.equal(wrong.expectedKey, first);
    assert.equal(wrong.stageStats.characterAttempts, 1);
    assert.equal(wrong.stageStats.errors, 1);
    session.submitKey(first.toUpperCase());
    const result = finish(session);
    assert.equal(result.targets, 20);
    assert.equal(result.characterAttempts, 21);
    assert.equal(result.correctFirstTry, 19);
    assert.equal(result.errors, 1);
    assert.equal(result.firstTryAccuracy, 0.95);
    assert.equal(result.stars, 3);
});

test('writing mistakes require deletion, retain their error, and count correction separately', () => {
    const session = engine.createSession('home-dk');
    session.advanceStage();
    while (session.getState().stage === 'feed') session.submitKey(session.getState().expectedKey);
    const wrong = session.submitKey('x');
    assert.equal(wrong.needsBackspace, true);
    assert.deepEqual(wrong.typed, ['x']);
    assert.equal(wrong.targetIndex, 0);
    session.submitKey(session.getState().expectedKey);
    assert.deepEqual(session.getState().typed, ['x']);
    session.backspace();
    const corrected = session.submitKey(session.getState().expectedKey);
    assert.equal(corrected.needsBackspace, false);
    assert.equal(corrected.stageStats.errors, 2);
    assert.equal(corrected.stageStats.corrections, 1);
    const result = finish(session);
    assert.equal(result.correctFirstTry, result.targets - 1);
    assert.equal(result.errors, 2);
    assert.equal(result.corrections, 1);
    assert.equal(result.backspaces, 1);
    assert.equal(result.characterAttempts, result.targets + 2);
});

test('deleting correct text cannot conceal a mistake on its rewritten target', () => {
    const session = engine.createSession('home-dk');
    session.advanceStage();
    while (session.getState().stage === 'feed') session.submitKey(session.getState().expectedKey);
    session.submitKey(session.getState().expectedKey);
    session.backspace();
    session.submitKey('x');
    session.backspace();
    const result = finish(session);
    assert.equal(result.correctFirstTry, result.targets - 1);
    assert.equal(result.errors, 1);
    assert.equal(result.backspaces, 2);
    assert.equal(result.corrections, 1);
    assert.equal(result.characterAttempts, result.targets + 2);
});

test('completion always earns a star, with inclusive 90% and 95% extra-star thresholds', () => {
    for (const [mistakes, stars] of [[0, 3], [1, 3], [2, 2], [3, 1]]) {
        const session = engine.createSession('home-fj');
        session.advanceStage();
        for (let index = 0; index < mistakes; index++) {
            session.submitKey('x');
            session.submitKey(session.getState().expectedKey);
        }
        assert.equal(finish(session).stars, stars);
    }
});

test('paused time and ignored keys do not affect active time or attempts; result remains immutable', () => {
    let time = 1000;
    const session = engine.createSession('home-fj', { now: () => time });
    time += 100;
    session.advanceStage();
    time += 150;
    session.setPaused(true);
    time += 10000;
    session.submitKey('f');
    session.hintUsed();
    session.setPaused(false);
    time += 250;
    session.submitKey('Enter');
    session.hintUsed();
    const result = finish(session);
    assert.equal(result.activeMs, 400);
    assert.equal(result.stages.demo.activeMs, 100);
    assert.equal(result.hintsUsed, 1);
    assert.equal(result.characterAttempts, 20);
    assert.throws(() => { result.stars = 99; }, TypeError);
    assert.throws(() => { result.stages.feed.errors = 0; }, TypeError);
    time += 10000;
    session.submitKey('x');
    assert.strictEqual(session.getState().result, result);
    assert.equal(session.getState().result.activeMs, 400);
});

test('a paused snapshot restores writing errors, counters and targets without adding time away', () => {
    let time = 100;
    const original = engine.createSession('home-space', { now: () => time });
    original.advanceStage();
    while (original.getState().stage === 'feed') original.submitKey(original.getState().expectedKey);
    time += 25;
    original.submitKey('x');
    original.setPaused(true);
    const snapshot = original.exportSnapshot();
    assert.equal(engine.isValidSnapshot(snapshot), true);
    time += 5000;
    const restored = engine.createSession('home-space', { snapshot, now: () => time });
    assert.equal(restored.getState().needsBackspace, true);
    assert.equal(restored.getState().stats.errors, 1);
    assert.equal(restored.getState().stats.activeMs, 25);
    restored.setPaused(false);
    restored.backspace();
    const result = finish(restored);
    assert.equal(result.sessionId, snapshot.sessionId);
    assert.equal(result.errors, 1);
    assert.equal(result.corrections, 1);
    assert.ok(result.stages.write.targets > 0);
});

test('incompatible or invalid snapshots restart safely and cannot replace approved targets', () => {
    const session = engine.createSession('home-fj');
    const bad = session.exportSnapshot();
    bad.stageData.feed.targets[0] = 'q';
    assert.equal(engine.isValidSnapshot(bad), false);
    assert.equal(engine.createSession('home-fj', { snapshot: bad }).getState().stage, 'demo');
    const old = session.exportSnapshot();
    old.curriculumVersion = '0.0.0';
    assert.equal(engine.isValidSnapshot(old), false);
    assert.equal(engine.getLesson('unknown'), null);
    assert.throws(() => engine.createSession('unknown'), /Unknown/);
});

test('the Rücktaste comes second while every existing lesson keeps its character curriculum and targets', () => {
    assert.equal(engine.CURRICULUM_VERSION, '1.0.0');
    assert.equal(engine.getLessons().length, 18);
    assert.equal(engine.getLesson('home-fj').nextLessonId, 'home-backspace');
    const lesson = engine.getLesson('home-backspace');
    assert.equal(lesson.number, 2);
    assert.equal(lesson.nextLessonId, 'home-dk');
    assert.equal(lesson.kind, 'backspace');
    assert.deepEqual(lesson.newKeys, []);
    assert.deepEqual(lesson.newControlKeys, ['backspace']);
    assert.deepEqual(lesson.taughtKeys, ['f', 'j']);
    const original = engine.getLessons().filter(item => item.id !== 'home-backspace').map(item => ({
        id: item.id, newKeys: item.newKeys, taughtKeys: item.taughtKeys, permittedKeys: item.permittedKeys,
        oldKeys: item.oldKeys, demoTargets: item.demoTargets, feedTargets: item.feedTargets, writeTargets: item.writeTargets
    }));
    assert.equal(crypto.createHash('sha256').update(JSON.stringify(original)).digest('hex'),
        '10958324027c4cab5f45316b16a861f223ea9b2c80639d5199558be11566d37d');
});

test('the first F/J writing task retries directly before the deletion key has been taught', () => {
    const session = engine.createSession('home-fj');
    session.advanceStage();
    while (session.getState().stage === 'feed') session.submitKey(session.getState().expectedKey);
    const expected = session.getState().expectedKey;
    const wrong = session.submitKey('x');
    assert.equal(wrong.needsBackspace, false);
    assert.deepEqual(wrong.typed, []);
    assert.equal(wrong.stageStats.errors, 1);
    session.submitKey(expected);
    const result = finish(session);
    assert.equal(result.errors, 1);
    assert.equal(result.correctFirstTry, result.targets - 1);
    assert.equal(result.corrections, 0);
    assert.equal(result.backspaces, 0);
});

test('legacy F/J writing snapshots retry their pending typo without losing its recorded error', () => {
    const original = engine.createSession('home-fj');
    original.advanceStage();
    while (original.getState().stage === 'feed') original.submitKey(original.getState().expectedKey);
    original.submitKey('x');
    original.setPaused(true);
    const legacy = original.exportSnapshot();
    legacy.stageData.write.typed.push('x');
    assert.equal(engine.isValidSnapshot(legacy), true);
    const restored = engine.createSession('home-fj', { snapshot: legacy });
    assert.equal(restored.getState().paused, true);
    assert.equal(restored.getState().needsBackspace, false);
    assert.deepEqual(restored.getState().typed, []);
    assert.equal(restored.getState().stageStats.errors, 1);
    restored.setPaused(false);
    assert.equal(finish(restored).correctFirstTry, 19);
});

test('guided deletion cannot be skipped and its planted examples do not count as typing mistakes', () => {
    const session = engine.createSession('home-backspace');
    const initial = session.getState();
    assert.equal(initial.stage, 'demo');
    assert.equal(initial.expectedKey, 'backspace');
    assert.equal(initial.typingExpectedKey, 'f');
    assert.equal(initial.guidedCorrectionPending, true);
    assert.equal(initial.needsBackspace, true);
    assert.equal(initial.canAdvance, false);
    session.advanceStage();
    assert.equal(session.getState().stage, 'demo');
    const ignored = session.submitKey('f');
    assert.equal(ignored.targetIndex, 0);
    assert.equal(ignored.lastInput.reason, 'guided-needs-backspace');
    assert.equal(ignored.stageStats.characterAttempts, 0);
    const deleted = session.backspace();
    assert.equal(deleted.lastInput.reason, 'guided-deleted');
    assert.equal(deleted.expectedKey, 'f');
    assert.equal(deleted.guidedCorrectionPending, false);
    session.submitKey('f');
    assert.equal(session.getState().expectedKey, 'backspace');
    assert.equal(session.getState().typingExpectedKey, 'j');
    const result = finish(session);
    assert.equal(result.targets, 6);
    assert.equal(result.characterAttempts, 6);
    assert.equal(result.correctFirstTry, 6);
    assert.equal(result.errors, 0);
    assert.equal(result.corrections, 0);
    assert.equal(result.backspaces, 0);
    assert.equal(result.accuracyPercent, 100);
    assert.equal(result.stages.demo.characterAttempts, 2);
});

test('guided deletion progress survives pause and reload without repeating or bypassing a correction', () => {
    const original = engine.createSession('home-backspace');
    original.backspace();
    original.setPaused(true);
    const snapshot = original.exportSnapshot();
    assert.equal(engine.isValidSnapshot(snapshot), true);
    assert.deepEqual(snapshot.stageData.demo.guidedDeleted, [true, false]);
    const restored = engine.createSession('home-backspace', { snapshot });
    assert.equal(restored.getState().expectedKey, 'f');
    restored.submitKey('f');
    assert.equal(restored.getState().targetIndex, 0);
    restored.setPaused(false);
    restored.submitKey('f');
    assert.equal(restored.getState().expectedKey, 'backspace');
    assert.deepEqual(restored.exportSnapshot().stageData.demo.guidedDeleted, [true, false]);
    const bad = JSON.parse(JSON.stringify(snapshot));
    bad.stageData.demo.guidedDeleted = [true];
    assert.equal(engine.isValidSnapshot(bad), false);
    const future = JSON.parse(JSON.stringify(snapshot));
    future.stageData.feed.guidedDeleted[2] = true;
    assert.equal(engine.isValidSnapshot(future), false);
    assert.equal(finish(restored).accuracyPercent, 100);
});

test('actual mistakes in the Rücktaste writing task still need correction and retain first-try accuracy', () => {
    const session = engine.createSession('home-backspace');
    while (session.getState().stage !== 'write') {
        if (session.getState().guidedCorrectionPending) session.backspace();
        else session.submitKey(session.getState().expectedKey);
    }
    session.backspace();
    session.submitKey('x');
    assert.equal(session.getState().guidedCorrectionPending, false);
    assert.equal(session.getState().needsBackspace, true);
    assert.deepEqual(session.getState().typed, ['x']);
    session.backspace();
    const result = finish(session);
    assert.equal(result.errors, 1);
    assert.equal(result.corrections, 1);
    assert.equal(result.backspaces, 1);
    assert.equal(result.correctFirstTry, 5);
});

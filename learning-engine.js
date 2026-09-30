(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.QwertzLearningEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const CURRICULUM_VERSION = '1.0.0';
    const SNAPSHOT_VERSION = 1;
    const STAGES = ['demo', 'feed', 'write', 'result'];
    const SCORE_STAGES = ['feed', 'write'];
    const ALL_KEYS = 'abcdefghijklmnopqrstuvwxyzäöü,.- '.split('');
    const clone = value => JSON.parse(JSON.stringify(value));
    function freeze(value) {
        if (value && typeof value === 'object') {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
        }
        return value;
    }
    const definitions = [
        ['home-fj', 'F und J finden', ['f', 'j'], ['fj', 'jf', 'ffjj']],
        ['home-backspace', 'Die Rücktaste', [], ['j', 'f', 'j'], {
            kind: 'backspace', newControlKeys: ['backspace'],
            demoTargets: ['f', 'j'], feedTargets: ['f', 'j', 'f'], writeTargets: ['j', 'f', 'j']
        }],
        ['home-dk', 'D und K entdecken', ['d', 'k'], ['fd', 'jk', 'fjdk']],
        ['home-sl', 'S und L entdecken', ['s', 'l'], ['fds', 'jkl', 'sdk']],
        ['home-aoe', 'A und Ö entdecken', ['a', 'ö'], ['fall', 'das', 'öl']],
        ['home-space', 'Die Leertaste', [' '], ['fall öl', 'das öl', 'saal']],
        ['reach-gh', 'G und H erreichen', ['g', 'h'], ['hals', 'glas', 'gas']],
        ['reach-ru', 'R und U erreichen', ['r', 'u'], ['uhr', 'klar', 'ural']],
        ['reach-tz', 'T und Z erreichen', ['t', 'z'], ['satz', 'zart', 'salz']],
        ['reach-ei', 'E und I erreichen', ['e', 'i'], ['reise', 'leise', 'zeile']],
        ['reach-wo', 'W und O erreichen', ['w', 'o'], ['wolle', 'wiese', 'rolle']],
        ['reach-qp', 'Q und P erreichen', ['q', 'p'], ['papa', 'quelle', 'quark']],
        ['reach-vm', 'V und M erreichen', ['v', 'm'], ['maus', 'vogel', 'warm']],
        ['reach-bn', 'B und N erreichen', ['b', 'n'], ['biene', 'banane', 'nebel']],
        ['reach-c-comma', 'C und Komma', ['c', ','], ['ich, du', 'danke, du']],
        ['reach-x-period', 'X und Punkt', ['x', '.'], ['mix.', 'text.', 'max.']],
        ['reach-y-hyphen', 'Y und Bindestrich', ['y', '-'], ['yoga', 'x-y', 'typ']],
        ['reach-umlauts', 'Ü und Ä erreichen', ['ü', 'ä'], ['grün', 'für', 'bär']]
    ];

    function feedTargets(newKeys, oldKeys, count) {
        const targets = [];
        let fresh = 0;
        let old = 0;
        for (let i = 0; i < count; i++) {
            targets.push(oldKeys.length && i % 3 === 2 ? oldKeys[old++ % oldKeys.length] : newKeys[fresh++ % newKeys.length]);
        }
        return targets;
    }
    let taught = [];
    const lessons = definitions.map((definition, index) => {
        const [id, title, newKeys, writePrompts, tutorial] = definition;
        const oldKeys = taught.slice();
        taught = taught.concat(newKeys);
        const lesson = {
            id, title, index, number: index + 1, curriculumVersion: CURRICULUM_VERSION,
            newKeys: newKeys.slice(), taughtKeys: taught.slice(), permittedKeys: taught.slice(), oldKeys,
            feedTargetCount: tutorial ? tutorial.feedTargets.length : id === 'home-fj' ? 12 : 24,
            demoTargets: tutorial ? tutorial.demoTargets.slice() : newKeys.flatMap(key => [key, key]),
            feedTargets: tutorial ? tutorial.feedTargets.slice() : feedTargets(newKeys, oldKeys, id === 'home-fj' ? 12 : 24),
            writePrompts: writePrompts.slice(), words: writePrompts.slice(),
            writeTargets: tutorial ? tutorial.writeTargets.slice() : writePrompts.join(taught.includes(' ') ? ' ' : '').split(''),
            nextLessonId: definitions[index + 1] ? definitions[index + 1][0] : null
        };
        if (tutorial) {
            lesson.kind = tutorial.kind;
            lesson.newControlKeys = tutorial.newControlKeys.slice();
        }
        lesson.sequences = { demo: lesson.demoTargets, feed: lesson.feedTargets, write: lesson.writeTargets };
        if (id === 'home-dk') lesson.bridge = { controlKeys: { left: 'f', right: 'j', up: 'd', down: 'k' }, safe: true };
        return freeze(lesson);
    });
    const byId = Object.fromEntries(lessons.map(lesson => [lesson.id, lesson]));

    function validateCurriculum() {
        const introduced = new Set();
        for (const lesson of lessons) {
            for (const key of lesson.newKeys) {
                if (!ALL_KEYS.includes(key) || introduced.has(key)) throw new Error('Invalid curriculum key: ' + key);
                introduced.add(key);
            }
            for (const stage of ['demo', 'feed', 'write']) {
                if (!lesson[stage + 'Targets'].length || lesson[stage + 'Targets'].some(key => !introduced.has(key))) {
                    throw new Error('Untaught target in ' + lesson.id + '/' + stage);
                }
            }
        }
        if (ALL_KEYS.some(key => !introduced.has(key))) throw new Error('Incomplete curriculum');
        return true;
    }
    validateCurriculum();

    const getLesson = id => byId[id] || null;
    const normalizeKey = key => {
        if (typeof key !== 'string' || Array.from(key).length !== 1) return null;
        const normalized = key.toLowerCase();
        return Array.from(normalized).length === 1 ? normalized : null;
    };
    const nonnegative = value => Number.isFinite(value) && value >= 0;
    const integer = value => Number.isSafeInteger(value) && value >= 0;
    function makeStage(targets, guided) {
        const data = {
            targets: targets.slice(), index: 0, typed: [],
            firstTry: targets.map(() => null), completed: targets.map(() => false),
            characterAttempts: 0, errors: 0, corrections: 0, backspaces: 0, activeMs: 0, hintsUsed: 0,
            keyAttempts: Object.fromEntries([...new Set(targets)].map(key => [key,
                { attempts: 0, errors: 0, corrections: 0, correct: 0, streak: 0 }]))
        };
        if (guided) data.guidedDeleted = targets.map(() => false);
        return data;
    }
    function stageMetrics(data) {
        const perKey = {};
        data.targets.forEach((key, index) => {
            if (!perKey[key]) perKey[key] = {
                targets: 0, attemptedTargets: 0, correctFirstTry: 0,
                attempts: 0, errors: 0, corrections: 0, correct: 0, streak: 0
            };
            perKey[key].targets++;
            if (data.firstTry[index] !== null) perKey[key].attemptedTargets++;
            if (data.completed[index] && data.firstTry[index] === true) perKey[key].correctFirstTry++;
        });
        Object.keys(perKey).forEach(key => Object.assign(perKey[key], data.keyAttempts[key]));
        const attemptedTargets = data.firstTry.filter(value => value !== null).length;
        const correctFirstTry = data.firstTry.filter((value, index) => value === true && data.completed[index]).length;
        return {
            targets: data.targets.length, completedTargets: data.completed.filter(Boolean).length,
            attemptedTargets, correctFirstTry, characterAttempts: data.characterAttempts,
            errors: data.errors, corrections: data.corrections, backspaces: data.backspaces,
            activeMs: Math.round(data.activeMs), hintsUsed: data.hintsUsed,
            accuracy: attemptedTargets ? correctFirstTry / attemptedTargets : 1, perKey
        };
    }
    function sumMetrics(stages) {
        const totals = {
            targets: 0, completedTargets: 0, attemptedTargets: 0, correctFirstTry: 0,
            characterAttempts: 0, errors: 0, corrections: 0, backspaces: 0,
            activeMs: 0, hintsUsed: 0, perKey: {}
        };
        for (const stage of stages) {
            const metrics = stageMetrics(stage);
            Object.keys(totals).filter(key => key !== 'perKey').forEach(key => totals[key] += metrics[key]);
            Object.entries(metrics.perKey).forEach(([key, metric]) => {
                if (!totals.perKey[key]) totals.perKey[key] = { ...metric };
                else {
                    const previous = totals.perKey[key];
                    Object.keys(metric).filter(name => name !== 'streak').forEach(name => previous[name] += metric[name]);
                    previous.streak = metric.streak;
                }
            });
        }
        totals.accuracy = totals.attemptedTargets ? totals.correctFirstTry / totals.attemptedTargets : 1;
        return totals;
    }
    function validStage(data, targets, stage, guided) {
        if (!data || JSON.stringify(data.targets) !== JSON.stringify(targets) || !integer(data.index) || data.index > targets.length) return false;
        if (!Array.isArray(data.typed) || data.typed.length > targets.length || data.typed.some(key => normalizeKey(key) !== key)) return false;
        if (!Array.isArray(data.firstTry) || data.firstTry.length !== targets.length || data.firstTry.some(value => value !== null && typeof value !== 'boolean')) return false;
        if (!Array.isArray(data.completed) || data.completed.length !== targets.length || data.completed.some(value => typeof value !== 'boolean')) return false;
        if (!['characterAttempts', 'errors', 'corrections', 'backspaces', 'hintsUsed'].every(key => integer(data[key]))) return false;
        if (!nonnegative(data.activeMs) || data.errors > data.characterAttempts || data.corrections > data.backspaces) return false;
        if (data.completed.some((value, index) => value !== (index < data.index))) return false;
        if (data.firstTry.some((value, index) => index < data.index && value === null)) return false;
        if (guided) {
            if (!Array.isArray(data.guidedDeleted) || data.guidedDeleted.length !== targets.length || data.guidedDeleted.some(value => typeof value !== 'boolean')) return false;
            if (data.guidedDeleted.slice(0, data.index).some(value => !value) || data.guidedDeleted.slice(data.index + 1).some(Boolean)) return false;
            if (data.index < targets.length && !data.guidedDeleted[data.index] && (data.firstTry[data.index] !== null || data.typed.length !== data.index)) return false;
        }
        if (data.typed.slice(0, data.index).some((key, index) => key !== targets[index])) return false;
        if (stage === 'write') {
            if (data.typed.length !== data.index && data.typed.length !== data.index + 1) return false;
            if (data.typed.length > data.index && data.typed[data.index] === targets[data.index]) return false;
        } else if (data.typed.length !== data.index) return false;
        const validMetrics = [...new Set(targets)].every(key => {
            const metric = data.keyAttempts && data.keyAttempts[key];
            return metric && ['attempts', 'errors', 'corrections', 'correct', 'streak'].every(name => integer(metric[name])) &&
                metric.correct + metric.errors === metric.attempts && metric.streak <= metric.correct;
        });
        if (!validMetrics) return false;
        return [['attempts', 'characterAttempts'], ['errors', 'errors'], ['corrections', 'corrections']].every(([metric, total]) =>
            [...new Set(targets)].reduce((sum, key) => sum + data.keyAttempts[key][metric], 0) === data[total]);
    }
    function isValidSnapshot(snapshot) {
        if (!snapshot || snapshot.schemaVersion !== SNAPSHOT_VERSION || snapshot.curriculumVersion !== CURRICULUM_VERSION) return false;
        const lesson = getLesson(snapshot.lessonId);
        if (!lesson || typeof snapshot.sessionId !== 'string' || !snapshot.sessionId || snapshot.sessionId.length > 200 || !STAGES.includes(snapshot.stage)) return false;
        if (!nonnegative(snapshot.createdAt) || typeof snapshot.paused !== 'boolean') return false;
        for (const stage of ['demo', 'feed', 'write']) {
            if (!validStage(snapshot.stageData && snapshot.stageData[stage], lesson[stage + 'Targets'], stage, lesson.kind === 'backspace')) return false;
            if (STAGES.indexOf(stage) < STAGES.indexOf(snapshot.stage) && snapshot.stageData[stage].index !== lesson[stage + 'Targets'].length) return false;
            if (STAGES.indexOf(stage) > STAGES.indexOf(snapshot.stage) && (snapshot.stageData[stage].characterAttempts !== 0 ||
                lesson.kind === 'backspace' && snapshot.stageData[stage].guidedDeleted.some(Boolean))) return false;
        }
        return snapshot.stage !== 'result' || nonnegative(snapshot.completedAt);
    }

    function createSession(lessonId, options) {
        options = options || {};
        const lesson = getLesson(lessonId);
        if (!lesson) throw new Error('Unknown learning lesson: ' + lessonId);
        const guided = lesson.kind === 'backspace';
        const now = typeof options.now === 'function' ? options.now : Date.now;
        const time = () => Math.max(0, Number(now()) || 0);
        const createdAt = time();
        let state = {
            schemaVersion: SNAPSHOT_VERSION, curriculumVersion: CURRICULUM_VERSION, lessonId,
            sessionId: 'run-' + createdAt.toString(36) + '-' + Math.random().toString(36).slice(2, 11),
            createdAt, completedAt: null, stage: 'demo', paused: false,
            stageData: { demo: makeStage(lesson.demoTargets, guided), feed: makeStage(lesson.feedTargets, guided), write: makeStage(lesson.writeTargets, guided) }
        };
        if (options.snapshot && options.snapshot.lessonId === lessonId && isValidSnapshot(options.snapshot)) {
            const saved = options.snapshot;
            state = {
                schemaVersion: SNAPSHOT_VERSION, curriculumVersion: CURRICULUM_VERSION, lessonId,
                sessionId: saved.sessionId, createdAt: saved.createdAt, completedAt: saved.completedAt,
                stage: saved.stage, paused: saved.paused, stageData: {}
            };
            for (const stage of ['demo', 'feed', 'write']) {
                const savedStage = saved.stageData[stage];
                const cleanStage = makeStage(lesson[stage + 'Targets'], guided);
                Object.keys(cleanStage).filter(key => key !== 'keyAttempts').forEach(key => cleanStage[key] = clone(savedStage[key]));
                Object.keys(cleanStage.keyAttempts).forEach(key => {
                    Object.keys(cleanStage.keyAttempts[key]).forEach(name => cleanStage.keyAttempts[key][name] = savedStage.keyAttempts[key][name]);
                });
                state.stageData[stage] = cleanStage;
            }
            // Older F/J sessions may already contain a typo from before the Rücktaste lesson existed.
            // Keep its recorded error, but let the pupil retry without an untaught deletion step.
            if (lessonId === 'home-fj' && state.stage === 'write' && state.stageData.write.typed.length > state.stageData.write.index) state.stageData.write.typed.pop();
        }
        let lastTime = time();
        let lastInput = null;
        let result = null;
        function tick() {
            const current = time();
            if (!state.paused && state.stage !== 'result') state.stageData[state.stage].activeMs += Math.max(0, current - lastTime);
            lastTime = current;
        }
        function buildResult() {
            const stages = Object.fromEntries(['demo', 'feed', 'write'].map(stage => [stage, stageMetrics(state.stageData[stage])]));
            const totals = sumMetrics(SCORE_STAGES.map(stage => state.stageData[stage]));
            const stars = totals.accuracy >= 0.95 ? 3 : totals.accuracy >= 0.90 ? 2 : 1;
            return freeze({
                id: state.sessionId, sessionId: state.sessionId, lessonId,
                curriculumVersion: CURRICULUM_VERSION, completedAt: state.completedAt,
                scoringStages: SCORE_STAGES.slice(), stages, ...totals, stars,
                firstTryAccuracy: totals.accuracy, accuracyPercent: Math.round(totals.accuracy * 100),
                introducedKeys: lesson.newKeys.slice(), taughtKeys: lesson.taughtKeys.slice()
            });
        }
        if (state.stage === 'result') result = buildResult();
        function transition() {
            const next = STAGES[STAGES.indexOf(state.stage) + 1];
            if (!next) return;
            state.stage = next;
            if (next === 'result') {
                state.completedAt = time();
                result = buildResult();
            }
        }
        function getState() {
            tick();
            const current = state.stage === 'result' ? null : state.stageData[state.stage];
            const typingExpectedKey = current && current.index < current.targets.length ? current.targets[current.index] : null;
            const guidedCorrectionPending = !!(guided && current && current.index < current.targets.length && !current.guidedDeleted[current.index]);
            const snapshot = {
                sessionId: state.sessionId, lessonId, curriculumVersion: CURRICULUM_VERSION,
                lesson, stage: state.stage, paused: state.paused,
                targets: current ? current.targets.slice() : [], targetIndex: current ? current.index : 0,
                expectedKey: guidedCorrectionPending ? 'backspace' : typingExpectedKey,
                typingExpectedKey, guidedCorrectionPending,
                typed: current ? current.typed.slice() : [],
                needsBackspace: guidedCorrectionPending || !!(current && state.stage === 'write' && current.typed.length > current.index),
                canAdvance: state.stage === 'demo' && (!guided || current.guidedDeleted.every(Boolean)),
                progress: current ? current.index / current.targets.length : 1,
                stageStats: current ? stageMetrics(current) : null,
                stats: sumMetrics(SCORE_STAGES.map(stage => state.stageData[stage])),
                perKey: current ? stageMetrics(current).perKey : result.perKey,
                lastInput: lastInput && { ...lastInput }, result
            };
            // Result and curriculum objects are immutable; arrays and live metrics are detached.
            return snapshot;
        }
        function submitKey(key) {
            tick();
            const normalized = normalizeKey(key);
            if (!normalized || state.paused || state.stage === 'result') {
                lastInput = { key, ignored: true, reason: !normalized ? 'not-character' : state.paused ? 'paused' : 'finished' };
                return getState();
            }
            const current = state.stageData[state.stage];
            const index = current.index;
            if (guided && !current.guidedDeleted[index]) {
                lastInput = { key: normalized, ignored: true, reason: 'guided-needs-backspace' };
                return getState();
            }
            const expected = current.targets[index];
            const blocked = state.stage === 'write' && current.typed.length > index;
            const correct = !blocked && normalized === expected;
            current.characterAttempts++;
            const metric = current.keyAttempts[expected];
            metric.attempts++;
            if (current.firstTry[index] === null) current.firstTry[index] = correct;
            if (correct) {
                metric.correct++;
                metric.streak++;
                current.completed[index] = true;
                current.typed.push(normalized);
                current.index++;
            } else {
                // Deleting and retyping a previously correct target cannot erase a later mistake.
                current.firstTry[index] = false;
                current.errors++;
                metric.errors++;
                metric.streak = 0;
                if (state.stage === 'write' && !blocked && lessonId !== 'home-fj') current.typed.push(normalized);
            }
            lastInput = { key: normalized, expected, correct, ignored: false, reason: blocked ? 'needs-backspace' : correct ? 'correct' : 'wrong-key' };
            if (current.index === current.targets.length) transition();
            return getState();
        }
        function backspace() {
            tick();
            const current = state.stage === 'result' ? null : state.stageData[state.stage];
            if (!state.paused && guided && current && current.index < current.targets.length && !current.guidedDeleted[current.index]) {
                current.guidedDeleted[current.index] = true;
                lastInput = { key: 'Backspace', ignored: false, reason: 'guided-deleted' };
                return getState();
            }
            if (state.paused || state.stage !== 'write' || !state.stageData.write.typed.length) {
                lastInput = { key: 'Backspace', ignored: true, reason: 'no-writing-character' };
                return getState();
            }
            const data = state.stageData.write;
            data.backspaces++;
            if (data.typed.length > data.index) {
                data.corrections++;
                data.keyAttempts[data.targets[data.index]].corrections++;
            } else {
                data.index--;
                data.completed[data.index] = false;
            }
            data.typed.pop();
            lastInput = { key: 'Backspace', ignored: false, reason: 'deleted' };
            return getState();
        }
        function setPaused(paused) {
            tick();
            state.paused = !!paused;
            return getState();
        }
        function hintUsed() {
            tick();
            if (state.stage !== 'result' && !state.paused) state.stageData[state.stage].hintsUsed++;
            return getState();
        }
        function advanceStage() {
            tick();
            if (state.stage === 'demo' && !state.paused && (!guided || state.stageData.demo.guidedDeleted.every(Boolean))) {
                // The UI may demonstrate the keys without asking the pupil to type them.
                const data = state.stageData.demo;
                data.index = data.targets.length;
                data.typed = data.targets.slice();
                data.completed.fill(true);
                data.firstTry = data.firstTry.map(value => value === null ? true : value);
                transition();
            }
            return getState();
        }
        function exportSnapshot() {
            tick();
            return clone(state);
        }
        return { getState, submitKey, backspace, setPaused, hintUsed, advanceStage, exportSnapshot };
    }

    return freeze({
        CURRICULUM_VERSION, SNAPSHOT_VERSION, LESSONS: lessons,
        getLessons: () => lessons.slice(), getLesson, validateCurriculum,
        normalizeKey, isValidSnapshot, createSession
    });
}));

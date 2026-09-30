(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./learning-engine'), root, require('./learning-arcade'));
    else root.QwertzLearningProgress = factory(root.QwertzLearningEngine, root, root.QwertzLearningArcade);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine, root, arcade) {
    'use strict';

    const STORAGE_KEY = 'qwertznake-learning-v1';
    const HISTORY_LIMIT = 50;
    const PROFILE_LIMIT = 100;
    const SCHEMA_VERSION = 1;
    const clone = value => JSON.parse(JSON.stringify(value));
    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const plain = value => value && typeof value === 'object' && !Array.isArray(value);
    const integer = value => Number.isSafeInteger(value) && value >= 0;
    const safeId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
    const nicknameOf = value => typeof value === 'string' ? value.trim().slice(0, 40) : '';
    const defaultPreferences = () => ({ snakeColor: 'mint', hat: 'none', showFingerHelp: true, bridgeComplete: false });
    const rewardRules = [
        { count: 2, id: 'hat:flower' },
        { count: 3, id: 'color:gold' },
        { count: 6, id: 'color:violet' },
        { count: 8, id: 'hat:crown' }
    ];
    function rewardsFor(completedLessons) {
        const ids = engine.getLessons().map(lesson => lesson.id).filter(id => own(completedLessons, id));
        const rewards = ids.map(id => 'lesson:' + id);
        for (let count = 1; count <= ids.length; count++) rewards.push('garden:' + count);
        rewardRules.filter(rule => ids.length >= rule.count).forEach(rule => rewards.push(rule.id));
        return rewards;
    }
    function normalizePreferences(preferences, rewards) {
        const result = defaultPreferences();
        if (!plain(preferences)) return result;
        if (preferences.snakeColor === 'mint' || rewards.includes('color:' + preferences.snakeColor)) result.snakeColor = preferences.snakeColor;
        if (preferences.hat === 'none' || rewards.includes('hat:' + preferences.hat)) result.hat = preferences.hat;
        if (typeof preferences.showFingerHelp === 'boolean') result.showFingerHelp = preferences.showFingerHelp;
        if (typeof preferences.bridgeComplete === 'boolean') result.bridgeComplete = preferences.bridgeComplete;
        return result;
    }
    function normalizeResult(result) {
        if (!plain(result) || result.curriculumVersion !== engine.CURRICULUM_VERSION || !safeId(result.id)) return null;
        const lesson = engine.getLesson(result.lessonId);
        if (!lesson || !plain(result.stages)) return null;
        const countFields = ['targets', 'completedTargets', 'attemptedTargets', 'correctFirstTry', 'characterAttempts', 'errors', 'corrections', 'backspaces', 'activeMs', 'hintsUsed'];
        const expectedTargets = lesson.feedTargets.length + lesson.writeTargets.length;
        if (!countFields.every(field => integer(result[field])) || result.targets !== expectedTargets || result.completedTargets !== expectedTargets || result.attemptedTargets !== expectedTargets) return null;
        if (result.correctFirstTry > expectedTargets || result.characterAttempts < expectedTargets || result.errors > result.characterAttempts || result.corrections > result.backspaces) return null;
        if (!Number.isFinite(result.completedAt) || result.completedAt < 0 || !plain(result.perKey)) return null;
        const stages = {};
        for (const name of ['demo', 'feed', 'write']) {
            const metrics = result.stages[name];
            if (!plain(metrics) || !countFields.every(field => integer(metrics[field])) || metrics.targets !== lesson[name + 'Targets'].length) return null;
            if (!plain(metrics.perKey) || metrics.completedTargets !== metrics.targets || metrics.attemptedTargets !== metrics.targets || metrics.correctFirstTry > metrics.targets) return null;
            const perKey = {};
            for (const key of new Set(lesson[name + 'Targets'])) {
                const source = own(metrics.perKey, key) && metrics.perKey[key];
                const metricFields = ['targets', 'attemptedTargets', 'correctFirstTry', 'attempts', 'errors', 'corrections', 'correct', 'streak'];
                const targetCount = lesson[name + 'Targets'].filter(target => target === key).length;
                if (!plain(source) || !metricFields.every(field => integer(source[field])) || source.targets !== targetCount || source.attemptedTargets !== targetCount || source.correctFirstTry > targetCount || source.correct + source.errors !== source.attempts || source.streak > source.correct) return null;
                // Scored stages must contain a successful attempt at every completed target.
                // A teacher may demonstrate the unscored demo without pupil key presses.
                if (name !== 'demo' && (source.correct < targetCount || source.errors < targetCount - source.correctFirstTry)) return null;
                perKey[key] = Object.fromEntries(metricFields.map(field => [field, source[field]]));
            }
            if ([['attempts', 'characterAttempts'], ['errors', 'errors'], ['corrections', 'corrections'], ['correctFirstTry', 'correctFirstTry']].some(([field, total]) => Object.values(perKey).reduce((sum, metric) => sum + metric[field], 0) !== metrics[total])) return null;
            stages[name] = { ...Object.fromEntries(countFields.map(field => [field, metrics[field]])), accuracy: metrics.correctFirstTry / metrics.targets, perKey };
        }
        if (countFields.some(field => result.stages.feed[field] + result.stages.write[field] !== result[field])) return null;
        const perKey = {};
        for (const name of ['feed', 'write']) {
            Object.entries(stages[name].perKey).forEach(([key, metric]) => {
                if (!own(perKey, key)) perKey[key] = { ...metric };
                else {
                    Object.keys(metric).filter(field => field !== 'streak').forEach(field => perKey[key][field] += metric[field]);
                    perKey[key].streak = metric.streak;
                }
            });
        }
        const output = {
            id: result.id, sessionId: result.id, lessonId: lesson.id,
            curriculumVersion: engine.CURRICULUM_VERSION, completedAt: result.completedAt,
            ...Object.fromEntries(countFields.map(field => [field, result[field]])), stages, perKey
        };
        output.accuracy = output.correctFirstTry / output.targets;
        output.firstTryAccuracy = output.accuracy;
        output.accuracyPercent = Math.round(output.accuracy * 100);
        output.stars = output.accuracy >= 0.95 ? 3 : output.accuracy >= 0.90 ? 2 : 1;
        output.sessionId = output.id;
        output.scoringStages = ['feed', 'write'];
        output.introducedKeys = lesson.newKeys.slice();
        output.taughtKeys = lesson.taughtKeys.slice();
        return output;
    }
    function normalizeBestResult(raw, lessonId) {
        const result = normalizeResult(raw);
        return result && (!lessonId || result.lessonId === lessonId) ? result : null;
    }
    function isBetterResult(candidate, previous) {
        return !!candidate && (!previous || candidate.correctFirstTry * previous.targets > previous.correctFirstTry * candidate.targets);
    }
    function normalizeProfile(raw) {
        if (!plain(raw) || !safeId(raw.id)) return null;
        const completedLessons = {};
        const bestStars = {};
        const lessons = engine.getLessons();
        const results = (Array.isArray(raw.results) ? raw.results : []).slice(-HISTORY_LIMIT).map(normalizeResult).filter(Boolean);
        lessons.forEach(lesson => {
            const completed = plain(raw.completedLessons) && own(raw.completedLessons, lesson.id) ? raw.completedLessons[lesson.id] : null;
            const retained = results.filter(result => result.lessonId === lesson.id);
            const storedStars = plain(completed) && [1, 2, 3].includes(completed.bestStars) ? completed.bestStars : 0;
            if (!storedStars && !retained.length) return;
            let bestResult = plain(completed) ? normalizeBestResult(completed.bestResult, lesson.id) : null;
            retained.forEach(result => {
                const candidate = normalizeBestResult(result, lesson.id);
                if (isBetterResult(candidate, bestResult)) bestResult = candidate;
            });
            const stars = Math.max(storedStars, ...retained.map(result => result.stars));
            const last = retained[retained.length - 1];
            completedLessons[lesson.id] = {
                bestStars: stars,
                completionCount: plain(completed) && integer(completed.completionCount) && completed.completionCount > 0 ? completed.completionCount : Math.max(1, retained.length),
                lastResultId: plain(completed) && safeId(completed.lastResultId) ? completed.lastResultId : last ? last.id : '',
                completedAt: plain(completed) && Number.isFinite(completed.completedAt) && completed.completedAt >= 0 ? completed.completedAt : last ? last.completedAt : 0,
                bestResult
            };
            bestStars[lesson.id] = stars;
        });
        const rewards = rewardsFor(completedLessons);
        const resume = engine.isValidSnapshot(raw.resume) ? clone(raw.resume) : null;
        const appliedResultIds = [...new Set((Array.isArray(raw.appliedResultIds) ? raw.appliedResultIds : results.map(result => result.id)).filter(safeId))];
        const arcadeLesson = plain(raw.arcadeChallenge) && engine.getLesson(raw.arcadeChallenge.lessonId);
        const arcadeChallenge = arcadeLesson && arcadeLesson.number % 3 === 0 &&
            completedLessons[arcadeLesson.id] && completedLessons[arcadeLesson.id].lastResultId === raw.arcadeChallenge.resultId &&
            appliedResultIds.includes(raw.arcadeChallenge.resultId)
            ? { lessonId: arcadeLesson.id, resultId: raw.arcadeChallenge.resultId } : null;
        const keyMetrics = {};
        const possibleKeys = lessons[lessons.length - 1].taughtKeys;
        possibleKeys.forEach(key => {
            if (!plain(raw.keyMetrics) || !own(raw.keyMetrics, key)) return;
            const metric = raw.keyMetrics[key];
            if (!plain(metric) || !['targets', 'correctFirstTry', 'attempts', 'errors', 'corrections'].every(name => integer(metric[name]))) return;
            if (metric.correctFirstTry > metric.targets || metric.errors > metric.attempts) return;
            keyMetrics[key] = {
                targets: metric.targets, correctFirstTry: metric.correctFirstTry, attempts: metric.attempts,
                errors: metric.errors, corrections: metric.corrections,
                introduced: true, reliable: metric.targets >= 20 && metric.correctFirstTry / metric.targets >= 0.9
            };
        });
        const current = engine.getLesson(raw.currentLessonId);
        const firstIncomplete = lessons.find(lesson => !own(completedLessons, lesson.id));
        return {
            id: raw.id, nickname: nicknameOf(raw.nickname),
            createdAt: Number.isFinite(raw.createdAt) && raw.createdAt >= 0 ? raw.createdAt : 0,
            currentLessonId: current ? current.id : firstIncomplete ? firstIncomplete.id : lessons[lessons.length - 1].id,
            resume, completedLessons, bestStars, rewards, arcadeChallenge,
            preferences: normalizePreferences(raw.preferences, rewards), keyMetrics, results,
            // Separate deduplication survives truncating the visible results history.
            appliedResultIds
        };
    }

    function createStore(options) {
        if (!engine) throw new Error('Load learning-engine.js before learning-progress.js');
        options = options || {};
        const now = typeof options.now === 'function' ? options.now : Date.now;
        const key = typeof options.key === 'string' ? options.key : STORAGE_KEY;
        let storage;
        try { storage = own(options, 'storage') ? options.storage : root.localStorage; } catch (error) { storage = null; }
        let persistenceAvailable = !!storage;
        function newProfile(nickname) {
            const timestamp = Math.max(0, Number(now()) || 0);
            let suffix;
            try { suffix = root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : Math.random().toString(36).slice(2); } catch (error) { suffix = Math.random().toString(36).slice(2); }
            return {
                id: 'pupil-' + timestamp.toString(36) + '-' + suffix,
                nickname: nicknameOf(nickname), createdAt: timestamp,
                currentLessonId: engine.getLessons()[0].id, resume: null,
                completedLessons: {}, bestStars: {}, rewards: [],
                preferences: defaultPreferences(), keyMetrics: {}, results: [], appliedResultIds: [], arcadeChallenge: null
            };
        }
        const first = newProfile('');
        let state = { schemaVersion: SCHEMA_VERSION, curriculumVersion: engine.CURRICULUM_VERSION, activeProfileId: first.id, profiles: [first] };
        try {
            const serialized = storage && storage.getItem(key);
            const saved = serialized ? JSON.parse(serialized) : null;
            if (saved && saved.schemaVersion === SCHEMA_VERSION && saved.curriculumVersion === engine.CURRICULUM_VERSION && Array.isArray(saved.profiles)) {
                const ids = new Set();
                const profiles = saved.profiles.slice(0, PROFILE_LIMIT).map(normalizeProfile).filter(profile => {
                    if (!profile || ids.has(profile.id)) return false;
                    ids.add(profile.id);
                    return true;
                });
                if (profiles.length) state = { schemaVersion: SCHEMA_VERSION, curriculumVersion: engine.CURRICULUM_VERSION,
                    activeProfileId: ids.has(saved.activeProfileId) ? saved.activeProfileId : profiles[0].id, profiles };
            }
        } catch (error) { persistenceAvailable = false; }
        const active = () => state.profiles.find(profile => profile.id === state.activeProfileId);
        function persist() {
            if (!storage) return;
            try { storage.setItem(key, JSON.stringify(state)); persistenceAvailable = true; }
            catch (error) { persistenceAvailable = false; }
        }
        persist();
        const getState = () => ({ ...clone(state), persistenceAvailable });
        const getCurrentProfile = () => clone(active());
        function switchProfile(idOrNickname) {
            const requestedNickname = nicknameOf(idOrNickname).toLocaleLowerCase('de');
            const profile = state.profiles.find(item => item.id === idOrNickname) || state.profiles.find(item => item.nickname.toLocaleLowerCase('de') === requestedNickname);
            if (!profile) return null;
            state.activeProfileId = profile.id;
            persist();
            return getCurrentProfile();
        }
        function createProfile(nickname) {
            const normalized = nicknameOf(nickname);
            const existing = state.profiles.find(profile => profile.nickname.toLocaleLowerCase('de') === normalized.toLocaleLowerCase('de'));
            if (existing) return switchProfile(existing.id);
            if (state.profiles.length >= PROFILE_LIMIT) return null;
            const profile = newProfile(normalized);
            state.profiles.push(profile);
            state.activeProfileId = profile.id;
            persist();
            return getCurrentProfile();
        }
        function renameProfile(nickname) {
            const normalized = nicknameOf(nickname);
            if (state.profiles.some(profile => profile.id !== active().id && profile.nickname.toLocaleLowerCase('de') === normalized.toLocaleLowerCase('de'))) return null;
            active().nickname = normalized;
            persist();
            return getCurrentProfile();
        }
        function saveSession(sessionOrSnapshot) {
            const snapshot = sessionOrSnapshot && typeof sessionOrSnapshot.exportSnapshot === 'function' ? sessionOrSnapshot.exportSnapshot() : sessionOrSnapshot;
            if (!engine.isValidSnapshot(snapshot)) return false;
            active().resume = clone(snapshot);
            active().currentLessonId = snapshot.lessonId;
            persist();
            return true;
        }
        function getResume() { return active().resume ? clone(active().resume) : null; }
        function clearResume() {
            active().resume = null;
            persist();
            return getCurrentProfile();
        }
        function setCurrentLesson(lessonId) {
            if (!engine.getLesson(lessonId)) return false;
            active().currentLessonId = lessonId;
            persist();
            return true;
        }
        function completeLesson(result) {
            const completed = normalizeResult(result);
            if (!completed) return null;
            const profile = active();
            if (profile.appliedResultIds.includes(completed.id)) return getCurrentProfile();
            profile.appliedResultIds.push(completed.id);
            const previous = profile.completedLessons[completed.lessonId];
            const bestStars = Math.max(previous ? previous.bestStars : 0, completed.stars);
            const candidate = normalizeBestResult(completed, completed.lessonId);
            const previousBest = previous && previous.bestResult;
            profile.completedLessons[completed.lessonId] = {
                bestStars, completionCount: (previous ? previous.completionCount : 0) + 1,
                lastResultId: completed.id, completedAt: completed.completedAt,
                bestResult: isBetterResult(candidate, previousBest) ? candidate : previousBest || null
            };
            profile.bestStars[completed.lessonId] = bestStars;
            profile.rewards = rewardsFor(profile.completedLessons);
            const lesson = engine.getLesson(completed.lessonId);
            if (lesson.number % 3 === 0 && (!profile.arcadeChallenge || profile.arcadeChallenge.lessonId === lesson.id)) {
                profile.arcadeChallenge = { lessonId: lesson.id, resultId: completed.id };
            }
            lesson.taughtKeys.forEach(key => {
                if (!own(profile.keyMetrics, key)) profile.keyMetrics[key] = { introduced: true, reliable: false, targets: 0, correctFirstTry: 0, attempts: 0, errors: 0, corrections: 0 };
            });
            Object.entries(completed.perKey).forEach(([key, metric]) => {
                if (!own(profile.keyMetrics, key) || !plain(metric)) return;
                const totals = profile.keyMetrics[key];
                ['targets', 'correctFirstTry', 'attempts', 'errors', 'corrections'].forEach(name => {
                    if (integer(metric[name])) totals[name] += metric[name];
                });
                totals.reliable = totals.targets >= 20 && totals.correctFirstTry / totals.targets >= 0.9;
            });
            profile.results.push(completed);
            profile.results = profile.results.slice(-HISTORY_LIMIT);
            profile.currentLessonId = lesson.nextLessonId || lesson.id;
            if (profile.resume && profile.resume.sessionId === completed.id) profile.resume = null;
            persist();
            return getCurrentProfile();
        }
        function updatePreferences(preferences) {
            active().preferences = normalizePreferences({ ...active().preferences, ...preferences }, active().rewards);
            persist();
            return getCurrentProfile();
        }
        function completeArcadeChallenge(result) {
            const pending = active().arcadeChallenge;
            const definition = pending && (arcade || root.QwertzLearningArcade).getChallenge(engine.getLesson(pending.lessonId));
            if (!pending || !plain(result) || result.lessonId !== pending.lessonId || result.resultId !== pending.resultId ||
                !definition || !integer(result.score) || result.score < definition.target) return false;
            active().arcadeChallenge = null;
            persist();
            return true;
        }
        return { getState, getCurrentProfile, createProfile, switchProfile, renameProfile, saveSession,
            completeLesson, completeArcadeChallenge, getResume, clearResume, setCurrentLesson, updatePreferences };
    }
    return { STORAGE_KEY, SCHEMA_VERSION, HISTORY_LIMIT, REWARD_RULES: clone(rewardRules), normalizeResult, normalizeBestResult, isBetterResult, createStore };
}));

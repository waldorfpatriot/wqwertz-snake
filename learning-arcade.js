(function (root, factory) {
    const games = typeof module === 'object' && module.exports
        ? require('./arcade-shared').GAMES : root.QwertzArcadeGames;
    const tetris = typeof module === 'object' && module.exports
        ? require('./learning-tetris') : root.QwertzLearningTetris;
    const api = factory(root, { ...games, tetris });
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.QwertzLearningArcade = api;
}(typeof window === 'undefined' ? globalThis : window, function (root, games) {
    'use strict';

    const DEFAULT_TARGET = 10;
    const SIZE = 420;
    const ROTATION = ['breakout', 'tetris', 'qwertzman', 'breakout', 'tetris', 'qwertzman'];
    const POOLS = {
        left: ['f', 'd', 's', 'a', 'g', 'r', 't', 'e', 'w', 'q', 'v', 'c', 'x', 'y', 'b'],
        right: ['j', 'k', 'l', 'ö', 'h', 'u', 'z', 'i', 'o', 'p', 'ü', 'm', 'n', 'ä', ',', '.', '-'],
        up: ['r', 'u', 'e', 'i', 't', 'z', 'w', 'o', 'q', 'p', 'ü'],
        down: ['v', 'm', 'b', 'n', 'c', ',', 'x', '.', 'y', '-'],
        action: [' ', 'd', 'k', 's', 'l', 'g', 'h']
    };
    const keyLabel = key => key === ' ' ? 'Leertaste' : key.toUpperCase();
    function normalizeKey(key) {
        return typeof key === 'string' && Array.from(key).length === 1 ? key.toLowerCase() : null;
    }

    function getChallenge(lesson) {
        if (!lesson || !Number.isSafeInteger(lesson.number) || lesson.number < 3 || lesson.number % 3 !== 0) return null;
        const gameId = ROTATION[(lesson.number / 3 - 1) % ROTATION.length];
        const config = games && games[gameId];
        if (!config) return null;
        const target = gameId === 'breakout' || gameId === 'tetris' ? 100 : DEFAULT_TARGET;
        const taughtKeys = [...new Set((lesson.taughtKeys || []).map(normalizeKey).filter(key => key !== null))];
        if (taughtKeys.length < config.actions.length) return null;
        const used = new Set();
        const controls = {};
        const actions = config.actions.map(action => Object.freeze({ ...action }));
        actions.forEach(action => {
            const pool = POOLS[action.pool || action.id] || POOLS.action;
            const preferred = action.id === 'shoot' || action.id === 'launch' ? [' ', ...pool] : pool;
            const key = [...preferred, ...taughtKeys].find(candidate => taughtKeys.includes(candidate) && !used.has(candidate));
            used.add(key);
            controls[action.id] = key;
        });
        return Object.freeze({
            lessonId: lesson.id,
            number: lesson.number,
            gameId,
            title: config.title,
            target,
            taughtKeys: Object.freeze(taughtKeys),
            actions: Object.freeze(actions),
            controls: Object.freeze(controls),
            instructions: 'Sammle ' + target + ' Punkte. ' + (gameId === 'tetris' ? config.summary + ' ' : '') + actions.map(action => keyLabel(controls[action.id]) + ': ' + action.label).join(' · ') + '. Diese Tasten bleiben für die ganze Runde gleich.'
        });
    }

    function mount(options) {
        options = options || {};
        const canvas = options.canvas;
        const context = canvas && canvas.getContext('2d');
        const requestFrame = options.requestFrame || (callback => root.requestAnimationFrame(callback));
        const cancelFrame = options.cancelFrame || (frame => root.cancelAnimationFrame(frame));
        let challenge = null;
        let game = null;
        let score = 0;
        let status = 'ready';
        let held = {};
        let frame = null;
        let previousTime = null;
        let generation = 0;
        let session = 0;
        let completed = false;
        let destroyed = false;
        let message = '';

        function getState() {
            return { challenge, score, status, message };
        }

        function notify() {
            if (!destroyed && typeof options.onChange === 'function') options.onChange(getState());
        }

        function stop() {
            generation++;
            if (frame !== null) cancelFrame(frame);
            frame = null;
            previousTime = null;
            held = {};
            if (challenge && game && typeof games[challenge.gameId].clearInputs === 'function') games[challenge.gameId].clearInputs(game);
        }

        function draw() {
            if (!context || !canvas) return;
            context.save();
            context.clearRect(0, 0, canvas.width, canvas.height);
            if (challenge && game) {
                context.scale(canvas.width / SIZE, canvas.height / SIZE);
                games[challenge.gameId].draw(context, game);
            }
            context.restore();
        }

        function schedule() {
            if (status !== 'playing' || destroyed || frame !== null) return;
            const ticket = generation;
            frame = requestFrame(time => tick(time, ticket));
        }

        function tick(time, ticket) {
            if (ticket !== generation || status !== 'playing' || destroyed) return;
            frame = null;
            const dt = previousTime === null ? 0.016 : Math.max(0, Math.min(0.032, (time - previousTime) / 1000));
            previousTime = time;
            const previousScore = score;
            const round = session;
            let lost = false;
            let won = false;
            let outcomeMessage = '';
            const finish = {
                score,
                addScore(points) {
                    if (!Number.isFinite(points) || points <= 0) return;
                    score = Math.min(challenge.target, score + points);
                    finish.score = score;
                },
                lose(reason) { lost = true; outcomeMessage = reason || ''; },
                win(reason) { won = true; outcomeMessage = reason || ''; }
            };
            games[challenge.gameId].update(game, dt, held, finish);
            // An update may score and collide in the same frame. Reaching the target wins that frame.
            if (score >= challenge.target) {
                status = 'complete';
                message = challenge.target + ' Punkte geschafft!';
                completed = true;
                stop();
                draw();
                notify();
                if (!destroyed && session === round && completed && typeof options.onComplete === 'function') options.onComplete(getState());
                return;
            }
            if (lost) {
                status = 'lost';
                message = outcomeMessage;
                stop();
            } else if (won) {
                // A cleared level never skips the points goal; continue with a fresh level and the same score.
                game = games[challenge.gameId].create(null);
            }
            draw();
            if (score !== previousScore || lost) notify();
            if (session === round) schedule();
        }

        function start(lesson) {
            if (destroyed) return getState();
            stop();
            session++;
            challenge = getChallenge(lesson);
            game = challenge ? games[challenge.gameId].create(null) : null;
            score = 0;
            status = 'ready';
            completed = false;
            message = '';
            draw();
            notify();
            return getState();
        }

        function play() {
            if (destroyed || !challenge || !['ready', 'paused'].includes(status)) return false;
            status = 'playing';
            message = '';
            notify();
            schedule();
            return true;
        }

        function restart() {
            if (destroyed || !challenge) return getState();
            stop();
            session++;
            game = games[challenge.gameId].create(null);
            score = 0;
            status = 'ready';
            completed = false;
            message = '';
            draw();
            notify();
            return getState();
        }

        function pause(force) {
            const shouldPause = force === undefined ? status === 'playing' : Boolean(force);
            if (shouldPause && status === 'playing') {
                stop();
                status = 'paused';
                notify();
            } else if (!shouldPause && status === 'paused') play();
            return getState();
        }

        function actionFor(event) {
            if (!challenge || !event) return null;
            const key = normalizeKey(event.key);
            return challenge.actions.find(action => challenge.controls[action.id] === key) || null;
        }

        function handleKey(event) {
            if (destroyed || !event || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
            if (!['ready', 'playing'].includes(status)) return false;
            const action = actionFor(event);
            if (!action) return false;
            if (typeof event.preventDefault === 'function') event.preventDefault();
            if (event.repeat) return true;
            if (status === 'ready') play();
            if (status !== 'playing') return true;
            held[action.id] = true;
            const config = games[challenge.gameId];
            if (typeof config.onPress === 'function') config.onPress(game, action.id);
            return true;
        }

        function handleKeyUp(event) {
            const action = !destroyed && actionFor(event);
            if (!action) return false;
            delete held[action.id];
            return true;
        }

        function cancel(silent) {
            stop();
            session++;
            challenge = null;
            game = null;
            score = 0;
            status = 'ready';
            completed = false;
            message = '';
            if (!silent) notify();
            return getState();
        }

        function destroy() {
            cancel(true);
            destroyed = true;
        }

        return { start, play, restart, pause, handleKey, handleKeyUp, getState, draw, cancel, destroy };
    }

    return { getChallenge, mount };
}));

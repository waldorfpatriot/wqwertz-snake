/* Beginner adventure. Input is routed by game.js, never by a second key listener. */
(function (root) {
    'use strict';

    const COLORS = { mint: '#36b486', gold: '#dba82e', violet: '#9474ce' };
    const ARROWS = { left: '←', right: '→', up: '↑', down: '↓' };
    const BRIDGE_KEYS = { left: 'f', right: 'j', up: 'd', down: 'k' };
    const BRIDGE_CORNERS = [{ x: 2, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 7 }, { x: 11, y: 7 }, { x: 11, y: 2 }, { x: 7, y: 2 }];
    const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const keyLabel = key => key === ' ' ? 'Leertaste' : key === 'backspace' ? '⌫ Rücktaste' : String(key || '').toUpperCase();
    const lessonKeys = lesson => [...lesson.newKeys, ...(lesson.newControlKeys || [])];

    function mount(options) {
        const { canvas, keyboard, fingerMap = {}, onEnter = () => {}, onExit = () => {}, onArcade = () => {}, onLeaderboard = () => {} } = options;
        const engine = root.QwertzLearningEngine;
        const store = root.QwertzLearningProgress.createStore();
        const lessons = engine.getLessons();
        const container = canvas.closest('.container');
        const context = canvas.getContext('2d');
        const shell = document.createElement('section');
        shell.className = 'learning-shell';
        shell.id = 'learningShell';
        shell.hidden = true;
        shell.setAttribute('aria-label', 'Tippen lernen');
        container.insertBefore(shell, container.querySelector('.keyboard-section'));
        const startButton = document.getElementById('learningStartButton');
        const arcadeButton = document.getElementById('learningArcadeButton');
        let active = false;
        let view = 'home';
        let session = null;
        let feedback = '';
        let forcedHelp = false;
        let waitingForRelease = false;
        let bridge = null;
        let bridgeTimer = null;
        let completeResultId = null;
        let entered = false;
        let rewardBoard = null;
        let rewardPauseAfter = false;
        let arcadeTicket = null;
        let nameError = '';
        let nameLoading = false;
        let nameMode = 'rename';
        let pendingLesson = null;
        let nameRequest = 0;
        const held = new Set();
        const originalCanvasTabIndex = canvas.getAttribute('tabindex');
        canvas.tabIndex = 0;
        const spaceElement = () => keyboard.querySelector('[data-key=" "]');
        let originalSpaceText = '';
        const hands = root.QwertzLearningHands ? root.QwertzLearningHands.mount({ keyboard, fingerMap }) : null;
        const rewardApi = root.QwertzLearningReward;
        const appleImages = {};
        const reward = rewardApi ? rewardApi.mount({
            onPhase(phase) {
                if (!active || !rewardBoard) return;
                rewardBoard.phase = phase;
                drawBoard();
            },
            onFinish({ id }) {
                if (!active || !rewardBoard || rewardBoard.id !== id) return;
                const finished = rewardBoard;
                rewardBoard = null;
                if (finished.bridge) {
                    view = 'lesson';
                    feedback = '';
                } else if (session && state().stage !== 'result') {
                    session.setPaused(rewardPauseAfter);
                    save();
                }
                waitingForRelease = held.size > 0;
                if (!finished.bridge && state() && state().stage === 'result' && profile().arcadeChallenge && beginChallenge()) return;
                render();
                focusGame();
            }
        }) : null;
        if (rewardApi) Object.entries(rewardApi.assets).forEach(([phase, url]) => {
            const image = new Image();
            image.onload = () => { if (active && view !== 'home') drawBoard(); };
            image.src = url;
            appleImages[phase] = image;
        });

        const profile = () => store.getCurrentProfile();
        const classroom = root.QwertzLearningClassroom ? root.QwertzLearningClassroom.createClient({
            onStatus(status) {
                if (!active || status.profileId !== profile().id) return;
                const label = shell.querySelector('#learningClassroomStatus');
                if (label) label.textContent = status.message || '';
            }
        }) : null;
        const state = () => session && session.getState();
        const completed = lessonId => Boolean(profile().completedLessons[lessonId]);
        const unlocked = index => index === 0 || completed(lessons[index].id) || completed(lessons[index - 1].id);
        const nextLesson = () => lessons.find((lesson, index) => unlocked(index) && !completed(lesson.id)) || lessons[lessons.length - 1];
        const challengeArcade = root.QwertzLearningArcade ? root.QwertzLearningArcade.mount({
            canvas,
            onChange(current) { if (active && view === 'arcade' && arcadeTicket && current.challenge) render(); },
            onComplete(current) {
                if (!active || view !== 'arcade' || !arcadeTicket || arcadeTicket.profileId !== profile().id ||
                    current.challenge.lessonId !== arcadeTicket.lessonId) return;
                const round = challengeArcade.getState();
                if (!round || round.status !== 'complete' || round.score < round.challenge.target || round.challenge.lessonId !== arcadeTicket.lessonId) return;
                if (store.completeArcadeChallenge({ ...arcadeTicket, score: current.score })) render();
            }
        }) : null;

        function cancelChallenge() {
            arcadeTicket = null;
            if (challengeArcade) challengeArcade.cancel();
        }

        function beginChallenge() {
            const pending = profile().arcadeChallenge;
            if (!challengeArcade || !pending) return false;
            const lesson = engine.getLesson(pending.lessonId);
            if (!lesson) return false;
            nameRequest++;
            cancelReward();
            cancelBridgeTimer();
            if (session && state().stage !== 'result') { session.setPaused(true); save(); }
            arcadeTicket = { ...pending, profileId: profile().id };
            bridge = null;
            view = 'arcade';
            waitingForRelease = held.size > 0;
            challengeArcade.start(lesson);
            render();
            focusGame();
            return true;
        }

        function continueAfterChallenge() {
            const round = challengeArcade && challengeArcade.getState();
            if (!arcadeTicket || !round || round.status !== 'complete' || profile().arcadeChallenge) return;
            const lesson = engine.getLesson(arcadeTicket.lessonId);
            cancelChallenge();
            if (lesson.nextLessonId) begin(lesson.nextLessonId);
            else open();
        }

        function focusGame() {
            canvas.focus({ preventScroll: true });
        }

        function cancelBridgeTimer() {
            if (bridgeTimer != null) clearTimeout(bridgeTimer);
            bridgeTimer = null;
        }

        function cancelReward() {
            if (reward) reward.cancel();
            rewardBoard = null;
            rewardPauseAfter = false;
        }

        function applyCompletedResult(current) {
            if (!current || current.stage !== 'result' || !current.result || completeResultId === current.result.id) return;
            const alreadySaved = profile().appliedResultIds.includes(current.result.id);
            store.completeLesson(current.result);
            if (classroom) classroom.syncProfile(profile());
            completeResultId = current.result.id;
            if (!alreadySaved) document.dispatchEvent(new CustomEvent('qwertz-learning-complete', { detail: { schemaVersion: 1, profileId: profile().id, result: current.result } }));
        }

        function beginReward(before, bridgeComplete = false) {
            if (!reward) return false;
            rewardPauseAfter = false;
            const id = bridgeComplete ? `${state().sessionId}:bridge` : `${before.sessionId}:${before.stage}`;
            rewardBoard = {
                id, bridge: bridgeComplete, phase: 'whole',
                current: bridgeComplete ? before : { ...before, targetIndex: before.targets.length, progress: 1, typed: before.stage === 'write' ? before.targets.slice() : before.typed, lastInput: { correct: true }, paused: true }
            };
            if (!bridgeComplete && state().stage !== 'result') session.setPaused(true);
            applyCompletedResult(state());
            save();
            render();
            const title = bridgeComplete ? 'Alle Kurven geschafft!' : before.stage === 'write' ? 'Mission geschafft!' : before.stage === 'demo' ? 'Tasten gefunden!' : 'Apfel erreicht!';
            const subtitle = bridgeComplete ? 'Deine Schlange freut sich über dich.' : before.stage === 'write' ? 'Dein Garten wächst mit dir.' : before.stage === 'demo' ? 'Jetzt geht es auf die nächste Strecke.' : 'Jede richtige Taste hat dich weitergebracht.';
            reward.start({ id, title, subtitle });
            return true;
        }

        function save() {
            if (session && state().stage !== 'result') store.saveSession(session.exportSnapshot());
        }

        function open() {
            nameRequest++;
            cancelReward();
            cancelChallenge();
            if (!active) {
                onEnter();
                active = true;
                entered = true;
                document.body.classList.add('learning-active');
                shell.hidden = false;
                const space = spaceElement();
                if (space) { originalSpaceText = space.textContent; space.textContent = 'LEERTASTE'; }
            }
            if (session && state().stage !== 'result') session.setPaused(true);
            save();
            cancelBridgeTimer();
            view = profile().nickname.trim() ? 'home' : 'name';
            nameError = '';
            nameLoading = false;
            nameMode = 'rename';
            pendingLesson = null;
            bridge = null;
            feedback = '';
            held.clear();
            waitingForRelease = false;
            render();
            const firstControl = document.getElementById(view === 'name' ? 'learningName' : 'learningPrimaryAction');
            if (firstControl) firstControl.focus({ preventScroll: true });
        }

        function close() {
            if (!active) return;
            nameRequest++;
            cancelReward();
            cancelChallenge();
            if (session && state().stage !== 'result') session.setPaused(true);
            save();
            cancelBridgeTimer();
            active = false;
            entered = false;
            held.clear();
            waitingForRelease = false;
            shell.hidden = true;
            if (hands) hands.hide();
            document.body.classList.remove('learning-active', 'learning-home', 'learning-result', 'learning-paused', 'learning-arcade');
            keyboard.querySelectorAll('[data-key]').forEach(key => key.classList.remove('learning-key-target', 'learning-key-taught', 'learning-key-unknown'));
            const space = spaceElement();
            if (space && originalSpaceText) space.textContent = originalSpaceText;
            onExit();
        }

        function arcade() {
            close();
            onArcade();
        }

        function begin(lessonId, resume, verified = false) {
            const requestedLesson = engine.getLesson(lessonId);
            if (!requestedLesson) return;
            if (!profile().nickname.trim()) { showNameEntry('rename', { lessonId, resume }); return; }
            const pending = profile().arcadeChallenge;
            if (pending && requestedLesson.index > engine.getLesson(pending.lessonId).index && beginChallenge()) return;
            if (classroom && !verified) {
                const generation = ++nameRequest;
                classroom.syncProfile(profile()).then(status => {
                    if (!active || generation !== nameRequest) return;
                    if (['conflict', 'unauthorized', 'invalid-name'].includes(status.status)) {
                        showNameEntry('rename', { lessonId, resume }, status.message);
                    } else begin(lessonId, resume, true);
                });
                return;
            }
            cancelReward();
            cancelChallenge();
            cancelBridgeTimer();
            session = engine.createSession(lessonId, resume ? { snapshot: resume } : {});
            view = 'lesson';
            bridge = null;
            completeResultId = null;
            forcedHelp = false;
            feedback = '';
            waitingForRelease = held.size > 0;
            session.setPaused(false);
            save();
            render();
            focusGame();
        }

        function continueLesson() {
            if (beginChallenge()) return;
            const resume = store.getResume();
            if (resume && engine.getLesson(resume.lessonId)) begin(resume.lessonId, resume);
            else begin(nextLesson().id);
        }

        function showNameEntry(mode = 'new', pending = null, error = '') {
            nameRequest++;
            cancelReward();
            cancelChallenge();
            cancelBridgeTimer();
            if (session && state().stage !== 'result') session.setPaused(true);
            save();
            view = 'name';
            nameMode = mode;
            nameError = error;
            nameLoading = false;
            pendingLesson = pending;
            render();
            const input = document.getElementById('learningName');
            if (input) input.focus({ preventScroll: true });
        }

        function nameMarkup() {
            const pupil = profile();
            return `<div class="learning-name-card"><span class="learning-eyebrow">DEIN TIPPABENTEUER</span><div class="learning-name-mascot" aria-hidden="true">🐍</div><h2>Wie heißt du?</h2><p>Deine Schlange und deine Ergebnisse gehören zu deinem Namen.</p><form id="learningNameForm"><label for="learningName">Dein Name</label><input id="learningName" name="name" type="text" maxlength="40" autocomplete="nickname" placeholder="Zum Beispiel Anna M." required value="${escape(nameMode === 'rename' ? pupil.nickname : '')}" ${nameLoading ? 'disabled' : ''}><p id="learningNameError" role="status" aria-live="polite">${escape(nameError)}</p><button type="submit" class="learning-button learning-primary" ${nameLoading ? 'disabled' : ''}>${nameLoading ? 'Einen Moment …' : 'Los geht’s →'}</button></form><small>Ein Vorname mit Anfangsbuchstabe reicht. Deine abgeschlossenen Lektionen erscheinen in der Klassenübersicht.</small><button type="button" class="learning-link-button" data-action="leaderboard">Lektions-Bestenliste ansehen</button>${pupil.nickname ? '<button type="button" class="learning-link-button" data-action="home">Zurück zu meinem Profil</button>' : ''}</div>`;
        }

        async function submitName(event) {
            if (event.target.id !== 'learningNameForm') return;
            event.preventDefault();
            if (nameLoading) return;
            const input = shell.querySelector('#learningName');
            const name = (root.QwertzLearningClassroom ? root.QwertzLearningClassroom.cleanName(input.value) : input.value.trim().slice(0, 40));
            if (!name) { nameError = 'Trage bitte deinen Namen ein.'; render(); document.getElementById('learningName').focus(); return; }
            save();
            const selected = nameMode === 'rename' ? store.renameProfile(name) : store.createProfile(name);
            if (!selected) {
                nameError = 'Dieses Profil gibt es bereits. Wähle es im Garten aus oder ergänze deinen Namen.';
                render();
                return;
            }
            session = null;
            completeResultId = null;
            nameLoading = true;
            nameError = '';
            const generation = ++nameRequest;
            render();
            const status = classroom ? await classroom.syncProfile(profile()) : { status: 'offline' };
            if (!active || generation !== nameRequest || view !== 'name') return;
            nameLoading = false;
            if (['conflict', 'unauthorized', 'invalid-name'].includes(status.status)) {
                nameMode = 'rename';
                nameError = status.message;
                render();
                document.getElementById('learningName').focus();
                return;
            }
            const pending = pendingLesson;
            pendingLesson = null;
            if (pending) begin(pending.lessonId, pending.resume, true);
            else {
                const resume = store.getResume();
                begin(resume ? resume.lessonId : nextLesson().id, resume || undefined, true);
            }
        }

        function shouldShowHint(current) {
            if (forcedHelp || current.stage === 'demo' || (current.lastInput && !current.lastInput.correct && !current.lastInput.ignored)) return true;
            const metric = current.perKey && current.perKey[current.expectedKey];
            if (metric && metric.errors > 0 && metric.streak < 3) return true;
            const learned = profile().keyMetrics[current.expectedKey];
            if (learned && learned.reliable) return false;
            return !metric || metric.streak < 6;
        }

        function toolbar(title, subtitle) {
            return `<div class="learning-toolbar"><button type="button" class="learning-icon-button" data-action="home" aria-label="Zurück zum Garten">←</button><div><strong>${escape(title)}</strong><small>${escape(subtitle)}</small></div>${rewardBoard ? '<small>Apfel erreicht ✓</small>' : `<button type="button" class="learning-link-button" data-action="pause">${isPaused() ? 'Weiter' : 'Pause'}</button>`}</div>`;
        }

        function homeMarkup() {
            const pupil = profile();
            const resume = store.getResume();
            const earned = Object.keys(pupil.completedLessons).length;
            const nickname = pupil.nickname || 'dein Tippgarten';
            const progress = store.getState();
            const profiles = progress.profiles;
            const arcadeGoal = pupil.arcadeChallenge && root.QwertzLearningArcade ? root.QwertzLearningArcade.getChallenge(engine.getLesson(pupil.arcadeChallenge.lessonId)).target : 10;
            return `<div class="learning-home-card">
                <div class="learning-home-heading"><span class="learning-eyebrow">DEIN TIPPABENTEUER</span><h2>${pupil.nickname ? `Hallo, ${escape(nickname)}!` : 'Kleine Tasten. Große Abenteuer.'}</h2><p>Lerne mit deiner Schlange. Eine neue Taste nach der anderen.</p><p>Nach jeder dritten Mission wartet eine Arcade-Runde mit deinen gelernten Tasten.</p></div>
                <div class="learning-garden" aria-label="${earned} abgeschlossene Missionen"><span class="learning-garden-cloud">☁</span><span class="learning-garden-sun">☀</span><div class="learning-garden-plants">${Array.from({ length: Math.max(3, Math.min(earned + 2, 9)) }, (_, i) => `<span style="--plant-delay:${i * 0.06}s">${i < earned ? '🌻' : '🌱'}</span>`).join('')}</div><div class="learning-garden-snake" style="--snake-color:${COLORS[pupil.preferences.snakeColor] || COLORS.mint}"><span></span><span></span><span class="learning-snake-face">${pupil.preferences.hat === 'crown' ? '♛' : pupil.preferences.hat === 'flower' ? '✿' : '··'}</span></div><small>${earned ? `${earned} Mission${earned === 1 ? '' : 'en'} geschafft` : 'Hier wächst dein Garten mit jedem Erfolg.'}</small></div>
                <button type="button" id="learningPrimaryAction" class="learning-button learning-primary" data-action="continue">${pupil.arcadeChallenge ? arcadeGoal + '-Punkte-Arcade spielen' : resume ? 'Mission fortsetzen' : earned ? 'Nächste Mission starten' : 'Mit F und J anfangen'} <span>→</span></button>
                <div class="learning-classroom-links"><button type="button" class="learning-link-button" data-action="name">Anderes Kind? Namen eingeben</button><button type="button" class="learning-link-button" data-action="leaderboard">Lektions-Bestenliste ansehen</button></div><p class="learning-classroom-status" id="learningClassroomStatus" role="status">${escape(classroom ? classroom.getStatus(pupil.id).message || '' : '')}</p>
                <div class="learning-home-details"><details class="learning-profile"><summary>👤 ${escape(pupil.nickname || 'Mein Profil')} <span>Profil wechseln</span></summary><label for="learningProfileSelect">Dein lokales Profil</label><select id="learningProfileSelect" data-action="switch-profile">${profiles.map(item => `<option value="${escape(item.id)}" ${item.id === pupil.id ? 'selected' : ''}>${escape(item.nickname || 'Mein Profil')}</option>`).join('')}</select><div class="learning-profile-create"><input id="learningNickname" type="text" maxlength="30" placeholder="Spitzname für neues Profil" aria-label="Spitzname für neues Profil"><button type="button" class="learning-link-button" data-action="create-profile">Anlegen</button></div><small>Fortschritt bleibt auf diesem Gerät. Für geteilte Geräte: immer dein Profil wählen.</small></details><button type="button" class="learning-link-button" data-action="arcade">Arcade spielen ↗</button></div>
                <div class="learning-map-heading"><h3>Deine Missionen</h3><small>Du bestimmst das Tempo.</small></div>
                <div class="learning-lesson-map">${lessons.map((lesson, index) => { const done = pupil.completedLessons[lesson.id]; return `<button type="button" class="learning-mission ${done ? 'learning-mission-complete' : ''}" data-action="lesson" data-lesson="${lesson.id}" ${unlocked(index) ? '' : 'disabled'}><span class="learning-mission-icon">${done ? '🌼' : unlocked(index) ? '🌱' : '🔒'}</span><strong>${escape(lesson.title)}</strong><span class="learning-mission-keys">${lessonKeys(lesson).map(keyLabel).join(' · ')}</span><small>${done ? '★'.repeat(done.bestStars || 1) : unlocked(index) ? 'Bereit für dich' : 'Vorherige Mission abschließen'}</small></button>`; }).join('')}</div>
                ${coverageMarkup(pupil)}${wardrobeMarkup(pupil)}${progress.persistenceAvailable === false ? '<p class="learning-repeat-note">Dieser Browser kann den Fortschritt gerade nicht speichern. Lass die Seite zum Weiterüben geöffnet.</p>' : ''}<p class="learning-device-note">QWERTZ-Tastatur nötig. Die Fingerbilder helfen dir beim Üben; das Spiel erkennt die gedrückte Taste.</p>
            </div>`;
        }

        function wardrobeMarkup(pupil) {
            const colors = Object.keys(COLORS).filter(color => color === 'mint' || pupil.rewards.includes('color:' + color));
            const hats = ['none', 'flower', 'crown'].filter(hat => hat === 'none' || pupil.rewards.includes('hat:' + hat));
            return `<details class="learning-wardrobe"><summary>🎨 Deine Schlange gestalten <span>${Math.max(0, colors.length + hats.length - 2)} Extras</span></summary><div class="learning-cosmetics">${colors.map(color => `<button type="button" class="learning-color-button ${pupil.preferences.snakeColor === color ? 'selected' : ''}" style="--swatch:${COLORS[color]}" data-action="color" data-value="${color}" aria-label="${({ mint: 'Mint', gold: 'Gold', violet: 'Violett' })[color]}" aria-pressed="${pupil.preferences.snakeColor === color}"></button>`).join('')}${hats.map(hat => `<button type="button" class="learning-hat-button ${pupil.preferences.hat === hat ? 'selected' : ''}" data-action="hat" data-value="${hat}" aria-pressed="${pupil.preferences.hat === hat}">${({ none: 'Ohne Hut', flower: '🌸 Blume', crown: '👑 Krone' })[hat]}</button>`).join('')}</div><small>Neue Missionen bringen neue Farben und Hüte.</small></details>`;
        }

        function coverageMarkup(pupil) {
            const metrics = Object.entries(pupil.keyMetrics).filter(([, metric]) => metric.introduced);
            if (!metrics.length) return '';
            const reliable = metrics.filter(([, metric]) => metric.reliable).length;
            return `<div class="learning-key-coverage"><strong>${metrics.length} Tasten kennengelernt · ${reliable} sicher geübt</strong><div>${metrics.map(([key, metric]) => `<span class="${metric.reliable ? 'reliable' : ''}" title="${metric.reliable ? 'Sicher geübt' : 'Darf noch wachsen'}">${escape(keyLabel(key))} ${metric.reliable ? '✓' : '🌱'}</span>`).join('')}</div><small>Mit Wiederholungen werden deine Tasten sicherer. Jede Mission bleibt spielbar.</small></div>`;
        }

        function typingMarkup(current) {
            const typed = current.typed || [];
            const prompts = current.lesson.writePrompts;
            const withSpaces = current.lesson.taughtKeys.includes(' ');
            let offset = 0;
            const character = (letter, index) => {
                const wrong = index < typed.length && typed[index] !== letter;
                const value = wrong ? typed[index] : letter;
                return `<span class="${index < typed.length ? (wrong ? 'wrong' : 'typed') : index === current.targetIndex ? 'current' : ''}" ${wrong ? `title="${escape(value)} statt ${escape(keyLabel(letter))}"` : ''}>${value === ' ' ? '␣' : escape(value)}</span>`;
            };
            const groups = prompts.map((prompt, groupIndex) => {
                const text = Array.from(prompt).map((letter, index) => character(letter, offset + index)).join('');
                offset += prompt.length;
                const separator = withSpaces && groupIndex < prompts.length - 1 ? character(' ', offset++) : '';
                return `<div class="learning-writing-word">${text}</div>${separator}`;
            }).join('');
            return `<div class="learning-writing" aria-label="Drei kleine Schreibaufgaben"><p class="learning-writing-label">${prompts.length} kleine Schreibaufgaben</p><div class="learning-writing-line">${groups}</div><p class="learning-writing-hint">${current.needsBackspace ? 'Drücke die Rücktaste ⌫. Dann probiere die Taste noch einmal.' : withSpaces ? 'Tippe die Zeichen der Reihe nach. ␣ bedeutet Leertaste.' : 'Tippe die Gruppen der Reihe nach, ohne Leerzeichen.'}</p></div>`;
        }

        function correctionMarkup(current) {
            if (rewardBoard) return '<p class="learning-correction-finished">⌫ Löschen und neu tippen – gut gemacht!</p>';
            const target = current.typingExpectedKey || current.targets[current.targetIndex];
            const prefix = target === 'f' ? 'j' : 'f';
            const wrong = current.guidedCorrectionPending ? prefix : current.needsBackspace ? current.typed[current.targetIndex] : null;
            const deleting = current.needsBackspace;
            return `<div class="learning-correction-card" aria-label="Rücktaste üben"><p class="learning-writing-label">${current.guidedCorrectionPending ? 'Deine Schlange hat einen Beispiel-Tippfehler vorbereitet.' : deleting ? 'Ein kleiner Tippfehler. Du kannst ihn verbessern.' : 'Der letzte Buchstabe ist gelöscht. Jetzt bist du dran.'}</p><div class="learning-correction-example" aria-label="${escape(prefix)}${wrong ? escape(wrong) + ', letzten Buchstaben löschen' : ', tippe ' + escape(target)}"><span>${escape(prefix)}</span>${wrong ? `<span class="learning-correction-wrong">${escape(wrong)}</span>` : '<span class="learning-correction-cursor" aria-hidden="true">▯</span>'}<small>So soll es aussehen: <strong>${escape(prefix + target)}</strong></small></div><div class="learning-correction-steps"><span class="${deleting ? 'active' : 'done'}"><b>${deleting ? '1' : '✓'}</b> ⌫ Rücktaste drücken</span><span class="${deleting ? '' : 'active'}"><b>2</b> ${escape(keyLabel(target))} neu tippen</span></div><p class="learning-writing-hint">${deleting ? 'Die Rücktaste ⌫ löscht den letzten Buchstaben. Du findest sie oben rechts über der Eingabetaste.' : `Tippe jetzt ${escape(keyLabel(target))}. Dein kleiner Finger kehrt zur Grundreihe zurück.`}</p><small class="learning-correction-note">Die vorbereiteten Beispiel-Fehler zählen nicht als deine Tippfehler.</small></div>`;
        }

        function resultMarkup(current) {
            const result = current.result || {};
            const stars = result.stars || 1;
            const accuracy = result.accuracyPercent != null ? result.accuracyPercent : result.accuracy == null ? null : result.accuracy * 100;
            const index = lessons.findIndex(lesson => lesson.id === current.lessonId);
            const next = lessons[index + 1];
            const corrections = result.corrections || current.stats && current.stats.corrections || 0;
            const newKeys = lessonKeys(current.lesson).map(keyLabel).join(' und ');
            const practiceKeys = Object.entries(result.perKey || {}).filter(([, metric]) => metric.errors > 0).sort((a, b) => b[1].errors - a[1].errors).slice(0, 2).map(([key]) => keyLabel(key));
            const pendingArcade = profile().arcadeChallenge;
            const arcadeGoal = pendingArcade && root.QwertzLearningArcade ? root.QwertzLearningArcade.getChallenge(engine.getLesson(pendingArcade.lessonId)).target : 10;
            return `${toolbar('Mission geschafft!', 'Dein Garten wächst.')}
                <div class="learning-result-card"><div class="learning-result-flower">🌻</div><div class="learning-stars" aria-label="${stars} Sterne">${'★'.repeat(stars)}<span>${'☆'.repeat(Math.max(0, 3 - stars))}</span></div><h2>Gut gemacht!</h2><p>Du hast ${escape(newKeys)} geübt und deine Schlange gefüttert.</p><div class="learning-result-facts"><span><strong>${current.lesson.feedTargetCount || 12}</strong> Schritte zum Apfel</span><span><strong>${accuracy == null ? '✓' : Math.round(accuracy) + '%'}</strong> ${accuracy == null ? 'Schreibaufgaben geschafft' : 'Treffer beim Tippen'}</span></div><p class="learning-positive-note">${corrections ? 'Du hast Fehler verbessert. Genau so lernst du weiter!' : 'Jeder richtige Tastendruck bringt dich weiter.'} Deine Belohnung bleibt in deinem Garten.</p>
                ${current.lesson.bridge && !profile().preferences.bridgeComplete ? '<button type="button" class="learning-button learning-primary" data-action="bridge">Jetzt die Schlange steuern →</button>' : ''}
                ${practiceKeys.length ? `<p class="learning-repeat-note">Noch üben: <strong>${escape(practiceKeys.join(' und '))}</strong>. Eine weitere Runde hilft deinen Fingern.${accuracy != null && accuracy < 90 ? ' Deine nächste Mission ist trotzdem bereit.' : ''}</p>` : ''}
                <button type="button" class="learning-button learning-secondary" data-action="lesson" data-lesson="${current.lessonId}">Diese Mission noch einmal üben</button>
                ${pendingArcade ? `<button type="button" class="learning-button learning-primary" data-action="challenge">Jetzt ${arcadeGoal} Punkte im Arcade-Spiel sammeln →</button>` : next ? `<button type="button" class="learning-button ${current.lesson.bridge && !profile().preferences.bridgeComplete ? 'learning-secondary' : 'learning-primary'}" data-action="lesson" data-lesson="${next.id}">Weiter: ${escape(next.title)} →</button>` : '<button type="button" class="learning-button learning-primary" data-action="arcade">Bereit für Arcade? →</button>'}
                <p class="learning-repeat-note">Mit der Leertaste geht es weiter.</p>
                <button type="button" class="learning-link-button" data-action="home">Zurück zu meinem Garten</button>
            </div>`;
        }

        function challengeMarkup() {
            const round = challengeArcade.getState();
            const { challenge, score, status } = round;
            const lesson = engine.getLesson(challenge.lessonId);
            const won = status === 'complete';
            return `${toolbar(challenge.title, `Arcade nach Mission ${lesson.number}`)}<div class="learning-arcade-card">
                <span class="learning-eyebrow">${won ? 'ARCADE GESCHAFFT!' : 'DEINE ARCADE-RUNDE'}</span><h2>${won ? challenge.target + ' Punkte – gut gespielt!' : 'Sammle ' + challenge.target + ' Punkte'}</h2>
                <p>${escape(challenge.instructions)}</p><p>Du spielst nur mit Tasten, die du bis Mission ${lesson.number} gelernt hast.</p>
                <div class="learning-bridge-controls">${challenge.actions.map(action => `<span><b>${escape(keyLabel(challenge.controls[action.id]))}</b> ${escape(action.label)}</span>`).join('')}</div>
                <div class="learning-progress-track" role="progressbar" aria-label="Arcade-Punkte" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="${challenge.target}"><span style="width:${score / challenge.target * 100}%"></span></div>
                <strong class="learning-arcade-score" role="status" aria-live="polite">${score} / ${challenge.target} Punkte</strong>
                ${won ? `<button type="button" class="learning-button learning-primary" data-action="challenge-continue">${lesson.nextLessonId ? 'Weiter: ' + escape(engine.getLesson(lesson.nextLessonId).title) + ' →' : 'Zurück zu meinem Garten →'}</button>` : status === 'lost' ? '<p>Versuch es noch einmal. Deine abgeschlossene Mission bleibt erhalten.</p><button type="button" class="learning-button learning-primary" data-action="challenge-retry">Noch einmal spielen →</button>' : status === 'ready' ? '<button type="button" class="learning-button learning-primary" data-action="challenge-start">Arcade-Runde starten →</button>' : status === 'paused' ? pauseMarkup() : '<p>Halte die passende Steuerungstaste gedrückt.</p>'}
                ${won ? '<p class="learning-repeat-note">Mit der Leertaste geht es weiter.</p>' : ''}
            </div>`;
        }

        function render() {
            if (!active) return;
            const current = rewardBoard ? rewardBoard.current : state();
            if (view === 'lesson') applyCompletedResult(state());
            document.body.classList.toggle('learning-home', view === 'home' || view === 'name');
            document.body.classList.toggle('learning-result', view === 'lesson' && current && current.stage === 'result');
            document.body.classList.toggle('learning-paused', isPaused());
            document.body.classList.toggle('learning-arcade', view === 'arcade');
            if (view === 'name') shell.innerHTML = nameMarkup();
            else if (view === 'home') shell.innerHTML = homeMarkup();
            else if (view === 'bridge') shell.innerHTML = bridgeMarkup();
            else if (view === 'arcade') shell.innerHTML = challengeMarkup();
            else if (current.stage === 'result') shell.innerHTML = resultMarkup(current);
            else {
                const demo = current.stage === 'demo';
                const correction = current.lesson.kind === 'backspace';
                const label = correction ? demo ? 'Lerne die Rücktaste kennen' : 'Löschen und neu tippen' : demo ? 'Finde deine Finger' : current.stage === 'write' ? 'Jetzt wird daraus Schreiben' : 'Füttere deine Schlange';
                const amount = current.targetIndex || 0;
                const total = current.targets.length || 1;
                const introduction = correction ? 'Dein rechter kleiner Finger drückt die Rücktaste ⌫ und kehrt danach zu Ö zurück.' : current.lesson.newKeys.includes('f') ? 'Fühle die kleinen Erhebungen auf F und J. Lege deine Zeigefinger darauf.' : `Lege deine Finger auf die Grundreihe. Neu dabei: ${current.lesson.newKeys.map(keyLabel).join(' und ')}.`;
                const displayedKey = current.needsBackspace ? 'backspace' : current.expectedKey;
                shell.innerHTML = `${toolbar(current.lesson.title, label)}<div class="learning-task-top"><div class="learning-task-message"><p>${correction ? introduction : demo ? introduction : current.stage === 'feed' ? 'Eine richtige Taste = ein Schritt zum Apfel.' : 'Nur Tasten, die du schon geübt hast.'}</p><div class="learning-progress-track" role="progressbar" aria-label="Missionsfortschritt" aria-valuenow="${amount}" aria-valuemin="0" aria-valuemax="${total}"><span style="width:${100 * amount / total}%"></span></div><small>${amount} / ${total} ${correction ? 'Beispiele verbessert' : demo ? 'Tasten gefunden' : current.stage === 'feed' ? 'Schritte zum Apfel' : 'Zeichen getippt'}</small></div><div class="learning-target" aria-label="Nächste Taste: ${escape(keyLabel(displayedKey))}">${displayedKey === ' ' ? '␣' : displayedKey === 'backspace' ? '⌫' : escape(keyLabel(displayedKey))}<small>${displayedKey === 'backspace' ? 'Rücktaste' : displayedKey === ' ' ? 'Leertaste' : 'Tippe diese Taste'}</small></div></div>
                    ${correction ? correctionMarkup(current) : current.stage === 'write' ? typingMarkup(current) : ''}<div class="learning-task-bottom"><p id="learningFeedback" class="learning-feedback ${current.lastInput && !current.lastInput.correct && !current.lastInput.ignored ? 'learning-feedback-retry' : ''}" role="status" aria-live="polite">${escape(rewardBoard ? 'Mmmh! Deine Schlange hat den Apfel erreicht.' : waitingForRelease ? 'Lass die Taste kurz los.' : feedback || (correction ? current.needsBackspace ? 'Lösche zuerst den roten Buchstaben mit ⌫.' : `Tippe jetzt ${keyLabel(current.typingExpectedKey)}.` : demo ? 'Tippe die große Taste. Du hast alle Zeit der Welt.' : 'Die Schlange wartet auf dich.'))}</p><button type="button" class="learning-link-button" data-action="hint" aria-pressed="${forcedHelp}">Fingerhilfe ${forcedHelp ? 'ausblenden' : 'zeigen'}</button></div>${!rewardBoard && isPaused() ? pauseMarkup() : ''}`;
            }
            updateKeyboard();
            if (view !== 'home' && view !== 'name' && (!current || current.stage !== 'result' || view === 'bridge' || view === 'arcade')) drawBoard();
        }

        function updateKeyboard() {
            if (view === 'arcade') {
                const round = challengeArcade.getState();
                const controls = Object.values(round.challenge.controls);
                keyboard.querySelectorAll('[data-key]').forEach(element => {
                    element.classList.toggle('learning-key-target', controls.includes(element.dataset.key));
                    element.classList.toggle('learning-key-taught', round.challenge.taughtKeys.includes(element.dataset.key));
                    element.classList.toggle('learning-key-unknown', !round.challenge.taughtKeys.includes(element.dataset.key));
                });
                if (hands) hands.hide();
                return;
            }
            const current = rewardBoard ? rewardBoard.current : state();
            const expected = rewardBoard ? null : view === 'bridge' ? bridgeExpectedKey() : current && (current.needsBackspace ? 'backspace' : current.expectedKey);
            const taught = view === 'bridge' ? Object.values(BRIDGE_KEYS) : current ? [...current.lesson.taughtKeys, ...(current.lesson.newControlKeys || []), ...(completed('home-backspace') ? ['backspace'] : [])] : [];
            const show = view === 'bridge' || current && shouldShowHint(current);
            keyboard.querySelectorAll('[data-key]').forEach(element => {
                element.classList.toggle('learning-key-target', show && element.dataset.key === expected);
                element.classList.toggle('learning-key-taught', taught.includes(element.dataset.key));
                element.classList.toggle('learning-key-unknown', !taught.includes(element.dataset.key));
            });
            if (hands) {
                if (view === 'home' || view === 'name' || view === 'lesson' && current.stage === 'result') hands.hide();
                else hands.update({
                    expectedKey: expected,
                    showHint: Boolean(show),
                    paused: Boolean(rewardBoard) || isPaused(),
                    targetToken: view === 'bridge' ? `bridge:${bridge.corner}:${bridge.moving}:${forcedHelp}` : `${current.sessionId}:${current.stage}:${current.targetIndex}:${expected}:${forcedHelp}`
                });
            }
        }

        function stageRoute(total) {
            if (rewardApi) return rewardApi.geometry.buildRoute(total);
            const path = [];
            for (let x = 1; x <= 10; x++) path.push({ x, y: 9 });
            for (let y = 8; y >= 2; y--) path.push({ x: 10, y });
            for (let x = 9; x >= 2; x--) path.push({ x, y: 2 });
            for (let y = 3; y <= 8; y++) path.push({ x: 2, y });
            const endIndex = Math.min(total + 2, path.length - 1);
            return { path: path.slice(0, endIndex + 1), startIndex: 2, endIndex };
        }

        function roundedRect(x, y, width, height, radius, color) {
            context.fillStyle = color;
            context.beginPath();
            context.roundRect(x, y, width, height, radius);
            context.fill();
        }

        function drawBoard() {
            if (view === 'arcade') { challengeArcade.draw(); return; }
            const current = rewardBoard ? rewardBoard.current : state();
            const pupil = profile();
            const width = canvas.width;
            const height = canvas.height;
            const size = Math.min(width, height) / 13;
            context.clearRect(0, 0, width, height);
            roundedRect(0, 0, width, height, 18, '#eff8ee');
            context.strokeStyle = '#dfeddb';
            context.lineWidth = 1;
            for (let index = 1; index < 13; index++) {
                context.beginPath(); context.moveTo(index * size, 0); context.lineTo(index * size, height); context.stroke();
                context.beginPath(); context.moveTo(0, index * size); context.lineTo(width, index * size); context.stroke();
            }
            const route = stageRoute(current && current.targets.length || 1);
            let path = route.path;
            let at = Math.min((current && current.targetIndex || 0) + route.startIndex, route.endIndex);
            let pieces;
            if (view === 'bridge') {
                path = bridge.path;
                at = bridge.position;
                pieces = path.slice(Math.max(0, at - 2), at + 1).reverse();
            } else {
                pieces = [path[at], path[Math.max(0, at - 1)], path[Math.max(0, at - 2)]];
            }
            context.strokeStyle = '#c1dbb6'; context.lineWidth = size * 0.3; context.lineCap = 'round'; context.setLineDash([3, size * 0.45]);
            context.beginPath(); path.forEach((point, index) => index ? context.lineTo((point.x + 0.5) * size, (point.y + 0.5) * size) : context.moveTo((point.x + 0.5) * size, (point.y + 0.5) * size)); context.stroke(); context.setLineDash([]);
            const snack = path[path.length - 1];
            canvas.dataset.learningAppleX = snack.x;
            canvas.dataset.learningAppleY = snack.y;
            canvas.dataset.learningHeadIndex = at;
            canvas.dataset.learningEndIndex = path.length - 1;
            context.font = `${size * 0.85}px sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
            pieces.slice().reverse().forEach((piece, index) => roundedRect(piece.x * size + 2, piece.y * size + 2, size - 4, size - 4, size * 0.25, index === pieces.length - 1 ? COLORS[pupil.preferences.snakeColor] || COLORS.mint : '#8ecea8'));
            const head = pieces[0];
            context.fillStyle = '#173e32';
            context.beginPath(); context.arc((head.x + 0.37) * size, (head.y + 0.35) * size, size * 0.055, 0, Math.PI * 2); context.arc((head.x + 0.68) * size, (head.y + 0.35) * size, size * 0.055, 0, Math.PI * 2); context.fill();
            context.beginPath(); context.arc((head.x + 0.52) * size, (head.y + 0.51) * size, size * 0.15, 0, Math.PI); context.strokeStyle = '#173e32'; context.lineWidth = 2; context.stroke();
            if (pupil.preferences.hat !== 'none') { context.font = `${size * 0.7}px sans-serif`; context.fillText(pupil.preferences.hat === 'crown' ? '👑' : '🌸', (head.x + 0.5) * size, head.y * size); }
            const phase = rewardBoard && rewardBoard.phase || 'whole';
            const apple = appleImages[phase === 'celebration' ? 'apple-top' : phase];
            canvas.dataset.learningApplePhase = phase;
            if (apple && apple.complete && apple.naturalWidth) {
                const appleSize = size * (rewardBoard ? 3 : 1.05);
                context.drawImage(apple, (snack.x + 0.5) * size - appleSize / 2, (snack.y + 0.5) * size - appleSize / 2, appleSize, appleSize);
            } else context.fillText('🍎', (snack.x + 0.5) * size, (snack.y + 0.5) * size);
            if (current && current.stage === 'demo' && view !== 'bridge' && !rewardBoard) { context.fillStyle = '#456b49'; context.font = `600 ${size * 0.55}px sans-serif`; context.fillText('Deine Schlange wartet auf dich.', width / 2, size * 5); }
        }

        function isPaused() {
            if (view === 'arcade') return challengeArcade.getState().status === 'paused';
            return view === 'bridge' ? bridge && bridge.paused : view === 'lesson' && state() && state().paused && state().stage !== 'result';
        }

        function pauseMarkup() {
            return '<div class="learning-pause-panel" role="status"><strong>Eine kleine Pause.</strong><span>Deine Snacks und dein Fortschritt bleiben erhalten.</span><button type="button" class="learning-button learning-primary" data-action="pause">Weiter üben</button></div>';
        }

        function pause(force) {
            if (rewardBoard) return;
            if (active && view === 'arcade') {
                challengeArcade.pause(force);
                render();
                if (!isPaused()) focusGame();
                return;
            }
            if (!active || view === 'home' || view === 'name' || state() && state().stage === 'result' && view !== 'bridge') return;
            const value = force === undefined ? !isPaused() : Boolean(force);
            if (view === 'bridge') {
                bridge.paused = value;
                cancelBridgeTimer();
                if (!value && bridge.moving) runBridge();
            } else session.setPaused(value);
            save();
            render();
            if (!value) focusGame();
        }

        function bridgeDirection() {
            if (!bridge || bridge.corner >= BRIDGE_CORNERS.length - 1) return null;
            const here = BRIDGE_CORNERS[bridge.corner];
            const next = BRIDGE_CORNERS[bridge.corner + 1];
            return next.x > here.x ? 'right' : next.x < here.x ? 'left' : next.y > here.y ? 'down' : 'up';
        }

        function bridgeExpectedKey() {
            return BRIDGE_KEYS[bridgeDirection()] || '';
        }

        function bridgeMarkup() {
            const direction = bridgeDirection();
            return `${toolbar('Erste Kurven', 'Feste Tasten. Ein sicherer Weg.')}<div class="learning-bridge-controls">${Object.entries(BRIDGE_KEYS).map(([name, key]) => `<span class="${name === direction ? 'current' : ''}"><b>${key.toUpperCase()}</b> ${ARROWS[name]}</span>`).join('')}</div><div class="learning-task-top"><div class="learning-task-message"><p>${bridge.moving ? 'Gut gelenkt! Die Schlange fährt bis zur nächsten Kurve.' : 'Die Schlange wartet an der Kurve. Tippe die passende Richtung.'}</p><small>Kurve ${Math.min(bridge.corner + 1, BRIDGE_CORNERS.length - 1)} / ${BRIDGE_CORNERS.length - 1}</small></div><div class="learning-target">${bridge.moving ? '→' : escape(keyLabel(bridgeExpectedKey()))}<small>${bridge.moving ? 'Unterwegs' : ARROWS[direction] + ' lenken'}</small></div></div><p class="learning-feedback" role="status" aria-live="polite">${escape(feedback || 'Du verlierst keine Snacks. Probiere in Ruhe.')}</p>${isPaused() ? pauseMarkup() : ''}`;
        }

        function beginBridge() {
            cancelReward();
            const path = [BRIDGE_CORNERS[0]];
            const stops = [0];
            for (let index = 1; index < BRIDGE_CORNERS.length; index++) {
                let previous = path[path.length - 1];
                const end = BRIDGE_CORNERS[index];
                while (previous.x !== end.x || previous.y !== end.y) { previous = { x: previous.x + Math.sign(end.x - previous.x), y: previous.y + Math.sign(end.y - previous.y) }; path.push(previous); }
                stops.push(path.length - 1);
            }
            bridge = { path, stops, position: 0, corner: 0, moving: false, paused: false };
            view = 'bridge';
            feedback = '';
            waitingForRelease = held.size > 0;
            render();
            focusGame();
        }

        function runBridge() {
            cancelBridgeTimer();
            if (!active || view !== 'bridge' || bridge.paused || !bridge.moving) return;
            bridgeTimer = setTimeout(() => {
                bridgeTimer = null;
                if (!active || view !== 'bridge' || bridge.paused) return;
                bridge.position++;
                if (bridge.position >= bridge.stops[bridge.corner + 1]) {
                    bridge.corner++;
                    bridge.moving = false;
                    waitingForRelease = held.size > 0;
                    feedback = 'Prima! Deine Schlange wartet an der nächsten Kurve.';
                    if (bridge.corner >= BRIDGE_CORNERS.length - 1) {
                        store.updatePreferences({ bridgeComplete: true });
                        if (beginReward(state(), true)) return;
                        view = 'lesson';
                        feedback = '';
                        render();
                        return;
                    }
                }
                render();
                if (bridge.moving) runBridge();
            }, 450);
        }

        function handleKey(event) {
            if (!active) return false;
            if (view === 'name') return true;
            if (rewardBoard) {
                if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return true;
                event.preventDefault();
                const key = event.key === ' ' || event.code === 'Space' ? ' ' : event.key.toLowerCase();
                const repeated = event.repeat || held.has(key);
                held.add(key);
                if (!repeated && (key === ' ' || ['Escape', 'Enter'].includes(event.key))) reward.finish();
                return true;
            }
            if (event.key === 'Escape') { event.preventDefault(); pause(); return true; }
            if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return true;
            if (view === 'arcade') {
                const key = event.key === ' ' || event.code === 'Space' ? ' ' : event.key.toLowerCase();
                if (key.length === 1) event.preventDefault();
                const repeated = event.repeat || held.has(key);
                held.add(key);
                if (!waitingForRelease) {
                    if (challengeArcade.getState().status === 'complete') {
                        if (key === ' ' && !repeated) continueAfterChallenge();
                    } else challengeArcade.handleKey(event);
                }
                return true;
            }
            const key = event.key === ' ' || event.code === 'Space' ? ' ' : event.key.toLowerCase();
            if (key.length !== 1 && key !== 'backspace' && key !== 'delete') return true;
            event.preventDefault();
            if (event.repeat || held.has(key)) return true;
            held.add(key);
            if (view === 'home' || isPaused() || waitingForRelease) return true;
            if (view === 'lesson' && state().stage === 'result') {
                if (key === ' ') {
                    const continuation = shell.querySelector('.learning-result-card .learning-primary');
                    if (continuation) continuation.click();
                }
                return true;
            }
            if (view === 'bridge') {
                if (bridge.moving) return true;
                if (key === bridgeExpectedKey()) { bridge.moving = true; feedback = 'Gute Kurve!'; render(); runBridge(); }
                else { feedback = `Probier ${keyLabel(bridgeExpectedKey())}. Deine Schlange wartet.`; render(); }
                return true;
            }
            const before = state();
            if (key === 'delete' && before.lesson.kind === 'backspace') {
                feedback = 'Für diese Aufgabe brauchst du die Rücktaste ⌫ oben rechts. Sie löscht den letzten Buchstaben.';
                render();
                return true;
            }
            if (key === 'backspace' || key === 'delete') session.backspace();
            else session.submitKey(key);
            const current = state();
            if (current.stage !== before.stage) waitingForRelease = true;
            const recent = current.lastInput || {};
            feedback = recent.reason === 'guided-deleted' ? `Gelöscht! Tippe jetzt ${keyLabel(current.typingExpectedKey)}.` : current.guidedCorrectionPending ? 'Lösche zuerst den roten Beispiel-Buchstaben mit der Rücktaste ⌫.' : current.needsBackspace ? 'Ein kleiner Tippfehler. Mit der Rücktaste kannst du ihn verbessern.' : recent.reason === 'deleted' ? 'Tippfehler verbessert. Jetzt kannst du weiterüben.' : recent.ignored ? feedback : recent.correct ? before.stage === 'feed' ? 'Prima! Ein Schritt näher am Apfel.' : 'Richtig getippt!' : `Fast! Probier ${keyLabel(current.expectedKey)} noch einmal.`;
            if (current.stage !== before.stage && beginReward(before)) return true;
            if (current.stage === 'result') {
                applyCompletedResult(current);
                if (beginChallenge()) return true;
            }
            save();
            render();
            return true;
        }

        function handleKeyUp(event) {
            if (active && view === 'arcade') challengeArcade.handleKeyUp(event);
            const key = event.key === ' ' || event.code === 'Space' ? ' ' : event.key.toLowerCase();
            held.delete(key);
            if (active && waitingForRelease && held.size === 0) { waitingForRelease = false; render(); }
            return active;
        }

        function shellClick(event) {
            const button = event.target.closest('button[data-action]');
            if (!button || button.disabled) return;
            const action = button.dataset.action;
            if (rewardBoard && action !== 'home' && action !== 'arcade') return;
            if (action === 'home') open();
            else if (action === 'arcade') arcade();
            else if (action === 'name') showNameEntry('new');
            else if (action === 'leaderboard') onLeaderboard();
            else if (action === 'continue') continueLesson();
            else if (action === 'challenge') beginChallenge();
            else if (action === 'challenge-start' || action === 'challenge-retry') {
                if (view !== 'arcade') return;
                held.clear();
                waitingForRelease = false;
                if (action === 'challenge-retry') challengeArcade.restart();
                challengeArcade.play();
                focusGame();
            } else if (action === 'challenge-continue') continueAfterChallenge();
            else if (action === 'lesson') {
                const index = lessons.findIndex(lesson => lesson.id === button.dataset.lesson);
                if (index >= 0 && unlocked(index)) begin(button.dataset.lesson);
            } else if (action === 'pause') pause();
            else if (action === 'hint') { forcedHelp = !forcedHelp; if (forcedHelp) session.hintUsed(); render(); focusGame(); }
            else if (action === 'bridge') beginBridge();
            else if (action === 'create-profile') {
                const input = shell.querySelector('#learningNickname');
                const name = input.value.trim();
                if (!name) { input.focus(); return; }
                save();
                const created = store.createProfile(name);
                if (classroom && created) classroom.syncProfile(created);
                session = null;
                render();
            } else if (action === 'color' || action === 'hat') { store.updatePreferences({ [action === 'color' ? 'snakeColor' : 'hat']: button.dataset.value }); render(); }
        }

        function switchProfile(event) {
            if (event.target.id !== 'learningProfileSelect') return;
            nameRequest++;
            cancelReward();
            cancelChallenge();
            save();
            store.switchProfile(event.target.value);
            session = null;
            completeResultId = null;
            if (!profile().nickname.trim()) { showNameEntry('rename'); return; }
            if (classroom) classroom.syncProfile(profile());
            render();
        }

        function onBlur() { if (active && entered) { held.clear(); waitingForRelease = false; if (rewardBoard) rewardPauseAfter = true; else pause(true); } }
        function onVisibility() { if (document.hidden) onBlur(); }
        function beforeUnload() { if (session && state().stage !== 'result') { session.setPaused(true); save(); } }
        shell.addEventListener('click', shellClick);
        shell.addEventListener('change', switchProfile);
        shell.addEventListener('submit', submitName);
        if (classroom) classroom.syncProfiles(store.getState().profiles);
        if (startButton) startButton.addEventListener('click', open);
        if (arcadeButton) arcadeButton.addEventListener('click', arcade);
        document.addEventListener('menu-open-learning', open);
        document.addEventListener('visibilitychange', onVisibility);
        root.addEventListener('blur', onBlur);
        root.addEventListener('beforeunload', beforeUnload);

        function destroy() {
            close();
            shell.removeEventListener('click', shellClick);
            shell.removeEventListener('change', switchProfile);
            shell.removeEventListener('submit', submitName);
            if (startButton) startButton.removeEventListener('click', open);
            if (arcadeButton) arcadeButton.removeEventListener('click', arcade);
            document.removeEventListener('menu-open-learning', open);
            document.removeEventListener('visibilitychange', onVisibility);
            root.removeEventListener('blur', onBlur);
            root.removeEventListener('beforeunload', beforeUnload);
            shell.remove();
            if (hands) hands.destroy();
            if (reward) reward.destroy();
            if (challengeArcade) challengeArcade.destroy();
            if (classroom) classroom.destroy();
            if (originalCanvasTabIndex == null) canvas.removeAttribute('tabindex');
            else canvas.setAttribute('tabindex', originalCanvasTabIndex);
        }

        return { isActive: () => active, handleKey, handleKeyUp, open, close, save, pause, destroy };
    }

    root.QwertzLearningMode = { mount };
})(window);

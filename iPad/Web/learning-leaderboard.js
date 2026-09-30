/* Protected classroom view; passwords live only in this mounted view. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./learning-engine'), require('./learning-progress'), root);
    else root.QwertzLearningLeaderboard = factory(root.QwertzLearningEngine, root.QwertzLearningProgress, root);
}(typeof window === 'undefined' ? globalThis : window, function (engine, progress, root) {
    'use strict';
    const REFRESH_MS = 7000;
    const plain = value => value && typeof value === 'object' && !Array.isArray(value);
    const integer = value => Number.isSafeInteger(value) && value >= 0;
    const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const keyLabel = key => key === ' ' ? 'Leertaste' : key === 'backspace' ? '⌫ Rücktaste' : key.toUpperCase();
    const lessonColumns = lessons => (lessons || engine.getLessons()).map((lesson, index) => ({
        id: lesson.id, title: lesson.title, newKeys: lesson.newKeys.slice(), newControlKeys: (lesson.newControlKeys || []).slice(), number: lesson.number || index + 1, index
    }));

    function cellFor(result, attemptCount, lastCompletedAt) {
        return {
            accuracyPercent: Math.round(result.correctFirstTry / result.targets * 100),
            correctFirstTry: result.correctFirstTry, targets: result.targets,
            errors: result.errors, corrections: result.corrections, activeMs: result.activeMs,
            characterAttempts: result.characterAttempts, attemptCount: Math.max(1, attemptCount || 1),
            lastCompletedAt: lastCompletedAt == null ? result.completedAt : lastCompletedAt
        };
    }

    function buildMatrix(input, lessons) {
        const profiles = Array.isArray(input) ? input : plain(input) && Array.isArray(input.profiles) ? input.profiles : [];
        const columns = lessonColumns(lessons);
        const rows = [];
        const seen = new Set();
        profiles.forEach(profile => {
            if (!plain(profile) || typeof profile.id !== 'string' || seen.has(profile.id) || typeof profile.nickname !== 'string' || !profile.nickname.trim()) return;
            seen.add(profile.id);
            const cells = {};
            const results = (Array.isArray(profile.results) ? profile.results : []).map(progress.normalizeResult).filter(Boolean);
            columns.forEach(lesson => {
                const completed = plain(profile.completedLessons) && profile.completedLessons[lesson.id];
                let best = plain(completed) ? progress.normalizeBestResult(completed.bestResult, lesson.id) : null;
                const retained = results.filter(result => result.lessonId === lesson.id);
                retained.forEach(result => { if (progress.isBetterResult(result, best)) best = result; });
                if (best) cells[lesson.id] = cellFor(best, plain(completed) && integer(completed.completionCount) ? completed.completionCount : retained.length,
                    plain(completed) && Number.isFinite(completed.completedAt) ? completed.completedAt : undefined);
            });
            rows.push({ pupilId: profile.id, name: profile.nickname.trim(), cells });
        });
        rows.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true }) || a.pupilId.localeCompare(b.pupilId));
        return { curriculumVersion: engine.CURRICULUM_VERSION, lessons: columns, rows };
    }

    function normalizeMatrix(raw) {
        if (!plain(raw) || raw.curriculumVersion !== engine.CURRICULUM_VERSION || !Array.isArray(raw.rows)) throw new Error('curriculum');
        const lessons = lessonColumns();
        const rows = [];
        const seen = new Set();
        raw.rows.forEach(row => {
            if (!plain(row) || typeof row.pupilId !== 'string' || !row.pupilId || seen.has(row.pupilId) || typeof row.name !== 'string' || !row.name.trim()) return;
            seen.add(row.pupilId);
            const cells = {};
            lessons.forEach(lesson => {
                const cell = plain(row.cells) && row.cells[lesson.id];
                const definition = engine.getLesson(lesson.id);
                const targets = definition.feedTargets.length + definition.writeTargets.length;
                if (!plain(cell) || !integer(cell.correctFirstTry) || cell.correctFirstTry > targets || cell.targets !== targets) return;
                if (!['errors', 'corrections', 'activeMs', 'attemptCount'].every(key => integer(cell[key])) || cell.attemptCount < 1 || cell.corrections > cell.errors) return;
                cells[lesson.id] = {
                    correctFirstTry: cell.correctFirstTry, targets, accuracyPercent: Math.round(cell.correctFirstTry / targets * 100),
                    errors: cell.errors, corrections: cell.corrections, activeMs: cell.activeMs, attemptCount: cell.attemptCount,
                    characterAttempts: integer(cell.characterAttempts) ? cell.characterAttempts : null,
                    lastCompletedAt: Number.isFinite(cell.lastCompletedAt) && cell.lastCompletedAt >= 0 ? cell.lastCompletedAt : null
                };
            });
            rows.push({ pupilId: row.pupilId, name: row.name.trim().slice(0, 80), cells });
        });
        rows.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true }) || a.pupilId.localeCompare(b.pupilId));
        return { curriculumVersion: raw.curriculumVersion, lessons, rows };
    }

    function mount({ container, onClose = () => {} } = {}) {
        const document = root.document;
        const host = container || document.querySelector('.container');
        if (!host) throw new Error('Die Klassenübersicht braucht einen Anzeigebereich.');
        const shell = document.createElement('section');
        shell.className = 'learning-leaderboard-shell';
        shell.hidden = true;
        shell.setAttribute('aria-label', 'Lektions-Bestenliste');
        host.appendChild(shell);
        let active = false;
        let destroyed = false;
        let password = '';
        let matrix = null;
        let selected = null;
        let message = '';
        let loading = false;
        let updatedAt = null;
        let timer = null;
        let controller = null;
        let revision = 0;

        function cancelTimer() { if (timer != null) root.clearTimeout(timer); timer = null; }
        function cancelRequest() { revision++; if (controller) controller.abort(); controller = null; loading = false; }
        function schedule() {
            cancelTimer();
            if (active && password && !document.hidden) timer = root.setTimeout(refresh, REFRESH_MS);
        }
        function detailsMarkup() {
            if (!selected || !matrix) return '';
            const row = matrix.rows.find(item => item.pupilId === selected.pupilId);
            const lesson = matrix.lessons.find(item => item.id === selected.lessonId);
            const cell = row && row.cells[selected.lessonId];
            if (!cell || !lesson) return '';
            const seconds = Math.round(cell.activeMs / 1000);
            const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
            return `<aside class="learning-leaderboard-detail" aria-label="Ausgewählte Lektion"><strong>${escape(row.name)} · ${escape(lesson.title)}</strong><p>${cell.correctFirstTry} von ${cell.targets} Zeichen beim ersten Versuch richtig.</p><dl><div><dt>Treffer beim Tippen</dt><dd>${cell.accuracyPercent} %</dd></div><div><dt>Tippfehler</dt><dd>${cell.errors}</dd></div><div><dt>Korrekturen</dt><dd>${cell.corrections}</dd></div><div><dt>Übungszeit der besten Runde</dt><dd>${time}</dd></div><div><dt>Abgeschlossene Runden</dt><dd>${cell.attemptCount}</dd></div>${cell.characterAttempts == null ? '' : `<div><dt>Tastenanschläge der besten Runde</dt><dd>${cell.characterAttempts}</dd></div>`}</dl><button type="button" data-action="clear-selection" class="learning-leaderboard-link">Details schließen</button></aside>`;
        }
        function render() {
            if (!active) return;
            const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-cell]');
            const focusPupil = focused && focused.dataset.pupil;
            const focusLesson = focused && focused.dataset.lesson;
            const header = '<div class="learning-leaderboard-heading"><div><p class="learning-leaderboard-eyebrow">FÜR LEHRKRÄFTE</p><h2 tabindex="-1" data-leaderboard-heading>Lektions-Bestenliste</h2><p>Klassenübersicht für alle Geräte. Beste Trefferquote je Lektion – der erste Versuch pro Zeichen zählt.</p></div><button type="button" data-action="close" class="learning-leaderboard-link">← Zurück zum Lernen</button></div>';
            if (!matrix) {
                shell.innerHTML = `${header}<form class="learning-leaderboard-login" data-password-form><h3>Klassenübersicht öffnen</h3><p>Namen und Ergebnisse sind nur mit dem Lehrerpasswort sichtbar.</p><label for="learningLeaderboardPassword">Lehrerpasswort</label><input id="learningLeaderboardPassword" name="password" type="password" autocomplete="current-password" required ${loading ? 'disabled' : ''}><button type="submit" class="learning-leaderboard-primary" ${loading ? 'disabled' : ''}>${loading ? 'Wird geöffnet …' : 'Klassenübersicht öffnen'}</button><small>Verwende das vorhandene Admin-Passwort. Es wird nur für diese geöffnete Ansicht behalten.</small></form><p role="status" aria-live="polite" class="learning-leaderboard-status">${escape(message)}</p>`;
            } else {
                shell.innerHTML = `${header}<div class="learning-leaderboard-actions"><p>${matrix.rows.length} Lernprofil${matrix.rows.length === 1 ? '' : 'e'} · <strong>Treffer beim Tippen</strong></p><button type="button" data-action="refresh" class="learning-leaderboard-primary" ${loading ? 'disabled' : ''}>${loading ? 'Aktualisiert …' : 'Jetzt aktualisieren'}</button></div><p role="status" aria-live="polite" class="learning-leaderboard-status">${escape(message || (updatedAt ? `Zuletzt aktualisiert: ${new Date(updatedAt).toLocaleTimeString('de-DE')} · Die Ansicht aktualisiert sich automatisch.` : ''))}</p><div class="learning-leaderboard-scroll" tabindex="0" role="region" aria-label="Trefferquoten nach Name und Lektion. Seitlich scrollen für weitere Lektionen."><table class="learning-leaderboard-table"><caption>Beste Trefferquote je Lektion. — bedeutet: noch keine abgeschlossene Runde.</caption><thead><tr><th scope="col">Name</th>${matrix.lessons.map(lesson => `<th scope="col"><span>Lektion ${lesson.number}</span><strong>${escape(lesson.newKeys.concat(lesson.newControlKeys).map(keyLabel).join(' · '))}</strong><small>${escape(lesson.title)}</small></th>`).join('')}</tr></thead><tbody>${matrix.rows.map(row => `<tr><th scope="row">${escape(row.name)}</th>${matrix.lessons.map(lesson => { const cell = row.cells[lesson.id]; return cell ? `<td><button type="button" data-cell data-pupil="${escape(row.pupilId)}" data-lesson="${escape(lesson.id)}" aria-label="${escape(row.name)}, Lektion ${lesson.number}: ${cell.accuracyPercent} Prozent Treffer beim Tippen. Details anzeigen." aria-pressed="${Boolean(selected && selected.pupilId === row.pupilId && selected.lessonId === lesson.id)}">${cell.accuracyPercent} %</button></td>` : '<td><span class="learning-leaderboard-empty" aria-label="Noch keine abgeschlossene Runde">—</span></td>'; }).join('')}</tr>`).join('')}</tbody></table></div>${matrix.rows.length ? '' : '<p class="learning-leaderboard-no-pupils">Hier erscheinen Lernprofile, sobald sie auf einem Gerät mit einem Namen angemeldet wurden.</p>'}${detailsMarkup()}<p class="learning-leaderboard-note">Vergleiche den Lernfortschritt je Lektion. Die Fingerbilder helfen beim Üben; die App erkennt die gedrückte Taste. Ältere Ergebnisse bleiben als beste Runde erhalten.</p>`;
            }
            if (focusPupil && focusLesson) {
                const replacement = [...shell.querySelectorAll('[data-cell]')].find(button => button.dataset.pupil === focusPupil && button.dataset.lesson === focusLesson);
                if (replacement) replacement.focus({ preventScroll: true });
            }
        }
        async function refresh() {
            cancelTimer();
            if (!active || !password || document.hidden || destroyed) return;
            cancelRequest();
            const requestRevision = revision;
            controller = new root.AbortController();
            loading = true;
            render();
            try {
                const response = await root.fetch('/api/learning/leaderboard', { headers: { 'x-admin-password': password }, signal: controller.signal, cache: 'no-store', credentials: 'same-origin' });
                if (!active || requestRevision !== revision || destroyed) return;
                if (response.status === 401 || response.status === 403) {
                    password = ''; matrix = null; selected = null; updatedAt = null;
                    message = 'Das Lehrerpasswort stimmt nicht. Bitte versuche es erneut.';
                } else if (!response.ok) throw new Error('server');
                else {
                    const payload = await response.json();
                    if (!active || requestRevision !== revision || destroyed) return;
                    matrix = normalizeMatrix(payload); updatedAt = Date.now(); message = '';
                }
            } catch (error) {
                if (!active || requestRevision !== revision || destroyed || error.name === 'AbortError') return;
                message = error.message === 'curriculum' ? 'Die Lektionen haben sich geändert. Bitte lade die Seite neu.' : 'Die Klassenübersicht ist gerade nicht erreichbar. Vorhandene Ergebnisse bleiben sichtbar.';
            } finally {
                if (active && requestRevision === revision && !destroyed) {
                    controller = null; loading = false; render(); schedule();
                    if (!password) shell.querySelector('[name="password"]').focus({ preventScroll: true });
                }
            }
        }
        function submit(event) {
            if (!event.target.matches('[data-password-form]')) return;
            event.preventDefault();
            const input = shell.querySelector('[name="password"]');
            password = input.value;
            input.value = '';
            if (!password) return;
            message = ''; refresh();
        }
        function click(event) {
            const button = event.target.closest('button');
            if (!button) return;
            if (button.dataset.action === 'close') { close(); onClose(); }
            else if (button.dataset.action === 'refresh') refresh();
            else if (button.dataset.action === 'clear-selection') { selected = null; render(); }
            else if (button.hasAttribute('data-cell')) { selected = { pupilId: button.dataset.pupil, lessonId: button.dataset.lesson }; render(); }
        }
        function visibility() {
            if (document.hidden) { cancelTimer(); cancelRequest(); }
            else if (active && password) refresh();
        }
        function open() {
            if (destroyed) return;
            active = true; shell.hidden = false; document.body.classList.add('learning-leaderboard-active');
            render();
            const focus = matrix ? shell.querySelector('[data-leaderboard-heading]') : shell.querySelector('[name="password"]');
            if (focus) focus.focus({ preventScroll: true });
            if (password) refresh();
        }
        function close() {
            active = false; cancelTimer(); cancelRequest(); password = ''; matrix = null; selected = null; updatedAt = null; message = '';
            shell.hidden = true; shell.innerHTML = ''; document.body.classList.remove('learning-leaderboard-active');
        }
        function destroy() {
            close(); destroyed = true; shell.removeEventListener('submit', submit); shell.removeEventListener('click', click);
            document.removeEventListener('visibilitychange', visibility); shell.remove();
        }
        shell.addEventListener('submit', submit); shell.addEventListener('click', click);
        document.addEventListener('visibilitychange', visibility);
        return { open, close, destroy, refresh, isActive: () => active };
    }
    return { REFRESH_MS, buildMatrix, normalizeMatrix, mount };
}));

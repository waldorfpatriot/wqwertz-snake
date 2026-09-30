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
        const classes = [];
        if (raw.classes !== undefined) {
            if (!Array.isArray(raw.classes) || !raw.classes.length) throw new Error('classes');
            const ids = new Set();
            raw.classes.forEach(group => {
                if (!plain(group) || typeof group.id !== 'string' || !group.id || ids.has(group.id) ||
                    typeof group.name !== 'string' || !group.name.trim() || !integer(group.pupilCount)) throw new Error('classes');
                ids.add(group.id);
                classes.push({ id: group.id, name: group.name.trim(), pupilCount: group.pupilCount });
            });
            if (!ids.has(raw.classId) || raw.classId !== raw.activeClassId) throw new Error('classes');
        }
        return { curriculumVersion: raw.curriculumVersion, lessons, rows, classes,
            classId: classes.length ? raw.classId : null, activeClassId: classes.length ? raw.activeClassId : null };
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
        let showClassForm = false;
        let className = '';
        let managedPupilId = null;
        let destinationClassId = '';
        let confirmingDelete = false;
        let focusToRestore = null;

        function cancelTimer() { if (timer != null) root.clearTimeout(timer); timer = null; }
        function cancelRequest() { revision++; if (controller) controller.abort(); controller = null; loading = false; }
        function schedule() {
            cancelTimer();
            if (active && password && !document.hidden) timer = root.setTimeout(refresh, REFRESH_MS);
        }
        function clearManagement() { managedPupilId = null; destinationClassId = ''; confirmingDelete = false; }
        function classOptions(selectedId, excludeId) {
            return matrix.classes.filter(group => group.id !== excludeId).map(group =>
                `<option value="${escape(group.id)}" ${group.id === selectedId ? 'selected' : ''}>${escape(group.name)} (${group.pupilCount})</option>`).join('');
        }
        function classesMarkup() {
            if (!matrix.classes.length) return '';
            const group = matrix.classes.find(item => item.id === matrix.classId);
            const disabled = loading ? 'disabled' : '';
            return `<section class="learning-leaderboard-classes" aria-label="Klasse auswählen"><div class="learning-leaderboard-class-picker"><div><label for="learningLeaderboardClass">Klasse</label><select id="learningLeaderboardClass" data-class-select ${disabled}>${classOptions(matrix.classId)}</select></div><button type="button" data-action="new-class" class="learning-leaderboard-link" ${disabled} aria-expanded="${showClassForm}">+ Neue Klasse</button></div><p>Neue Anmeldungen auf allen Geräten gehören zu <strong>${escape(group.name)}</strong>. Diese Auswahl bleibt auch nach dem Schließen aktiv. Bereits angemeldete Kinder bleiben in ihrer Klasse.</p>${showClassForm ? `<form data-class-form class="learning-leaderboard-class-form"><div><label for="learningLeaderboardClassName">Name der neuen Klasse</label><input id="learningLeaderboardClassName" name="className" maxlength="80" required autocomplete="off" placeholder="Zum Beispiel Nachmittag 2. Trimester" value="${escape(className)}" ${disabled}></div><button type="submit" data-action="create-class" class="learning-leaderboard-primary" ${disabled}>Klasse anlegen und auswählen</button><button type="button" data-action="cancel-class" class="learning-leaderboard-link" ${disabled}>Abbrechen</button></form>` : ''}</section>`;
        }
        function managementMarkup() {
            if (!managedPupilId || !matrix.classes.length) return '';
            const row = matrix.rows.find(item => item.pupilId === managedPupilId);
            if (!row) return '';
            const disabled = loading ? 'disabled' : '';
            return `<aside class="learning-leaderboard-management" aria-label="Lernprofil verwalten"><div class="learning-leaderboard-management-heading"><h3>${escape(row.name)} verwalten</h3><button type="button" data-action="close-management" class="learning-leaderboard-link" ${disabled}>Schließen</button></div>${matrix.classes.length > 1 ? `<form data-move-form class="learning-leaderboard-move-form"><div><label for="learningLeaderboardDestination">In eine andere Klasse verschieben</label><select id="learningLeaderboardDestination" name="destinationClass" ${disabled}>${classOptions(destinationClassId, matrix.classId)}</select></div><button type="submit" data-action="move-pupil" class="learning-leaderboard-primary" ${disabled}>Verschieben</button></form><p>Alle Ergebnisse bleiben beim Verschieben erhalten.</p>` : '<p>Lege eine weitere Klasse an, um dieses Kind dorthin zu verschieben.</p>'}${confirmingDelete ? `<div class="learning-leaderboard-delete-confirm" role="group" aria-label="Löschen bestätigen"><p><strong>${escape(row.name)} wirklich löschen?</strong> Das Lernprofil und alle Ergebnisse werden aus der Klassenübersicht gelöscht. Das kann nicht rückgängig gemacht werden. Der Lernfortschritt auf dem Gerät bleibt erhalten.</p><button type="button" data-action="confirm-delete" class="learning-leaderboard-danger" ${disabled}>Endgültig löschen</button><button type="button" data-action="cancel-delete" class="learning-leaderboard-link" ${disabled}>Abbrechen</button></div>` : `<button type="button" data-action="delete-pupil" class="learning-leaderboard-danger" ${disabled}>Aus der Klassenübersicht löschen</button>`}</aside>`;
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
            const currentFocus = document.activeElement;
            const focused = currentFocus && currentFocus.closest && currentFocus.closest('[data-cell]');
            const focusName = currentFocus && currentFocus.name;
            const focusClass = currentFocus && currentFocus.hasAttribute && currentFocus.hasAttribute('data-class-select');
            if (focused) focusToRestore = { pupilId: focused.dataset.pupil, lessonId: focused.dataset.lesson };
            else if (['className', 'destinationClass', 'password'].includes(focusName) || focusClass) {
                focusToRestore = { selector: focusClass ? '[data-class-select]' : `[name="${focusName}"]`,
                    start: currentFocus.selectionStart, end: currentFocus.selectionEnd };
            } else if (currentFocus && currentFocus.dataset && currentFocus.dataset.action) {
                focusToRestore = { action: currentFocus.dataset.action, pupilId: currentFocus.dataset.pupil };
            } else if (currentFocus && currentFocus !== document.body && currentFocus !== shell) focusToRestore = null;
            const scroll = shell.querySelector('.learning-leaderboard-scroll');
            const scrollLeft = scroll && scroll.scrollLeft;
            const scrollTop = scroll && scroll.scrollTop;
            const header = '<div class="learning-leaderboard-heading"><div><p class="learning-leaderboard-eyebrow">FÜR LEHRKRÄFTE</p><h2 tabindex="-1" data-leaderboard-heading>Lektions-Bestenliste</h2><p>Klassenübersicht für alle Geräte. Beste Trefferquote je Lektion – der erste Versuch pro Zeichen zählt.</p></div><button type="button" data-action="close" class="learning-leaderboard-link">← Zurück zum Lernen</button></div>';
            if (!matrix) {
                shell.innerHTML = `${header}<form class="learning-leaderboard-login" data-password-form><h3>Klassenübersicht öffnen</h3><p>Namen und Ergebnisse sind nur mit dem Lehrerpasswort sichtbar.</p><label for="learningLeaderboardPassword">Lehrerpasswort</label><input id="learningLeaderboardPassword" name="password" type="password" autocomplete="current-password" required ${loading ? 'disabled' : ''}><button type="submit" data-action="login" class="learning-leaderboard-primary" ${loading ? 'disabled' : ''}>${loading ? 'Wird geöffnet …' : 'Klassenübersicht öffnen'}</button><small>Verwende das vorhandene Admin-Passwort. Es wird nur für diese geöffnete Ansicht behalten.</small></form><p role="status" aria-live="polite" class="learning-leaderboard-status">${escape(message)}</p>`;
            } else {
                shell.innerHTML = `${header}${classesMarkup()}<div class="learning-leaderboard-actions"><p>${matrix.rows.length} Lernprofil${matrix.rows.length === 1 ? '' : 'e'} · <strong>Treffer beim Tippen</strong></p><button type="button" data-action="refresh" class="learning-leaderboard-primary" ${loading ? 'disabled' : ''}>${loading ? 'Wird geladen …' : 'Jetzt aktualisieren'}</button></div><p role="status" aria-live="polite" class="learning-leaderboard-status">${escape(message || (updatedAt ? `Zuletzt aktualisiert: ${new Date(updatedAt).toLocaleTimeString('de-DE')} · Die Ansicht aktualisiert sich automatisch.` : ''))}</p>${managementMarkup()}<div class="learning-leaderboard-scroll" tabindex="0" role="region" aria-label="Trefferquoten nach Name und Lektion. Seitlich scrollen für weitere Lektionen."><table class="learning-leaderboard-table"><caption>${matrix.classes.length ? `${escape(matrix.classes.find(group => group.id === matrix.classId).name)} · ` : ''}Beste Trefferquote je Lektion. — bedeutet: noch keine abgeschlossene Runde.</caption><thead><tr><th scope="col">Name</th>${matrix.lessons.map(lesson => `<th scope="col"><span>Lektion ${lesson.number}</span><strong>${escape(lesson.newKeys.concat(lesson.newControlKeys).map(keyLabel).join(' · '))}</strong><small>${escape(lesson.title)}</small></th>`).join('')}</tr></thead><tbody>${matrix.rows.map(row => `<tr><th scope="row"><span class="learning-leaderboard-pupil-name">${escape(row.name)}</span>${matrix.classes.length ? `<button type="button" data-action="manage-pupil" data-pupil="${escape(row.pupilId)}" class="learning-leaderboard-pupil-button" aria-label="${escape(row.name)} verwalten" ${loading ? 'disabled' : ''}>Verwalten</button>` : ''}</th>${matrix.lessons.map(lesson => { const cell = row.cells[lesson.id]; return cell ? `<td><button type="button" data-cell data-pupil="${escape(row.pupilId)}" data-lesson="${escape(lesson.id)}" aria-label="${escape(row.name)}, Lektion ${lesson.number}: ${cell.accuracyPercent} Prozent Treffer beim Tippen. Details anzeigen." aria-pressed="${Boolean(selected && selected.pupilId === row.pupilId && selected.lessonId === lesson.id)}">${cell.accuracyPercent} %</button></td>` : '<td><span class="learning-leaderboard-empty" aria-label="Noch keine abgeschlossene Runde">—</span></td>'; }).join('')}</tr>`).join('')}</tbody></table></div>${matrix.rows.length ? '' : '<p class="learning-leaderboard-no-pupils">In dieser Klasse sind noch keine Kinder angemeldet. Neue Lernprofile erscheinen hier, sobald sie sich auf einem Gerät mit ihrem Namen anmelden.</p>'}${detailsMarkup()}<p class="learning-leaderboard-note">Vergleiche den Lernfortschritt je Lektion. Die Fingerbilder helfen beim Üben; die App erkennt die gedrückte Taste. Ältere Ergebnisse bleiben als beste Runde erhalten.</p>`;
            }
            const replacementScroll = shell.querySelector('.learning-leaderboard-scroll');
            if (replacementScroll && scroll) { replacementScroll.scrollLeft = scrollLeft; replacementScroll.scrollTop = scrollTop; }
            if (focusToRestore) {
                const savedFocus = focusToRestore;
                const replacement = savedFocus.selector ? shell.querySelector(savedFocus.selector) :
                    [...shell.querySelectorAll(savedFocus.lessonId ? '[data-cell]' : '[data-action]')].find(button =>
                        savedFocus.lessonId ? button.dataset.pupil === savedFocus.pupilId && button.dataset.lesson === savedFocus.lessonId :
                            button.dataset.action === savedFocus.action && button.dataset.pupil === savedFocus.pupilId);
                if (replacement && !replacement.disabled) {
                    replacement.focus({ preventScroll: true });
                    if (Number.isInteger(savedFocus.start) && replacement.setSelectionRange) replacement.setSelectionRange(savedFocus.start, savedFocus.end);
                } else if (!loading) shell.querySelector('[data-leaderboard-heading]').focus({ preventScroll: true });
                // Keep the logical focus while a refreshed control is temporarily disabled.
                if (!loading) focusToRestore = null;
            }
        }
        async function load(path = '/leaderboard', { method = 'GET', body, success = '' } = {}) {
            cancelTimer();
            if (!active || !password || document.hidden || destroyed || loading) return;
            cancelRequest();
            const requestRevision = revision;
            controller = new root.AbortController();
            loading = true;
            render();
            try {
                const response = await root.fetch('/api/learning' + path, { method,
                    headers: { 'x-admin-password': password, ...(body ? { 'Content-Type': 'application/json' } : {}) },
                    ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal, cache: 'no-store', credentials: 'same-origin' });
                if (!active || requestRevision !== revision || destroyed) return;
                if (response.status === 401 || response.status === 403) {
                    password = ''; matrix = null; selected = null; updatedAt = null;
                    clearManagement(); showClassForm = false; className = '';
                    message = 'Das Lehrerpasswort stimmt nicht. Bitte versuche es erneut.';
                } else {
                    const payload = await response.json();
                    if (!active || requestRevision !== revision || destroyed) return;
                    if (!response.ok) {
                        const failure = new Error(typeof payload.error === 'string' ? payload.error : 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.');
                        failure.serverMessage = true;
                        throw failure;
                    }
                    const updated = normalizeMatrix(payload);
                    if (!matrix || matrix.classId !== updated.classId || method !== 'GET') { selected = null; clearManagement(); }
                    matrix = updated; updatedAt = Date.now(); message = success;
                    if (managedPupilId && !matrix.rows.some(row => row.pupilId === managedPupilId)) clearManagement();
                    if (path === '/classes' && method === 'POST') { showClassForm = false; className = ''; }
                }
            } catch (error) {
                if (!active || requestRevision !== revision || destroyed || error.name === 'AbortError') return;
                message = error.serverMessage ? error.message : error.message === 'curriculum' ? 'Die Lektionen haben sich geändert. Bitte lade die Seite neu.' :
                    method === 'GET' ? 'Die Klassenübersicht ist gerade nicht erreichbar. Vorhandene Ergebnisse bleiben sichtbar.' : 'Die Änderung konnte nicht bestätigt werden. Bitte aktualisiere die Übersicht, bevor du es erneut versuchst.';
            } finally {
                if (active && requestRevision === revision && !destroyed) {
                    controller = null; loading = false; render(); schedule();
                    if (!password) shell.querySelector('[name="password"]').focus({ preventScroll: true });
                }
            }
        }
        function refresh() { return load(); }
        function submit(event) {
            if (event.target.matches('[data-password-form]')) {
                event.preventDefault();
                if (loading) return;
                const input = shell.querySelector('[name="password"]');
                password = input.value; input.value = '';
                if (!password) return;
                message = ''; refresh();
            } else if (event.target.matches('[data-class-form]')) {
                event.preventDefault();
                if (loading || !matrix) return;
                className = shell.querySelector('[name="className"]').value;
                if (!className.trim()) return;
                load('/classes', { method: 'POST', body: { name: className.trim() }, success: 'Klasse angelegt. Neue Anmeldungen gehören ab jetzt zu dieser Klasse.' });
            } else if (event.target.matches('[data-move-form]')) {
                event.preventDefault();
                if (loading || !managedPupilId || !matrix) return;
                destinationClassId = shell.querySelector('[name="destinationClass"]').value;
                if (!matrix.classes.some(group => group.id === destinationClassId && group.id !== matrix.classId)) return;
                load('/pupils/' + encodeURIComponent(managedPupilId), { method: 'PATCH', body: { classId: destinationClassId }, success: 'Lernprofil mit allen Ergebnissen verschoben.' });
            }
        }
        function click(event) {
            const button = event.target.closest('button');
            if (!button) return;
            if (button.dataset.action === 'close') { close(); onClose(); }
            else if (loading) return;
            else if (button.dataset.action === 'refresh') refresh();
            else if (button.dataset.action === 'clear-selection') { selected = null; render(); }
            else if (button.dataset.action === 'new-class' && matrix) {
                showClassForm = !showClassForm; render();
                if (showClassForm) shell.querySelector('[name="className"]').focus({ preventScroll: true });
            }
            else if (button.dataset.action === 'cancel-class') { showClassForm = false; className = ''; render(); }
            else if (button.dataset.action === 'manage-pupil' && matrix) {
                if (!matrix.rows.some(row => row.pupilId === button.dataset.pupil)) return;
                managedPupilId = button.dataset.pupil;
                destinationClassId = matrix.classes.find(group => group.id !== matrix.classId)?.id || '';
                confirmingDelete = false; render();
                shell.querySelector('[data-action="close-management"]').focus({ preventScroll: true });
            }
            else if (button.dataset.action === 'close-management') { clearManagement(); render(); }
            else if (button.dataset.action === 'delete-pupil' && managedPupilId) {
                confirmingDelete = true; render();
                shell.querySelector('[data-action="cancel-delete"]').focus({ preventScroll: true });
            }
            else if (button.dataset.action === 'cancel-delete') { confirmingDelete = false; render(); }
            else if (button.dataset.action === 'confirm-delete' && confirmingDelete && managedPupilId) {
                load('/pupils/' + encodeURIComponent(managedPupilId), { method: 'DELETE', success: 'Lernprofil aus der Klassenübersicht gelöscht.' });
            }
            else if (button.hasAttribute('data-cell')) { selected = { pupilId: button.dataset.pupil, lessonId: button.dataset.lesson }; render(); }
        }
        function input(event) { if (event.target.name === 'className') className = event.target.value; }
        function change(event) {
            if (event.target.name === 'destinationClass') destinationClassId = event.target.value;
            else if (event.target.matches('[data-class-select]') && matrix && !loading && event.target.value !== matrix.classId) {
                if (!matrix.classes.some(group => group.id === event.target.value)) return;
                load('/classes/active', { method: 'PATCH', body: { classId: event.target.value }, success: 'Klasse ausgewählt. Neue Anmeldungen gehören ab jetzt zu dieser Klasse.' });
            }
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
            clearManagement(); showClassForm = false; className = '';
            focusToRestore = null;
            shell.hidden = true; shell.innerHTML = ''; document.body.classList.remove('learning-leaderboard-active');
        }
        function destroy() {
            close(); destroyed = true; shell.removeEventListener('submit', submit); shell.removeEventListener('click', click);
            shell.removeEventListener('input', input); shell.removeEventListener('change', change);
            document.removeEventListener('visibilitychange', visibility); shell.remove();
        }
        shell.addEventListener('submit', submit); shell.addEventListener('click', click);
        shell.addEventListener('input', input); shell.addEventListener('change', change);
        document.addEventListener('visibilitychange', visibility);
        return { open, close, destroy, refresh, isActive: () => active };
    }
    return { REFRESH_MS, buildMatrix, normalizeMatrix, mount };
}));

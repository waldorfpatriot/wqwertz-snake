/* Fixed learning routes and the endpoint-apple reward lifecycle. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.QwertzLearningReward = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
    'use strict';
    const assets = Object.freeze({ whole: 'assets/learning/apple-whole.svg', 'bite-one': 'assets/learning/apple-one-bite.svg', 'bite-two': 'assets/learning/apple-two-bites.svg', 'apple-top': 'assets/learning/apple-top.svg' });
    const biteOrder = Object.freeze(['bite-one', 'bite-two', 'apple-top']);
    const phases = Object.freeze([...biteOrder, 'celebration']);
    const BITE_MS = 400;
    const CELEBRATION_MS = 1400;
    let serial = 0;

    function buildRoute(targetCount) {
        const numeric = Number(targetCount);
        const totalTargets = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
        const loop = [];
        for (let x = 1; x <= 10; x++) loop.push({ x, y: 9 });
        for (let y = 8; y >= 2; y--) loop.push({ x: 10, y });
        for (let x = 9; x >= 2; x--) loop.push({ x, y: 2 });
        for (let y = 3; y <= 8; y++) loop.push({ x: 2, y });
        loop.push({ x: 1, y: 8 });
        const startIndex = 2;
        const endIndex = startIndex + totalTargets;
        const path = Array.from({ length: endIndex + 1 }, (_, index) => ({ ...loop[index % loop.length] }));
        const apple = { ...path[endIndex] };
        return { path, startIndex, endIndex, totalTargets, apple };
    }

    function progress(route, completedTargets) {
        const numeric = Number(completedTargets);
        const completed = Number.isFinite(numeric) ? Math.max(0, Math.min(route.totalTargets, Math.floor(numeric))) : 0;
        const headIndex = route.startIndex + completed;
        return { completedTargets: completed, headIndex, head: { ...route.path[headIndex] }, apple: { ...route.apple }, atEnd: completed === route.totalTargets };
    }

    function mount({ onFinish = () => {}, onPhase = () => {} } = {}) {
        const document = root.document;
        const overlay = document.createElement('section');
        const titleId = 'learning-reward-title-' + (++serial);
        overlay.className = 'learning-reward-overlay';
        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', titleId);
        const confetti = document.createElement('div');
        confetti.className = 'learning-reward-confetti';
        confetti.setAttribute('aria-hidden', 'true');
        for (let index = 0; index < 28; index++) {
            const piece = document.createElement('span');
            piece.style.cssText = `--confetti-x:${(index * 37 + 9) % 100}%;--confetti-y:${(index * 53 + 12) % 90}%;--confetti-delay:${index % 7 * 45}ms;--confetti-turn:${(index % 2 ? -1 : 1) * (140 + index * 11)}deg;--confetti-color:${['#8dbb71', '#edb847', '#eb9171', '#ad97cf'][index % 4]};`;
            confetti.appendChild(piece);
        }
        const content = document.createElement('div');
        content.className = 'learning-reward-content';
        const icon = document.createElement('div');
        icon.className = 'learning-reward-apple';
        icon.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.src = assets['apple-top'];
        image.alt = '';
        icon.appendChild(image);
        const stars = document.createElement('div');
        stars.className = 'learning-reward-stars';
        stars.textContent = '✦ ★ ✦';
        stars.setAttribute('aria-hidden', 'true');
        const title = document.createElement('h2');
        title.id = titleId;
        const subtitle = document.createElement('p');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'learning-button learning-primary learning-reward-continue';
        button.textContent = 'Weiter →';
        content.appendChild(icon);
        content.appendChild(stars);
        content.appendChild(title);
        content.appendChild(subtitle);
        content.appendChild(button);
        overlay.appendChild(confetti);
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        let active = false;
        let phase = 'idle';
        let run = null;
        let generation = 0;
        let timer = null;
        let startedAt = 0;
        let remainingMs = 0;
        let manuallyPaused = false;
        let blurred = false;
        let previousFocus = null;
        let destroyed = false;
        const now = () => root.Date ? root.Date.now() : Date.now();
        const media = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

        function clearTimer() {
            if (timer != null) root.clearTimeout(timer);
            timer = null;
        }

        function suspended() { return manuallyPaused || blurred || document.hidden; }

        function schedule() {
            clearTimer();
            if (!active || suspended()) return;
            startedAt = now();
            const token = generation;
            timer = root.setTimeout(() => {
                timer = null;
                if (!active || token !== generation || destroyed) return;
                const index = phases.indexOf(phase);
                if (index === phases.length - 1) finish('finished');
                else enterPhase(phases[index + 1]);
            }, remainingMs);
        }

        function restoreFocus() {
            if (previousFocus && previousFocus.isConnected && (document.activeElement === button || overlay.contains(document.activeElement)) &&
                (!previousFocus.getClientRects || previousFocus.getClientRects().length)) previousFocus.focus({ preventScroll: true });
            previousFocus = null;
        }

        function enterPhase(next) {
            if (!active) return;
            phase = next;
            overlay.dataset.phase = phase;
            overlay.hidden = phase !== 'celebration';
            overlay.classList.toggle('learning-reward-reduced-motion', media.matches);
            overlay.classList.toggle('learning-reward-paused', suspended());
            if (phase === 'celebration') {
                title.textContent = run.title || 'Geschafft!';
                subtitle.textContent = run.subtitle || 'Deine Finger werden mit jeder Runde sicherer.';
                button.focus({ preventScroll: true });
            }
            remainingMs = phase === 'celebration' ? CELEBRATION_MS : BITE_MS;
            const token = generation;
            onPhase(phase, { id: run.id, assetKey: phase === 'celebration' ? 'apple-top' : phase, assetUrl: assets[phase === 'celebration' ? 'apple-top' : phase] });
            if (active && generation === token) schedule();
        }

        function cancel() {
            generation++;
            clearTimer();
            active = false;
            overlay.hidden = true;
            phase = 'idle';
            overlay.dataset.phase = phase;
            run = null;
            remainingMs = 0;
            manuallyPaused = false;
            overlay.classList.toggle('learning-reward-paused', false);
            restoreFocus();
        }

        function start(details) {
            if (destroyed) return;
            cancel();
            run = { id: details && details.id || 'reward-' + generation, title: details && details.title, subtitle: details && details.subtitle };
            previousFocus = document.activeElement;
            blurred = false;
            active = true;
            enterPhase(biteOrder[0]);
            return phase;
        }

        function finish(reason) {
            if (!active) return;
            const completed = { id: run.id, reason: reason === 'finished' ? 'finished' : 'skip', lastPhase: phase };
            cancel();
            onFinish(completed);
        }

        function pause() {
            if (!active) return;
            if (timer != null) remainingMs = Math.max(0, remainingMs - (now() - startedAt));
            clearTimer();
        }

        function setPaused(value) {
            if (value) { pause(); manuallyPaused = true; }
            else { manuallyPaused = false; schedule(); }
            overlay.classList.toggle('learning-reward-paused', suspended());
        }

        function visibility() {
            if (document.hidden) pause();
            else schedule();
            overlay.classList.toggle('learning-reward-paused', suspended());
        }
        function blur() { pause(); blurred = true; overlay.classList.toggle('learning-reward-paused', suspended()); }
        function focus() { blurred = false; schedule(); overlay.classList.toggle('learning-reward-paused', suspended()); }
        function trapFocus(event) { if (active && phase === 'celebration' && !overlay.contains(event.target)) button.focus({ preventScroll: true }); }
        function buttonClick() { finish('skip'); }
        button.addEventListener('click', buttonClick);
        document.addEventListener('visibilitychange', visibility);
        document.addEventListener('focusin', trapFocus);
        root.addEventListener('blur', blur);
        root.addEventListener('focus', focus);

        function destroy() {
            cancel(); destroyed = true;
            button.removeEventListener('click', buttonClick);
            document.removeEventListener('visibilitychange', visibility);
            document.removeEventListener('focusin', trapFocus);
            root.removeEventListener('blur', blur);
            root.removeEventListener('focus', focus);
            overlay.remove();
        }

        return { start, finish, cancel, isActive: () => active, getPhase: () => phase, pause: () => setPaused(true), resume: () => setPaused(false), destroy };
    }

    return { assets, biteOrder, phases, BITE_MS, CELEBRATION_MS, buildRoute, progress, geometry: { buildRoute, progress }, mount };
});

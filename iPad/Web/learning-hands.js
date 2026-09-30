/* Articulated, projected hand skeletons. Bone lengths remain fixed in 3D. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.QwertzLearningHands = api;
})(typeof window === 'undefined' ? globalThis : window, function (root) {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const FINGERS = ['finger-pinky', 'finger-ring', 'finger-middle', 'finger-index'];
    const HOMES = { links: ['a', 's', 'd', 'f'], rechts: ['ö', 'l', 'k', 'j'] };
    const NAMES = { 'finger-pinky': 'kleiner Finger', 'finger-ring': 'Ringfinger', 'finger-middle': 'Mittelfinger', 'finger-index': 'Zeigefinger', 'finger-thumb': 'Daumen' };
    const LENGTHS = { 'finger-pinky': [1.01, .70, .56], 'finger-ring': [1.33, .88, .64], 'finger-middle': [1.42, .94, .72], 'finger-index': [1.24, .85, .68], 'finger-thumb': [.95, .83, .65] };
    const BASE_DEPTH = { 'finger-pinky': 1.65, 'finger-ring': 2.20, 'finger-middle': 2.36, 'finger-index': 2.10 };
    const SKEW = .20;
    const point = (x, y, z = 0) => ({ x, y, z });
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
    const project = p => point(p.x, p.y - SKEW * p.z);
    const lerp = (a, b, mix) => a + (b - a) * mix;
    const interpolatePoint = (a, b, mix) => point(lerp(a.x, b.x, mix), lerp(a.y, b.y, mix), lerp(a.z || 0, b.z || 0, mix));
    const smooth = value => value * value * (3 - 2 * value);
    const rounded = value => Math.round(value * 1000) / 1000;

    function mappingFor(fingerMap, key) {
        if (key === ' ') return { finger: 'finger-thumb', hand: 'rechts' };
        if (key === 'backspace') return { finger: 'finger-pinky', hand: 'rechts' };
        return fingerMap[key];
    }

    function foldedVector(lengths, bend, coupling) {
        const angles = [0, bend, bend * (1 + coupling)];
        return { x: lengths.reduce((sum, length, index) => sum + length * Math.cos(angles[index]), 0),
            z: lengths.reduce((sum, length, index) => sum + length * Math.sin(angles[index]), 0) };
    }

    function solveChain(base, target, lengths, thumb) {
        const dx = target.x - base.x;
        const dy = target.y - base.y;
        const planar = Math.hypot(dx, dy);
        const dz = (target.z || 0) - base.z;
        const needed = Math.hypot(planar, dz);
        const coupling = thumb ? .56 : .62;
        let low = 0;
        let high = 2.15;
        // PIP/IP flexion shortens the projected reach; no bone is scaled.
        for (let iteration = 0; iteration < 48; iteration++) {
            const bend = (low + high) / 2;
            const vector = foldedVector(lengths, bend, coupling);
            if (Math.hypot(vector.x, vector.z) > needed) low = bend;
            else high = bend;
        }
        const bend = (low + high) / 2;
        const folded = foldedVector(lengths, bend, coupling);
        const firstAngle = Math.atan2(dz, planar) + Math.atan2(folded.z, folded.x);
        const angles = [firstAngle, firstAngle - bend, firstAngle - bend * (1 + coupling)];
        const ux = planar > .0001 ? dx / planar : 0;
        const uy = planar > .0001 ? dy / planar : -1;
        const joints = [{ ...base }];
        lengths.forEach((length, index) => {
            const previous = joints[joints.length - 1];
            const along = length * Math.cos(angles[index]);
            joints.push(point(previous.x + ux * along, previous.y + uy * along, previous.z + length * Math.sin(angles[index])));
        });
        return { joints, projected: joints.map(project), lengths: lengths.slice(), segmentLengths: lengths.map((_, index) => distance(joints[index], joints[index + 1])),
            angles: { mcp: firstAngle, pip: bend, dip: bend * coupling, splay: Math.atan2(dx, -dy) }, error: distance(joints[3], target) };
    }

    function normalizeKeys(rects) {
        return Object.fromEntries(Object.entries(rects).map(([key, rect]) => [key, { x: Number(rect.x), y: Number(rect.y), width: Number(rect.width) || 30, height: Number(rect.height) || 36 }]));
    }

    function makeLayout(rects, width, height) {
        const keys = normalizeKeys(rects);
        if (!keys.a || !keys.f || !keys.j || !keys['ö'] || !keys[' ']) return null;
        const pitch = Math.max(14, Math.abs(keys.s ? keys.s.x - keys.a.x : (keys.f.x - keys.a.x) / 3));
        const hands = {};
        for (const hand of ['links', 'rechts']) {
            const sign = hand === 'links' ? 1 : -1;
            const fingers = {};
            FINGERS.forEach((finger, index) => {
                const homeKey = HOMES[hand][index];
                const home = keys[homeKey];
                const shift = finger === 'finger-pinky' ? .20 : finger === 'finger-ring' ? .06 : finger === 'finger-index' ? -.08 : 0;
                const height3D = pitch * .36;
                const base = point(home.x + sign * shift * pitch, home.y + BASE_DEPTH[finger] * pitch + SKEW * height3D, height3D);
                fingers[finger] = { homeKey, base, tip: point(home.x, home.y), lengths: LENGTHS[finger].map(length => length * pitch), width: pitch * (finger === 'finger-pinky' ? .43 : .55) };
            });
            const index = keys[hand === 'links' ? 'f' : 'j'];
            const space = keys[' '];
            const thumbTipX = Math.max(space.x - space.width / 2 + 12, Math.min(space.x + space.width / 2 - 12, index.x + sign * pitch * 1.20));
            const baseHeight = pitch * .36;
            fingers['finger-thumb'] = { homeKey: ' ', base: point(index.x + sign * .22 * pitch, index.y + 2.96 * pitch + SKEW * baseHeight, baseHeight),
                tip: point(thumbTipX, space.y), lengths: LENGTHS['finger-thumb'].map(length => length * pitch), width: pitch * .61 };
            hands[hand] = { hand, sign, fingers, homeY: index.y, pitch };
        }
        return { keys, width: width || 600, height: height || 190, pitch, hands };
    }

    function makeRig(layout, fingerMap, expectedKey) {
        const mapping = mappingFor(fingerMap, expectedKey);
        const target = layout.keys[expectedKey];
        const rig = {};
        for (const hand of ['links', 'rechts']) {
            const shape = layout.hands[hand];
            const offset = point(0, 0);
            if (target && mapping && mapping.hand === hand && shape.fingers[mapping.finger]) {
                const finger = shape.fingers[mapping.finger];
                const radial = Math.hypot(target.x - finger.base.x, target.y - finger.base.y);
                const maximum = Math.sqrt(Math.max(0, Math.pow(finger.lengths.reduce((sum, value) => sum + value, 0) * .985, 2) - finger.base.z * finger.base.z));
                if (radial > maximum) {
                    const move = radial - maximum;
                    offset.x = (target.x - finger.base.x) / radial * move;
                    offset.y = (target.y - finger.base.y) / radial * move;
                }
            }
            rig[hand] = { offset, tips: Object.fromEntries(Object.entries(shape.fingers).map(([finger, data]) => [finger,
                target && mapping && mapping.hand === hand && mapping.finger === finger ? point(target.x, target.y) : { ...data.tip }])) };
        }
        return rig;
    }

    function interpolateRig(from, to, mix) {
        return Object.fromEntries(['links', 'rechts'].map(hand => [hand, {
            offset: interpolatePoint(from[hand].offset, to[hand].offset, mix),
            tips: Object.fromEntries(Object.keys(from[hand].tips).map(finger => [finger, interpolatePoint(from[hand].tips[finger], to[hand].tips[finger], mix)]))
        }]));
    }

    function solveRig(layout, rig) {
        return Object.fromEntries(['links', 'rechts'].map(hand => [hand, Object.fromEntries(Object.entries(layout.hands[hand].fingers).map(([finger, definition]) => {
            const offset = rig[hand].offset;
            const base = point(definition.base.x + offset.x, definition.base.y + offset.y, definition.base.z);
            return [finger, { ...solveChain(base, rig[hand].tips[finger], definition.lengths, finger === 'finger-thumb'), width: definition.width }];
        }))]));
    }

    function poseForKeys(rects, fingerMap, expectedKey, dimensions) {
        const layout = makeLayout(rects, dimensions && dimensions.width, dimensions && dimensions.height);
        if (!layout) return null;
        const rig = makeRig(layout, fingerMap, expectedKey);
        return { layout, rig, hands: solveRig(layout, rig) };
    }

    function mount({ keyboard, fingerMap = {} }) {
        const document = keyboard.ownerDocument || root.document;
        const svg = document.createElementNS(NS, 'svg');
        const caption = document.createElement('div');
        svg.setAttribute('class', 'learning-hands-overlay');
        svg.setAttribute('data-learning-hands', '');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;display:none;';
        caption.className = 'learning-hands-caption';
        caption.hidden = true;
        caption.setAttribute('role', 'status');
        caption.setAttribute('aria-live', 'polite');
        keyboard.appendChild(svg);
        keyboard.insertAdjacentElement('afterend', caption);
        let layoutData = null;
        let currentRig = null;
        let active = false;
        let destroyed = false;
        let frameId = null;
        let layoutFrame = null;
        let animation = null;
        let settings = { expectedKey: null, showHint: true, paused: false, targetToken: null, pressedKey: null };
        let previousToken = null;
        const media = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
        let nodes = null;

        function element(name, attrs, parent) {
            const node = document.createElementNS(NS, name);
            Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
            if (parent) parent.appendChild(node);
            return node;
        }

        function createNodes() {
            svg.replaceChildren();
            // Draw continuous translucent hands above the keys, including their letters.
            const body = element('g', {}, svg);
            const hands = {};
            for (const hand of ['links', 'rechts']) {
                const group = element('g', { 'data-hand': hand }, body);
                const wrist = element('path', { fill: '#e0b58b', 'fill-opacity': .17, stroke: '#806548', 'stroke-opacity': .35, 'stroke-width': 1.1 }, group);
                const palm = element('path', { fill: '#e5ba92', 'fill-opacity': .22, stroke: '#806548', 'stroke-opacity': .35, 'stroke-width': 1.2 }, group);
                const palmCrease = element('path', { fill: 'none', stroke: '#806548', 'stroke-opacity': .22, 'stroke-width': 1 }, group);
                const fingers = {};
                for (const finger of FINGERS.concat('finger-thumb')) {
                    const digit = element('g', { 'data-finger': finger, 'data-joint-order': finger === 'finger-thumb' ? 'CMC MCP IP tip' : 'MCP PIP DIP tip', 'data-phalanges': finger === 'finger-thumb' ? 2 : 3 }, group);
                    const bones = [0, 1, 2].map(index => element('path', { fill: 'none', stroke: '#e5ba92', 'stroke-opacity': finger === 'finger-thumb' && index === 0 ? .14 : .30, 'stroke-linecap': 'round' }, digit));
                    const outlines = [0, 1, 2].map(index => element('path', { fill: 'none', stroke: '#83684d', 'stroke-opacity': finger === 'finger-thumb' && index === 0 ? .10 : .35, 'stroke-linecap': 'round', 'stroke-width': .8 }, digit));
                    const joints = [0, 1, 2].map(index => element('circle', { 'data-joint': finger === 'finger-thumb' ? ['CMC', 'MCP', 'IP'][index] : ['MCP', 'PIP', 'DIP'][index], fill: '#d9aa80', 'fill-opacity': .13, stroke: '#806548', 'stroke-opacity': .25, 'stroke-width': .8 }, digit));
                    const creases = [1, 2].map(() => element('path', { fill: 'none', stroke: '#785c45', 'stroke-opacity': .38, 'stroke-width': .85, 'stroke-linecap': 'round' }, digit));
                    const nail = element('ellipse', { fill: '#fff8ed', 'fill-opacity': .20, stroke: '#9f7c65', 'stroke-opacity': .28, 'stroke-width': .8 }, digit);
                    fingers[finger] = { group: digit, bones, outlines, joints, creases, nail };
                }
                hands[hand] = { group, wrist, palm, palmCrease, fingers };
            }
            const targetRing = element('circle', { fill: 'none', stroke: '#24865b', 'stroke-width': 2.2, 'stroke-opacity': .95, 'stroke-dasharray': '3 3' }, svg);
            nodes = { hands, targetRing };
        }

        function measure() {
            const bounds = keyboard.getBoundingClientRect();
            if (bounds.width < 1 || bounds.height < 1) return null;
            const keys = {};
            keyboard.querySelectorAll('[data-key]').forEach(key => {
                const rect = key.getBoundingClientRect();
                keys[key.dataset.key] = { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2, width: rect.width, height: rect.height };
            });
            return makeLayout(keys, bounds.width, bounds.height);
        }

        function cancelAnimation() {
            if (frameId != null) root.cancelAnimationFrame(frameId);
            frameId = null;
            animation = null;
        }

        function captionText() {
            if (settings.paused) return 'Pause · Die Hände ruhen in der Grundstellung.';
            if (!settings.showHint || !settings.expectedKey) return '';
            if (settings.expectedKey === ' ') return 'Rechter Daumen · Leertaste. Der linke Daumen darf ruhen.';
            const mapping = mappingFor(fingerMap, settings.expectedKey);
            if (!mapping) return '';
            const label = settings.expectedKey === 'backspace' ? 'Löschen (⌫)' : settings.expectedKey.toUpperCase();
            return `${mapping.hand === 'links' ? 'Linker' : 'Rechter'} ${NAMES[mapping.finger]} · ${label}. Danach zurück zur Grundreihe.`;
        }

        function palmPaths(hand, rig) {
            const shape = layoutData.hands[hand];
            const pitch = shape.pitch;
            const offset = rig[hand].offset;
            const base = finger => project(point(shape.fingers[finger].base.x + offset.x, shape.fingers[finger].base.y + offset.y, shape.fingers[finger].base.z));
            const knuckles = FINGERS.map(base);
            const thumb = base('finger-thumb');
            const centerX = (knuckles[0].x + knuckles[3].x) / 2;
            const wristY = shape.homeY + 4.05 * pitch + offset.y;
            const outer = knuckles[0];
            const inner = knuckles[3];
            const sign = shape.sign;
            const first = point(outer.x - sign * pitch * .22, outer.y - pitch * .12);
            const wristOuter = point(centerX - sign * pitch * .64, wristY);
            const wristInner = point(centerX + sign * pitch * .66, wristY);
            const path = `M ${first.x} ${first.y} Q ${knuckles[0].x} ${knuckles[0].y - pitch * .35} ${knuckles[1].x} ${knuckles[1].y - pitch * .12} Q ${knuckles[2].x} ${knuckles[2].y - pitch * .25} ${inner.x + sign * pitch * .25} ${inner.y} C ${inner.x + sign * pitch * .68} ${inner.y + pitch * .5} ${thumb.x + sign * pitch * .45} ${thumb.y + pitch * .1} ${wristInner.x} ${wristInner.y} Q ${centerX} ${wristY + pitch * .15} ${wristOuter.x} ${wristOuter.y} C ${outer.x - sign * pitch * .4} ${wristY - pitch * .35} ${outer.x - sign * pitch * .55} ${outer.y + pitch * .4} ${first.x} ${first.y} Z`;
            const wrist = `M ${wristOuter.x} ${wristOuter.y - 1} L ${wristInner.x} ${wristInner.y - 1} L ${wristInner.x + sign * pitch * .12} ${wristY + pitch * .45} Q ${centerX} ${wristY + pitch * .6} ${wristOuter.x - sign * pitch * .12} ${wristY + pitch * .45} Z`;
            const crease = `M ${outer.x + sign * pitch * .2} ${outer.y + pitch * .6} Q ${centerX} ${shape.homeY + 2.75 * pitch + offset.y} ${inner.x} ${inner.y + pitch * .55} M ${thumb.x} ${thumb.y - pitch * .45} Q ${thumb.x - sign * pitch * .35} ${thumb.y} ${wristInner.x - sign * pitch * .2} ${wristY - pitch * .3}`;
            return { path, wrist, crease };
        }

        function draw(rig, phase) {
            if (!active || !layoutData || !nodes) return;
            currentRig = rig;
            const solved = solveRig(layoutData, rig);
            const mapping = mappingFor(fingerMap, settings.expectedKey);
            const highlighted = settings.showHint && !settings.paused && mapping;
            for (const hand of ['links', 'rechts']) {
                const palm = palmPaths(hand, rig);
                const handNodes = nodes.hands[hand];
                handNodes.palm.setAttribute('d', palm.path);
                handNodes.wrist.setAttribute('d', palm.wrist);
                handNodes.palmCrease.setAttribute('d', palm.crease);
                for (const [finger, data] of Object.entries(solved[hand])) {
                    const fingerNodes = handNodes.fingers[finger];
                    const selected = Boolean(highlighted && mapping.hand === hand && mapping.finger === finger);
                    const projected = data.projected;
                    fingerNodes.group.setAttribute('data-active', selected ? 'true' : 'false');
                    fingerNodes.group.setAttribute('data-tip-x', rounded(projected[3].x));
                    fingerNodes.group.setAttribute('data-tip-y', rounded(projected[3].y));
                    fingerNodes.group.setAttribute('data-bone-lengths', JSON.stringify(data.lengths.map(rounded)));
                    fingerNodes.group.setAttribute('data-measured-bone-lengths', JSON.stringify(data.segmentLengths.map(rounded)));
                    fingerNodes.group.setAttribute('data-joints-3d', JSON.stringify(data.joints.map(joint => ({ x: rounded(joint.x), y: rounded(joint.y), z: rounded(joint.z) }))));
                    fingerNodes.group.setAttribute('data-flexion', JSON.stringify({ mcp: rounded(data.angles.mcp), pip: rounded(data.angles.pip), dip: rounded(data.angles.dip) }));
                    [0, 1, 2].forEach(index => {
                        const a = projected[index];
                        const b = projected[index + 1];
                        const width = data.width * [1, .96, .84][index];
                        const path = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
                        fingerNodes.bones[index].setAttribute('d', path);
                        fingerNodes.bones[index].setAttribute('stroke-width', width);
                        fingerNodes.bones[index].setAttribute('stroke', selected ? '#a4cea8' : '#e5ba92');
                        const angle = Math.atan2(b.y - a.y, b.x - a.x);
                        const nx = Math.sin(angle) * width / 2;
                        const ny = -Math.cos(angle) * width / 2;
                        fingerNodes.outlines[index].setAttribute('d', `M ${a.x + nx} ${a.y + ny} L ${b.x + nx} ${b.y + ny} M ${a.x - nx} ${a.y - ny} L ${b.x - nx} ${b.y - ny}`);
                        fingerNodes.joints[index].setAttribute('cx', a.x);
                        fingerNodes.joints[index].setAttribute('cy', a.y);
                        fingerNodes.joints[index].setAttribute('r', width * .37);
                        fingerNodes.joints[index].setAttribute('fill', selected ? '#78aa81' : '#d9aa80');
                        if (index > 0) {
                            const x = nx * .62;
                            const y = ny * .62;
                            fingerNodes.creases[index - 1].setAttribute('d', `M ${a.x - x} ${a.y - y} Q ${a.x + Math.cos(angle) * 1.5} ${a.y + Math.sin(angle) * 1.5} ${a.x + x} ${a.y + y}`);
                        }
                    });
                    const dip = projected[2];
                    const tip = projected[3];
                    const nailX = lerp(dip.x, tip.x, .64);
                    const nailY = lerp(dip.y, tip.y, .64);
                    fingerNodes.nail.setAttribute('cx', nailX);
                    fingerNodes.nail.setAttribute('cy', nailY);
                    fingerNodes.nail.setAttribute('rx', data.width * .25);
                    fingerNodes.nail.setAttribute('ry', Math.max(2.4, Math.min(data.width * .42, Math.hypot(tip.x - dip.x, tip.y - dip.y) * .22)));
                    fingerNodes.nail.setAttribute('transform', `rotate(${Math.atan2(tip.y - dip.y, tip.x - dip.x) * 180 / Math.PI + 90} ${nailX} ${nailY})`);
                }
            }
            const target = layoutData.keys[settings.expectedKey];
            const activeFinger = mapping && solved[mapping.hand] && solved[mapping.hand][mapping.finger];
            const tip = activeFinger && activeFinger.projected[3];
            const ring = nodes.targetRing;
            ring.setAttribute('visibility', target && highlighted ? 'visible' : 'hidden');
            if (target) {
                ring.setAttribute('cx', target.x); ring.setAttribute('cy', target.y);
                ring.setAttribute('r', Math.max(6, Math.min(target.width, target.height) * .43));
                svg.setAttribute('data-target-x', rounded(target.x)); svg.setAttribute('data-target-y', rounded(target.y));
                svg.setAttribute('data-key-left', rounded(target.x - target.width / 2)); svg.setAttribute('data-key-right', rounded(target.x + target.width / 2));
                svg.setAttribute('data-key-top', rounded(target.y - target.height / 2)); svg.setAttribute('data-key-bottom', rounded(target.y + target.height / 2));
            }
            if (tip && target) {
                svg.setAttribute('data-fingertip-x', rounded(tip.x)); svg.setAttribute('data-fingertip-y', rounded(tip.y));
                svg.setAttribute('data-target-distance', rounded(Math.hypot(tip.x - target.x, tip.y - target.y)));
                svg.setAttribute('data-bone-lengths', JSON.stringify(activeFinger.lengths.map(rounded)));
                svg.setAttribute('data-measured-bone-lengths', JSON.stringify(activeFinger.segmentLengths.map(rounded)));
            }
            svg.setAttribute('data-target-key', settings.expectedKey || '');
            svg.setAttribute('data-active-hand', mapping ? mapping.hand : '');
            svg.setAttribute('data-active-finger', mapping ? mapping.finger : '');
            svg.setAttribute('data-reach-phase', phase || 'rest');
            svg.setAttribute('data-paused', settings.paused ? 'true' : 'false');
            svg.setAttribute('data-target-token', settings.targetToken == null ? '' : String(settings.targetToken));
            svg.setAttribute('opacity', settings.showHint ? '1' : '.32');
        }

        function animateToTarget() {
            cancelAnimation();
            if (!layoutData || !active) return;
            const home = makeRig(layoutData, fingerMap, null);
            const target = makeRig(layoutData, fingerMap, settings.showHint && !settings.paused ? settings.expectedKey : null);
            if (media.matches || settings.paused || !settings.showHint) { draw(target, settings.paused ? 'paused' : settings.showHint ? 'reached' : 'rest'); return; }
            animation = { from: currentRig || home, home, target, started: null };
            function frame(timestamp) {
                frameId = null;
                if (!active || destroyed || !animation) return;
                if (animation.started == null) animation.started = timestamp;
                const elapsed = timestamp - animation.started;
                const returning = elapsed < 130;
                const mix = smooth(Math.min(1, returning ? elapsed / 130 : (elapsed - 130) / 330));
                const rig = returning ? interpolateRig(animation.from, animation.home, mix) : interpolateRig(animation.home, animation.target, mix);
                draw(rig, returning ? 'returning' : mix >= 1 ? 'reached' : 'reaching');
                if (elapsed < 460) frameId = root.requestAnimationFrame(frame);
                else animation = null;
            }
            frameId = root.requestAnimationFrame(frame);
        }

        function layout() {
            if (destroyed) return null;
            const measured = measure();
            if (!measured) return null;
            const sameGeometry = layoutData && nodes && Math.abs(layoutData.width - measured.width) < .2 && Math.abs(layoutData.height - measured.height) < .2 &&
                Object.keys(measured.keys).length === Object.keys(layoutData.keys).length && Object.entries(measured.keys).every(([key, next]) => {
                    const previous = layoutData.keys[key];
                    return previous && ['x', 'y', 'width', 'height'].every(axis => Math.abs(previous[axis] - next[axis]) < .2);
                });
            // Highlight classes change every answer. They must not cancel a reach animation.
            if (sameGeometry) return getState();
            cancelAnimation();
            layoutData = measured;
            svg.setAttribute('viewBox', `0 0 ${layoutData.width} ${layoutData.height}`);
            createNodes();
            currentRig = makeRig(layoutData, fingerMap, settings.showHint && !settings.paused ? settings.expectedKey : null);
            if (active) draw(currentRig, settings.paused ? 'paused' : settings.showHint ? 'reached' : 'rest');
            return getState();
        }

        function scheduleLayout(records) {
            if (destroyed || !active || layoutFrame != null) return;
            if (records && records.length && records.every(record => record.target === svg || svg.contains(record.target))) return;
            layoutFrame = root.requestAnimationFrame(() => { layoutFrame = null; layout(); });
        }

        function update(next) {
            if (destroyed) return;
            const previous = settings;
            settings = { ...settings, ...next };
            const keyChanged = settings.expectedKey !== previous.expectedKey;
            const tokenChanged = settings.targetToken !== previousToken;
            const hintChanged = settings.showHint !== previous.showHint;
            const pauseChanged = settings.paused !== previous.paused;
            previousToken = settings.targetToken;
            const wasActive = active;
            active = true;
            svg.style.display = 'block';
            const text = captionText();
            if (caption.textContent !== text) caption.textContent = text;
            caption.hidden = !text;
            if (!layoutData || !wasActive) {
                layout();
                if (layoutData) currentRig = makeRig(layoutData, fingerMap, null);
            }
            if (keyChanged || tokenChanged || hintChanged || pauseChanged || !wasActive) animateToTarget();
            return getState();
        }

        function hide() {
            cancelAnimation();
            if (layoutFrame != null) root.cancelAnimationFrame(layoutFrame);
            layoutFrame = null;
            active = false;
            svg.style.display = 'none';
            svg.setAttribute('data-reach-phase', 'hidden');
            caption.hidden = true;
        }

        function getState() {
            return { active, paused: settings.paused, expectedKey: settings.expectedKey, phase: svg.getAttribute('data-reach-phase'),
                target: layoutData && layoutData.keys[settings.expectedKey] ? { ...layoutData.keys[settings.expectedKey] } : null,
                fingertip: svg.hasAttribute('data-fingertip-x') ? { x: Number(svg.getAttribute('data-fingertip-x')), y: Number(svg.getAttribute('data-fingertip-y')) } : null,
                targetDistance: svg.hasAttribute('data-target-distance') ? Number(svg.getAttribute('data-target-distance')) : null,
                boneLengths: svg.hasAttribute('data-bone-lengths') ? JSON.parse(svg.getAttribute('data-bone-lengths')) : [],
                measuredBoneLengths: svg.hasAttribute('data-measured-bone-lengths') ? JSON.parse(svg.getAttribute('data-measured-bone-lengths')) : [], animationPending: frameId != null, layoutPending: layoutFrame != null };
        }

        const resizeObserver = root.ResizeObserver ? new root.ResizeObserver(() => scheduleLayout()) : null;
        if (resizeObserver) resizeObserver.observe(keyboard);
        const mutationObserver = root.MutationObserver ? new root.MutationObserver(scheduleLayout) : null;
        if (mutationObserver) mutationObserver.observe(keyboard, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-key'] });
        keyboard.addEventListener('scroll', scheduleLayout);
        root.addEventListener('resize', scheduleLayout);
        if (root.visualViewport) root.visualViewport.addEventListener('resize', scheduleLayout);
        function motionChanged() { if (active) animateToTarget(); }
        if (media.addEventListener) media.addEventListener('change', motionChanged);

        function destroy() {
            hide(); destroyed = true;
            if (resizeObserver) resizeObserver.disconnect();
            if (mutationObserver) mutationObserver.disconnect();
            keyboard.removeEventListener('scroll', scheduleLayout);
            root.removeEventListener('resize', scheduleLayout);
            if (root.visualViewport) root.visualViewport.removeEventListener('resize', scheduleLayout);
            if (media.removeEventListener) media.removeEventListener('change', motionChanged);
            svg.remove(); caption.remove();
        }

        return { update, hide, destroy, layout, getState };
    }

    return { mount, geometry: { poseForKeys, solveChain, distance, project } };
});

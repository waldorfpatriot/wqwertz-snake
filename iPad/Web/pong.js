const PONG_WIDTH = 640;
const PONG_HEIGHT = 420;
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 88;
const PADDLE_MARGIN = 28;
const PADDLE_SPEED = 360;
const BALL_RADIUS = 7;
const BALL_START_SPEED = 245;
const BALL_MAX_SPEED = 520;
const BALL_SPEEDUP = 1.035;
const WINNING_SCORE = 11;
const PRESSES_PER_CHANGE = 50;
const KEY_CHANGES_BEFORE_FORCE_PROGRESSION = 4;
const CENTER_KEY_CHANGE_BAND = 18;

const KEYBOARD_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
    ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
    [' ']
];

const FINGER_MAP = {
    q: { finger: 'finger-pinky', hand: 'links' },
    a: { finger: 'finger-pinky', hand: 'links' },
    y: { finger: 'finger-pinky', hand: 'links' },
    w: { finger: 'finger-ring', hand: 'links' },
    s: { finger: 'finger-ring', hand: 'links' },
    x: { finger: 'finger-ring', hand: 'links' },
    e: { finger: 'finger-middle', hand: 'links' },
    d: { finger: 'finger-middle', hand: 'links' },
    c: { finger: 'finger-middle', hand: 'links' },
    r: { finger: 'finger-index', hand: 'links' },
    f: { finger: 'finger-index', hand: 'links' },
    v: { finger: 'finger-index', hand: 'links' },
    t: { finger: 'finger-index', hand: 'links' },
    g: { finger: 'finger-index', hand: 'links' },
    b: { finger: 'finger-index', hand: 'links' },
    p: { finger: 'finger-pinky', hand: 'rechts' },
    ü: { finger: 'finger-pinky', hand: 'rechts' },
    ö: { finger: 'finger-pinky', hand: 'rechts' },
    ä: { finger: 'finger-pinky', hand: 'rechts' },
    '-': { finger: 'finger-pinky', hand: 'rechts' },
    o: { finger: 'finger-ring', hand: 'rechts' },
    l: { finger: 'finger-ring', hand: 'rechts' },
    '.': { finger: 'finger-ring', hand: 'rechts' },
    i: { finger: 'finger-middle', hand: 'rechts' },
    k: { finger: 'finger-middle', hand: 'rechts' },
    ',': { finger: 'finger-middle', hand: 'rechts' },
    z: { finger: 'finger-index', hand: 'rechts' },
    h: { finger: 'finger-index', hand: 'rechts' },
    n: { finger: 'finger-index', hand: 'rechts' },
    u: { finger: 'finger-index', hand: 'rechts' },
    j: { finger: 'finger-index', hand: 'rechts' },
    m: { finger: 'finger-index', hand: 'rechts' }
};

const FINGER_NAMES = {
    'finger-pinky': 'Kleiner',
    'finger-ring': 'Ring',
    'finger-middle': 'Mittel',
    'finger-index': 'Zeige'
};

const KEY_POOLS = {
    leftUp: ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g'],
    leftDown: ['y', 'x', 'c', 'v', 'b'],
    rightUp: ['z', 'u', 'i', 'o', 'p', 'ü', 'h', 'j', 'k', 'l', 'ö', 'ä'],
    rightDown: ['n', 'm', ',', '.', '-']
};

const CONTROL_META = {
    leftUp: { label: 'LINKS HOCH', arrow: '↑', owner: 'left-player' },
    leftDown: { label: 'LINKS RUNTER', arrow: '↓', owner: 'left-player' },
    rightUp: { label: 'RECHTS HOCH', arrow: '↑', owner: 'right-player' },
    rightDown: { label: 'RECHTS RUNTER', arrow: '↓', owner: 'right-player' }
};

let canvas;
let ctx;
let virtualKeyboardElement;
let overlayElement;
let overlayTitleElement;
let overlayMessageElement;
let overlayStatsElement;
let restartButton;
let keyChangeModal;
let keyChangeDirection;
let keyChangeFingerName;
let leftScoreElement;
let rightScoreElement;
let rallyElement;
let kpmElement;
let counterElements = {};
let keyElements = {};

let gameRunning = false;
let gamePaused = false;
let gameLoop = 0;
let lastFrameTime = 0;
let gameStartTime = 0;
let totalKeystrokes = 0;
let keySequence = '';
let keyChangeModalVisible = false;
let pendingKeyConfirmation = null;
let keyChangeStartedAt = null;
let pausedBeforeKeyChange = false;
let keysHeld = new Set();
let pendingKeyChanges = new Set();

let controlKeys = {
    leftUp: 'r',
    leftDown: 'v',
    rightUp: 'u',
    rightDown: 'm'
};

let keyPressCounters = {
    leftUp: 0,
    leftDown: 0,
    rightUp: 0,
    rightDown: 0
};

let directionIndices = {
    leftUp: 0,
    leftDown: 0,
    rightUp: 0,
    rightDown: 0
};

let keyChangeCounts = {
    leftUp: 0,
    leftDown: 0,
    rightUp: 0,
    rightDown: 0
};

let fingerUsage = {
    'finger-pinky': 0,
    'finger-ring': 0,
    'finger-middle': 0,
    'finger-index': 0
};

let state = createInitialState();
let lastGameSummary = null;

function getFingerClass(key) {
    const mapping = FINGER_MAP[key];
    return mapping ? mapping.finger : '';
}

function getFingerHand(key) {
    const mapping = FINGER_MAP[key];
    return mapping ? mapping.hand : '';
}

function displayKey(key) {
    if (key === ' ') return 'SPACE';
    return key.length === 1 && /[a-zäöü]/.test(key) ? key.toUpperCase() : key;
}

async function loadKeySequence() {
    try {
        const response = await fetch('key_sequence.txt');
        const text = await response.text();
        keySequence = text.split('\n').filter(line => line.trim()).join('');
    } catch (error) {
        keySequence = KEYBOARD_ROWS.flat().join('');
    }
}

function createInitialState() {
    return {
        leftPaddle: {
            x: PADDLE_MARGIN,
            y: PONG_HEIGHT / 2 - PADDLE_HEIGHT / 2,
            score: 0
        },
        rightPaddle: {
            x: PONG_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH,
            y: PONG_HEIGHT / 2 - PADDLE_HEIGHT / 2,
            score: 0
        },
        ball: {
            x: PADDLE_MARGIN + PADDLE_WIDTH + BALL_RADIUS + 28,
            y: PONG_HEIGHT / 2,
            vx: BALL_START_SPEED,
            vy: BALL_START_SPEED * 0.25,
            speed: BALL_START_SPEED,
            radius: BALL_RADIUS
        },
        rally: 0,
        lastHitSide: null,
        flashSide: null,
        flashUntil: 0,
        scoreFlashSide: null,
        scoreFlashUntil: 0
    };
}

function renderKeyboard() {
    virtualKeyboardElement.innerHTML = '';
    keyElements = {};

    const separatorPositions = {
        0: 4,
        1: 4,
        2: 4
    };

    KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'keyboard-row';
        if (rowIndex === 0) {
            rowElement.classList.add('keyboard-row-top');
        }

        row.forEach((key, keyIndex) => {
            if (separatorPositions[rowIndex] !== undefined && keyIndex === separatorPositions[rowIndex] + 1) {
                const separator = document.createElement('div');
                separator.className = 'keyboard-separator';
                rowElement.appendChild(separator);
            }

            const keyElement = document.createElement('div');
            if (key === ' ') {
                keyElement.className = 'keyboard-key keyboard-space';
                keyElement.textContent = 'PLAY / PAUSE';
            } else {
                keyElement.className = `keyboard-key ${getFingerClass(key)}`;
                keyElement.textContent = displayKey(key);
            }
            keyElement.dataset.key = key;
            keyElements[key] = keyElement;
            rowElement.appendChild(keyElement);
        });

        virtualKeyboardElement.appendChild(rowElement);
    });

    updateKeyboardDisplay();
}

function renderTitleScreenKeyboard() {
    const titleKeyboardElement = document.getElementById('titleScreenKeyboard');
    if (!titleKeyboardElement) return;

    titleKeyboardElement.innerHTML = '';

    const separatorPositions = {
        0: 4,
        1: 4,
        2: 4
    };

    KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'title-keyboard-row';
        if (rowIndex === 0) {
            rowElement.classList.add('title-keyboard-row-top');
        }

        row.forEach((key, keyIndex) => {
            if (separatorPositions[rowIndex] !== undefined && keyIndex === separatorPositions[rowIndex] + 1) {
                const separator = document.createElement('div');
                separator.className = 'keyboard-separator title-keyboard-separator';
                rowElement.appendChild(separator);
            }

            const keyElement = document.createElement('div');
            if (key === ' ') {
                keyElement.className = 'title-keyboard-key title-keyboard-space';
                keyElement.textContent = 'SPACE';
            } else {
                keyElement.className = `title-keyboard-key ${getFingerClass(key)}`;
                keyElement.textContent = displayKey(key);
            }

            if (Object.values(controlKeys).includes(key)) {
                keyElement.classList.add('pulse-hint');
            }

            rowElement.appendChild(keyElement);
        });

        titleKeyboardElement.appendChild(rowElement);
    });
}

function updateKeyboardDisplay() {
    Object.values(keyElements).forEach(el => {
        el.classList.remove('active-control', 'left-player', 'right-player', 'active');
        el.removeAttribute('data-direction');
        el.removeAttribute('data-arrow');
        el.removeAttribute('data-owner');
    });

    Object.keys(controlKeys).forEach(direction => {
        const key = controlKeys[direction];
        const element = keyElements[key];
        const meta = CONTROL_META[direction];
        if (!element || !meta) return;
        element.classList.add('active-control', meta.owner);
        element.setAttribute('data-direction', direction);
        element.setAttribute('data-arrow', meta.arrow);
        element.setAttribute('data-owner', meta.owner === 'left-player' ? 'L' : 'R');
    });
}

function updateCounters() {
    Object.keys(keyPressCounters).forEach(direction => {
        if (counterElements[direction]) {
            const count = Math.min(keyPressCounters[direction], PRESSES_PER_CHANGE);
            counterElements[direction].textContent = `${count}/${PRESSES_PER_CHANGE}`;
        }
    });
}

function updateScoreDisplay() {
    leftScoreElement.textContent = state.leftPaddle.score;
    rightScoreElement.textContent = state.rightPaddle.score;
    rallyElement.textContent = state.rally;
}

function flashScore(side) {
    const element = side === 'left' ? leftScoreElement : rightScoreElement;
    state.scoreFlashSide = side;
    state.scoreFlashUntil = performance.now() + 650;

    element.classList.remove('pong-score-flash');
    void element.offsetWidth;
    element.classList.add('pong-score-flash');

    setTimeout(() => {
        element.classList.remove('pong-score-flash');
    }, 650);
}

function updateKPMDisplay() {
    if (!gameRunning || gamePaused || !gameStartTime) return;
    const elapsedMinutes = (Date.now() - gameStartTime) / 60000;
    const kpm = elapsedMinutes > 0 ? Math.round(totalKeystrokes / elapsedMinutes) : 0;
    kpmElement.textContent = kpm;
}

function filterSequenceByFingerOrder(sequence, keyPool) {
    const fingerOrder = ['finger-index', 'finger-ring', 'finger-middle', 'finger-pinky'];
    const keysByFinger = {
        'finger-index': [],
        'finger-ring': [],
        'finger-middle': [],
        'finger-pinky': []
    };
    const seenKeys = new Set();

    for (const key of sequence) {
        if (!keyPool.includes(key) || seenKeys.has(key)) continue;
        const fingerType = getFingerClass(key);
        if (!keysByFinger[fingerType]) continue;
        keysByFinger[fingerType].push(key);
        seenKeys.add(key);
    }

    return fingerOrder.flatMap(fingerType => keysByFinger[fingerType]);
}

function getNextControlKey(direction) {
    const keyPool = KEY_POOLS[direction];
    const currentKey = controlKeys[direction];
    const sequence = keySequence ? keySequence.split('') : KEYBOARD_ROWS.flat();
    const filteredSequence = filterSequenceByFingerOrder(sequence, keyPool);
    const usableKeys = filteredSequence.length ? filteredSequence : keyPool;
    const fingerOrder = ['finger-index', 'finger-ring', 'finger-middle', 'finger-pinky'];
    const keysByFinger = {
        'finger-index': [],
        'finger-ring': [],
        'finger-middle': [],
        'finger-pinky': []
    };

    usableKeys.forEach(key => {
        const fingerType = getFingerClass(key);
        if (keysByFinger[fingerType] && !keysByFinger[fingerType].includes(key)) {
            keysByFinger[fingerType].push(key);
        }
    });

    const currentFingerType = getFingerClass(currentKey);
    const currentFingerIndex = Math.max(0, fingerOrder.indexOf(currentFingerType));
    let targetFingerIndex = currentFingerIndex;

    if ((keyChangeCounts[direction] || 0) >= KEY_CHANGES_BEFORE_FORCE_PROGRESSION) {
        targetFingerIndex = (currentFingerIndex + 1) % fingerOrder.length;
        keyChangeCounts[direction] = 0;
    }

    let targetKeys = keysByFinger[fingerOrder[targetFingerIndex]];
    if (!targetKeys || targetKeys.length === 0) {
        targetKeys = usableKeys;
    }

    const directionIndex = directionIndices[direction] || 0;
    let nextKey = targetKeys[directionIndex % targetKeys.length];
    if (nextKey === currentKey && targetKeys.length > 1) {
        nextKey = targetKeys[(directionIndex + 1) % targetKeys.length];
    }

    directionIndices[direction] = directionIndex + 1;
    keyChangeCounts[direction] = (keyChangeCounts[direction] || 0) + 1;
    return nextKey;
}

function changeSingleKey(direction) {
    const oldKey = controlKeys[direction];
    const newKey = getNextControlKey(direction);
    if (!newKey || oldKey === newKey) return false;

    keysHeld.delete(oldKey);
    controlKeys[direction] = newKey;
    updateKeyboardDisplay();
    showKeyChangeModal(direction, oldKey, newKey);
    return true;
}

function showKeyChangeModal(direction, oldKey, newKey) {
    pausedBeforeKeyChange = gamePaused;
    keyChangeStartedAt = Date.now();
    gamePaused = true;
    keysHeld.clear();
    updateKeyboardDisplay();
    if (gameLoop) cancelAnimationFrame(gameLoop);
    gameLoop = 0;

    const fingerType = getFingerClass(newKey);
    const fingerHand = getFingerHand(newKey);
    const fingerName = FINGER_NAMES[fingerType] || 'Unbekannt';
    const handLabel = fingerHand === 'links' ? 'links' : 'rechts';
    const meta = CONTROL_META[direction];

    keyChangeDirection.textContent = meta.label;
    keyChangeDirection.setAttribute('data-arrow', meta.arrow);
    keyChangeFingerName.textContent = `${fingerName}finger ${handLabel}: ${displayKey(oldKey)} -> ${displayKey(newKey)}`;
    keyChangeFingerName.className = `finger-label ${fingerType}`;

    renderKeyChangeKeyboard(newKey);

    const hintElement = keyChangeModal.querySelector('.key-change-hint');
    if (hintElement) {
        hintElement.textContent = `Drücke ${displayKey(newKey)} zum Fortfahren`;
    }

    createConfetti();
    keyChangeModal.classList.add('visible');
    keyChangeModalVisible = true;
    pendingKeyConfirmation = newKey;
}

function hideKeyChangeModal(resumeGame = true) {
    if (!keyChangeModalVisible) return;
    keyChangeModal.classList.remove('visible');
    keyChangeModalVisible = false;
    pendingKeyConfirmation = null;
    keysHeld.clear();
    if (keyChangeStartedAt !== null && gameRunning) {
        gameStartTime += Math.max(0, Date.now() - keyChangeStartedAt);
    }
    keyChangeStartedAt = null;
    gamePaused = pausedBeforeKeyChange;

    const container = keyChangeModal.querySelector('.confetti-container');
    if (container) {
        container.innerHTML = '';
    }

    if (resumeGame && gameRunning && !gamePaused) {
        lastFrameTime = performance.now();
        gameLoop = requestAnimationFrame(update);
    }
}

function renderKeyChangeKeyboard(newKey) {
    const keyboardContainer = document.getElementById('keyChangeKeyboard');
    keyboardContainer.innerHTML = '';

    const separatorPositions = {
        0: 4,
        1: 4,
        2: 4
    };

    KEYBOARD_ROWS.slice(0, 3).forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'key-change-keyboard-row';

        row.forEach((key, keyIndex) => {
            if (separatorPositions[rowIndex] !== undefined && keyIndex === separatorPositions[rowIndex] + 1) {
                const separator = document.createElement('div');
                separator.className = 'keyboard-separator key-change-separator';
                rowElement.appendChild(separator);
            }

            const keyElement = document.createElement('div');
            const fingerClass = getFingerClass(key);
            keyElement.className = `key-change-key ${fingerClass}`;
            keyElement.textContent = displayKey(key);

            if (key === newKey) {
                keyElement.classList.add('highlighted');
            }

            Object.keys(controlKeys).forEach(direction => {
                const meta = CONTROL_META[direction];
                if (controlKeys[direction] === key) {
                    keyElement.classList.add('active-control', meta.owner);
                    keyElement.setAttribute('data-direction', direction);
                    keyElement.setAttribute('data-arrow', meta.arrow);
                }
            });

            rowElement.appendChild(keyElement);
        });

        keyboardContainer.appendChild(rowElement);
    });
}

function createConfetti() {
    const container = keyChangeModal.querySelector('.confetti-container');
    if (!container) return;

    container.innerHTML = '';
    const colors = ['#ff6b6b', '#ffa500', '#ffd700', '#32cd32', '#36a2ff', '#b45cff'];
    const shapes = ['●', '■', '▲', '★'];

    for (let i = 0; i < 36; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        particle.style.color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 0.4 + 's';
        particle.style.animationDuration = (1 + Math.random() * 0.8) + 's';
        particle.style.fontSize = (12 + Math.random() * 16) + 'px';
        container.appendChild(particle);
    }
}

function bounceAfterMiss(scoringSide) {
    if (scoringSide === 'right') {
        state.ball.x = BALL_RADIUS;
        state.ball.vx = Math.abs(state.ball.vx);
    } else {
        state.ball.x = PONG_WIDTH - BALL_RADIUS;
        state.ball.vx = -Math.abs(state.ball.vx);
    }

    state.rally = 0;
    state.lastHitSide = null;
}

function resetGame() {
    hideKeyChangeModal(false);
    state = createInitialState();
    keyPressCounters = {
        leftUp: 0,
        leftDown: 0,
        rightUp: 0,
        rightDown: 0
    };
    pendingKeyChanges.clear();
    keysHeld.clear();
    totalKeystrokes = 0;
    fingerUsage = {
        'finger-pinky': 0,
        'finger-ring': 0,
        'finger-middle': 0,
        'finger-index': 0
    };
    kpmElement.textContent = '0';
    updateCounters();
    updateScoreDisplay();
}

function startGame() {
    resetGame();
    gameRunning = true;
    gamePaused = false;
    gameStartTime = Date.now();
    hideOverlay();
    window.location.hash = 'game';
    lastFrameTime = performance.now();
    if (gameLoop) cancelAnimationFrame(gameLoop);
    gameLoop = requestAnimationFrame(update);
}

async function submitStatistics(kpm) {
    const payload = {
        name: localStorage.getItem('qwertz_arcade_name') || 'Anonym',
        points: Math.max(state.leftPaddle.score, state.rightPaddle.score) * 100 + state.rally,
        kpm: kpm,
        level: 1,
        duration: Math.round((Date.now() - gameStartTime) / 1000),
        fingersUsed: fingerUsage,
        rally: state.rally,
        winner: state.leftPaddle.score > state.rightPaddle.score ? 'Links' : 'Rechts',
        game: 'qwertzPong',
        source: 'pong.html'
    };

    try {
        await fetch('/api/statistics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Failed to submit Pong statistics:', error);
    }
}

function endGame(winner) {
    gameRunning = false;
    gamePaused = false;
    keysHeld.clear();
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = 0;
    }

    const elapsedMinutes = (Date.now() - gameStartTime) / 60000;
    const kpm = elapsedMinutes > 0 ? Math.round(totalKeystrokes / elapsedMinutes) : 0;
    lastGameSummary = {
        winner,
        left: state.leftPaddle.score,
        right: state.rightPaddle.score,
        rally: state.rally,
        kpm
    };

    submitStatistics(kpm);
    showOverlay('Spiel vorbei', `${winner} gewinnt ${state.leftPaddle.score}:${state.rightPaddle.score}`, true);
}

function showOverlay(title, message, showStats) {
    overlayTitleElement.textContent = title;
    overlayMessageElement.textContent = message;
    overlayElement.classList.remove('hidden');

    if (showStats && lastGameSummary) {
        overlayStatsElement.innerHTML = `
            <div class="overlay-stat-item">Sieger: ${lastGameSummary.winner}</div>
            <div class="overlay-stat-item">Endstand: ${lastGameSummary.left}:${lastGameSummary.right}</div>
            <div class="overlay-stat-item">T/Min: ${lastGameSummary.kpm}</div>
        `;
        overlayStatsElement.style.display = 'block';
    } else {
        overlayStatsElement.style.display = 'none';
    }
}

function hideOverlay() {
    overlayElement.classList.add('hidden');
}

function clampPaddles() {
    state.leftPaddle.y = Math.max(0, Math.min(PONG_HEIGHT - PADDLE_HEIGHT, state.leftPaddle.y));
    state.rightPaddle.y = Math.max(0, Math.min(PONG_HEIGHT - PADDLE_HEIGHT, state.rightPaddle.y));
}

function updatePaddles(deltaSeconds) {
    if (keysHeld.has(controlKeys.leftUp)) {
        state.leftPaddle.y -= PADDLE_SPEED * deltaSeconds;
    }
    if (keysHeld.has(controlKeys.leftDown)) {
        state.leftPaddle.y += PADDLE_SPEED * deltaSeconds;
    }
    if (keysHeld.has(controlKeys.rightUp)) {
        state.rightPaddle.y -= PADDLE_SPEED * deltaSeconds;
    }
    if (keysHeld.has(controlKeys.rightDown)) {
        state.rightPaddle.y += PADDLE_SPEED * deltaSeconds;
    }
    clampPaddles();
}

function bounceFromPaddle(paddle, side) {
    const ball = state.ball;
    const paddleCenter = paddle.y + PADDLE_HEIGHT / 2;
    const relativeHit = (ball.y - paddleCenter) / (PADDLE_HEIGHT / 2);
    const clampedHit = Math.max(-0.95, Math.min(0.95, relativeHit));
    const bounceAngle = clampedHit * (Math.PI / 3);
    const direction = side === 'left' ? 1 : -1;

    ball.speed = Math.min(BALL_MAX_SPEED, ball.speed * BALL_SPEEDUP);
    ball.vx = Math.cos(bounceAngle) * ball.speed * direction;
    ball.vy = Math.sin(bounceAngle) * ball.speed;

    if (side === 'left') {
        ball.x = paddle.x + PADDLE_WIDTH + BALL_RADIUS;
    } else {
        ball.x = paddle.x - BALL_RADIUS;
    }

    state.rally += 1;
    state.lastHitSide = side;
    state.flashSide = side;
    state.flashUntil = performance.now() + 120;
    updateScoreDisplay();
}

function ballOverlapsPaddle(paddle) {
    const ball = state.ball;
    return ball.x + BALL_RADIUS >= paddle.x &&
        ball.x - BALL_RADIUS <= paddle.x + PADDLE_WIDTH &&
        ball.y + BALL_RADIUS >= paddle.y &&
        ball.y - BALL_RADIUS <= paddle.y + PADDLE_HEIGHT;
}

function ballReachedCenter(previousX) {
    const centerX = PONG_WIDTH / 2;
    const ballX = state.ball.x;
    const isInsideCenterBand = Math.abs(ballX - centerX) <= CENTER_KEY_CHANGE_BAND;
    const crossedCenterLine = (previousX <= centerX && ballX >= centerX) || (previousX >= centerX && ballX <= centerX);
    return isInsideCenterBand || crossedCenterLine;
}

function tryApplyPendingKeyChange(previousX) {
    if (!gameRunning || keyChangeModalVisible || pendingKeyChanges.size === 0) return;
    if (!ballReachedCenter(previousX)) return;

    const direction = pendingKeyChanges.values().next().value;
    pendingKeyChanges.delete(direction);
    keyPressCounters[direction] = 0;
    updateCounters();
    changeSingleKey(direction);
}

function updateBall(deltaSeconds) {
    const ball = state.ball;
    const previousX = ball.x;
    ball.x += ball.vx * deltaSeconds;
    ball.y += ball.vy * deltaSeconds;

    if (ball.y - BALL_RADIUS <= 0) {
        ball.y = BALL_RADIUS;
        ball.vy = Math.abs(ball.vy);
    } else if (ball.y + BALL_RADIUS >= PONG_HEIGHT) {
        ball.y = PONG_HEIGHT - BALL_RADIUS;
        ball.vy = -Math.abs(ball.vy);
    }

    if (ball.vx < 0 && state.lastHitSide !== 'left' && ballOverlapsPaddle(state.leftPaddle)) {
        bounceFromPaddle(state.leftPaddle, 'left');
    } else if (ball.vx > 0 && state.lastHitSide !== 'right' && ballOverlapsPaddle(state.rightPaddle)) {
        bounceFromPaddle(state.rightPaddle, 'right');
    }

    if (ball.x < -BALL_RADIUS) {
        state.rightPaddle.score += 1;
        updateScoreDisplay();
        flashScore('right');
        if (state.rightPaddle.score >= WINNING_SCORE) {
            endGame('Rechts');
            return;
        }
        bounceAfterMiss('right');
    } else if (ball.x > PONG_WIDTH + BALL_RADIUS) {
        state.leftPaddle.score += 1;
        updateScoreDisplay();
        flashScore('left');
        if (state.leftPaddle.score >= WINNING_SCORE) {
            endGame('Links');
            return;
        }
        bounceAfterMiss('left');
    }

    tryApplyPendingKeyChange(previousX);
}

function update(timestamp) {
    gameLoop = 0;
    if (!gameRunning || gamePaused || keyChangeModalVisible) return;

    const deltaSeconds = Math.min(0.033, (timestamp - lastFrameTime) / 1000 || 0);
    lastFrameTime = timestamp;

    updatePaddles(deltaSeconds);
    updateBall(deltaSeconds);
    updateKPMDisplay();
    draw();

    if (gameRunning && !gamePaused && !keyChangeModalVisible) {
        gameLoop = requestAnimationFrame(update);
    }
}

function drawCourt() {
    ctx.clearRect(0, 0, PONG_WIDTH, PONG_HEIGHT);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, PONG_WIDTH, PONG_HEIGHT);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    ctx.moveTo(PONG_WIDTH / 2, 16);
    ctx.lineTo(PONG_WIDTH / 2, PONG_HEIGHT - 16);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '700 88px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = state.scoreFlashSide === 'left' && performance.now() < state.scoreFlashUntil ? 22 : 0;
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle = state.scoreFlashSide === 'left' && performance.now() < state.scoreFlashUntil ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fillText(state.leftPaddle.score, PONG_WIDTH * 0.25, 82);
    ctx.shadowBlur = state.scoreFlashSide === 'right' && performance.now() < state.scoreFlashUntil ? 22 : 0;
    ctx.fillStyle = state.scoreFlashSide === 'right' && performance.now() < state.scoreFlashUntil ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fillText(state.rightPaddle.score, PONG_WIDTH * 0.75, 82);
    ctx.shadowBlur = 0;
}

function drawPaddle(paddle, color, isFlashing) {
    ctx.fillStyle = color;
    ctx.shadowColor = isFlashing ? color : 'transparent';
    ctx.shadowBlur = isFlashing ? 18 : 0;
    ctx.fillRect(paddle.x, paddle.y, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.shadowBlur = 0;
}

function draw() {
    drawCourt();

    drawPaddle(state.leftPaddle, '#4ade80', state.flashSide === 'left' && performance.now() < state.flashUntil);
    drawPaddle(state.rightPaddle, '#38bdf8', state.flashSide === 'right' && performance.now() < state.flashUntil);

    const ball = state.ball;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

function normalizeKey(event) {
    if (event.key === ' ') return ' ';
    return event.key.toLowerCase();
}

function findDirectionByKey(key) {
    return Object.keys(controlKeys).find(direction => controlKeys[direction] === key);
}

function recordControlPress(direction, key) {
    totalKeystrokes += 1;
    const fingerType = getFingerClass(key);
    if (fingerUsage[fingerType] != null) {
        fingerUsage[fingerType] += 1;
    }

    if (!pendingKeyChanges.has(direction)) {
        keyPressCounters[direction] += 1;
    }
    if (keyPressCounters[direction] >= PRESSES_PER_CHANGE) {
        keyPressCounters[direction] = PRESSES_PER_CHANGE;
        pendingKeyChanges.add(direction);
        updateCounters();
        tryApplyPendingKeyChange(state.ball.x);
    } else {
        updateCounters();
    }
}

function handleKeyDown(event) {
    const key = normalizeKey(event);

    if (keyChangeModalVisible) {
        if (key.length === 1) event.preventDefault();
        if (key === pendingKeyConfirmation && !event.repeat) {
            hideKeyChangeModal();
        }
        return;
    }

    if (event.repeat) {
        if (key === ' ' || findDirectionByKey(key)) event.preventDefault();
        return;
    }

    if (key === ' ') {
        event.preventDefault();
        if (!gameRunning) {
            startGame();
        } else {
            gamePaused = !gamePaused;
            if (gamePaused) {
                if (gameLoop) cancelAnimationFrame(gameLoop);
                gameLoop = 0;
                keysHeld.clear();
                updateKeyboardDisplay();
            } else {
                lastFrameTime = performance.now();
                gameLoop = requestAnimationFrame(update);
            }
            draw();
        }
        return;
    }

    const direction = findDirectionByKey(key);
    if (!direction) {
        return;
    }

    event.preventDefault();
    if (!gameRunning) {
        startGame();
    }

    if (gamePaused) return;

    if (!keysHeld.has(key)) {
        keysHeld.add(key);
        if (keyElements[key]) {
            keyElements[key].classList.add('active');
        }
        recordControlPress(direction, key);
    }
}

function handleKeyUp(event) {
    const key = normalizeKey(event);
    keysHeld.delete(key);
    if (keyElements[key]) {
        keyElements[key].classList.remove('active');
    }
}

function initDom() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    virtualKeyboardElement = document.getElementById('virtualKeyboard');
    overlayElement = document.getElementById('gameOverlay');
    overlayTitleElement = document.getElementById('overlayTitle');
    overlayMessageElement = document.getElementById('overlayMessage');
    overlayStatsElement = document.getElementById('overlayStats');
    restartButton = document.getElementById('restartButton');
    keyChangeModal = document.getElementById('keyChangeModal');
    keyChangeDirection = document.getElementById('keyChangeDirection');
    keyChangeFingerName = document.getElementById('keyChangeFingerName');
    leftScoreElement = document.getElementById('leftScore');
    rightScoreElement = document.getElementById('rightScore');
    rallyElement = document.getElementById('rally');
    kpmElement = document.getElementById('kpm');
    counterElements = {
        leftUp: document.getElementById('counter-leftUp'),
        leftDown: document.getElementById('counter-leftDown'),
        rightUp: document.getElementById('counter-rightUp'),
        rightDown: document.getElementById('counter-rightDown')
    };
}

async function init() {
    await loadKeySequence();
    initDom();
    renderKeyboard();
    renderTitleScreenKeyboard();
    updateCounters();
    updateScoreDisplay();
    draw();

    restartButton.addEventListener('click', startGame);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    document.addEventListener('qwertz:restart', startGame);
}

document.addEventListener('DOMContentLoaded', init);

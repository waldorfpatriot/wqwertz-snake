// Tetris Game Configuration
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 25;
let PRESSES_PER_CHANGE = 10;
const MIN_SCORE_FOR_KEY_CHANGE = 3;

// QWERTZ keyboard layout (same as Snake)
const KEYBOARD_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
    ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
    [' '] // Leertaste
];

// Finger mapping (same as Snake)
const FINGER_MAP = {
    'q': { finger: 'finger-pinky', hand: 'links' },
    'a': { finger: 'finger-pinky', hand: 'links' },
    'y': { finger: 'finger-pinky', hand: 'links' },
    'w': { finger: 'finger-ring', hand: 'links' },
    's': { finger: 'finger-ring', hand: 'links' },
    'x': { finger: 'finger-ring', hand: 'links' },
    'e': { finger: 'finger-middle', hand: 'links' },
    'd': { finger: 'finger-middle', hand: 'links' },
    'c': { finger: 'finger-middle', hand: 'links' },
    'r': { finger: 'finger-index', hand: 'links' },
    'f': { finger: 'finger-index', hand: 'links' },
    'v': { finger: 'finger-index', hand: 'links' },
    't': { finger: 'finger-index', hand: 'links' },
    'g': { finger: 'finger-index', hand: 'links' },
    'b': { finger: 'finger-index', hand: 'links' },
    'p': { finger: 'finger-pinky', hand: 'rechts' },
    'ü': { finger: 'finger-pinky', hand: 'rechts' },
    'ö': { finger: 'finger-pinky', hand: 'rechts' },
    'ä': { finger: 'finger-pinky', hand: 'rechts' },
    '-': { finger: 'finger-pinky', hand: 'rechts' },
    'o': { finger: 'finger-ring', hand: 'rechts' },
    'l': { finger: 'finger-ring', hand: 'rechts' },
    '.': { finger: 'finger-ring', hand: 'rechts' },
    'i': { finger: 'finger-middle', hand: 'rechts' },
    'k': { finger: 'finger-middle', hand: 'rechts' },
    ',': { finger: 'finger-middle', hand: 'rechts' },
    'z': { finger: 'finger-index', hand: 'rechts' },
    'h': { finger: 'finger-index', hand: 'rechts' },
    'n': { finger: 'finger-index', hand: 'rechts' },
    'u': { finger: 'finger-index', hand: 'rechts' },
    'j': { finger: 'finger-index', hand: 'rechts' },
    'm': { finger: 'finger-index', hand: 'rechts' }
};

function getFingerClass(key) {
    const mapping = FINGER_MAP[key];
    return mapping ? mapping.finger : '';
}

function getFingerHand(key) {
    const mapping = FINGER_MAP[key];
    return mapping ? mapping.hand : '';
}

const FINGER_NAMES = {
    'finger-pinky': 'Kleiner',
    'finger-ring': 'Ring',
    'finger-middle': 'Mittel',
    'finger-index': 'Zeige'
};

// Key pools for Tetris controls
const KEY_POOLS = {
    left: ['q', 'a', 'y', 'w', 's', 'x', 'e', 'd', 'c', 'r', 'f', 'v', 't', 'g', 'b'],
    right: ['p', 'ü', 'ö', 'ä', '-', 'o', 'l', '.', 'i', 'k', ',', 'z', 'h', 'n', 'u', 'j', 'm'],
    down: ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
    rotate: ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä', 'y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-']
};

const DIRECTION_LABELS = {
    'left': 'LINKS',
    'right': 'RECHTS',
    'down': 'SCHNELL',
    'rotate': 'DREHEN'
};

const DIRECTION_ARROWS = {
    'left': '←',
    'right': '→',
    'down': '↓',
    'rotate': '↻'
};

// Tetromino definitions
const TETROMINOES = {
    I: {
        shape: [[1, 1, 1, 1]],
        color: '#00f0f0'
    },
    O: {
        shape: [[1, 1], [1, 1]],
        color: '#f0f000'
    },
    T: {
        shape: [[0, 1, 0], [1, 1, 1]],
        color: '#a000f0'
    },
    S: {
        shape: [[0, 1, 1], [1, 1, 0]],
        color: '#00f000'
    },
    Z: {
        shape: [[1, 1, 0], [0, 1, 1]],
        color: '#f00000'
    },
    J: {
        shape: [[1, 0, 0], [1, 1, 1]],
        color: '#0000f0'
    },
    L: {
        shape: [[0, 0, 1], [1, 1, 1]],
        color: '#f0a000'
    }
};

// Game state
let canvas, ctx;
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let lines = 0;
let gameRunning = false;
let gamePaused = false;
let gameLoop;
let lastUpdate = 0;
let dropTimer = 0;
let dropInterval = 1000; // milliseconds

// Control keys
let controlKeys = {
    left: 'a',
    right: 'd',
    down: 's',
    rotate: 'w'
};

// Key press counters
let keyPressCounters = {
    left: 0,
    right: 0,
    down: 0,
    rotate: 0
};

// Statistics tracking
let gameStartTime = 0;
let totalKeystrokes = 0;
let fingerUsage = {
    'finger-pinky': 0,
    'finger-ring': 0,
    'finger-middle': 0,
    'finger-index': 0
};
let kpmUpdateInterval;
let playerName = localStorage.getItem('qwertztetris_name') || '';

// Key sequence
let keySequence = '';
let directionIndices = {
    left: 0,
    right: 0,
    down: 0,
    rotate: 0
};
let keyChangeCounts = {
    left: 0,
    right: 0,
    down: 0,
    rotate: 0
};
let KEY_CHANGES_BEFORE_FORCE_PROGRESSION = 4;

// DOM elements
let scoreElement, levelElement, linesElement, kpmElement;
let counterLeftElement, counterRightElement, counterDownElement, counterRotateElement;
let virtualKeyboardElement;
let overlayElement, overlayTitleElement, overlayMessageElement, restartButton;
let overlayStatsElement, overlayStatsButton, nameInputSection, playerNameInput, saveHint;
let statsModal, statsClose, statsTableBody;
let keyChangeModal, keyChangeDirection, keyChangeFingerName;
let keyElements = {};

let pendingKeyConfirmation = null;
let keyChangeModalVisible = false;
let gameStatsSaved = false;
let lastGameKPM = 0;
let lastGameScore = 0;
let lastGameFingerUsage = {};

// Initialize board
function initBoard() {
    board = Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));
}

// Get random tetromino
function getRandomPiece() {
    const types = Object.keys(TETROMINOES);
    const type = types[Math.floor(Math.random() * types.length)];
    return {
        type: type,
        shape: TETROMINOES[type].shape.map(row => [...row]),
        color: TETROMINOES[type].color,
        x: Math.floor(BOARD_WIDTH / 2) - 1,
        y: 0,
        rotation: 0
    };
}

// Rotate piece clockwise
function rotatePiece(piece) {
    const rows = piece.shape.length;
    const cols = piece.shape[0].length;
    const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = piece.shape[r][c];
        }
    }
    
    return rotated;
}

// Check collision
function checkCollision(piece, dx = 0, dy = 0, rotatedShape = null) {
    const shape = rotatedShape || piece.shape;
    const newX = piece.x + dx;
    const newY = piece.y + dy;
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
                const boardX = newX + c;
                const boardY = newY + r;
                
                if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
                    return true;
                }
                if (boardY >= 0 && board[boardY][boardX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Lock piece to board
function lockPiece(piece) {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) {
                const boardY = piece.y + r;
                const boardX = piece.x + c;
                if (boardY >= 0) {
                    board[boardY][boardX] = piece.color;
                }
            }
        }
    }
}

// Clear full lines
function clearLines() {
    let linesCleared = 0;
    for (let r = BOARD_HEIGHT - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
            board.splice(r, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0));
            linesCleared++;
            r++; // Check same row again
        }
    }
    
    if (linesCleared > 0) {
        lines += linesCleared;
        // Scoring: 100 * lines^2 * level
        score += 100 * linesCleared * linesCleared * level;
        scoreElement.textContent = score;
        linesElement.textContent = lines;
        
        // Level up every 10 lines
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            levelElement.textContent = level;
            dropInterval = Math.max(100, 1000 - (level - 1) * 50);
        }
    }
}

// Check game over
function checkGameOver() {
    return checkCollision(currentPiece);
}

// Load key sequence
async function loadKeySequence() {
    try {
        const response = await fetch('key_sequence.txt');
        const text = await response.text();
        keySequence = text.split('\n').filter(line => line.trim()).join('');
    } catch (error) {
        keySequence = KEYBOARD_ROWS.flat().join('');
    }
}

// Render virtual keyboard
function renderKeyboard() {
    virtualKeyboardElement.innerHTML = '';
    keyElements = {};

    KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'keyboard-row';
        if (rowIndex === 0) {
            rowElement.classList.add('keyboard-row-top');
        }

        row.forEach(key => {
            const keyElement = document.createElement('div');
            
            if (key === ' ') {
                keyElement.className = 'keyboard-key keyboard-space';
                keyElement.textContent = 'PLAY / PAUSE';
                keyElement.dataset.key = ' ';
            } else {
                keyElement.className = `keyboard-key ${getFingerClass(key)}`;
                if (key.length === 1 && /[a-zäöü]/.test(key)) {
                    keyElement.textContent = key.toUpperCase();
                } else {
                    keyElement.textContent = key;
                }
                keyElement.dataset.key = key;
            }
            
            keyElements[key] = keyElement;
            rowElement.appendChild(keyElement);
        });

        virtualKeyboardElement.appendChild(rowElement);
    });

    updateKeyboardDisplay();
}

// Render title screen keyboard
function renderTitleScreenKeyboard() {
    const titleKeyboardElement = document.getElementById('titleScreenKeyboard');
    if (!titleKeyboardElement) return;
    
    titleKeyboardElement.innerHTML = '';
    
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'title-keyboard-row';
        if (rowIndex === 0) {
            rowElement.classList.add('title-keyboard-row-top');
        }

        row.forEach(key => {
            const keyElement = document.createElement('div');
            
            if (key === ' ') {
                keyElement.className = 'title-keyboard-key title-keyboard-space';
                keyElement.textContent = 'SPACE';
            } else {
                keyElement.className = `title-keyboard-key ${getFingerClass(key)}`;
                if (key.length === 1 && /[a-zäöü]/.test(key)) {
                    keyElement.textContent = key.toUpperCase();
                } else {
                    keyElement.textContent = key;
                }
            }
            
            if (Math.random() > 0.7) {
                keyElement.classList.add('pulse-hint');
            }
            
            rowElement.appendChild(keyElement);
        });

        titleKeyboardElement.appendChild(rowElement);
    });
}

// Update keyboard display
function updateKeyboardDisplay() {
    Object.values(keyElements).forEach(el => {
        el.classList.remove('active-control');
        el.removeAttribute('data-direction');
    });

    const directionMap = {
        'left': '←',
        'right': '→',
        'down': '↓',
        'rotate': '↻'
    };
    
    ['left', 'right', 'down', 'rotate'].forEach(dir => {
        const key = controlKeys[dir];
        if (keyElements[key]) {
            keyElements[key].classList.add('active-control');
            keyElements[key].setAttribute('data-direction', dir);
            keyElements[key].setAttribute('data-arrow', directionMap[dir]);
        }
    });
}

// Filter sequence by finger order
function filterSequenceByFingerOrder(sequence, keyPool) {
    const fingerOrder = ['finger-index', 'finger-ring', 'finger-middle', 'finger-pinky'];
    const filtered = [];
    const keysByFinger = {
        'finger-index': [],
        'finger-ring': [],
        'finger-middle': [],
        'finger-pinky': []
    };
    const seenKeys = new Set();
    
    for (let key of sequence) {
        if (keyPool.includes(key) && getFingerClass(key) && !seenKeys.has(key)) {
            const fingerType = getFingerClass(key);
            if (keysByFinger[fingerType]) {
                keysByFinger[fingerType].push(key);
                seenKeys.add(key);
            }
        }
    }
    
    for (let fingerType of fingerOrder) {
        filtered.push(...keysByFinger[fingerType]);
    }
    
    return filtered;
}

// Change single key
function changeSingleKey(direction) {
    const keyPool = KEY_POOLS[direction];
    if (!keyPool || keyPool.length === 0) return;

    const oldKey = controlKeys[direction];
    const fullSequence = keySequence.split('');
    const filteredSequence = filterSequenceByFingerOrder(fullSequence, keyPool);
    
    if (filteredSequence.length === 0) return;

    const fingerOrder = ['finger-index', 'finger-ring', 'finger-middle', 'finger-pinky'];
    const keysByFinger = {
        'finger-index': [],
        'finger-ring': [],
        'finger-middle': [],
        'finger-pinky': []
    };
    const seenKeys = new Set();
    
    for (let key of filteredSequence) {
        if (!seenKeys.has(key)) {
            const fingerType = getFingerClass(key);
            if (keysByFinger[fingerType]) {
                keysByFinger[fingerType].push(key);
                seenKeys.add(key);
            }
        }
    }

    const currentFingerType = getFingerClass(oldKey);
    const currentFingerIndex = fingerOrder.indexOf(currentFingerType);
    const directionIndex = directionIndices[direction] || 0;
    const keyChangeCount = keyChangeCounts[direction] || 0;
    
    let targetFingerIndex = currentFingerIndex;
    if (keyChangeCount >= KEY_CHANGES_BEFORE_FORCE_PROGRESSION) {
        targetFingerIndex = (currentFingerIndex + 1) % fingerOrder.length;
        keyChangeCounts[direction] = 0;
    }

    const targetKeys = keysByFinger[fingerOrder[targetFingerIndex]] || [];
    if (targetKeys.length === 0) return;

    const relativeIndex = directionIndex % targetKeys.length;
    const finalKey = targetKeys[relativeIndex];
    
    directionIndices[direction] = directionIndex + 1;
    keyChangeCounts[direction] = (keyChangeCounts[direction] || 0) + 1;
    
    controlKeys[direction] = finalKey;
    updateKeyboardDisplay();
    showKeyChangeModal(direction, oldKey, finalKey);
}

// Show key change modal
function showKeyChangeModal(direction, oldKey, newKey) {
    const fingerType = getFingerClass(newKey);
    const fingerHand = getFingerHand(newKey);
    const fingerName = FINGER_NAMES[fingerType] || 'Unbekannt';
    const handLabel = fingerHand === 'links' ? 'links' : 'rechts';
    
    keyChangeDirection.textContent = DIRECTION_LABELS[direction];
    keyChangeDirection.setAttribute('data-arrow', DIRECTION_ARROWS[direction]);
    keyChangeFingerName.textContent = `${fingerName}finger ${handLabel}`;
    keyChangeFingerName.className = `finger-label ${fingerType}`;
    
    renderKeyChangeKeyboard(newKey);
    
    const hintElement = keyChangeModal.querySelector('.key-change-hint');
    if (hintElement) {
        hintElement.textContent = `Drücke ${newKey.toUpperCase()} zum Fortfahren`;
    }
    
    createConfetti();
    keyChangeModal.classList.add('visible');
    keyChangeModalVisible = true;
    pendingKeyConfirmation = newKey;
    
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    }
}

// Hide key change modal
function hideKeyChangeModal() {
    keyChangeModal.classList.remove('visible');
    keyChangeModalVisible = false;
    pendingKeyConfirmation = null;
    
    // Clear confetti particles
    const container = keyChangeModal.querySelector('.confetti-container');
    if (container) {
        container.innerHTML = '';
    }
    
    if (gameRunning) {
        gamePaused = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
}

// Render key change keyboard
function renderKeyChangeKeyboard(newKey) {
    const keyboardContainer = document.getElementById('keyChangeKeyboard');
    keyboardContainer.innerHTML = '';
    
    // Only render the letter rows (not space bar)
    const letterRows = KEYBOARD_ROWS.slice(0, 3);
    
    // Map of direction to arrow symbol
    const directionMap = {
        'left': '←',
        'right': '→',
        'down': '↓',
        'rotate': '↻'
    };
    
    letterRows.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'key-change-keyboard-row';
        
        row.forEach(key => {
            const keyElement = document.createElement('div');
            const fingerClass = getFingerClass(key);
            keyElement.className = `key-change-key ${fingerClass}`;
            
            // Display letter in uppercase
            if (key.length === 1 && /[a-zäöü]/.test(key)) {
                keyElement.textContent = key.toUpperCase();
            } else {
                keyElement.textContent = key;
            }
            
            // Highlight the new key
            if (key === newKey) {
                keyElement.classList.add('highlighted');
            }
            
            // Add arrows for all current control keys
            ['left', 'right', 'down', 'rotate'].forEach(dir => {
                if (controlKeys[dir] === key) {
                    keyElement.classList.add('active-control');
                    keyElement.setAttribute('data-direction', dir);
                    keyElement.setAttribute('data-arrow', directionMap[dir]);
                }
            });
            
            rowElement.appendChild(keyElement);
        });
        
        keyboardContainer.appendChild(rowElement);
    });
}

// Create confetti
function createConfetti() {
    const container = keyChangeModal.querySelector('.confetti-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const colors = ['#ff6b6b', '#ffa500', '#ffd700', '#32cd32', '#888', '#666', '#ff69b4', '#00ced1'];
    const shapes = ['●', '■', '▲', '★', '♦', '❤'];
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        particle.style.color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 0.5 + 's';
        particle.style.animationDuration = (1 + Math.random() * 1) + 's';
        particle.style.fontSize = (12 + Math.random() * 20) + 'px';
        container.appendChild(particle);
    }
}

// Update counters
function updateCounters() {
    counterLeftElement.textContent = `${keyPressCounters.left}/${PRESSES_PER_CHANGE}`;
    counterRightElement.textContent = `${keyPressCounters.right}/${PRESSES_PER_CHANGE}`;
    counterDownElement.textContent = `${keyPressCounters.down}/${PRESSES_PER_CHANGE}`;
    counterRotateElement.textContent = `${keyPressCounters.rotate}/${PRESSES_PER_CHANGE}`;
}

// Update KPM display
function updateKPMDisplay() {
    if (!gameRunning || gamePaused) return;
    const elapsed = (Date.now() - gameStartTime) / 1000 / 60; // minutes
    const kpm = elapsed > 0 ? Math.round(totalKeystrokes / elapsed) : 0;
    kpmElement.textContent = kpm;
}

// Submit statistics
async function submitStatistics(kpm, gameScore, gameFingersUsed) {
    const name = playerName || 'Anonym';
    
    const gameData = {
        name: name,
        points: gameScore,
        kpm: kpm,
        level: level,
        lines: lines,
        fingersUsed: gameFingersUsed,
        duration: Math.round((Date.now() - gameStartTime) / 1000)
    };
    
    try {
        const response = await fetch('/api/statistics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameData)
        });
        if (response.ok) {
            console.log('Statistics saved successfully');
        }
    } catch (error) {
        console.error('Failed to submit statistics:', error);
    }
}

// Fetch statistics
async function fetchStatistics() {
    try {
        const response = await fetch('/api/statistics');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch statistics:', error);
        return [];
    }
}

// Show overlay
function showOverlay(title, message, showStats = true) {
    overlayTitleElement.textContent = title;
    overlayMessageElement.textContent = message;
    overlayElement.classList.remove('hidden');
    
    if (showStats && lastGameScore > 0) {
        overlayStatsElement.innerHTML = `
            <div class="overlay-stat-item">Punkte: ${lastGameScore}</div>
            <div class="overlay-stat-item">Level: ${level}</div>
            <div class="overlay-stat-item">Linien: ${lines}</div>
            <div class="overlay-stat-item">T/Min: ${lastGameKPM}</div>
        `;
        overlayStatsElement.style.display = 'block';
    } else {
        overlayStatsElement.style.display = 'none';
    }
}

// Hide overlay
function hideOverlay() {
    overlayElement.classList.add('hidden');
}

// Reset game
function resetGame() {
    initBoard();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = 1000;
    scoreElement.textContent = score;
    levelElement.textContent = level;
    linesElement.textContent = lines;
    currentPiece = getRandomPiece();
    nextPiece = getRandomPiece();
    keyPressCounters = { left: 0, right: 0, down: 0, rotate: 0 };
    updateCounters();
    totalKeystrokes = 0;
    fingerUsage = {
        'finger-pinky': 0,
        'finger-ring': 0,
        'finger-middle': 0,
        'finger-index': 0
    };
    gameStatsSaved = false;
}

// Start game
async function startGame() {
    if (!gameStatsSaved && lastGameScore > 0) {
        await submitStatistics(lastGameKPM, lastGameScore, lastGameFingerUsage);
        gameStatsSaved = true;
    }
    
    resetGame();
    gameRunning = true;
    gamePaused = false;
    gameStartTime = Date.now();
    hideOverlay();
    window.location.hash = 'game';
    lastUpdate = Date.now();
    dropTimer = 0;
    gameLoop = requestAnimationFrame(update);
    
    if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
}

// Game over
function gameOver() {
    gameRunning = false;
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    if (kpmUpdateInterval) {
        clearInterval(kpmUpdateInterval);
    }
    
    const elapsed = (Date.now() - gameStartTime) / 1000 / 60;
    lastGameKPM = elapsed > 0 ? Math.round(totalKeystrokes / elapsed) : 0;
    lastGameScore = score;
    lastGameFingerUsage = { ...fingerUsage };
    
    showOverlay('Game Over', `Punkte: ${score} | Level: ${level} | Linien: ${lines}`, true);
    window.location.hash = 'start';
}

// Update game
function update() {
    if (!gameRunning || gamePaused) {
        gameLoop = requestAnimationFrame(update);
        return;
    }

    const now = Date.now();
    const deltaTime = now - lastUpdate;
    
    // Drop piece
    dropTimer += deltaTime;
    if (dropTimer >= dropInterval) {
        dropTimer = 0;
        
        if (!checkCollision(currentPiece, 0, 1)) {
            currentPiece.y++;
        } else {
            lockPiece(currentPiece);
            clearLines();
            
            currentPiece = nextPiece;
            nextPiece = getRandomPiece();
            
            if (checkGameOver()) {
                gameOver();
                return;
            }
        }
    }
    
    lastUpdate = now;
    draw();
    gameLoop = requestAnimationFrame(update);
}

// Draw game
function draw() {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw board
    const offsetX = (canvas.width - BOARD_WIDTH * CELL_SIZE) / 2;
    const offsetY = 20;
    
    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let r = 0; r <= BOARD_HEIGHT; r++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + r * CELL_SIZE);
        ctx.lineTo(offsetX + BOARD_WIDTH * CELL_SIZE, offsetY + r * CELL_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= BOARD_WIDTH; c++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + c * CELL_SIZE, offsetY);
        ctx.lineTo(offsetX + c * CELL_SIZE, offsetY + BOARD_HEIGHT * CELL_SIZE);
        ctx.stroke();
    }
    
    // Draw locked pieces
    for (let r = 0; r < BOARD_HEIGHT; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
            if (board[r][c]) {
                ctx.fillStyle = board[r][c];
                ctx.fillRect(offsetX + c * CELL_SIZE + 1, offsetY + r * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
            }
        }
    }
    
    // Draw current piece
    if (currentPiece) {
        ctx.fillStyle = currentPiece.color;
        for (let r = 0; r < currentPiece.shape.length; r++) {
            for (let c = 0; c < currentPiece.shape[r].length; c++) {
                if (currentPiece.shape[r][c]) {
                    const x = offsetX + (currentPiece.x + c) * CELL_SIZE + 1;
                    const y = offsetY + (currentPiece.y + r) * CELL_SIZE + 1;
                    ctx.fillRect(x, y, CELL_SIZE - 2, CELL_SIZE - 2);
                }
            }
        }
    }
}

// Handle key press
function handleKeyPress(key) {
    if (keyChangeModalVisible) {
        if (key === pendingKeyConfirmation) {
            hideKeyChangeModal();
        }
        return;
    }
    
    // Handle space key for pause/resume
    if (key === ' ') {
        if (!gameRunning) {
            startGame();
        } else {
            // Toggle pause
            gamePaused = !gamePaused;
            if (gamePaused) {
                if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
            } else {
                lastUpdate = Date.now();
                gameLoop = requestAnimationFrame(update);
                kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
            }
        }
        return;
    }
    
    // Start game if not running (for any QWERTZ key)
    if (!gameRunning) {
        if (getFingerClass(key)) {
            startGame();
        }
        return;
    }
    
    // Ignore input while paused
    if (gamePaused) {
        return;
    }
    
    const fingerType = getFingerClass(key);
    if (fingerType) {
        fingerUsage[fingerType] = (fingerUsage[fingerType] || 0) + 1;
    }
    totalKeystrokes++;
    
    if (key === controlKeys.left) {
        if (!checkCollision(currentPiece, -1, 0)) {
            currentPiece.x--;
        }
        keyPressCounters.left++;
        updateCounters();
        
        if (keyPressCounters.left >= PRESSES_PER_CHANGE && score >= MIN_SCORE_FOR_KEY_CHANGE) {
            changeSingleKey('left');
            keyPressCounters.left = 0;
            updateCounters();
        }
    } else if (key === controlKeys.right) {
        if (!checkCollision(currentPiece, 1, 0)) {
            currentPiece.x++;
        }
        keyPressCounters.right++;
        updateCounters();
        
        if (keyPressCounters.right >= PRESSES_PER_CHANGE && score >= MIN_SCORE_FOR_KEY_CHANGE) {
            changeSingleKey('right');
            keyPressCounters.right = 0;
            updateCounters();
        }
    } else if (key === controlKeys.down) {
        // Soft drop - move piece down faster
        if (!checkCollision(currentPiece, 0, 1)) {
            currentPiece.y++;
            score += 1; // Award 1 point per soft drop cell
            scoreElement.textContent = score;
        }
        keyPressCounters.down++;
        updateCounters();
        
        if (keyPressCounters.down >= PRESSES_PER_CHANGE && score >= MIN_SCORE_FOR_KEY_CHANGE) {
            changeSingleKey('down');
            keyPressCounters.down = 0;
            updateCounters();
        }
    } else if (key === controlKeys.rotate) {
        const rotated = rotatePiece(currentPiece);
        if (!checkCollision(currentPiece, 0, 0, rotated)) {
            currentPiece.shape = rotated;
        }
        keyPressCounters.rotate++;
        updateCounters();
        
        if (keyPressCounters.rotate >= PRESSES_PER_CHANGE && score >= MIN_SCORE_FOR_KEY_CHANGE) {
            changeSingleKey('rotate');
            keyPressCounters.rotate = 0;
            updateCounters();
        }
    } else if (key === ' ') {
        // Hard drop
        while (!checkCollision(currentPiece, 0, 1)) {
            currentPiece.y++;
            score += 2;
        }
        lockPiece(currentPiece);
        clearLines();
        currentPiece = nextPiece;
        nextPiece = getRandomPiece();
        if (checkGameOver()) {
            gameOver();
            return;
        }
        scoreElement.textContent = score;
    }
}

// Initialize
async function init() {
    await loadKeySequence();
    
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    scoreElement = document.getElementById('score');
    levelElement = document.getElementById('level');
    linesElement = document.getElementById('lines');
    kpmElement = document.getElementById('kpm');
    counterLeftElement = document.getElementById('counter-left');
    counterRightElement = document.getElementById('counter-right');
    counterDownElement = document.getElementById('counter-down');
    counterRotateElement = document.getElementById('counter-rotate');
    virtualKeyboardElement = document.getElementById('virtualKeyboard');
    overlayElement = document.getElementById('gameOverlay');
    overlayTitleElement = document.getElementById('overlayTitle');
    overlayMessageElement = document.getElementById('overlayMessage');
    restartButton = document.getElementById('restartButton');
    overlayStatsElement = document.getElementById('overlayStats');
    overlayStatsButton = document.getElementById('overlayStatsButton');
    nameInputSection = document.getElementById('nameInputSection');
    playerNameInput = document.getElementById('playerNameInput');
    saveHint = document.getElementById('saveHint');
    statsModal = document.getElementById('statsModal');
    statsClose = document.getElementById('statsClose');
    statsTableBody = document.getElementById('statsTableBody');
    keyChangeModal = document.getElementById('keyChangeModal');
    keyChangeDirection = document.getElementById('keyChangeDirection');
    keyChangeFingerName = document.getElementById('keyChangeFingerName');
    
    // Initialize random control keys
    controlKeys.left = KEY_POOLS.left[Math.floor(Math.random() * KEY_POOLS.left.length)];
    controlKeys.right = KEY_POOLS.right[Math.floor(Math.random() * KEY_POOLS.right.length)];
    controlKeys.down = KEY_POOLS.down[Math.floor(Math.random() * KEY_POOLS.down.length)];
    controlKeys.rotate = KEY_POOLS.rotate[Math.floor(Math.random() * KEY_POOLS.rotate.length)];
    
    renderKeyboard();
    renderTitleScreenKeyboard();
    initBoard();
    resetGame();
    
    // Event listeners
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (key.length === 1 || key === ' ') {
            e.preventDefault();
            handleKeyPress(key);
        }
    });
    
    restartButton.addEventListener('click', () => {
        startGame();
    });
    
    async function openTetrisStatsModal() {
        const stats = await fetchStatistics();
        statsTableBody.innerHTML = '';
        stats.slice(0, 50).forEach((stat, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${stat.name}</td>
                <td>${stat.points}</td>
                <td>${stat.level || 0}</td>
                <td>${stat.lines || 0}</td>
                <td>${stat.kpm}</td>
                <td>${getFingerUsageDisplay(stat.fingersUsed)}</td>
            `;
            statsTableBody.appendChild(row);
        });
        statsModal.classList.add('visible');
    }
    
    document.addEventListener('menu-open-stats', openTetrisStatsModal);
    document.addEventListener('menu-restart', () => startGame());
    document.addEventListener('menu-open-admin', () => { window.location.href = 'index.html#admin'; });
    document.addEventListener('menu-open-tutorial', () => { window.location.href = 'index.html'; });

    function handleTetrisHash() {
        const hash = window.location.hash.substring(1);
        if (hash === 'bestenliste') openTetrisStatsModal();
        if (hash === 'admin') window.location.href = 'index.html#admin';
        if (hash === 'neustart') {
            if (confirm('Möchtest du wirklich das Spiel von vorne beginnen, ohne dich in die Bestenliste einzutragen?')) {
                startGame();
            } else {
                window.location.hash = '';
            }
        }
        if (hash.indexOf('tutorial-step-') === 0) window.location.href = 'index.html#' + hash;
    }
    window.addEventListener('hashchange', handleTetrisHash);
    handleTetrisHash();

    overlayStatsButton.addEventListener('click', openTetrisStatsModal);
    
    statsClose.addEventListener('click', () => {
        statsModal.classList.remove('visible');
    });
    
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) {
            statsModal.classList.remove('visible');
        }
    });
    
    playerNameInput.addEventListener('input', () => {
        playerName = playerNameInput.value.trim();
        localStorage.setItem('qwertztetris_name', playerName);
    });
    
    // Show overlay on start
    showOverlay('qwertzis', 'Drücke eine Taste zum Starten', false);
}

// Get finger usage display
function getFingerUsageDisplay(fingersUsed) {
    if (!fingersUsed) return '';
    const maxFinger = Object.entries(fingersUsed).reduce((a, b) => 
        (b[1] || 0) > (a[1] || 0) ? b : a, ['', 0]);
    const fingerType = maxFinger[0];
    const fingerName = FINGER_NAMES[fingerType] || '';
    return fingerName ? `${fingerName}finger` : '';
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

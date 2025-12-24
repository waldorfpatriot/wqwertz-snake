// Game configuration
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const FPS = 7;
const PRESSES_PER_CHANGE = 20;

// QWERTZ keyboard layout
const KEYBOARD_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
    ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
    [' '] // Leertaste
];

// Finger mapping for 10-finger system (QWERTZ)
// Based on standard 10-finger typing method
// Home row: ASDF (left) and JKLÖ (right)
// Same colors for both hands (4 colors total)
const FINGER_MAP = {
    // Kleiner Finger (Pinky) - beide Hände
    // Links: q, a, y
    // Rechts: p, ü, ö, ä, '-' (Minus)
    'q': 'finger-pinky', 'a': 'finger-pinky', 'y': 'finger-pinky',
    'p': 'finger-pinky', 'ü': 'finger-pinky', 'ö': 'finger-pinky', 'ä': 'finger-pinky', '-': 'finger-pinky',
    // Ringfinger - beide Hände
    // Links: w, s, x
    // Rechts: o, l (ä wurde zu pinky verschoben)
    'w': 'finger-ring', 's': 'finger-ring', 'x': 'finger-ring',
    'o': 'finger-ring', 'l': 'finger-ring',
    // Mittelfinger - beide Hände
    // Links: e, d, c
    // Rechts: i, k, ',' (Komma)
    'e': 'finger-middle', 'd': 'finger-middle', 'c': 'finger-middle',
    'i': 'finger-middle', 'k': 'finger-middle', ',': 'finger-middle',
    // Ringfinger - beide Hände
    // Links: w, s, x
    // Rechts: o, l, '.' (Punkt)
    'w': 'finger-ring', 's': 'finger-ring', 'x': 'finger-ring',
    'o': 'finger-ring', 'l': 'finger-ring', '.': 'finger-ring',
    // Zeigefinger - beide Hände
    // Links: r, f, v, t, g, b
    // Rechts: z, h, n, u, j, m
    'r': 'finger-index', 'f': 'finger-index', 'v': 'finger-index',
    't': 'finger-index', 'g': 'finger-index', 'b': 'finger-index',
    'z': 'finger-index', 'h': 'finger-index', 'n': 'finger-index',
    'u': 'finger-index', 'j': 'finger-index', 'm': 'finger-index'
};

// Key pools for each direction
const KEY_POOLS = {
    left: ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü', 'a', 's', 'd', 'f'], // alles links von g
    right: ['j', 'k', 'l', 'ö', 'ä', 'y', 'x', 'c', 'v', 'b', 'n', 'm'], // alles rechts von h
    up: ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'], // oberste Reihe
    down: ['y', 'x', 'c', 'v', 'b', 'n', 'm'] // unterste Reihe
};

// Game state
let canvas, ctx;
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let gameRunning = false;
let gameLoop;
let lastUpdate = 0;

// Control keys
let controlKeys = {
    up: 't',
    down: 'b',
    left: 'f',
    right: 'j'
};

// Key press counters
let keyPressCounters = {
    up: 0,
    down: 0,
    left: 0,
    right: 0
};

// Key sequence from file
let keySequence = '';
let keySequenceIndex = 0;
// Separate indices for each direction
let directionIndices = {
    up: 0,
    down: 0,
    left: 0,
    right: 0
};

// DOM elements
let scoreElement;
let counterUpElement, counterDownElement, counterLeftElement, counterRightElement;
let virtualKeyboardElement;
let overlayElement, overlayTitleElement, overlayMessageElement, restartButton;
let keyElements = {}; // Map of key characters to DOM elements

// Load key sequence from file
async function loadKeySequence() {
    try {
        const response = await fetch('key_sequence.txt');
        const text = await response.text();
        // Remove line breaks and combine all lines into one string
        keySequence = text.split('\n').filter(line => line.trim()).join('');
        console.log('Key sequence loaded:', keySequence.length, 'characters');
    } catch (error) {
        console.error('Error loading key sequence:', error);
        // Fallback to QWERTZ layout if file can't be loaded
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

        row.forEach(key => {
            const keyElement = document.createElement('div');
            
            // Special handling for space key
            if (key === ' ') {
                keyElement.className = 'keyboard-key keyboard-space';
                keyElement.textContent = 'SPACE';
                keyElement.dataset.key = ' ';
            } else {
                keyElement.className = `keyboard-key ${FINGER_MAP[key] || ''}`;
                // Display special characters as-is, letters in uppercase
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

// Update keyboard to highlight active control keys
function updateKeyboardDisplay() {
    // Remove all active-control classes and direction attributes
    Object.values(keyElements).forEach(el => {
        el.classList.remove('active-control');
        el.removeAttribute('data-direction');
    });

    // Add active-control to current control keys with direction
    const directionMap = {
        'up': '↑',
        'down': '↓',
        'left': '←',
        'right': '→'
    };
    
    ['up', 'down', 'left', 'right'].forEach(dir => {
        const key = controlKeys[dir];
        if (keyElements[key]) {
            keyElements[key].classList.add('active-control');
            keyElements[key].setAttribute('data-direction', dir);
            keyElements[key].setAttribute('data-arrow', directionMap[dir]);
        }
    });
}

// Initialize game
async function init() {
    await loadKeySequence();
    
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    scoreElement = document.getElementById('score');
    counterUpElement = document.getElementById('counter-up');
    counterDownElement = document.getElementById('counter-down');
    counterLeftElement = document.getElementById('counter-left');
    counterRightElement = document.getElementById('counter-right');
    virtualKeyboardElement = document.getElementById('virtualKeyboard');
    overlayElement = document.getElementById('gameOverlay');
    overlayTitleElement = document.getElementById('overlayTitle');
    overlayMessageElement = document.getElementById('overlayMessage');
    restartButton = document.getElementById('restartButton');

    renderKeyboard();
    updateCounters();
    resetGame();
    
    // Event listeners
    document.addEventListener('keydown', handleKeyPress);
    restartButton.addEventListener('click', startGame);
    
    // Start screen
    showOverlay('QWERTZ Snake', 'Drücke eine Taste zum Starten');
}

// Reset game state
function resetGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    scoreElement.textContent = '0';
    spawnFood();
    
    // Reset counters
    keyPressCounters = {
        up: 0,
        down: 0,
        left: 0,
        right: 0
    };
    
    // Reset direction indices
    directionIndices = {
        up: 0,
        down: 0,
        left: 0,
        right: 0
    };
    
    updateCounters();
}

// Start game
function startGame() {
    resetGame();
    gameRunning = true;
    hideOverlay();
    lastUpdate = Date.now();
    gameLoop = requestAnimationFrame(update);
}

// Game over
function gameOver() {
    gameRunning = false;
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    showOverlay('Game Over!', `Punkte: ${score}`);
}

// Show overlay
function showOverlay(title, message) {
    overlayTitleElement.textContent = title;
    overlayMessageElement.textContent = message;
    overlayElement.classList.remove('hidden');
}

// Hide overlay
function hideOverlay() {
    overlayElement.classList.add('hidden');
}

// Spawn food at random position
function spawnFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
    
    food = newFood;
}

// Update game state
function update() {
    if (!gameRunning) return;

    const now = Date.now();
    const deltaTime = now - lastUpdate;
    const frameInterval = 1000 / FPS;

    if (deltaTime >= frameInterval) {
        // Update direction
        direction = { ...nextDirection };

        // Move snake with wrap-around (infinite walls)
        let headX = snake[0].x + direction.x;
        let headY = snake[0].y + direction.y;
        
        // Wrap around if out of bounds
        if (headX < 0) headX = GRID_SIZE - 1;
        if (headX >= GRID_SIZE) headX = 0;
        if (headY < 0) headY = GRID_SIZE - 1;
        if (headY >= GRID_SIZE) headY = 0;
        
        const head = { x: headX, y: headY };

        // Check self collision (only way to lose)
        if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            gameOver();
            return;
        }

        snake.unshift(head);

        // Check food collision
        if (head.x === food.x && head.y === food.y) {
            score++;
            scoreElement.textContent = score;
            spawnFood();
        } else {
            snake.pop();
        }

        lastUpdate = now;
    }

    draw();
    gameLoop = requestAnimationFrame(update);
}

// Draw game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (optional, for visual reference)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
    }

    // Draw food
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(food.x * CELL_SIZE + 2, food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

    // Draw snake
    snake.forEach((segment, index) => {
        if (index === 0) {
            // Head
            ctx.fillStyle = '#667eea';
        } else {
            // Body
            ctx.fillStyle = '#764ba2';
        }
        ctx.fillRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });
}

// Handle keyboard input
function handleKeyPress(event) {
    const key = event.key.toLowerCase();

    // Start game if not running
    if (!gameRunning) {
        if (FINGER_MAP[key]) {
            startGame();
        }
        return;
    }

    // Prevent default behavior for game keys
    if (FINGER_MAP[key]) {
        event.preventDefault();
    }

    // Handle direction changes and count presses
    let directionChanged = null;
    
    if (key === controlKeys.up && direction.y === 0) {
        nextDirection = { x: 0, y: -1 };
        directionChanged = 'up';
        highlightKey('up');
    } else if (key === controlKeys.down && direction.y === 0) {
        nextDirection = { x: 0, y: 1 };
        directionChanged = 'down';
        highlightKey('down');
    } else if (key === controlKeys.left && direction.x === 0) {
        nextDirection = { x: -1, y: 0 };
        directionChanged = 'left';
        highlightKey('left');
    } else if (key === controlKeys.right && direction.x === 0) {
        nextDirection = { x: 1, y: 0 };
        directionChanged = 'right';
        highlightKey('right');
    }

    // Increment counter and check if key should change
    if (directionChanged) {
        keyPressCounters[directionChanged]++;
        updateCounters();
        
        if (keyPressCounters[directionChanged] >= PRESSES_PER_CHANGE) {
            changeSingleKey(directionChanged);
            keyPressCounters[directionChanged] = 0;
            updateCounters();
        }
    }
}

// Highlight key visually
function highlightKey(direction) {
    const key = controlKeys[direction];
    if (keyElements[key]) {
        keyElements[key].classList.add('active');
        setTimeout(() => {
            keyElements[key].classList.remove('active');
        }, 200);
    }
}

// Update counter display
function updateCounters() {
    counterUpElement.textContent = `${keyPressCounters.up}/${PRESSES_PER_CHANGE}`;
    counterDownElement.textContent = `${keyPressCounters.down}/${PRESSES_PER_CHANGE}`;
    counterLeftElement.textContent = `${keyPressCounters.left}/${PRESSES_PER_CHANGE}`;
    counterRightElement.textContent = `${keyPressCounters.right}/${PRESSES_PER_CHANGE}`;
}

// Filter sequence maintaining finger order: index -> ring -> middle -> pinky
// Only including keys from keyPool, but respecting finger progression
function filterSequenceByFingerOrder(sequence, keyPool) {
    const fingerOrder = ['finger-index', 'finger-ring', 'finger-middle', 'finger-pinky'];
    const filtered = [];
    
    // First, collect all keys from sequence that are in keyPool, grouped by finger
    const keysByFinger = {
        'finger-index': [],
        'finger-ring': [],
        'finger-middle': [],
        'finger-pinky': []
    };
    
    // Go through sequence in original order and group by finger
    for (let key of sequence) {
        if (keyPool.includes(key) && FINGER_MAP[key]) {
            const fingerType = FINGER_MAP[key];
            if (keysByFinger[fingerType]) {
                keysByFinger[fingerType].push(key);
            }
        }
    }
    
    // Now build filtered sequence in finger order: index -> ring -> middle -> pinky
    for (let fingerType of fingerOrder) {
        filtered.push(...keysByFinger[fingerType]);
    }
    
    return filtered;
}

// Change a single control key based on direction-specific key pool
function changeSingleKey(direction) {
    const keyPool = KEY_POOLS[direction];
    if (!keyPool || keyPool.length === 0) {
        console.error('No key pool for direction:', direction);
        return;
    }

    // Filter key sequence respecting finger order (index -> ring -> middle -> pinky)
    const fullSequence = keySequence.split('');
    const filteredSequence = filterSequenceByFingerOrder(fullSequence, keyPool);
    
    if (filteredSequence.length === 0) {
        console.error('No valid keys in sequence for direction:', direction);
        return;
    }

    // Use direction-specific index
    const directionIndex = directionIndices[direction];

    // Get next key from filtered sequence using direction-specific index
    const newKey = filteredSequence[directionIndex % filteredSequence.length];
    directionIndices[direction] = (directionIndex + 1) % filteredSequence.length;

    // Make sure the new key is not already used by another direction
    const usedKeys = Object.values(controlKeys);
    let finalKey = newKey;
    let attempts = 0;
    let currentIndex = directionIndices[direction];
    
    // If the key is already used, try to find a different one from the pool
    while (usedKeys.includes(finalKey) && attempts < filteredSequence.length) {
        finalKey = filteredSequence[currentIndex % filteredSequence.length];
        currentIndex = (currentIndex + 1) % filteredSequence.length;
        attempts++;
    }
    
    // Update the index if we skipped keys
    if (attempts > 0) {
        directionIndices[direction] = currentIndex;
    }

    // Update the specific key
    controlKeys[direction] = finalKey;
    updateKeyboardDisplay();
    
    // Visual feedback for the changed key
    if (keyElements[finalKey]) {
        keyElements[finalKey].style.animation = 'none';
        setTimeout(() => {
            keyElements[finalKey].style.animation = 'pulse 0.5s';
        }, 10);
    }
}

// Initialize on load
init();

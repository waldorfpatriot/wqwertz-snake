// Game configuration
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const FPS = 7;
const PRESSES_PER_CHANGE = 20;
const QWERTZ_LAYOUT = 'qwertzuiopüasdfghjklöäyxcvbnm';

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

// DOM elements
let scoreElement;
let keyUpElement, keyDownElement, keyLeftElement, keyRightElement;
let counterUpElement, counterDownElement, counterLeftElement, counterRightElement;
let overlayElement, overlayTitleElement, overlayMessageElement, restartButton;

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
        keySequence = QWERTZ_LAYOUT;
    }
}

// Initialize game
async function init() {
    await loadKeySequence();
    
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    scoreElement = document.getElementById('score');
    keyUpElement = document.getElementById('key-up');
    keyDownElement = document.getElementById('key-down');
    keyLeftElement = document.getElementById('key-left');
    keyRightElement = document.getElementById('key-right');
    counterUpElement = document.getElementById('counter-up');
    counterDownElement = document.getElementById('counter-down');
    counterLeftElement = document.getElementById('counter-left');
    counterRightElement = document.getElementById('counter-right');
    overlayElement = document.getElementById('gameOverlay');
    overlayTitleElement = document.getElementById('overlayTitle');
    overlayMessageElement = document.getElementById('overlayMessage');
    restartButton = document.getElementById('restartButton');

    updateKeyDisplay();
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
        if (QWERTZ_LAYOUT.includes(key)) {
            startGame();
        }
        return;
    }

    // Prevent default behavior for game keys
    if (QWERTZ_LAYOUT.includes(key)) {
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
    const keyElement = {
        'up': keyUpElement,
        'down': keyDownElement,
        'left': keyLeftElement,
        'right': keyRightElement
    }[direction];

    if (keyElement) {
        keyElement.classList.add('active');
        setTimeout(() => {
            keyElement.classList.remove('active');
        }, 200);
    }
}

// Update key display
function updateKeyDisplay() {
    keyUpElement.textContent = controlKeys.up.toUpperCase();
    keyDownElement.textContent = controlKeys.down.toUpperCase();
    keyLeftElement.textContent = controlKeys.left.toUpperCase();
    keyRightElement.textContent = controlKeys.right.toUpperCase();
}

// Update counter display
function updateCounters() {
    counterUpElement.textContent = `${keyPressCounters.up}/${PRESSES_PER_CHANGE}`;
    counterDownElement.textContent = `${keyPressCounters.down}/${PRESSES_PER_CHANGE}`;
    counterLeftElement.textContent = `${keyPressCounters.left}/${PRESSES_PER_CHANGE}`;
    counterRightElement.textContent = `${keyPressCounters.right}/${PRESSES_PER_CHANGE}`;
}

// Change a single control key
function changeSingleKey(direction) {
    if (keySequence.length === 0) {
        console.error('Key sequence is empty');
        return;
    }

    // Get next key from sequence
    const newKey = keySequence[keySequenceIndex % keySequence.length];
    keySequenceIndex++;

    // Make sure the new key is not already used by another direction
    const usedKeys = Object.values(controlKeys);
    let finalKey = newKey;
    let attempts = 0;
    
    // If the key is already used, try to find a different one
    while (usedKeys.includes(finalKey) && attempts < keySequence.length) {
        finalKey = keySequence[keySequenceIndex % keySequence.length];
        keySequenceIndex++;
        attempts++;
    }

    // Update the specific key
    controlKeys[direction] = finalKey;
    updateKeyDisplay();
    
    // Visual feedback for the changed key
    const keyElement = {
        'up': keyUpElement,
        'down': keyDownElement,
        'left': keyLeftElement,
        'right': keyRightElement
    }[direction];

    if (keyElement) {
        keyElement.style.animation = 'none';
        setTimeout(() => {
            keyElement.style.animation = 'pulse 0.5s';
        }, 10);
    }
}

// Initialize on load
init();

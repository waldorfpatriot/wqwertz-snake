// Game configuration
const GRID_SIZE = 20;
const CELL_SIZE = 20;
const FPS = 4.65; // 25% slower than 6.2 FPS
const PRESSES_PER_CHANGE = 10;
const MIN_SCORE_FOR_KEY_CHANGE = 3;

// QWERTZ keyboard layout
const KEYBOARD_ROWS = [
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
    ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-'],
    [' '] // Leertaste
];

// Finger mapping for 10-finger system (QWERTZ)
// Based on standard 10-finger typing method from Wikipedia
// https://de.wikipedia.org/wiki/Zehnfingersystem#Bedienung_der_Tasten
// Home row: ASDF (left) and JKLÖ (right)
// Format: { finger: 'finger-type', hand: 'links'|'rechts' }
const FINGER_MAP = {
    // Kleiner Finger links: Q A Y
    'q': { finger: 'finger-pinky', hand: 'links' },
    'a': { finger: 'finger-pinky', hand: 'links' },
    'y': { finger: 'finger-pinky', hand: 'links' },
    // Ringfinger links: W S X
    'w': { finger: 'finger-ring', hand: 'links' },
    's': { finger: 'finger-ring', hand: 'links' },
    'x': { finger: 'finger-ring', hand: 'links' },
    // Mittelfinger links: E D C
    'e': { finger: 'finger-middle', hand: 'links' },
    'd': { finger: 'finger-middle', hand: 'links' },
    'c': { finger: 'finger-middle', hand: 'links' },
    // Zeigefinger links: R F V T G B
    'r': { finger: 'finger-index', hand: 'links' },
    'f': { finger: 'finger-index', hand: 'links' },
    'v': { finger: 'finger-index', hand: 'links' },
    't': { finger: 'finger-index', hand: 'links' },
    'g': { finger: 'finger-index', hand: 'links' },
    'b': { finger: 'finger-index', hand: 'links' },
    // Kleiner Finger rechts: P Ü Ö Ä -
    'p': { finger: 'finger-pinky', hand: 'rechts' },
    'ü': { finger: 'finger-pinky', hand: 'rechts' },
    'ö': { finger: 'finger-pinky', hand: 'rechts' },
    'ä': { finger: 'finger-pinky', hand: 'rechts' },
    '-': { finger: 'finger-pinky', hand: 'rechts' },
    // Ringfinger rechts: O L .
    'o': { finger: 'finger-ring', hand: 'rechts' },
    'l': { finger: 'finger-ring', hand: 'rechts' },
    '.': { finger: 'finger-ring', hand: 'rechts' },
    // Mittelfinger rechts: I K ,
    'i': { finger: 'finger-middle', hand: 'rechts' },
    'k': { finger: 'finger-middle', hand: 'rechts' },
    ',': { finger: 'finger-middle', hand: 'rechts' },
    // Zeigefinger rechts: Z H N U J M
    'z': { finger: 'finger-index', hand: 'rechts' },
    'h': { finger: 'finger-index', hand: 'rechts' },
    'n': { finger: 'finger-index', hand: 'rechts' },
    'u': { finger: 'finger-index', hand: 'rechts' },
    'j': { finger: 'finger-index', hand: 'rechts' },
    'm': { finger: 'finger-index', hand: 'rechts' }
};

// Helper function to get finger class from FINGER_MAP
function getFingerClass(key) {
    const mapping = FINGER_MAP[key];
    return mapping ? mapping.finger : '';
}

// Helper function to get hand from FINGER_MAP
function getFingerHand(key) {
    const mapping = FINGER_MAP[key];
    return mapping ? mapping.hand : '';
}

// Finger names for display
const FINGER_NAMES = {
    'finger-pinky': 'Kleiner',
    'finger-ring': 'Ring',
    'finger-middle': 'Mittel',
    'finger-index': 'Zeige'
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
let gamePaused = false;
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
let playerName = localStorage.getItem('qwertzsnake_name') || '';

// Level system
let availableLevels = [];
let currentLevelIndex = 0;
let currentLevel = null;
let barriers = [];
let levelChangeModalVisible = false;
let maxLevelReached = 0;

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
let scoreElement, kpmElement;
let counterUpElement, counterDownElement, counterLeftElement, counterRightElement;
let virtualKeyboardElement;
let overlayElement, overlayTitleElement, overlayMessageElement, restartButton;
let overlayStatsElement, overlayStatsButton, nameInputSection, playerNameInput, saveHint;
let statsButton, statsModal, statsClose, statsTableBody;
let keyChangeModal, keyChangeDirection, keyChangeFingerName;
let keyElements = {}; // Map of key characters to DOM elements

// Level designer DOM elements
let adminLoginBtn, loginModal, loginClose, loginPassword, loginSubmit, loginError;
let levelDesignerModal, designerClose, levelNameInput, levelGrid;
let toolBarrier, toolEraser, toolClear, saveLevelBtn, savedLevelsList;
let levelChangeModal, levelChangeName, levelChangeNumber;

// Track if current game stats have been saved
let gameStatsSaved = false;
let lastGameKPM = 0;

// Track if game was paused by stats modal
let pausedByStatsModal = false;

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
                keyElement.textContent = 'PLAY / PAUSE';
                keyElement.dataset.key = ' ';
            } else {
                keyElement.className = `keyboard-key ${getFingerClass(key)}`;
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

// Render title screen keyboard with visual hints
function renderTitleScreenKeyboard() {
    const titleKeyboardElement = document.getElementById('titleScreenKeyboard');
    if (!titleKeyboardElement) return;
    
    titleKeyboardElement.innerHTML = '';
    
    // Show all rows including space bar
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'title-keyboard-row';

        row.forEach(key => {
            const keyElement = document.createElement('div');
            
            // Special handling for space key
            if (key === ' ') {
                keyElement.className = 'title-keyboard-key title-keyboard-space';
                keyElement.textContent = 'SPACE';
            } else {
                keyElement.className = `title-keyboard-key ${getFingerClass(key)}`;
                // Display letter in uppercase
                if (key.length === 1 && /[a-zäöü]/.test(key)) {
                    keyElement.textContent = key.toUpperCase();
                } else {
                    keyElement.textContent = key;
                }
            }
            
            // Add pulsing animation to random keys to show interactivity
            if (Math.random() > 0.7) {
                keyElement.classList.add('pulse-hint');
            }
            
            rowElement.appendChild(keyElement);
        });

        titleKeyboardElement.appendChild(rowElement);
    });
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
    await loadLevels();
    
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    scoreElement = document.getElementById('score');
    kpmElement = document.getElementById('kpm');
    counterUpElement = document.getElementById('counter-up');
    counterDownElement = document.getElementById('counter-down');
    counterLeftElement = document.getElementById('counter-left');
    counterRightElement = document.getElementById('counter-right');
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
    statsButton = document.getElementById('statsButton');
    statsModal = document.getElementById('statsModal');
    statsClose = document.getElementById('statsClose');
    statsTableBody = document.getElementById('statsTableBody');
    keyChangeModal = document.getElementById('keyChangeModal');
    keyChangeDirection = document.getElementById('keyChangeDirection');
    keyChangeFingerName = document.getElementById('keyChangeFingerName');

    // Level designer elements
    adminLoginBtn = document.getElementById('adminLoginBtn');
    loginModal = document.getElementById('loginModal');
    loginClose = document.getElementById('loginClose');
    loginPassword = document.getElementById('loginPassword');
    loginSubmit = document.getElementById('loginSubmit');
    loginError = document.getElementById('loginError');
    levelDesignerModal = document.getElementById('levelDesignerModal');
    designerClose = document.getElementById('designerClose');
    levelNameInput = document.getElementById('levelNameInput');
    levelGrid = document.getElementById('levelGrid');
    toolBarrier = document.getElementById('toolBarrier');
    toolEraser = document.getElementById('toolEraser');
    toolClear = document.getElementById('toolClear');
    saveLevelBtn = document.getElementById('saveLevelBtn');
    savedLevelsList = document.getElementById('savedLevelsList');
    levelChangeModal = document.getElementById('levelChangeModal');
    levelChangeName = document.getElementById('levelChangeName');
    levelChangeNumber = document.getElementById('levelChangeNumber');

    // Set saved player name
    if (playerName) {
        playerNameInput.value = playerName;
    }

    renderKeyboard();
    updateCounters();
    resetGame();
    
    // Event listeners
    document.addEventListener('keydown', handleKeyPress);
    restartButton.addEventListener('click', startGame);
    statsButton.addEventListener('click', openStatsModal);
    overlayStatsButton.addEventListener('click', openStatsModal);
    statsClose.addEventListener('click', closeStatsModal);
    statsModal.addEventListener('click', (e) => {
        if (e.target === statsModal) closeStatsModal();
    });
    playerNameInput.addEventListener('input', () => {
        playerName = playerNameInput.value.trim();
        localStorage.setItem('qwertzsnake_name', playerName);
    });

    // Level designer event listeners
    adminLoginBtn.addEventListener('click', openLoginModal);
    loginClose.addEventListener('click', closeLoginModal);
    loginSubmit.addEventListener('click', handleLogin);
    loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeLoginModal();
    });
    designerClose.addEventListener('click', closeLevelDesigner);
    levelDesignerModal.addEventListener('click', (e) => {
        if (e.target === levelDesignerModal) closeLevelDesigner();
    });
    toolBarrier.addEventListener('click', () => setDesignerTool('barrier'));
    toolEraser.addEventListener('click', () => setDesignerTool('eraser'));
    toolClear.addEventListener('click', clearLevelGrid);
    saveLevelBtn.addEventListener('click', saveLevel);
    
    // Start screen
    showOverlay('qwertZnake', 'Drücke eine Taste zum Starten', false);
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
    kpmElement.textContent = '0';
    
    // Reset level state
    currentLevelIndex = 0;
    currentLevel = null;
    barriers = [];
    maxLevelReached = 0;
    
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
    
    // Reset statistics
    totalKeystrokes = 0;
    fingerUsage = {
        'finger-pinky': 0,
        'finger-ring': 0,
        'finger-middle': 0,
        'finger-index': 0
    };
    
    updateCounters();
}

// Calculate KPM (keystrokes per minute)
function calculateKPM() {
    if (!gameStartTime || totalKeystrokes === 0) return 0;
    const elapsedMinutes = (Date.now() - gameStartTime) / 60000;
    if (elapsedMinutes < 0.01) return 0; // Avoid division issues for very short times
    return Math.round(totalKeystrokes / elapsedMinutes);
}

// Update KPM display
function updateKPMDisplay() {
    if (gameRunning && !gamePaused) {
        kpmElement.textContent = calculateKPM();
    }
}

// Track last game score for saving
let lastGameScore = 0;
let lastGameFingerUsage = {};

// Start game
async function startGame() {
    // Save statistics from previous game if not saved yet
    if (!gameStatsSaved && lastGameScore > 0) {
        await submitStatistics(lastGameKPM, lastGameScore, lastGameFingerUsage);
        gameStatsSaved = true;
    }
    
    resetGame();
    gameRunning = true;
    gamePaused = false;
    pausedByStatsModal = false;
    gameStartTime = Date.now();
    hideOverlay();
    lastUpdate = Date.now();
    gameLoop = requestAnimationFrame(update);
    
    // Start KPM update interval
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
    
    // Store last game data before it gets reset
    lastGameKPM = calculateKPM();
    lastGameScore = score;
    lastGameFingerUsage = { ...fingerUsage };
    gameStatsSaved = false;
    
    // Show game over with stats (don't auto-save, wait for user to click button)
    showOverlay('Game Over!', `Punkte: ${score}`, true, lastGameKPM);
}

// Submit statistics to server
async function submitStatistics(kpm, gameScore, gameFingersUsed) {
    const name = playerName || 'Anonym';
    
    const gameData = {
        name: name,
        points: gameScore,
        kpm: kpm,
        level: maxLevelReached,
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

// Fetch statistics from server
async function fetchStatistics() {
    try {
        const response = await fetch('/api/statistics');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch statistics:', error);
        return [];
    }
}

// Render statistics table
function renderStatisticsTable(stats) {
    if (!stats || stats.length === 0) {
        statsTableBody.innerHTML = '<tr><td colspan="6" class="no-stats">Noch keine Statistiken vorhanden</td></tr>';
        return;
    }
    
    statsTableBody.innerHTML = stats.map((game, index) => {
        const fingerDots = renderFingerDots(game.fingersUsed);
        const levelDisplay = game.level ? `Level ${game.level}` : '-';
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(game.name)}</td>
                <td>${game.points}</td>
                <td>${levelDisplay}</td>
                <td>${game.kpm}</td>
                <td>${fingerDots}</td>
            </tr>
        `;
    }).join('');
}

// Render finger dots for statistics
function renderFingerDots(fingersUsed) {
    if (!fingersUsed) return '-';
    
    const fingers = [
        { key: 'finger-index', class: 'index' },
        { key: 'finger-middle', class: 'middle' },
        { key: 'finger-ring', class: 'ring' },
        { key: 'finger-pinky', class: 'pinky' }
    ];
    
    return `<div class="finger-dots">${fingers.map(f => {
        const count = fingersUsed[f.key] || 0;
        if (count === 0) return '';
        return `<span class="finger-mini ${f.class}">${count}</span>`;
    }).filter(Boolean).join('')}</div>`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open statistics modal
async function openStatsModal() {
    statsModal.classList.add('visible');
    statsTableBody.innerHTML = '<tr><td colspan="5">Lade Statistiken...</td></tr>';
    
    // Pause the game if it's running and not already paused
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        pausedByStatsModal = true;
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    }
    
    const stats = await fetchStatistics();
    renderStatisticsTable(stats);
}

// Close statistics modal
function closeStatsModal() {
    statsModal.classList.remove('visible');
    
    // Resume the game if it was paused by opening the stats modal
    if (gameRunning && pausedByStatsModal) {
        gamePaused = false;
        pausedByStatsModal = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
}

// Show overlay
function showOverlay(title, message, showStats = false, kpm = 0) {
    overlayTitleElement.textContent = title;
    overlayMessageElement.textContent = message;
    overlayElement.classList.remove('hidden');
    
    // Show title screen keyboard if it's the start screen
    const titleKeyboardElement = document.getElementById('titleScreenKeyboard');
    const titleScreenHint = document.querySelector('.title-screen-hint');
    if (titleKeyboardElement && titleScreenHint) {
        if (!gameRunning && !showStats) {
            // Start screen - show keyboard visualization
            renderTitleScreenKeyboard();
            titleKeyboardElement.style.display = 'flex';
            titleScreenHint.style.display = 'flex';
        } else {
            // Game over or pause - hide keyboard visualization
            titleKeyboardElement.style.display = 'none';
            titleScreenHint.style.display = 'none';
        }
    }
    
    if (showStats && score > 0) {
        nameInputSection.classList.add('visible');
        overlayStatsElement.innerHTML = renderOverlayStats(kpm);
        restartButton.textContent = 'Speichern & Neues Spiel';
        restartButton.style.display = 'inline-block';
        saveHint.textContent = 'Dein Ergebnis wird beim Klick gespeichert';
        saveHint.style.display = 'block';
    } else {
        nameInputSection.classList.remove('visible');
        overlayStatsElement.innerHTML = '';
        restartButton.style.display = 'none';
        saveHint.textContent = '';
        saveHint.style.display = 'none';
    }
}

// Render overlay statistics
function renderOverlayStats(kpm) {
    const fingerBadges = renderFingerBadges();
    
    return `
        <div class="overlay-stats-grid">
            <div class="overlay-stat-item">
                <div class="overlay-stat-label">Punkte</div>
                <div class="overlay-stat-value">${score}</div>
            </div>
            <div class="overlay-stat-item">
                <div class="overlay-stat-label">KPM</div>
                <div class="overlay-stat-value">${kpm}</div>
            </div>
        </div>
        <div class="overlay-stat-item" style="margin-bottom: 0;">
            <div class="overlay-stat-label">Finger verwendet</div>
            <div class="overlay-fingers-used">${fingerBadges}</div>
        </div>
    `;
}

// Render finger badges for overlay
function renderFingerBadges() {
    const fingers = [
        { key: 'finger-index', name: 'Zeige', class: 'index' },
        { key: 'finger-middle', name: 'Mittel', class: 'middle' },
        { key: 'finger-ring', name: 'Ring', class: 'ring' },
        { key: 'finger-pinky', name: 'Klein', class: 'pinky' }
    ];
    
    return fingers
        .filter(f => fingerUsage[f.key] > 0)
        .map(f => `<span class="finger-badge ${f.class}">${f.name}<span class="finger-count">${fingerUsage[f.key]}</span></span>`)
        .join('');
}

// Hide overlay
function hideOverlay() {
    overlayElement.classList.add('hidden');
}

// Direction labels in German
const DIRECTION_LABELS = {
    'up': 'OBEN',
    'down': 'UNTEN', 
    'left': 'LINKS',
    'right': 'RECHTS'
};

// Direction arrows
const DIRECTION_ARROWS = {
    'up': '↑',
    'down': '↓',
    'left': '←',
    'right': '→'
};

// Key change modal state
let pendingKeyConfirmation = null;
let keyChangeModalVisible = false;

// Render QWERTZ keyboard in key change modal
function renderKeyChangeKeyboard(newKey) {
    const keyboardContainer = document.getElementById('keyChangeKeyboard');
    keyboardContainer.innerHTML = '';
    
    // Only render the letter rows (not space bar)
    const letterRows = KEYBOARD_ROWS.slice(0, 3);
    
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
            
            rowElement.appendChild(keyElement);
        });
        
        keyboardContainer.appendChild(rowElement);
    });
}

// Show key change modal with entertaining graphics
function showKeyChangeModal(direction, oldKey, newKey) {
    const fingerType = getFingerClass(newKey);
    const fingerHand = getFingerHand(newKey);
    const fingerName = FINGER_NAMES[fingerType] || 'Unbekannt';
    const handLabel = fingerHand === 'links' ? 'links' : 'rechts';
    
    keyChangeDirection.textContent = DIRECTION_LABELS[direction];
    keyChangeDirection.setAttribute('data-arrow', DIRECTION_ARROWS[direction]);
    keyChangeFingerName.textContent = `${fingerName}finger ${handLabel}`;
    keyChangeFingerName.className = `finger-label ${fingerType}`;
    
    // Render the keyboard with highlighted new key
    renderKeyChangeKeyboard(newKey);
    
    // Update hint text
    const hintElement = keyChangeModal.querySelector('.key-change-hint');
    if (hintElement) {
        hintElement.textContent = `Drücke ${newKey.toUpperCase()} zum Fortfahren`;
    }
    
    // Create confetti particles
    createConfetti();
    
    // Show modal and pause game
    keyChangeModal.classList.add('visible');
    keyChangeModalVisible = true;
    pendingKeyConfirmation = newKey;
    
    // Pause the game while modal is shown
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    }
}

// Hide key change modal and resume game
function hideKeyChangeModal() {
    keyChangeModal.classList.remove('visible');
    keyChangeModalVisible = false;
    pendingKeyConfirmation = null;
    
    // Resume the game
    if (gameRunning) {
        gamePaused = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
}

// Create confetti particles for the key change modal
function createConfetti() {
    const container = keyChangeModal.querySelector('.confetti-container');
    container.innerHTML = '';
    
    const colors = ['#ff6b6b', '#ffa500', '#ffd700', '#32cd32', '#667eea', '#764ba2', '#ff69b4', '#00ced1'];
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

// Toggle pause
function togglePause() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    
    if (gamePaused) {
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
        showOverlay('Pausiert', 'Drücke Leertaste zum Fortsetzen', false);
    } else {
        hideOverlay();
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
}

// Spawn food at random position
function spawnFood() {
    let newFood;
    let attempts = 0;
    const maxAttempts = 1000;
    
    do {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        attempts++;
    } while (
        attempts < maxAttempts && (
            snake.some(segment => segment.x === newFood.x && segment.y === newFood.y) ||
            barriers.some(b => b.x === newFood.x && b.y === newFood.y)
        )
    );
    
    food = newFood;
}

// Update game state
function update() {
    if (!gameRunning || gamePaused) return;

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

        // Check barrier collision
        if (barriers.some(b => b.x === head.x && b.y === head.y)) {
            gameOver();
            return;
        }

        // Check food collision
        if (head.x === food.x && head.y === food.y) {
            const oldScore = score;
            score++;
            scoreElement.textContent = score;
            spawnFood();
            
            // Check for level change every 10 points
            checkLevelChange(oldScore, score);
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

    // Draw barriers
    barriers.forEach(barrier => {
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(barrier.x * CELL_SIZE, barrier.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        // Add 3D effect
        ctx.fillStyle = '#654321';
        ctx.fillRect(barrier.x * CELL_SIZE + 2, barrier.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        ctx.fillStyle = '#a0522d';
        ctx.fillRect(barrier.x * CELL_SIZE + 4, barrier.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
    });

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
    
    // Ignore keypresses when typing in input fields
    if (document.activeElement === playerNameInput || 
        document.activeElement === loginPassword ||
        document.activeElement === levelNameInput) {
        return;
    }
    
    // Handle level change modal - only space continues
    if (levelChangeModalVisible) {
        event.preventDefault();
        if (key === ' ' || event.code === 'Space') {
            hideLevelChangeModal();
        }
        return;
    }
    
    // Handle key change modal confirmation
    if (keyChangeModalVisible && pendingKeyConfirmation) {
        event.preventDefault();
        if (key === pendingKeyConfirmation) {
            hideKeyChangeModal();
        }
        return;
    }

    // Handle Escape to close stats modal
    if (key === 'escape') {
        if (statsModal.classList.contains('visible')) {
            closeStatsModal();
            return;
        }
    }

    // Handle space key
    if (key === ' ' || event.code === 'Space') {
        event.preventDefault();
        if (!gameRunning) {
            // Start game if not running
            startGame();
        } else {
            // Pause/resume if game is running
            togglePause();
        }
        return;
    }

    // Start game if not running (for any other key with finger class)
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

    // Prevent default behavior for game keys
    if (getFingerClass(key)) {
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

    // Track keystroke statistics
    if (directionChanged) {
        totalKeystrokes++;
        const fingerType = getFingerClass(key);
        if (fingerType && fingerUsage[fingerType] !== undefined) {
            fingerUsage[fingerType]++;
        }
        
        keyPressCounters[directionChanged]++;
        updateCounters();
        
        if (keyPressCounters[directionChanged] >= PRESSES_PER_CHANGE && score >= MIN_SCORE_FOR_KEY_CHANGE) {
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
        if (keyPool.includes(key) && getFingerClass(key)) {
            const fingerType = getFingerClass(key);
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

    // Store old key for modal display
    const oldKey = controlKeys[direction];

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
    
    // Show key change modal with entertaining graphics
    showKeyChangeModal(direction, oldKey, finalKey);
    
    // Visual feedback for the changed key
    if (keyElements[finalKey]) {
        keyElements[finalKey].style.animation = 'none';
        setTimeout(() => {
            keyElements[finalKey].style.animation = 'pulse 0.5s';
        }, 10);
    }
}

// ============= LEVEL SYSTEM =============

// Load levels from server
async function loadLevels() {
    try {
        const response = await fetch('/api/levels');
        availableLevels = await response.json();
        console.log('Loaded', availableLevels.length, 'levels');
    } catch (error) {
        console.error('Failed to load levels:', error);
        availableLevels = [];
    }
}

// Get level for current score
function getLevelForScore(score) {
    if (availableLevels.length === 0) return null;
    const levelIndex = Math.floor(score / 10);
    if (levelIndex >= availableLevels.length) {
        return availableLevels[availableLevels.length - 1];
    }
    return availableLevels[levelIndex];
}

// Check for level change
function checkLevelChange(oldScore, newScore) {
    if (availableLevels.length === 0) return;
    
    const oldLevelIndex = Math.floor(oldScore / 10);
    const newLevelIndex = Math.floor(newScore / 10);
    
    if (newLevelIndex > oldLevelIndex && newLevelIndex <= availableLevels.length) {
        const newLevel = availableLevels[newLevelIndex - 1]; // -1 because level 1 starts at 10 points
        if (newLevel) {
            currentLevelIndex = newLevelIndex;
            currentLevel = newLevel;
            maxLevelReached = Math.max(maxLevelReached, newLevelIndex);
            
            // Draw the current frame first so player sees they ate the food
            draw();
            
            // Then apply level and show modal after a short delay
            setTimeout(() => {
                applyLevel(newLevel);
                showLevelChangeModal(newLevel, newLevelIndex);
            }, 100);
        }
    }
}

// Apply level barriers and reset snake
function applyLevel(level) {
    if (level && level.barriers) {
        barriers = level.barriers;
    } else {
        barriers = [];
    }
    
    // Reset snake to starting size and position
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    
    // Spawn new food avoiding barriers and snake
    spawnFood();
}

// Show level change modal
function showLevelChangeModal(level, levelNumber) {
    levelChangeName.textContent = level.name || `Level ${levelNumber}`;
    levelChangeNumber.textContent = levelNumber;
    
    // Create confetti
    const container = levelChangeModal.querySelector('.level-confetti-container');
    container.innerHTML = '';
    const colors = ['#32cd32', '#667eea', '#ffd700', '#ff6b6b', '#00ced1'];
    const shapes = ['★', '●', '♦', '▲', '❤'];
    
    for (let i = 0; i < 40; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        particle.style.color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 0.5 + 's';
        particle.style.animationDuration = (1.5 + Math.random() * 1) + 's';
        particle.style.fontSize = (14 + Math.random() * 18) + 'px';
        container.appendChild(particle);
    }
    
    levelChangeModal.classList.add('visible');
    levelChangeModalVisible = true;
    
    // Pause game
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    }
}

// Hide level change modal
function hideLevelChangeModal() {
    levelChangeModal.classList.remove('visible');
    levelChangeModalVisible = false;
    
    // Resume game
    if (gameRunning) {
        gamePaused = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
}

// ============= LOGIN SYSTEM =============

function openLoginModal() {
    closeStatsModal();
    loginModal.classList.add('visible');
    loginPassword.value = '';
    loginError.textContent = '';
    loginPassword.focus();
}

function closeLoginModal() {
    loginModal.classList.remove('visible');
}

async function handleLogin() {
    const password = loginPassword.value;
    loginSubmit.disabled = true;
    loginError.textContent = '';
    
    try {
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (result.valid) {
            closeLoginModal();
            openLevelDesigner();
        } else {
            loginError.textContent = 'Falsches Passwort!';
            loginPassword.value = '';
            loginPassword.focus();
        }
    } catch (error) {
        loginError.textContent = 'Verbindungsfehler!';
    } finally {
        loginSubmit.disabled = false;
    }
}

// ============= LEVEL DESIGNER =============

let currentTool = 'barrier';
let designerBarriers = [];
let isDrawing = false;

function openLevelDesigner() {
    levelDesignerModal.classList.add('visible');
    designerBarriers = [];
    levelNameInput.value = '';
    renderLevelGrid();
    loadSavedLevels();
}

function closeLevelDesigner() {
    levelDesignerModal.classList.remove('visible');
}

function setDesignerTool(tool) {
    currentTool = tool;
    toolBarrier.classList.remove('active');
    toolEraser.classList.remove('active');
    if (tool === 'barrier') {
        toolBarrier.classList.add('active');
    } else if (tool === 'eraser') {
        toolEraser.classList.add('active');
    }
}

function renderLevelGrid() {
    levelGrid.innerHTML = '';
    
    // Define spawn zone (only the 3 cells where snake starts: x 8-10, y 10)
    const spawnZone = ['8,10', '9,10', '10,10'];
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement('div');
            cell.className = 'level-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            const key = `${x},${y}`;
            if (spawnZone.includes(key)) {
                cell.classList.add('spawn-zone');
            }
            if (designerBarriers.some(b => b.x === x && b.y === y)) {
                cell.classList.add('barrier');
            }
            
            cell.addEventListener('mousedown', (e) => {
                isDrawing = true;
                handleCellClick(x, y, spawnZone.includes(key));
            });
            cell.addEventListener('mouseenter', () => {
                if (isDrawing) {
                    handleCellClick(x, y, spawnZone.includes(key));
                }
            });
            
            levelGrid.appendChild(cell);
        }
    }
    
    document.addEventListener('mouseup', () => {
        isDrawing = false;
    });
}

function handleCellClick(x, y, isSpawnZone) {
    if (isSpawnZone) return;
    
    const existingIndex = designerBarriers.findIndex(b => b.x === x && b.y === y);
    
    if (currentTool === 'barrier') {
        if (existingIndex === -1) {
            designerBarriers.push({ x, y });
        }
    } else if (currentTool === 'eraser') {
        if (existingIndex !== -1) {
            designerBarriers.splice(existingIndex, 1);
        }
    }
    
    updateGridCell(x, y);
}

function updateGridCell(x, y) {
    const cells = levelGrid.querySelectorAll('.level-cell');
    const index = y * GRID_SIZE + x;
    const cell = cells[index];
    
    if (cell && !cell.classList.contains('spawn-zone')) {
        const hasBarrier = designerBarriers.some(b => b.x === x && b.y === y);
        cell.classList.toggle('barrier', hasBarrier);
    }
}

function clearLevelGrid() {
    designerBarriers = [];
    renderLevelGrid();
}

async function saveLevel() {
    const name = levelNameInput.value.trim();
    if (!name) {
        alert('Bitte gib einen Level-Namen ein!');
        levelNameInput.focus();
        return;
    }
    
    if (designerBarriers.length === 0) {
        alert('Das Level braucht mindestens eine Barriere!');
        return;
    }
    
    const levelData = {
        name: name,
        barriers: designerBarriers
    };
    
    try {
        const response = await fetch('/api/levels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(levelData)
        });
        
        if (response.ok) {
            alert('Level gespeichert!');
            levelNameInput.value = '';
            designerBarriers = [];
            renderLevelGrid();
            loadSavedLevels();
            await loadLevels(); // Reload levels for game
        } else {
            alert('Fehler beim Speichern!');
        }
    } catch (error) {
        console.error('Failed to save level:', error);
        alert('Fehler beim Speichern!');
    }
}

async function loadSavedLevels() {
    try {
        const response = await fetch('/api/levels');
        const levels = await response.json();
        
        if (levels.length === 0) {
            savedLevelsList.innerHTML = '<p class="no-levels">Keine Levels vorhanden</p>';
            return;
        }
        
        savedLevelsList.innerHTML = levels.map((level, index) => `
            <div class="level-item" data-id="${level.id}">
                <span class="level-item-name">${index + 1}. ${escapeHtml(level.name)}</span>
                <div class="level-item-actions">
                    <button class="level-item-btn edit" onclick="editLevel(${level.id})">✏️</button>
                    <button class="level-item-btn delete" onclick="deleteLevel(${level.id})">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load saved levels:', error);
    }
}

async function deleteLevel(id) {
    if (!confirm('Level wirklich löschen?')) return;
    
    try {
        const response = await fetch(`/api/levels/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadSavedLevels();
            await loadLevels();
        }
    } catch (error) {
        console.error('Failed to delete level:', error);
    }
}

function editLevel(id) {
    const level = availableLevels.find(l => l.id === id);
    if (level) {
        levelNameInput.value = level.name;
        designerBarriers = [...level.barriers];
        renderLevelGrid();
    }
}

// Initialize on load
init();

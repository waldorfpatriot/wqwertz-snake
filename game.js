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

// Tutorial elements
let tutorialModal, tutorialClose, tutorialContent;
let tutorialPrevBtn, tutorialNextBtn;
let tutorialCurrentStepIndicator, tutorialTotalStepsIndicator;
let tutorialCurrentStep = 1;

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
let pausedByLoginModal = false;
let pausedByLevelDesignerModal = false;

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
        if (rowIndex === 0) {
            rowElement.classList.add('keyboard-row-top');
        }

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
        if (rowIndex === 0) {
            rowElement.classList.add('title-keyboard-row-top');
        }

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

    // Tutorial elements
    tutorialModal = document.getElementById('tutorialModal');
    tutorialClose = document.getElementById('tutorialClose');
    tutorialContent = document.getElementById('tutorialContent');
    tutorialPrevBtn = document.getElementById('tutorialBack');
    tutorialNextBtn = document.getElementById('tutorialNext');
    tutorialCurrentStepIndicator = document.getElementById('tutorialCurrentStep');
    tutorialTotalStepsIndicator = document.getElementById('tutorialTotalSteps');

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

    // Tutorial event listeners
    const overlayTutorialButton = document.getElementById('overlayTutorialButton');
    if (overlayTutorialButton) {
        overlayTutorialButton.addEventListener('click', () => openTutorial());
    }
    tutorialClose.addEventListener('click', closeTutorial);
    tutorialModal.addEventListener('click', (e) => {
        if (e.target === tutorialModal) closeTutorial();
    });
    if (tutorialPrevBtn) {
        tutorialPrevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateTutorial(-1);
        });
    }
    if (tutorialNextBtn) {
        tutorialNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigateTutorial(1);
        });
    }

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
    
    // Handle hash navigation
    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);
}

// Handle hash-based navigation
function handleHashNavigation() {
    const hash = window.location.hash.substring(1); // Remove #
    
    if (!hash) {
        // No hash - show start screen if game not running
        if (!gameRunning) {
            showOverlay('qwertZnake', 'Drücke eine Taste zum Starten', false);
        }
        return;
    }
    
    // Handle tutorial steps
    if (hash.startsWith('tutorial-step-')) {
        const stepStr = hash.replace('tutorial-step-', '');
        const step = parseInt(stepStr, 10);
        if (!isNaN(step) && step >= 1 && step <= 6) {
            if (!tutorialModal.classList.contains('visible')) {
                openTutorial(step);
            } else {
                // Already open, just navigate to the step without updating hash
                navigateTutorialToStep(step, false);
            }
            return;
        } else {
            // Invalid step in hash, reset to step 1
            console.warn('Invalid tutorial step in hash:', stepStr);
            window.location.hash = 'tutorial-step-1';
            if (!tutorialModal.classList.contains('visible')) {
                openTutorial(1);
            } else {
                navigateTutorialToStep(1, false);
            }
            return;
        }
    }
    
    // Handle modals and screens
    switch(hash) {
        case 'start':
            if (!gameRunning) {
                showOverlay('qwertZnake', 'Drücke eine Taste zum Starten', false);
            }
            break;
        case 'game':
            if (!gameRunning) {
                startGame();
            }
            break;
        case 'statistics':
            openStatsModal();
            break;
        case 'login':
            openLoginModal();
            break;
        case 'level-editor':
            openLevelDesigner();
            break;
    }
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
    window.location.hash = 'game';
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
    window.location.hash = 'statistics';
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
    // Clear hash if it's statistics
    if (window.location.hash === '#statistics') {
        window.location.hash = '';
    }
    
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
    // Update hash for start screen if not game over
    if (!showStats && !gameRunning) {
        window.location.hash = 'start';
    }
    
    // Show title screen keyboard if it's the start screen
    const titleKeyboardElement = document.getElementById('titleScreenKeyboard');
    const titleScreenHint = document.querySelector('.title-screen-hint');
    const spacebarHint = document.querySelector('.spacebar-hint');
    if (titleKeyboardElement && titleScreenHint) {
        if (!gameRunning && !showStats) {
            // Start screen - show keyboard visualization
            renderTitleScreenKeyboard();
            titleKeyboardElement.style.display = 'flex';
            titleScreenHint.style.display = 'flex';
            // Hide spacebar hint on start screen
            if (spacebarHint) {
                spacebarHint.style.display = 'none';
            }
        } else {
            // Game over or pause - hide keyboard visualization
            titleKeyboardElement.style.display = 'none';
            titleScreenHint.style.display = 'none';
            // Show spacebar hint when paused or game over
            if (spacebarHint) {
                spacebarHint.style.display = 'flex';
            }
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
            ctx.fillStyle = '#32cd32';
        } else {
            // Body
            ctx.fillStyle = '#28a428';
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

    // Handle Escape to close modals
    if (key === 'escape') {
        if (statsModal.classList.contains('visible')) {
            closeStatsModal();
            return;
        }
        if (tutorialModal && tutorialModal.classList.contains('visible')) {
            closeTutorial();
            return;
        }
    }
    
    // Handle tutorial step 1 - check for any key (Warum dieses Spiel)
    if (tutorialModal && tutorialModal.classList.contains('visible') && tutorialCurrentStep === 1) {
        // Accept any key to continue (except Escape which closes modals)
        if (key && key !== 'Escape') {
            event.preventDefault();
            navigateTutorial(1);
        }
        return;
    }

    // Handle tutorial step 2 - check for "j" key (Spielprinzip)
    if (tutorialModal && tutorialModal.classList.contains('visible') && tutorialCurrentStep === 2) {
        if (key === 'j') {
            event.preventDefault();
            navigateTutorial(1);
        }
        return;
    }

    // Handle tutorial step 3 - home row keys to continue (Fingerplatzierung)
    if (tutorialModal && tutorialModal.classList.contains('visible') && tutorialCurrentStep === 3) {
        if (homeRowKeysSequence.includes(key)) {
            event.preventDefault();
            const expectedKey = homeRowKeysSequence[homeRowKeysPressed.length];
            
            if (key === expectedKey) {
                // Correct key in sequence
                homeRowKeysPressed.push(key);
                updateHomeRowKeyCheckmarks();
                
                // Check if all keys have been pressed
                if (homeRowKeysPressed.length === homeRowKeysSequence.length) {
                    // All keys pressed in order - advance to next step
                    setTimeout(() => {
                        navigateTutorial(1);
                    }, 500); // Small delay to show final checkmark
                }
            } else {
                // Wrong key - reset
                homeRowKeysPressed = [];
                updateHomeRowKeyCheckmarks();
            }
            return;
        }
    }

    // Handle tutorial step 4 - highlight keys when pressed and check for "verstanden" (Fingerzuordnung)
    if (tutorialModal && tutorialModal.classList.contains('visible') && tutorialCurrentStep === 4) {
        // Find the key-box element with matching data-key attribute
        const keyBox = document.querySelector(`.tutorial-step[data-step="4"] .key-box[data-key="${key}"]`);
        if (keyBox) {
            event.preventDefault();
            // Remove highlight from all keys first
            document.querySelectorAll('.tutorial-step[data-step="4"] .key-box').forEach(box => {
                box.classList.remove('highlighted');
            });
            // Add highlight to the pressed key
            keyBox.classList.add('highlighted');
            // Remove highlight after animation
            setTimeout(() => {
                keyBox.classList.remove('highlighted');
            }, 400);
        }
        
        // Check for typing "verstanden"
        const expectedKey = verstandenSequence[verstandenTyped.length];
        if (key === expectedKey) {
            event.preventDefault();
            verstandenTyped.push(key);
            updateVerstandenKeys();
            
            // Check if all keys have been pressed
            if (verstandenTyped.length === verstandenSequence.length) {
                // All keys pressed in order - advance to next step
                setTimeout(() => {
                    navigateTutorial(1);
                }, 500);
            }
        } else if (verstandenSequence.includes(key)) {
            // Wrong key in sequence - reset
            event.preventDefault();
            verstandenTyped = [];
            updateVerstandenKeys();
        }
    }

    // Handle tutorial step 5 - highlight keys when pressed and check for "zeigefinger" (Farbcodierung)
    if (tutorialModal && tutorialModal.classList.contains('visible') && tutorialCurrentStep === 5) {
        // Find the keyboard key element with matching data-key attribute
        const keyboardKey = document.querySelector(`.tutorial-step[data-step="5"] .keyboard-key[data-key="${key}"]`);
        if (keyboardKey) {
            event.preventDefault();
            // Remove highlight from all keys first
            document.querySelectorAll('.tutorial-step[data-step="5"] .keyboard-key').forEach(k => {
                k.classList.remove('key-highlighted');
            });
            // Add highlight to the pressed key
            keyboardKey.classList.add('key-highlighted');
            // Remove highlight after animation
            setTimeout(() => {
                keyboardKey.classList.remove('key-highlighted');
            }, 400);
        }
        
        // Check for typing "zeigefinger"
        const expectedKey = zeigefingerSequence[zeigefingerTyped.length];
        if (key === expectedKey) {
            event.preventDefault();
            zeigefingerTyped.push(key);
            updateZeigefingerKeys();
            
            // Check if all keys have been pressed
            if (zeigefingerTyped.length === zeigefingerSequence.length) {
                // All keys pressed in order - advance to next step
                setTimeout(() => {
                    navigateTutorial(1);
                }, 500);
            }
        } else if (zeigefingerSequence.includes(key)) {
            // Wrong key in sequence - reset
            event.preventDefault();
            zeigefingerTyped = [];
            updateZeigefingerKeys();
        }
    }

    // Handle tutorial step 6 - check for typing "los gehts" (Benutzeroberfläche)
    if (tutorialModal && tutorialModal.classList.contains('visible') && tutorialCurrentStep === 6) {
        // Handle space key for "los gehts" sequence
        const expectedKey = losgehtsSequence[losgehtsTyped.length];
        const normalizedKey = (key === ' ' || event.code === 'Space') ? ' ' : key;
        
        if (normalizedKey === expectedKey) {
            event.preventDefault();
            losgehtsTyped.push(normalizedKey);
            updateLosgehtsKeys();
            
            // Check if all keys have been pressed
            if (losgehtsTyped.length === losgehtsSequence.length) {
                // All keys pressed in order - close tutorial (last step)
                setTimeout(() => {
                    closeTutorial();
                }, 500);
            }
        } else if (losgehtsSequence.includes(normalizedKey)) {
            // Wrong key in sequence - reset
            event.preventDefault();
            losgehtsTyped = [];
            updateLosgehtsKeys();
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
    const colors = ['#32cd32', '#888', '#ffd700', '#ff6b6b', '#00ced1'];
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
    // Pause the game if it's running and not already paused
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        pausedByLoginModal = true;
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    }
    loginModal.classList.add('visible');
    window.location.hash = 'login';
    loginPassword.value = '';
    loginError.textContent = '';
    loginPassword.focus();
}

function closeLoginModal() {
    loginModal.classList.remove('visible');
    // Clear hash if it's login
    if (window.location.hash === '#login') {
        window.location.hash = '';
    }
    // Resume the game if it was paused by opening the login modal
    if (gameRunning && pausedByLoginModal) {
        gamePaused = false;
        pausedByLoginModal = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
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
    // Pause the game if it's running and not already paused
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        pausedByLevelDesignerModal = true;
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    }
    levelDesignerModal.classList.add('visible');
    window.location.hash = 'level-editor';
    designerBarriers = [];
    levelNameInput.value = '';
    renderLevelGrid();
    loadSavedLevels();
}

function closeLevelDesigner() {
    levelDesignerModal.classList.remove('visible');
    // Clear hash if it's level-editor
    if (window.location.hash === '#level-editor') {
        window.location.hash = '';
    }
    // Resume the game if it was paused by opening the level designer modal
    if (gameRunning && pausedByLevelDesignerModal) {
        gamePaused = false;
        pausedByLevelDesignerModal = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
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

// ============= TUTORIAL SYSTEM =============

// Home row animation interval
let homeRowAnimationInterval = null;
// Tutorial demo animation timeout
let tutorialDemoAnimationTimeout = null;
// Track if game was paused by tutorial modal
let pausedByTutorialModal = false;
// Track home row key presses for step 1
let homeRowKeysPressed = [];
const homeRowKeysSequence = ['a', 's', 'd', 'f', 'j', 'k', 'l', 'ö'];

// Track "verstanden" typing for step 2
let verstandenTyped = [];
const verstandenSequence = ['v', 'e', 'r', 's', 't', 'a', 'n', 'd', 'e', 'n'];

// Track "zeigefinger" typing for step 3
let zeigefingerTyped = [];
const zeigefingerSequence = ['z', 'e', 'i', 'g', 'e', 'f', 'i', 'n', 'g', 'e', 'r'];

// Track "los gehts" typing for step 4
let losgehtsTyped = [];
const losgehtsSequence = ['l', 'o', 's', ' ', 'g', 'e', 'h', 't', 's'];

// Open tutorial modal
function openTutorial(step = 1) {
    // Ensure step is always a number
    const stepNumber = typeof step === 'number' ? step : parseInt(step, 10);
    if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 6) {
        console.error('Invalid tutorial step:', step);
        return;
    }
    
    // Pause the game if it's running and not already paused
    if (gameRunning && !gamePaused) {
        gamePaused = true;
        pausedByTutorialModal = true;
        if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    }
    
    tutorialModal.classList.add('visible');
    tutorialCurrentStep = stepNumber;
    setTutorialStep(stepNumber);
    
    // Update hash
    window.location.hash = `tutorial-step-${stepNumber}`;
    
    // Reset home row key presses
    homeRowKeysPressed = [];
    verstandenTyped = [];
    zeigefingerTyped = [];
    losgehtsTyped = [];
    
    // Render keyboards for tutorial steps
    setTimeout(() => {
        renderTutorialHomeRow();
        renderTutorialKeyboards();
        renderTutorialGameDemo();
        renderTutorialStep1Keyboard();
        renderVerstandenKeys();
        renderZeigefingerKeys();
        renderLosgehtsKeys();
        renderJKey();
    }, 100);
}

// Close tutorial modal
function closeTutorial() {
    tutorialModal.classList.remove('visible');
    // Clear hash if it's a tutorial hash
    if (window.location.hash.startsWith('#tutorial-step-')) {
        window.location.hash = '';
    }
    // Clear all animations
    if (homeRowAnimationInterval) {
        clearInterval(homeRowAnimationInterval);
        homeRowAnimationInterval = null;
    }
    if (verstandenAnimationInterval) {
        clearInterval(verstandenAnimationInterval);
        verstandenAnimationInterval = null;
    }
    if (zeigefingerAnimationInterval) {
        clearInterval(zeigefingerAnimationInterval);
        zeigefingerAnimationInterval = null;
    }
    if (losgehtsAnimationInterval) {
        clearInterval(losgehtsAnimationInterval);
        losgehtsAnimationInterval = null;
    }
    if (tutorialMiniGameAnimation) {
        clearInterval(tutorialMiniGameAnimation);
        tutorialMiniGameAnimation = null;
    }
    // Clear tutorial demo animation
    if (tutorialDemoAnimationTimeout) {
        clearTimeout(tutorialDemoAnimationTimeout);
        tutorialDemoAnimationTimeout = null;
    }
    
    // Resume the game if it was paused by opening the tutorial modal
    if (gameRunning && pausedByTutorialModal) {
        gamePaused = false;
        pausedByTutorialModal = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
}

// Set tutorial step (updates data attribute for CSS)
function setTutorialStep(step) {
    // Ensure step is always a number
    const stepNumber = typeof step === 'number' ? step : parseInt(step, 10);
    if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 6) {
        console.error('Invalid tutorial step:', step);
        return;
    }
    tutorialCurrentStep = stepNumber;
    tutorialModal.setAttribute('data-current-step', stepNumber);
    if (tutorialCurrentStepIndicator) {
        tutorialCurrentStepIndicator.textContent = stepNumber;
    }
}

// Navigate tutorial steps to a specific step (used by hash navigation)
function navigateTutorialToStep(step, updateHash = true) {
    // Ensure step is always a number
    const stepNumber = typeof step === 'number' ? step : parseInt(step, 10);
    if (isNaN(stepNumber) || stepNumber < 1 || stepNumber > 6) {
        console.error('Invalid tutorial step:', step);
        return;
    }
    
    if (stepNumber >= 1 && stepNumber <= 6) {
        // Update hash if requested
        if (updateHash) {
            window.location.hash = `tutorial-step-${stepNumber}`;
        }
        // Reset demo animation when leaving step 1 (Warum dieses Spiel)
        if (tutorialCurrentStep === 1 && stepNumber !== 1) {
            // Clear tutorial demo animation
            if (tutorialDemoAnimationTimeout) {
                clearTimeout(tutorialDemoAnimationTimeout);
                tutorialDemoAnimationTimeout = null;
            }
        }
        
        // Clear home row animation if leaving step 3 (Fingerplatzierung)
        if (tutorialCurrentStep === 3 && stepNumber !== 3) {
            if (homeRowAnimationInterval) {
                clearInterval(homeRowAnimationInterval);
                homeRowAnimationInterval = null;
            }
            // Reset key presses when leaving step 3
            homeRowKeysPressed = [];
        }
        
        // Reset verstanden typing when leaving step 4 (Fingerzuordnung)
        if (tutorialCurrentStep === 4 && stepNumber !== 4) {
            if (verstandenAnimationInterval) {
                clearInterval(verstandenAnimationInterval);
                verstandenAnimationInterval = null;
            }
            verstandenTyped = [];
            updateVerstandenKeys();
        }
        
        // Reset zeigefinger typing when leaving step 5 (Farbcodierung)
        if (tutorialCurrentStep === 5 && stepNumber !== 5) {
            if (zeigefingerAnimationInterval) {
                clearInterval(zeigefingerAnimationInterval);
                zeigefingerAnimationInterval = null;
            }
            zeigefingerTyped = [];
            updateZeigefingerKeys();
        }
        
        // Reset los gehts typing when leaving step 6 (Benutzeroberfläche)
        if (tutorialCurrentStep === 6 && stepNumber !== 6) {
            if (losgehtsAnimationInterval) {
                clearInterval(losgehtsAnimationInterval);
                losgehtsAnimationInterval = null;
            }
            losgehtsTyped = [];
            updateLosgehtsKeys();
        }
        
        setTutorialStep(stepNumber);
        
        // Scroll to top of tutorial content
        const contentInner = document.querySelector('.tutorial-modal-content-inner');
        if (contentInner) {
            contentInner.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Re-render keyboards if needed
        if (stepNumber === 1) {
            setTimeout(() => {
                renderTutorialGameDemo();
                renderTutorialStep1Keyboard();
            }, 100);
        } else if (stepNumber === 2) {
            setTimeout(() => {
                renderJKey();
            }, 100);
        } else if (stepNumber === 3) {
            setTimeout(() => {
                renderTutorialHomeRow();
            }, 100);
        } else if (stepNumber === 4) {
            setTimeout(() => {
                renderVerstandenKeys();
            }, 100);
        } else if (stepNumber === 5) {
            setTimeout(() => {
                renderTutorialKeyboards();
                renderZeigefingerKeys();
            }, 100);
        } else if (stepNumber === 6) {
            setTimeout(() => {
                renderTutorialMiniComponents();
                renderLosgehtsKeys();
            }, 100);
        }
    }
}

// Navigate tutorial steps
function navigateTutorial(direction) {
    // Ensure direction is always a number
    const directionNumber = typeof direction === 'number' ? direction : parseInt(direction, 10);
    if (isNaN(directionNumber)) {
        console.error('Invalid tutorial direction:', direction);
        return;
    }
    
    const newStep = tutorialCurrentStep + directionNumber;
    navigateTutorialToStep(newStep, true);
}

// Render home row for tutorial step 1
function renderTutorialHomeRow() {
    const homeRowContainer = document.getElementById('tutorialHomeRow');
    if (!homeRowContainer) return;
    
    homeRowContainer.innerHTML = '';
    
    // Get the home row (second row: a, s, d, f, g, h, j, k, l, ö, ä)
    const homeRow = KEYBOARD_ROWS[1]; // ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä']
    
    const rowElement = document.createElement('div');
    rowElement.className = 'home-row-keyboard-row';
    
    homeRow.forEach(key => {
        const keyElement = document.createElement('div');
        keyElement.className = `home-row-key ${getFingerClass(key)}`;
        
        // Highlight home row keys
        if (['a', 's', 'd', 'f', 'j', 'k', 'l', 'ö'].includes(key)) {
            keyElement.classList.add('home-row-resting');
        }
        
        if (key.length === 1 && /[a-zäöü]/.test(key)) {
            keyElement.textContent = key.toUpperCase();
        } else {
            keyElement.textContent = key;
        }
        
        rowElement.appendChild(keyElement);
    });
    
    homeRowContainer.appendChild(rowElement);
    
    // Set up key animation in instruction text
    animateHomeRowKeys();
}

// Animate home row keys in instruction text
function animateHomeRowKeys() {
    // Clear any existing animation
    if (homeRowAnimationInterval) {
        clearInterval(homeRowAnimationInterval);
        homeRowAnimationInterval = null;
    }
    
    // Reset key presses
    homeRowKeysPressed = [];
    
    // Find the instruction element specifically in step 3 (Fingerplatzierung)
    const step1Element = document.querySelector('#tutorial-step-3');
    if (!step1Element) return;
    
    const instructionElement = step1Element.querySelector('.home-row-keys');
    if (!instructionElement) return;
    
    const keys = ['A', 'S', 'D', 'F', 'J', 'K', 'L', 'Ö'];
    let currentKeyIndex = 0;
    
    // Create key elements with checkmark placeholders and finger color classes
    instructionElement.innerHTML = keys.map((key, index) => {
        const keyLower = key.toLowerCase();
        const fingerClass = getFingerClass(keyLower);
        return `<span class="home-row-key-wrapper">
            <span class="home-row-key-animate ${fingerClass}" data-key="${keyLower}" data-index="${index}">${key}</span>
            <span class="home-row-checkmark" data-index="${index}">✓</span>
        </span>`;
    }).join('');
    
    const keyElements = instructionElement.querySelectorAll('.home-row-key-animate');
    
    function highlightNextKey() {
        // Only animate if we haven't completed the sequence
        if (homeRowKeysPressed.length < homeRowKeysSequence.length) {
            // Remove active class from all keys
            keyElements.forEach(el => el.classList.remove('active'));
            
            // Add active class to next expected key
            const nextKeyIndex = homeRowKeysPressed.length;
            if (keyElements[nextKeyIndex]) {
                keyElements[nextKeyIndex].classList.add('active');
            }
        }
    }
    
    function animateCycle() {
        // Only cycle if no keys have been pressed yet
        if (homeRowKeysPressed.length === 0) {
            // Check if we're about to show Ö (last key, index 7)
            const aboutToShowLastKey = currentKeyIndex === keys.length - 1;
            
            // Remove active class and pause class from all keys
            keyElements.forEach(el => {
                el.classList.remove('active', 'pausing');
            });
            
            // Add active class to current key in cycle
            if (keyElements[currentKeyIndex]) {
                keyElements[currentKeyIndex].classList.add('active');
            }
            
            // Move to next key in cycle
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            
            // If we just showed Ö, signal to pause (keep Ö active)
            if (aboutToShowLastKey) {
                return true;
            }
        }
        return false;
    }
    
    function startPauseAnimation() {
        // Find the Ö key (last key, index 7) and add pausing class
        // It should already have active class from animateCycle
        const lastKeyIndex = keys.length - 1;
        if (keyElements[lastKeyIndex]) {
            keyElements[lastKeyIndex].classList.add('pausing');
        }
    }
    
    function stopPauseAnimation() {
        // Remove pausing class from all keys
        keyElements.forEach(el => el.classList.remove('pausing'));
    }
    
    // Start by highlighting the first key
    highlightNextKey();
    
    // Start cycling animation (only runs when no keys pressed)
    let cyclePaused = false;
    let pauseEndTime = 0;
    homeRowAnimationInterval = setInterval(() => {
        if (tutorialCurrentStep !== 3 || !tutorialModal.classList.contains('visible')) {
            clearInterval(homeRowAnimationInterval);
            return;
        }
        // Only cycle if no keys have been pressed yet
        if (homeRowKeysPressed.length === 0) {
            if (cyclePaused) {
                // Check if pause time has elapsed (2 seconds)
                if (Date.now() >= pauseEndTime) {
                    // Resume after pause - show A again
                    stopPauseAnimation();
                    cyclePaused = false;
                    animateCycle();
                }
            } else {
                const shouldPause = animateCycle();
                if (shouldPause) {
                    // Don't remove active class from Ö, just add pausing
                    cyclePaused = true;
                    pauseEndTime = Date.now() + 2000; // Pause for 2 seconds
                    startPauseAnimation();
                }
            }
        }
    }, 400); // Cycle every 0.4 seconds
}

// Update checkmarks for pressed keys
function updateHomeRowKeyCheckmarks() {
    const checkmarks = document.querySelectorAll('.home-row-checkmark');
    const keyElements = document.querySelectorAll('.home-row-key-animate');
    
    checkmarks.forEach((checkmark, index) => {
        if (index < homeRowKeysPressed.length) {
            checkmark.classList.add('checked');
        } else {
            checkmark.classList.remove('checked');
        }
    });
    
    // Immediately highlight the next expected key
    if (homeRowKeysPressed.length < homeRowKeysSequence.length) {
        // Remove active class from all keys
        keyElements.forEach(el => el.classList.remove('active'));
        
        // Add active class to next expected key
        const nextKeyIndex = homeRowKeysPressed.length;
        if (keyElements[nextKeyIndex]) {
            keyElements[nextKeyIndex].classList.add('active');
        }
    }
}

// Animation interval for verstanden keys
let verstandenAnimationInterval = null;

// Render "verstanden" keys for step 2
function renderVerstandenKeys() {
    const verstandenKeysElement = document.getElementById('verstandenKeys');
    if (!verstandenKeysElement) return;
    
    const keys = ['V', 'E', 'R', 'S', 'T', 'A', 'N', 'D', 'E', 'N'];
    
    verstandenKeysElement.innerHTML = keys.map((key, index) => {
        const keyLower = key.toLowerCase();
        const fingerClass = getFingerClass(keyLower);
        return `<span class="home-row-key-wrapper">
            <span class="home-row-key-animate ${fingerClass}" data-key="${keyLower}" data-index="${index}">${key}</span>
            <span class="home-row-checkmark" data-index="${index}">✓</span>
        </span>`;
    }).join('');
    
    // Set up animation
    animateVerstandenKeys();
}

// Animate verstanden keys
function animateVerstandenKeys() {
    // Clear any existing animation
    if (verstandenAnimationInterval) {
        clearInterval(verstandenAnimationInterval);
    }
    
    // Reset typing
    verstandenTyped = [];
    
    const verstandenKeysElement = document.getElementById('verstandenKeys');
    if (!verstandenKeysElement) return;
    
    const keys = ['V', 'E', 'R', 'S', 'T', 'A', 'N', 'D', 'E', 'N'];
    let currentKeyIndex = 0;
    const keyElements = verstandenKeysElement.querySelectorAll('.home-row-key-animate');
    
    function animateCycle() {
        // Only cycle if no keys have been pressed yet
        if (verstandenTyped.length === 0) {
            // Check if we're about to show N (last key, index 9)
            const aboutToShowLastKey = currentKeyIndex === keys.length - 1;
            
            // Remove active class and pause class from all keys
            keyElements.forEach(el => {
                el.classList.remove('active', 'pausing');
            });
            
            // Add active class to current key in cycle
            if (keyElements[currentKeyIndex]) {
                keyElements[currentKeyIndex].classList.add('active');
            }
            
            // Move to next key in cycle
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            
            // If we just showed N, signal to pause
            if (aboutToShowLastKey) {
                return true;
            }
        }
        return false;
    }
    
    function startPauseAnimation() {
        const lastKeyIndex = keys.length - 1;
        if (keyElements[lastKeyIndex]) {
            keyElements[lastKeyIndex].classList.add('pausing');
        }
    }
    
    function stopPauseAnimation() {
        keyElements.forEach(el => el.classList.remove('pausing'));
    }
    
    // Start by highlighting the first key
    if (keyElements[0]) {
        keyElements[0].classList.add('active');
    }
    
    // Start cycling animation
    let cyclePaused = false;
    let pauseEndTime = 0;
    verstandenAnimationInterval = setInterval(() => {
        if (tutorialCurrentStep !== 4 || !tutorialModal.classList.contains('visible')) {
            clearInterval(verstandenAnimationInterval);
            return;
        }
        // Only cycle if no keys have been pressed yet
        if (verstandenTyped.length === 0) {
            if (cyclePaused) {
                // Check if pause time has elapsed (2 seconds)
                if (Date.now() >= pauseEndTime) {
                    // Resume after pause - show V again
                    stopPauseAnimation();
                    cyclePaused = false;
                    animateCycle();
                }
            } else {
                const shouldPause = animateCycle();
                if (shouldPause) {
                    cyclePaused = true;
                    pauseEndTime = Date.now() + 2000; // Pause for 2 seconds
                    startPauseAnimation();
                }
            }
        }
    }, 400); // Cycle every 0.4 seconds
}

// Update "verstanden" keys display
function updateVerstandenKeys() {
    const checkmarks = document.querySelectorAll('#verstandenKeys .home-row-checkmark');
    const keyElements = document.querySelectorAll('#verstandenKeys .home-row-key-animate');
    
    checkmarks.forEach((checkmark, index) => {
        if (index < verstandenTyped.length) {
            checkmark.classList.add('checked');
        } else {
            checkmark.classList.remove('checked');
        }
    });
    
    // Immediately highlight the next expected key
    if (verstandenTyped.length < verstandenSequence.length) {
        // Remove active class from all keys
        keyElements.forEach(el => el.classList.remove('active'));
        
        // Add active class to next expected key
        const nextKeyIndex = verstandenTyped.length;
        if (keyElements[nextKeyIndex]) {
            keyElements[nextKeyIndex].classList.add('active');
        }
    }
}

// Animation interval for zeigefinger keys
let zeigefingerAnimationInterval = null;

// Render "zeigefinger" keys for step 3
function renderZeigefingerKeys() {
    const zeigefingerKeysElement = document.getElementById('zeigefingerKeys');
    if (!zeigefingerKeysElement) return;
    
    const keys = ['Z', 'E', 'I', 'G', 'E', 'F', 'I', 'N', 'G', 'E', 'R'];
    
    zeigefingerKeysElement.innerHTML = keys.map((key, index) => {
        const keyLower = key.toLowerCase();
        const fingerClass = getFingerClass(keyLower);
        return `<span class="home-row-key-wrapper">
            <span class="home-row-key-animate ${fingerClass}" data-key="${keyLower}" data-index="${index}">${key}</span>
            <span class="home-row-checkmark" data-index="${index}">✓</span>
        </span>`;
    }).join('');
    
    // Set up animation
    animateZeigefingerKeys();
}

// Animate zeigefinger keys
function animateZeigefingerKeys() {
    // Clear any existing animation
    if (zeigefingerAnimationInterval) {
        clearInterval(zeigefingerAnimationInterval);
    }
    
    // Reset typing
    zeigefingerTyped = [];
    
    const zeigefingerKeysElement = document.getElementById('zeigefingerKeys');
    if (!zeigefingerKeysElement) return;
    
    const keys = ['Z', 'E', 'I', 'G', 'E', 'F', 'I', 'N', 'G', 'E', 'R'];
    let currentKeyIndex = 0;
    const keyElements = zeigefingerKeysElement.querySelectorAll('.home-row-key-animate');
    
    function animateCycle() {
        // Only cycle if no keys have been pressed yet
        if (zeigefingerTyped.length === 0) {
            // Check if we're about to show R (last key, index 10)
            const aboutToShowLastKey = currentKeyIndex === keys.length - 1;
            
            // Remove active class and pause class from all keys
            keyElements.forEach(el => {
                el.classList.remove('active', 'pausing');
            });
            
            // Add active class to current key in cycle
            if (keyElements[currentKeyIndex]) {
                keyElements[currentKeyIndex].classList.add('active');
            }
            
            // Move to next key in cycle
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            
            // If we just showed R, signal to pause
            if (aboutToShowLastKey) {
                return true;
            }
        }
        return false;
    }
    
    function startPauseAnimation() {
        const lastKeyIndex = keys.length - 1;
        if (keyElements[lastKeyIndex]) {
            keyElements[lastKeyIndex].classList.add('pausing');
        }
    }
    
    function stopPauseAnimation() {
        keyElements.forEach(el => el.classList.remove('pausing'));
    }
    
    // Start by highlighting the first key
    if (keyElements[0]) {
        keyElements[0].classList.add('active');
    }
    
    // Start cycling animation
    let cyclePaused = false;
    let pauseEndTime = 0;
    zeigefingerAnimationInterval = setInterval(() => {
        if (tutorialCurrentStep !== 5 || !tutorialModal.classList.contains('visible')) {
            clearInterval(zeigefingerAnimationInterval);
            return;
        }
        // Only cycle if no keys have been pressed yet
        if (zeigefingerTyped.length === 0) {
            if (cyclePaused) {
                // Check if pause time has elapsed (2 seconds)
                if (Date.now() >= pauseEndTime) {
                    // Resume after pause - show Z again
                    stopPauseAnimation();
                    cyclePaused = false;
                    animateCycle();
                }
            } else {
                const shouldPause = animateCycle();
                if (shouldPause) {
                    cyclePaused = true;
                    pauseEndTime = Date.now() + 2000; // Pause for 2 seconds
                    startPauseAnimation();
                }
            }
        }
    }, 400); // Cycle every 0.4 seconds
}

// Update "zeigefinger" keys display
function updateZeigefingerKeys() {
    const checkmarks = document.querySelectorAll('#zeigefingerKeys .home-row-checkmark');
    const keyElements = document.querySelectorAll('#zeigefingerKeys .home-row-key-animate');
    
    checkmarks.forEach((checkmark, index) => {
        if (index < zeigefingerTyped.length) {
            checkmark.classList.add('checked');
        } else {
            checkmark.classList.remove('checked');
        }
    });
    
    // Immediately highlight the next expected key
    if (zeigefingerTyped.length < zeigefingerSequence.length) {
        // Remove active class from all keys
        keyElements.forEach(el => el.classList.remove('active'));
        
        // Add active class to next expected key
        const nextKeyIndex = zeigefingerTyped.length;
        if (keyElements[nextKeyIndex]) {
            keyElements[nextKeyIndex].classList.add('active');
        }
    }
}

// Animation interval for los gehts keys
let losgehtsAnimationInterval = null;

// Render "los gehts" keys for step 4
function renderLosgehtsKeys() {
    const losgehtsKeysElement = document.getElementById('losgehtsKeys');
    if (!losgehtsKeysElement) return;
    
    const keys = ['L', 'O', 'S', ' ', 'G', 'E', 'H', 'T', 'S'];
    
    losgehtsKeysElement.innerHTML = keys.map((key, index) => {
        if (key === ' ') {
            return `<span class="home-row-key-wrapper">
                <span class="home-row-key-animate keyboard-space" data-key=" " data-index="${index}">SPACE</span>
                <span class="home-row-checkmark" data-index="${index}">✓</span>
            </span>`;
        }
        const keyLower = key.toLowerCase();
        const fingerClass = getFingerClass(keyLower);
        return `<span class="home-row-key-wrapper">
            <span class="home-row-key-animate ${fingerClass}" data-key="${keyLower}" data-index="${index}">${key}</span>
            <span class="home-row-checkmark" data-index="${index}">✓</span>
        </span>`;
    }).join('');
    
    // Set up animation
    animateLosgehtsKeys();
}

// Animate los gehts keys
function animateLosgehtsKeys() {
    // Clear any existing animation
    if (losgehtsAnimationInterval) {
        clearInterval(losgehtsAnimationInterval);
    }
    
    // Reset typing
    losgehtsTyped = [];
    
    const losgehtsKeysElement = document.getElementById('losgehtsKeys');
    if (!losgehtsKeysElement) return;
    
    const keys = ['L', 'O', 'S', ' ', 'G', 'E', 'H', 'T', 'S'];
    let currentKeyIndex = 0;
    const keyElements = losgehtsKeysElement.querySelectorAll('.home-row-key-animate');
    
    function animateCycle() {
        // Only cycle if no keys have been pressed yet
        if (losgehtsTyped.length === 0) {
            // Check if we're about to show S (last key, index 8)
            const aboutToShowLastKey = currentKeyIndex === keys.length - 1;
            
            // Remove active class and pause class from all keys
            keyElements.forEach(el => {
                el.classList.remove('active', 'pausing');
            });
            
            // Add active class to current key in cycle
            if (keyElements[currentKeyIndex]) {
                keyElements[currentKeyIndex].classList.add('active');
            }
            
            // Move to next key in cycle
            currentKeyIndex = (currentKeyIndex + 1) % keys.length;
            
            // If we just showed S, signal to pause
            if (aboutToShowLastKey) {
                return true;
            }
        }
        return false;
    }
    
    function startPauseAnimation() {
        const lastKeyIndex = keys.length - 1;
        if (keyElements[lastKeyIndex]) {
            keyElements[lastKeyIndex].classList.add('pausing');
        }
    }
    
    function stopPauseAnimation() {
        keyElements.forEach(el => el.classList.remove('pausing'));
    }
    
    // Start by highlighting the first key
    if (keyElements[0]) {
        keyElements[0].classList.add('active');
    }
    
    // Start cycling animation
    let cyclePaused = false;
    let pauseEndTime = 0;
    losgehtsAnimationInterval = setInterval(() => {
        if (tutorialCurrentStep !== 6 || !tutorialModal.classList.contains('visible')) {
            clearInterval(losgehtsAnimationInterval);
            return;
        }
        // Only cycle if no keys have been pressed yet
        if (losgehtsTyped.length === 0) {
            if (cyclePaused) {
                // Check if pause time has elapsed (2 seconds)
                if (Date.now() >= pauseEndTime) {
                    // Resume after pause - show L again
                    stopPauseAnimation();
                    cyclePaused = false;
                    animateCycle();
                }
            } else {
                const shouldPause = animateCycle();
                if (shouldPause) {
                    cyclePaused = true;
                    pauseEndTime = Date.now() + 2000; // Pause for 2 seconds
                    startPauseAnimation();
                }
            }
        }
    }, 400); // Cycle every 0.4 seconds
}

// Update "los gehts" keys display
function updateLosgehtsKeys() {
    const checkmarks = document.querySelectorAll('#losgehtsKeys .home-row-checkmark');
    const keyElements = document.querySelectorAll('#losgehtsKeys .home-row-key-animate');
    
    checkmarks.forEach((checkmark, index) => {
        if (index < losgehtsTyped.length) {
            checkmark.classList.add('checked');
        } else {
            checkmark.classList.remove('checked');
        }
    });
    
    // Immediately highlight the next expected key
    if (losgehtsTyped.length < losgehtsSequence.length) {
        // Remove active class from all keys
        keyElements.forEach(el => el.classList.remove('active'));
        
        // Add active class to next expected key
        const nextKeyIndex = losgehtsTyped.length;
        if (keyElements[nextKeyIndex]) {
            keyElements[nextKeyIndex].classList.add('active');
        }
    }
}

// Render keyboards for tutorial
function renderTutorialKeyboards() {
    // Render keyboard for step 1
    const keyboard1 = document.getElementById('tutorialKeyboard1');
    if (keyboard1) {
        keyboard1.innerHTML = '';
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
                    keyElement.textContent = 'SPACE';
                } else {
                    keyElement.className = `keyboard-key ${getFingerClass(key)}`;
                    keyElement.dataset.key = key; // Add data-key for highlighting
                    if (key.length === 1 && /[a-zäöü]/.test(key)) {
                        keyElement.textContent = key.toUpperCase();
                    } else {
                        keyElement.textContent = key;
                    }
                }
                rowElement.appendChild(keyElement);
            });
            
            keyboard1.appendChild(rowElement);
        });
    }
    
    // Render keyboard for step 2 with active controls
    const keyboard2 = document.getElementById('tutorialKeyboard2');
    if (keyboard2) {
        keyboard2.innerHTML = '';
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
                    keyElement.textContent = 'SPACE';
                } else {
                    keyElement.className = `keyboard-key ${getFingerClass(key)}`;
                    if (key.length === 1 && /[a-zäöü]/.test(key)) {
                        keyElement.textContent = key.toUpperCase();
                    } else {
                        keyElement.textContent = key;
                    }
                    
                    // Show example active controls (T, B, F, J)
                    if (['t', 'b', 'f', 'j'].includes(key)) {
                        keyElement.classList.add('active-control');
                        const directionMap = {
                            't': { dir: 'up', arrow: '↑' },
                            'b': { dir: 'down', arrow: '↓' },
                            'f': { dir: 'left', arrow: '←' },
                            'j': { dir: 'right', arrow: '→' }
                        };
                        if (directionMap[key]) {
                            keyElement.setAttribute('data-direction', directionMap[key].dir);
                            keyElement.setAttribute('data-arrow', directionMap[key].arrow);
                        }
                    }
                }
                rowElement.appendChild(keyElement);
            });
            
            keyboard2.appendChild(rowElement);
        });
    }
}

// Render mini components for tutorial step 4
function renderTutorialMiniComponents() {
    renderTutorialMiniKeyboard();
    renderTutorialMiniDirectionInfo();
    renderTutorialMiniCounter();
    renderTutorialMiniGameCanvas();
    renderTutorialMiniScore();
}

// Render mini keyboard for step 4
function renderTutorialMiniKeyboard() {
    const container = document.getElementById('tutorialMiniKeyboard');
    if (!container) return;
    
    container.innerHTML = '';
    container.className = 'tutorial-mini-keyboard';
    
    // Render all rows to match the full keyboard
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'tutorial-mini-keyboard-row';
        if (rowIndex === 0) {
            rowElement.classList.add('tutorial-mini-keyboard-row-top');
        }
        
            row.forEach(key => {
            const keyElement = document.createElement('div');
            
            // Special handling for space key
            if (key === ' ') {
                keyElement.className = 'tutorial-mini-key keyboard-space';
                keyElement.textContent = 'SPACE';
            } else {
                keyElement.className = `tutorial-mini-key ${getFingerClass(key)}`;
                
                if (key.length === 1 && /[a-zäöü]/.test(key)) {
                    keyElement.textContent = key.toUpperCase();
                } else {
                    keyElement.textContent = key;
                }
                
                // Show example active controls (T, B, F, J)
                if (['t', 'b', 'f', 'j'].includes(key)) {
                    keyElement.classList.add('active-control');
                    const directionMap = {
                        't': { dir: 'up', arrow: '↑' },
                        'b': { dir: 'down', arrow: '↓' },
                        'f': { dir: 'left', arrow: '←' },
                        'j': { dir: 'right', arrow: '→' }
                    };
                    if (directionMap[key]) {
                        keyElement.setAttribute('data-direction', directionMap[key].dir);
                        keyElement.setAttribute('data-arrow', directionMap[key].arrow);
                    }
                }
            }
            
            rowElement.appendChild(keyElement);
        });
        
        container.appendChild(rowElement);
    });
}

// Render mini direction info for step 4
function renderTutorialMiniDirectionInfo() {
    const container = document.getElementById('tutorialMiniDirectionInfo');
    if (!container) return;
    
    container.innerHTML = '';
    container.className = 'tutorial-mini-direction-info';
    
    // Match the keys from tutorialKeyboard2: T (up), B (down), F (left), J (right)
    const directions = [
        { arrow: '↑', key: 'T', direction: 'up' },
        { arrow: '↓', key: 'B', direction: 'down' },
        { arrow: '←', key: 'F', direction: 'left' },
        { arrow: '→', key: 'J', direction: 'right' }
    ];
    
    directions.forEach(dir => {
        const item = document.createElement('div');
        item.className = 'tutorial-mini-direction-item';
        // Create a mini key element that matches the keyboard style
        const keyElement = document.createElement('div');
        keyElement.className = `tutorial-mini-direction-key ${getFingerClass(dir.key.toLowerCase())} active-control`;
        keyElement.setAttribute('data-direction', dir.direction);
        keyElement.setAttribute('data-arrow', dir.arrow);
        keyElement.textContent = dir.key;
        item.appendChild(keyElement);
        container.appendChild(item);
    });
}

// Render mini counter for step 4
function renderTutorialMiniCounter() {
    const container = document.getElementById('tutorialMiniCounter');
    if (!container) return;
    
    container.innerHTML = '';
    container.className = 'tutorial-mini-counter';
    
    const counters = [
        { arrow: '↑', count: '3/10' },
        { arrow: '↓', count: '7/10' },
        { arrow: '←', count: '1/10' },
        { arrow: '→', count: '5/10' }
    ];
    
    counters.forEach(counter => {
        const item = document.createElement('div');
        item.className = 'tutorial-mini-counter-item';
        item.innerHTML = `
            <span class="tutorial-mini-counter-arrow">${counter.arrow}</span>
            <span class="tutorial-mini-counter-value">${counter.count}</span>
        `;
        container.appendChild(item);
    });
}

// Render mini game canvas for step 4 with animation
let tutorialMiniGameAnimation = null;
let tutorialMiniSnake = [
    { x: 4, y: 4 },
    { x: 3, y: 4 },
    { x: 2, y: 4 }
];
let tutorialMiniFood = { x: 6, y: 4 };
let tutorialMiniDirection = { x: 1, y: 0 };

function renderTutorialMiniGameCanvas() {
    const canvas = document.getElementById('tutorialMiniGameCanvas');
    if (!canvas) return;
    
    // Clear any existing animation
    if (tutorialMiniGameAnimation) {
        clearInterval(tutorialMiniGameAnimation);
    }
    
    // Reset snake position
    tutorialMiniSnake = [
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 2, y: 4 }
    ];
    tutorialMiniFood = { x: 6, y: 4 };
    tutorialMiniDirection = { x: 1, y: 0 };
    
    const ctx = canvas.getContext('2d');
    const gridSize = 8;
    const cellSize = canvas.width / gridSize;
    
    function drawMiniGame() {
        // Clear canvas
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw grid
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * cellSize, 0);
            ctx.lineTo(i * cellSize, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(canvas.width, i * cellSize);
            ctx.stroke();
        }
        
        // Move snake
        const headX = tutorialMiniSnake[0].x + tutorialMiniDirection.x;
        const headY = tutorialMiniSnake[0].y + tutorialMiniDirection.y;
        
        // Wrap around
        const newHeadX = headX < 0 ? gridSize - 1 : (headX >= gridSize ? 0 : headX);
        const newHeadY = headY < 0 ? gridSize - 1 : (headY >= gridSize ? 0 : headY);
        
        const newHead = { x: newHeadX, y: newHeadY };
        
        // Check if food eaten
        if (newHead.x === tutorialMiniFood.x && newHead.y === tutorialMiniFood.y) {
            tutorialMiniSnake.unshift(newHead);
            // Spawn new food
            do {
                tutorialMiniFood = {
                    x: Math.floor(Math.random() * gridSize),
                    y: Math.floor(Math.random() * gridSize)
                };
            } while (tutorialMiniSnake.some(s => s.x === tutorialMiniFood.x && s.y === tutorialMiniFood.y));
        } else {
            tutorialMiniSnake.unshift(newHead);
            tutorialMiniSnake.pop();
        }
        
        // Draw mini snake
        tutorialMiniSnake.forEach((segment, index) => {
            if (index === 0) {
                ctx.fillStyle = '#32cd32';
            } else {
                ctx.fillStyle = '#28a428';
            }
            ctx.fillRect(segment.x * cellSize + 1, segment.y * cellSize + 1, cellSize - 2, cellSize - 2);
        });
        
        // Draw mini food
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(tutorialMiniFood.x * cellSize + 1, tutorialMiniFood.y * cellSize + 1, cellSize - 2, cellSize - 2);
    }
    
    // Initial draw
    drawMiniGame();
    
    // Animate
    tutorialMiniGameAnimation = setInterval(() => {
        // Only animate if tutorial step 6 is visible
        if (tutorialModal && tutorialModal.classList.contains('visible') && tutorialCurrentStep === 6) {
            drawMiniGame();
        } else {
            clearInterval(tutorialMiniGameAnimation);
            tutorialMiniGameAnimation = null;
        }
    }, 500); // Update every 500ms
}

// Render mini score display for step 4
function renderTutorialMiniScore() {
    const container = document.getElementById('tutorialMiniScore');
    if (!container) return;
    
    container.innerHTML = '';
    container.className = 'tutorial-mini-score';
    
    container.innerHTML = `
        <div class="tutorial-mini-score-item">
            <span class="tutorial-mini-score-label">Punkte:</span>
            <span class="tutorial-mini-score-value">42</span>
        </div>
        <div class="tutorial-mini-score-divider">|</div>
        <div class="tutorial-mini-score-item">
            <span class="tutorial-mini-score-label">KPM:</span>
            <span class="tutorial-mini-score-value">120</span>
        </div>
    `;
}

// Render J key for tutorial step 2
function renderJKey() {
    const jKeyElement = document.getElementById('jKey');
    if (!jKeyElement) return;
    
    const fingerClass = getFingerClass('j');
    jKeyElement.innerHTML = `<span class="home-row-key-wrapper">
        <span class="home-row-key-animate ${fingerClass}" data-key="j">J</span>
    </span>`;
}

// Render animated keyboard for tutorial step 1
function renderTutorialStep1Keyboard() {
    const keyboardElement = document.getElementById('tutorialStep1Keyboard');
    if (!keyboardElement) return;
    
    keyboardElement.innerHTML = '';
    
    // Show all rows including space bar
    KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowElement = document.createElement('div');
        rowElement.className = 'title-keyboard-row';
        if (rowIndex === 0) {
            rowElement.classList.add('title-keyboard-row-top');
        }

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

        keyboardElement.appendChild(rowElement);
    });
}

// Render game demo for tutorial step 1
function renderTutorialGameDemo() {
    const demoCanvas = document.getElementById('tutorialGameCanvas');
    if (!demoCanvas) return;
    
    // Clear any existing animation before starting a new one
    if (tutorialDemoAnimationTimeout) {
        clearTimeout(tutorialDemoAnimationTimeout);
        tutorialDemoAnimationTimeout = null;
    }
    
    const demoCtx = demoCanvas.getContext('2d');
    const demoGridSize = 10;
    const demoCellSize = 20;
    
    // Demo snake - use let so it can be modified
    let demoSnake = [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 }
    ];
    let demoFood = { x: 7, y: 5 };
    let demoDirection = { x: 1, y: 0 };
    
    // Function to generate new food position (not on snake)
    const generateNewFood = () => {
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * demoGridSize),
                y: Math.floor(Math.random() * demoGridSize)
            };
        } while (demoSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y));
        return newFood;
    };
    
    // Function to draw everything
    const drawDemo = () => {
        // Clear canvas
        demoCtx.fillStyle = '#f8f9fa';
        demoCtx.fillRect(0, 0, demoCanvas.width, demoCanvas.height);
        
        // Draw grid
        demoCtx.strokeStyle = '#e0e0e0';
        demoCtx.lineWidth = 0.5;
        for (let i = 0; i <= demoGridSize; i++) {
            demoCtx.beginPath();
            demoCtx.moveTo(i * demoCellSize, 0);
            demoCtx.lineTo(i * demoCellSize, demoCanvas.height);
            demoCtx.stroke();
            demoCtx.beginPath();
            demoCtx.moveTo(0, i * demoCellSize);
            demoCtx.lineTo(demoCanvas.width, i * demoCellSize);
            demoCtx.stroke();
        }
        
        // Draw food
        demoCtx.fillStyle = '#e74c3c';
        demoCtx.fillRect(demoFood.x * demoCellSize + 2, demoFood.y * demoCellSize + 2, demoCellSize - 4, demoCellSize - 4);
        
        // Draw snake
        demoSnake.forEach((segment, index) => {
            if (index === 0) {
                demoCtx.fillStyle = '#32cd32';
            } else {
                demoCtx.fillStyle = '#28a428';
            }
            demoCtx.fillRect(segment.x * demoCellSize + 1, segment.y * demoCellSize + 1, demoCellSize - 2, demoCellSize - 2);
        });
    };
    
    // Initial draw
    drawDemo();
    
    // Animate demo
    const animateDemo = () => {
        // Check if tutorial modal is still visible and on step 1
        if (!tutorialModal || !tutorialModal.classList.contains('visible') || tutorialCurrentStep !== 1) {
            // Stop animation if not on step 1 or modal is closed
            tutorialDemoAnimationTimeout = null;
            return;
        }
        
        // Move snake head
        const newHead = {
            x: demoSnake[0].x + demoDirection.x,
            y: demoSnake[0].y + demoDirection.y
        };
        
        // Wrap around edges
        if (newHead.x >= demoGridSize) {
            newHead.x = 0;
        } else if (newHead.x < 0) {
            newHead.x = demoGridSize - 1;
        }
        if (newHead.y >= demoGridSize) {
            newHead.y = 0;
        } else if (newHead.y < 0) {
            newHead.y = demoGridSize - 1;
        }
        
        // Check if snake ate food
        const ateFood = newHead.x === demoFood.x && newHead.y === demoFood.y;
        
        // Update snake position
        demoSnake.unshift(newHead);
        if (!ateFood) {
            demoSnake.pop();
        } else {
            // Snake grows, generate new food
            demoFood = generateNewFood();
        }
        
        // Redraw
        drawDemo();
        
        // Schedule next animation frame and store timeout ID
        tutorialDemoAnimationTimeout = setTimeout(animateDemo, 300);
    };
    
    // Start animation after initial delay
    tutorialDemoAnimationTimeout = setTimeout(animateDemo, 500);
}

// Initialize on load
init();

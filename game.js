// Game configuration
const GRID_SIZE = 20;
const CELL_SIZE = 20;
let FPS = 4.65; // 25% slower than 6.2 FPS
let PRESSES_PER_CHANGE = 10;
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
//
// Complete Key -> Finger/Hand Mapping:
// LEFT HAND:
//   - Pinky:   q, a, y
//   - Ring:    w, s, x
//   - Middle:  e, d, c
//   - Index:   r, f, v, t, g, b
// RIGHT HAND:
//   - Pinky:   p, ü, ö, ä, -
//   - Ring:    o, l, .
//   - Middle:  i, k, ,
//   - Index:   z, h, n, u, j, m
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

// Helper function to get row index of a key (0 = top, 1 = middle, 2 = bottom)
function getKeyRow(key) {
    for (let rowIndex = 0; rowIndex < KEYBOARD_ROWS.length; rowIndex++) {
        if (KEYBOARD_ROWS[rowIndex].includes(key)) {
            return rowIndex;
        }
    }
    return -1; // Key not found
}

// Helper function to get column position of a key within its row
function getKeyColumn(key) {
    for (let rowIndex = 0; rowIndex < KEYBOARD_ROWS.length; rowIndex++) {
        const colIndex = KEYBOARD_ROWS[rowIndex].indexOf(key);
        if (colIndex !== -1) {
            return colIndex;
        }
    }
    return -1; // Key not found
}

// Helper function to check if two keys are in the same row
function areKeysInSameRow(key1, key2) {
    const row1 = getKeyRow(key1);
    const row2 = getKeyRow(key2);
    return row1 !== -1 && row2 !== -1 && row1 === row2;
}

// Helper function to check if a key position violates the left/right constraint
// Returns true if the constraint is violated, false otherwise
function violatesPositionConstraint(direction, newKey) {
    const newKeyRow = getKeyRow(newKey);
    const newKeyCol = getKeyColumn(newKey);
    
    if (newKeyRow === -1 || newKeyCol === -1) {
        return false; // Can't check if key position is unknown
    }
    
    // Check constraint based on direction being changed
    if (direction === 'left') {
        // Left should be more left than up/down in the same row
        const upKey = controlKeys.up;
        const downKey = controlKeys.down;
        
        if (areKeysInSameRow(newKey, upKey)) {
            const upCol = getKeyColumn(upKey);
            if (newKeyCol >= upCol) {
                return true; // Violation: left is not more left than up
            }
        }
        
        if (areKeysInSameRow(newKey, downKey)) {
            const downCol = getKeyColumn(downKey);
            if (newKeyCol >= downCol) {
                return true; // Violation: left is not more left than down
            }
        }
    } else if (direction === 'right') {
        // Right should be more right than up/down in the same row
        const upKey = controlKeys.up;
        const downKey = controlKeys.down;
        
        if (areKeysInSameRow(newKey, upKey)) {
            const upCol = getKeyColumn(upKey);
            if (newKeyCol <= upCol) {
                return true; // Violation: right is not more right than up
            }
        }
        
        if (areKeysInSameRow(newKey, downKey)) {
            const downCol = getKeyColumn(downKey);
            if (newKeyCol <= downCol) {
                return true; // Violation: right is not more right than down
            }
        }
    } else if (direction === 'up' || direction === 'down') {
        // Up/down should be more right than left, and more left than right when in the same row
        const leftKey = controlKeys.left;
        const rightKey = controlKeys.right;
        
        // Check constraint with left: up/down must be more right than left in same row
        if (areKeysInSameRow(newKey, leftKey)) {
            const leftCol = getKeyColumn(leftKey);
            if (newKeyCol <= leftCol) {
                return true; // Violation: up/down is not more right than left
            }
        }
        
        // Check constraint with right: up/down must be more left than right in same row
        if (areKeysInSameRow(newKey, rightKey)) {
            const rightCol = getKeyColumn(rightKey);
            if (newKeyCol >= rightCol) {
                return true; // Violation: up/down is not more left than right
            }
        }
    }
    
    return false; // No violation
}

// Finger names for display
const FINGER_NAMES = {
    'finger-pinky': 'Kleiner',
    'finger-ring': 'Ring',
    'finger-middle': 'Mittel',
    'finger-index': 'Zeige'
};

// Key pools for each direction
// Rules:
// - left: only keys from left hand (hand: 'links')
// - right: only keys from right hand (hand: 'rechts')
// - up: only keys from top row (KEYBOARD_ROWS[0])
// - down: only keys from bottom row (KEYBOARD_ROWS[2])
// These rules have priority over finger progression (index -> ring -> middle -> pinky)
const KEY_POOLS = {
    // Left hand keys: q, a, y, w, s, x, e, d, c, r, f, v, t, g, b
    left: ['q', 'a', 'y', 'w', 's', 'x', 'e', 'd', 'c', 'r', 'f', 'v', 't', 'g', 'b'],
    // Right hand keys: p, ü, ö, ä, -, o, l, ., i, k, ,, z, h, n, u, j, m
    right: ['p', 'ü', 'ö', 'ä', '-', 'o', 'l', '.', 'i', 'k', ',', 'z', 'h', 'n', 'u', 'j', 'm'],
    // Top row keys: q, w, e, r, t, z, u, i, o, p, ü
    up: ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
    // Bottom row keys: y, x, c, v, b, n, m, ,, ., -
    down: ['y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-']
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
let pointsInCurrentLevel = 0; // Track points collected in current level
let pendingLevelChange = null; // Store pending level change info to show after practice

// Track all keys pressed during gameplay for practice mode
let keyPressSequence = [];

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

// Track how many times each direction has changed keys
// After 12 changes, force progression to next finger type
let keyChangeCounts = {
    up: 0,
    down: 0,
    left: 0,
    right: 0
};
let KEY_CHANGES_BEFORE_FORCE_PROGRESSION = 4;

// DOM elements
let scoreElement, kpmElement;
let counterUpElement, counterDownElement, counterLeftElement, counterRightElement;
let virtualKeyboardElement;
let overlayElement, overlayTitleElement, overlayMessageElement, restartButton;
let overlayStatsElement, overlayStatsButton, nameInputSection, playerNameInput, saveHint;
let statsModal, statsClose, statsTableBody;
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
let practiceModal, practiceKeysElement, practiceModalVisible = false;
let practiceCombinations = [];
let currentPracticeIndex = 0;
let practiceTyped = [];
let practicePoints = 0;
let practiceStartTime = 0;
let practiceKeystrokes = 0;
let practiceWrongKeys = new Set(); // Track wrong key indices in typed sequence
let practiceCorrectedKeys = new Set(); // Track keys that were wrong but corrected
let practiceDeletedWrongPositions = new Set(); // Track positions where wrong keys were deleted
let practiceHadMistake = false; // Track if any mistake was ever made in current word
let practiceKPMInterval = null;

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
    practiceModal = document.getElementById('practiceModal');
    practiceKeysElement = document.getElementById('practiceKeys');

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
    
    // Update debug menu after levels are loaded
    updateDebugMenu();
    
    // Event listeners
    document.addEventListener('keydown', handleKeyPress);
    restartButton.addEventListener('click', async () => {
        // If game over screen is showing, save statistics first
        if (!gameRunning && lastGameScore > 0 && !gameStatsSaved) {
            // Get name from input field in the table
            const nameInput = document.querySelector('.game-over-name-input');
            if (nameInput) {
                const inputValue = nameInput.value.trim();
                if (inputValue) {
                    playerName = inputValue;
                } else {
                    // Use placeholder if input is empty
                    const placeholder = nameInput.placeholder;
                    playerName = placeholder === 'Anonym' ? '' : placeholder;
                }
                localStorage.setItem('qwertzsnake_name', playerName);
            }
            
            // Save statistics
            await submitStatistics(lastGameKPM, lastGameScore, lastGameFingerUsage);
            gameStatsSaved = true;
        }
        startGame();
    });
    overlayStatsButton.addEventListener('click', openStatsModal);
    document.addEventListener('menu-open-stats', openStatsModal);
    document.addEventListener('menu-open-admin', openLoginModal);
    document.addEventListener('menu-restart', () => startGame());
    document.addEventListener('menu-open-tutorial', (e) => {
        const step = (e.detail && e.detail.step) ? e.detail.step : 1;
        openTutorial(step);
    });
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
    
    // Debug menu elements
    const simulateGameEndBtn = document.getElementById('simulateGameEnd');
    const debugSpeedInput = document.getElementById('debugSpeed');
    const applySpeedBtn = document.getElementById('applySpeed');
    const debugKeyChangePeriodInput = document.getElementById('debugKeyChangePeriod');
    const applyKeyChangePeriodBtn = document.getElementById('applyKeyChangePeriod');
    const debugLevelInput = document.getElementById('debugLevel');
    const goToLevelBtn = document.getElementById('goToLevel');
    const debugForceProgressionInput = document.getElementById('debugForceProgression');
    const applyForceProgressionBtn = document.getElementById('applyForceProgression');
    
    // Debug menu event listeners
    if (simulateGameEndBtn) {
        simulateGameEndBtn.addEventListener('click', simulateGameEndWithRandomData);
    }
    if (applySpeedBtn) {
        applySpeedBtn.addEventListener('click', () => {
            const newSpeed = parseFloat(debugSpeedInput.value);
            if (!isNaN(newSpeed) && newSpeed > 0) {
                changeGameSpeed(newSpeed);
            }
        });
    }
    if (applyKeyChangePeriodBtn) {
        applyKeyChangePeriodBtn.addEventListener('click', () => {
            const newPeriod = parseInt(debugKeyChangePeriodInput.value);
            if (!isNaN(newPeriod) && newPeriod > 0) {
                changeKeyChangePeriod(newPeriod);
            }
        });
    }
    if (goToLevelBtn) {
        goToLevelBtn.addEventListener('click', () => {
            const targetLevel = parseInt(debugLevelInput.value);
            if (!isNaN(targetLevel) && targetLevel > 0) {
                goToLevel(targetLevel);
            }
        });
    }
    if (applyForceProgressionBtn) {
        applyForceProgressionBtn.addEventListener('click', () => {
            const newValue = parseInt(debugForceProgressionInput.value);
            if (!isNaN(newValue) && newValue > 0) {
                KEY_CHANGES_BEFORE_FORCE_PROGRESSION = newValue;
                console.log(`Force progression threshold set to ${KEY_CHANGES_BEFORE_FORCE_PROGRESSION} key changes`);
            }
        });
    }
    
    // Logging toggle button
    const toggleLoggingBtn = document.getElementById('toggleLogging');
    const logStatusElement = document.getElementById('logStatus');
    if (toggleLoggingBtn && logStatusElement) {
        toggleLoggingBtn.addEventListener('click', toggleLogging);
        updateLoggingUI();
    }
    
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
        case 'neustart':
            if (confirm('Möchtest du wirklich das Spiel von vorne beginnen, ohne dich in die Bestenliste einzutragen?')) {
                startGame();
            } else {
                window.location.hash = '';
            }
            break;
        case 'statistics':
        case 'statistik':
        case 'bestenliste':
            openStatsModal();
            break;
        case 'admin':
            openLoginModal();
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
    pointsInCurrentLevel = 0;
    pendingLevelChange = null;
    
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
    
    // Reset key change counts
    keyChangeCounts = {
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
    
    // Reset key press sequence for practice mode
    keyPressSequence = [];
    
    updateCounters();
}

// Calculate T/Min (keystrokes per minute)
function calculateKPM() {
    if (!gameStartTime || totalKeystrokes === 0) return 0;
    const elapsedMinutes = (Date.now() - gameStartTime) / 60000;
    if (elapsedMinutes < 0.01) return 0; // Avoid division issues for very short times
    return Math.round(totalKeystrokes / elapsedMinutes);
}

// Update T/Min display
function updateKPMDisplay() {
    if (gameRunning && !gamePaused) {
        kpmElement.textContent = calculateKPM();
    }
}

// Track last game score for saving
let lastGameScore = 0;
let lastGameFingerUsage = {};

// Logging state
let loggingEnabled = false;
let logBuffer = [];
const LOG_BUFFER_SIZE = 50; // Send logs in batches

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
    
    // Start T/Min update interval
    if (kpmUpdateInterval) clearInterval(kpmUpdateInterval);
    kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    
    // Log game start
    if (loggingEnabled) {
        logEvent('game_start', {
            timestamp: new Date().toISOString(),
            controlKeys: { ...controlKeys }
        });
    }
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
    
    // Log game over
    if (loggingEnabled) {
        logEvent('game_over', {
            score: score,
            kpm: lastGameKPM,
            level: currentLevelIndex,
            fingerUsage: { ...fingerUsage },
            duration: Math.round((Date.now() - gameStartTime) / 1000),
            timestamp: new Date().toISOString()
        });
        // Send logs immediately on game over
        sendLogsToServer();
    }
    
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
async function showOverlay(title, message, showStats = false, kpm = 0) {
    overlayTitleElement.textContent = title;
    overlayMessageElement.textContent = message;
    // Hide message when showing stats
    if (showStats) {
        overlayMessageElement.style.display = 'none';
    } else {
        overlayMessageElement.style.display = 'block';
    }
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
            // Hide spacebar hint on game over (no keyboard shortcuts)
            if (spacebarHint && showStats) {
                spacebarHint.style.display = 'none';
            } else if (spacebarHint) {
                spacebarHint.style.display = 'flex';
            }
        }
    }
    
    if (showStats && score > 0) {
        nameInputSection.classList.remove('visible'); // Hide the old name input section
        // Fetch statistics and render table with new score
        const stats = await fetchStatistics();
        overlayStatsElement.innerHTML = renderGameOverStatsTable(stats, kpm);
        
        // Set up event listener for the name input in the table
        setTimeout(() => {
            const gameOverNameInput = document.querySelector('.game-over-name-input');
            if (gameOverNameInput) {
                gameOverNameInput.addEventListener('input', (e) => {
                    playerName = e.target.value.trim();
                    localStorage.setItem('qwertzsnake_name', playerName);
                });
                // Focus the input
                gameOverNameInput.focus();
            }
        }, 100);
        
        restartButton.textContent = 'speichern & neues spiel';
        restartButton.style.display = 'inline-block';
        saveHint.textContent = '';
        saveHint.style.display = 'none';
    } else {
        nameInputSection.classList.remove('visible');
        overlayStatsElement.innerHTML = '';
        restartButton.style.display = 'none';
        saveHint.textContent = '';
        saveHint.style.display = 'none';
    }
}

// Render game over statistics table with new score inserted
function renderGameOverStatsTable(stats, kpm) {
    // Create new score entry
    const newScore = {
        name: playerName || 'Anonym',
        points: score,
        kpm: kpm,
        level: maxLevelReached,
        fingersUsed: lastGameFingerUsage,
        isNew: true
    };
    
    // Combine existing stats with new score and sort by points descending
    const allStats = [...stats, newScore].sort((a, b) => b.points - a.points);
    
    // Find position of new score
    const newScoreIndex = allStats.findIndex(s => s.isNew);
    
    // Show top 10 entries, but always include the new score if it's not in top 10
    let displayStats = allStats.slice(0, 10);
    if (newScoreIndex >= 10) {
        // Replace last entry with new score if it's not in top 10
        displayStats = [...allStats.slice(0, 9), newScore];
    }
    
    // Get saved name for placeholder
    const savedName = localStorage.getItem('qwertzsnake_name') || '';
    const placeholderName = savedName || 'Anonym';
    
    let html = `
        <div class="game-over-stats-container">
            <table class="game-over-stats-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Punkte</th>
                        <th>Level</th>
                        <th>T/Min</th>
                        <th>Finger</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    displayStats.forEach((game) => {
        const actualIndex = allStats.indexOf(game);
        const fingerDots = game.isNew ? renderFingerDots(newScore.fingersUsed) : renderFingerDots(game.fingersUsed);
        const levelDisplay = game.level ? `Level ${game.level}` : '-';
        const isNewRow = game.isNew;
        const rowClass = isNewRow ? 'new-score-row blinking' : '';
        
        html += `
            <tr class="${rowClass}">
                <td>${actualIndex + 1}</td>
                <td>${isNewRow ? `<input type="text" class="game-over-name-input" placeholder="${placeholderName}" value="${playerName || ''}" maxlength="20">` : escapeHtml(game.name)}</td>
                <td>${game.points}</td>
                <td>${levelDisplay}</td>
                <td>${game.kpm}</td>
                <td>${fingerDots}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
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
    
    // Map of direction to arrow symbol
    const directionMap = {
        'up': '↑',
        'down': '↓',
        'left': '←',
        'right': '→'
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
            ['up', 'down', 'left', 'right'].forEach(dir => {
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
    
    // Log pause/unpause
    if (loggingEnabled) {
        logEvent(gamePaused ? 'game_pause' : 'game_resume', {
            score: score,
            level: currentLevelIndex,
            timestamp: new Date().toISOString()
        });
    }
    
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
    
    // Check if typing in game over name input
    const gameOverNameInput = document.querySelector('.game-over-name-input');
    if (gameOverNameInput && document.activeElement === gameOverNameInput) {
        // Update player name as user types
        playerName = gameOverNameInput.value.trim();
        localStorage.setItem('qwertzsnake_name', playerName);
        return;
    }
    
    // Don't allow any keyboard shortcuts when game over screen is showing
    if (!gameRunning && lastGameScore > 0 && !gameStatsSaved) {
        return; // Game over screen - no keyboard shortcuts
    }
    
    // Handle practice mode
    if (practiceModalVisible) {
        event.preventDefault();
        // Handle backspace/delete to remove wrong keys
        if (key === 'Backspace' || key === 'Delete' || event.code === 'Backspace' || event.code === 'Delete') {
            handlePracticeBackspace();
            return;
        }
        // Handle letter keys and space for practice (only if no wrong key blocking)
        if ((key.length === 1 && /[a-züöä]/.test(key)) || key === ' ' || event.code === 'Space') {
            handlePracticeKey(key, event);
        }
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
        // Don't allow space to start game if game over screen is showing (with stats)
        if (!gameRunning && lastGameScore > 0 && !gameStatsSaved) {
            return; // Game over screen - no keyboard shortcuts
        }
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
    // But not if game over screen is showing
    if (!gameRunning) {
        // Don't allow keyboard shortcuts if game over screen is showing
        if (lastGameScore > 0 && !gameStatsSaved) {
            return; // Game over screen - no keyboard shortcuts
        }
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
        
        // Track key for practice mode (only track letter keys, not space)
        if (key !== ' ' && key.length === 1 && /[a-züöä]/.test(key)) {
            keyPressSequence.push(key);
        }
        
        keyPressCounters[directionChanged]++;
        updateCounters();
        
        // Log key press interaction
        if (loggingEnabled) {
            logEvent('key_press', {
                key: key,
                direction: directionChanged,
                fingerType: fingerType,
                score: score,
                keyPressCount: keyPressCounters[directionChanged],
                timestamp: new Date().toISOString()
            });
        }
        
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
// Removes duplicates while preserving order (first occurrence)
function filterSequenceByFingerOrder(sequence, keyPool) {
    const fingerOrder = ['finger-index', 'finger-ring', 'finger-middle', 'finger-pinky'];
    const filtered = [];
    
    // First, collect all keys from sequence that are in keyPool, grouped by finger
    // Remove duplicates while preserving order (first occurrence)
    const keysByFinger = {
        'finger-index': [],
        'finger-ring': [],
        'finger-middle': [],
        'finger-pinky': []
    };
    const seenKeys = new Set();
    
    // Go through sequence in original order and group by finger (deduplicated)
    for (let key of sequence) {
        if (keyPool.includes(key) && getFingerClass(key) && !seenKeys.has(key)) {
            const fingerType = getFingerClass(key);
            if (keysByFinger[fingerType]) {
                keysByFinger[fingerType].push(key);
                seenKeys.add(key);
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

    // Group filtered sequence by finger type to enable finger-type-level skipping
    // Remove duplicates while preserving order (first occurrence)
    const fingerOrder = ['finger-index', 'finger-ring', 'finger-middle', 'finger-pinky'];
    const keysByFinger = {
        'finger-index': [],
        'finger-ring': [],
        'finger-middle': [],
        'finger-pinky': []
    };
    const seenKeys = new Set();
    
    for (let key of filteredSequence) {
        const fingerType = getFingerClass(key);
        if (fingerType && keysByFinger[fingerType] && !seenKeys.has(key)) {
            keysByFinger[fingerType].push(key);
            seenKeys.add(key);
        }
    }
    
    // Find which finger type the current index points to
    const directionIndex = directionIndices[direction];
    let currentFingerTypeIndex = 0;
    let currentKeyIndexInFinger = 0;
    let accumulatedLength = 0;
    
    // Determine current finger type and position within it
    for (let i = 0; i < fingerOrder.length; i++) {
        const fingerType = fingerOrder[i];
        const fingerKeys = keysByFinger[fingerType];
        if (directionIndex < accumulatedLength + fingerKeys.length) {
            currentFingerTypeIndex = i;
            currentKeyIndexInFinger = directionIndex - accumulatedLength;
            break;
        }
        accumulatedLength += fingerKeys.length;
    }

    // Make sure the new key is not already used by another direction
    // and that it doesn't violate the position constraint
    // Exclude the old key for this direction from usedKeys check
    const usedKeys = Object.values(controlKeys).filter(key => key !== oldKey);
    
    let finalKey = null;
    let debugLog = [];
    
    // Strategy: Progress through finger types when all keys of current type are exhausted
    // Track how many times we've used keys from each finger type
    // When we've used all available keys of a finger type, move to the next
    
    let fingerTypeIndex = currentFingerTypeIndex;
    let keyIndexInFinger = currentKeyIndexInFinger;
    
    // Check if we've changed keys 12 times for this direction
    // If so, force progression to next finger type
    // Note: counter will be incremented AFTER this key change, so check if count >= 11
    // means we've done 11 changes and this is the 12th, so we should force after this one
    // Actually, we want to force ON the 12th change, so check if count >= 11 (after 11 changes, this is the 12th)
    const currentChangeCount = keyChangeCounts[direction] || 0;
    const shouldForceProgression = currentChangeCount >= (KEY_CHANGES_BEFORE_FORCE_PROGRESSION - 1);
    
    debugLog.push(`Key change count for ${direction}: ${currentChangeCount}/${KEY_CHANGES_BEFORE_FORCE_PROGRESSION}, shouldForce: ${shouldForceProgression}`);
    
    // Track the original finger type before any changes
    const originalFingerTypeIndex = fingerTypeIndex;
    let forcedToNextFingerType = false;
    
    // If we need to force progression, skip current finger type and go to next
    if (shouldForceProgression) {
        debugLog.push(`Forcing progression after ${currentChangeCount} key changes - moving to next finger type`);
        fingerTypeIndex = (fingerTypeIndex + 1) % fingerOrder.length;
        keyIndexInFinger = 0;
        forcedToNextFingerType = true;
        // Reset counter when forcing progression (will be incremented after key selection)
        keyChangeCounts[direction] = 0;
    }
    
    // Check if current finger type is exhausted (all available keys are used)
    const currentFingerType = fingerOrder[fingerTypeIndex];
    const currentFingerKeys = keysByFinger[currentFingerType];
    const availableKeysInCurrentType = currentFingerKeys.filter(key => {
        if (key === oldKey) return false; // Exclude old key
        const isUsed = usedKeys.includes(key);
        const violatesConstraint = violatesPositionConstraint(direction, key);
        return !isUsed && !violatesConstraint;
    });
    
    debugLog.push(`Current finger type: ${currentFingerType}, ${availableKeysInCurrentType.length} available`);
    
    // If current finger type has no available keys, move to next finger type
    if (availableKeysInCurrentType.length === 0 && currentFingerKeys.length > 0) {
        debugLog.push(`All keys of ${currentFingerType} are unavailable, moving to next finger type`);
        fingerTypeIndex = (fingerTypeIndex + 1) % fingerOrder.length;
        keyIndexInFinger = 0;
    }
    
    // Try all finger types starting from current (or next if current is exhausted)
    for (let fingerTypeAttempt = 0; fingerTypeAttempt < fingerOrder.length; fingerTypeAttempt++) {
        const tryFingerType = fingerOrder[fingerTypeIndex];
        const tryFingerKeys = keysByFinger[tryFingerType];
        
        debugLog.push(`Trying finger type ${tryFingerType} (${tryFingerKeys.length} keys)`);
        
        if (tryFingerKeys.length === 0) {
            debugLog.push(`No keys for ${tryFingerType}, skipping to next`);
            fingerTypeIndex = (fingerTypeIndex + 1) % fingerOrder.length;
            keyIndexInFinger = 0;
            continue;
        }
        
        // Check if there are any available keys in this finger type
        // Exclude the old key to ensure we always change to a different key
        const availableKeysInType = tryFingerKeys.filter(key => {
            if (key === oldKey) return false; // Never select the same key we're replacing
            const isUsed = usedKeys.includes(key);
            const violatesConstraint = violatesPositionConstraint(direction, key);
            return !isUsed && !violatesConstraint;
        });
        
        debugLog.push(`${tryFingerType}: ${availableKeysInType.length} available out of ${tryFingerKeys.length} total`);
        
        if (availableKeysInType.length === 0) {
            // No available keys in this finger type, try next
            debugLog.push(`All keys of ${tryFingerType} are unavailable, moving to next finger type`);
            fingerTypeIndex = (fingerTypeIndex + 1) % fingerOrder.length;
            keyIndexInFinger = 0;
            continue;
        }
        
        // Found available keys in this finger type
        // Find the first available key starting from current position
        let foundKey = false;
        let selectedCandidateIndex = -1;
        
        for (let i = 0; i < tryFingerKeys.length; i++) {
            const candidateIndex = (keyIndexInFinger + i) % tryFingerKeys.length;
            const candidateKey = tryFingerKeys[candidateIndex];
            const isUsed = usedKeys.includes(candidateKey);
            const violatesConstraint = violatesPositionConstraint(direction, candidateKey);
            
            if (!isUsed && !violatesConstraint && candidateKey !== oldKey) {
                finalKey = candidateKey;
                foundKey = true;
                selectedCandidateIndex = candidateIndex;
                debugLog.push(`Selected ${finalKey} from ${tryFingerType} at index ${candidateIndex}`);
                break;
            }
        }
        
        if (foundKey) {
            // Verify we actually selected from a different finger type if we forced progression
            const selectedFingerType = getFingerClass(finalKey);
            const originalFingerType = fingerOrder[originalFingerTypeIndex];
            
            if (forcedToNextFingerType && selectedFingerType === originalFingerType) {
                debugLog.push(`WARNING: Forced progression but still selected from ${originalFingerType}, trying next finger type`);
                // Continue to next finger type
                fingerTypeIndex = (fingerTypeIndex + 1) % fingerOrder.length;
                keyIndexInFinger = 0;
                foundKey = false;
                finalKey = null;
                continue;
            }
            
            // Update indices for next time: move to next key in this finger type
            keyIndexInFinger = (selectedCandidateIndex + 1) % tryFingerKeys.length;
            
            // If we've wrapped around (tried all keys in this finger type), move to next finger type
            if (keyIndexInFinger === 0) {
                debugLog.push(`Wrapped around ${tryFingerType}, will move to next finger type next time`);
                fingerTypeIndex = (fingerTypeIndex + 1) % fingerOrder.length;
            }
            break;
        }
        
        // Should not reach here if availableKeysInType.length > 0, but just in case
        debugLog.push(`Unexpected: no key found in ${tryFingerType} despite ${availableKeysInType.length} available`);
        fingerTypeIndex = (fingerTypeIndex + 1) % fingerOrder.length;
        keyIndexInFinger = 0;
    }
    
    // If no valid key found (shouldn't happen, but fallback)
    if (finalKey === null) {
        debugLog.push('ERROR: No key found in main loop, using fallback');
        // First try: find first available key from any finger type (respecting constraints)
        for (let fingerType of fingerOrder) {
            const fingerKeys = keysByFinger[fingerType];
            for (let key of fingerKeys) {
                if (key !== oldKey && !usedKeys.includes(key) && !violatesPositionConstraint(direction, key)) {
                    finalKey = key;
                    debugLog.push(`Found fallback key (with constraints): ${finalKey} from ${fingerType}`);
                    fingerTypeIndex = fingerOrder.indexOf(fingerType);
                    keyIndexInFinger = fingerKeys.indexOf(key);
                    break;
                }
            }
            if (finalKey) break;
        }
        
        // Second try: if still no key, ignore position constraints (but still avoid used keys and old key)
        if (finalKey === null) {
            debugLog.push('No key found respecting constraints, ignoring constraints');
            for (let fingerType of fingerOrder) {
                const fingerKeys = keysByFinger[fingerType];
                for (let key of fingerKeys) {
                    if (key !== oldKey && !usedKeys.includes(key)) {
                        finalKey = key;
                        debugLog.push(`Found fallback key (ignoring constraints): ${finalKey} from ${fingerType}`);
                        fingerTypeIndex = fingerOrder.indexOf(fingerType);
                        keyIndexInFinger = fingerKeys.indexOf(key);
                        break;
                    }
                }
                if (finalKey) break;
            }
        }
        
        // Last resort: use first key in filtered sequence (even if used)
        if (finalKey === null) {
            finalKey = filteredSequence[0];
            debugLog.push(`Using first key as last resort: ${finalKey}`);
            // Find which finger type this key belongs to
            for (let i = 0; i < fingerOrder.length; i++) {
                const fingerKeys = keysByFinger[fingerOrder[i]];
                if (fingerKeys.includes(finalKey)) {
                    fingerTypeIndex = i;
                    keyIndexInFinger = fingerKeys.indexOf(finalKey);
                    break;
                }
            }
        }
    }
    
    // Calculate new absolute index in filtered sequence
    // This index should point to the selected key's position in the filtered sequence
    // Find which finger type the finalKey belongs to
    let finalKeyFingerTypeIndex = -1;
    for (let i = 0; i < fingerOrder.length; i++) {
        if (keysByFinger[fingerOrder[i]].includes(finalKey)) {
            finalKeyFingerTypeIndex = i;
            break;
        }
    }
    
    let newAbsoluteIndex = 0;
    if (finalKeyFingerTypeIndex !== -1) {
        // Sum up lengths of all finger types before the one containing finalKey
        for (let i = 0; i < finalKeyFingerTypeIndex; i++) {
            newAbsoluteIndex += keysByFinger[fingerOrder[i]].length;
        }
        // Add the index of finalKey within its finger type
        const finalKeyFingerKeys = keysByFinger[fingerOrder[finalKeyFingerTypeIndex]];
        const finalKeyIndexInFinger = finalKeyFingerKeys.indexOf(finalKey);
        if (finalKeyIndexInFinger !== -1) {
            newAbsoluteIndex += finalKeyIndexInFinger;
        }
    } else {
        // Fallback: find finalKey in filtered sequence
        newAbsoluteIndex = filteredSequence.indexOf(finalKey);
        if (newAbsoluteIndex === -1) {
            newAbsoluteIndex = 0;
        }
    }
    
    // Ensure index is within bounds
    newAbsoluteIndex = newAbsoluteIndex % filteredSequence.length;
    
    // Log detailed information
    if (loggingEnabled) {
        logEvent('key_change', {
            direction: direction,
            oldKey: oldKey,
            newKey: finalKey,
            oldFingerType: getFingerClass(oldKey),
            newFingerType: getFingerClass(finalKey),
            score: score,
            filteredSequence: filteredSequence.join(''),
            keysByFinger: {
                index: keysByFinger['finger-index'],
                ring: keysByFinger['finger-ring'],
                middle: keysByFinger['finger-middle'],
                pinky: keysByFinger['finger-pinky']
            },
            usedKeys: Object.values(controlKeys),
            oldIndex: directionIndex,
            newIndex: newAbsoluteIndex,
            debugLog: debugLog,
            timestamp: new Date().toISOString()
        });
    }
    
    // Update the index for next time
    directionIndices[direction] = newAbsoluteIndex;

    // Increment key change counter for this direction
    const previousCount = keyChangeCounts[direction] || 0;
    keyChangeCounts[direction] = previousCount + 1;
    debugLog.push(`Key change count: ${previousCount} -> ${keyChangeCounts[direction]}`);
    
    // Also log to console for debugging
    if (loggingEnabled) {
        console.log(`[KEY_CHANGE_COUNT] ${direction}: ${previousCount} -> ${keyChangeCounts[direction]}`);
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
        // Update debug menu after loading levels
        updateDebugMenu();
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

// Check for level change based on points in current level
function checkLevelChange(oldScore, newScore) {
    if (availableLevels.length === 0) return;
    
    // Points earned this update (could be from game or practice)
    const pointsEarned = newScore - oldScore;
    pointsInCurrentLevel += pointsEarned;
    
    // Check if we've collected 10 points in the current level
    if (pointsInCurrentLevel >= 10 && currentLevelIndex < availableLevels.length) {
        const newLevelIndex = currentLevelIndex + 1;
        const newLevel = availableLevels[newLevelIndex - 1]; // -1 because array is 0-indexed
        
        if (newLevel) {
            // Reset points counter for new level
            pointsInCurrentLevel = 0;
            
            currentLevelIndex = newLevelIndex;
            currentLevel = newLevel;
            maxLevelReached = Math.max(maxLevelReached, newLevelIndex);
            
            // Update debug menu level input
            const debugLevelInput = document.getElementById('debugLevel');
            if (debugLevelInput) {
                debugLevelInput.value = currentLevelIndex;
            }
            
            // Draw the current frame first so player sees they ate the food
            draw();
            
            // Apply level immediately (barriers, etc.)
            applyLevel(newLevel);
            
            // Store pending level change to show after practice mode completes
            pendingLevelChange = {
                level: newLevel,
                levelNumber: newLevelIndex
            };
            
            // Show practice mode first, level change modal will show after practice completes
            setTimeout(() => {
                if (keyPressSequence.length > 0) {
                    showPracticeMode();
                } else {
                    // No practice available, show level change modal directly
                    showLevelChangeModal(newLevel, newLevelIndex);
                }
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
    pendingLevelChange = null; // Clear pending level change
    
    // Resume game
    if (gameRunning) {
        gamePaused = false;
        lastUpdate = Date.now();
        gameLoop = requestAnimationFrame(update);
        kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
    }
}

// Extract letter combinations (2-8 characters) from key sequence
function extractCombinations(sequence) {
    const combinations = [];
    const seen = new Set();
    
    // Extract combinations of length 2 to 8
    for (let len = 2; len <= 8; len++) {
        for (let i = 0; i <= sequence.length - len; i++) {
            const combo = sequence.slice(i, i + len).join('');
            // Only add unique combinations
            if (!seen.has(combo)) {
                seen.add(combo);
                combinations.push(combo);
            }
        }
    }
    
    // Shuffle and limit to 10 words
    const shuffled = combinations.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(10, shuffled.length));
}

// Show practice mode
function showPracticeMode() {
    // Extract combinations from key sequence
    practiceCombinations = extractCombinations(keyPressSequence);
    
    if (practiceCombinations.length === 0) {
        // No combinations available, resume game
        if (gameRunning) {
            gamePaused = false;
            lastUpdate = Date.now();
            gameLoop = requestAnimationFrame(update);
            kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
        }
        return;
    }
    
    // Reset practice state
    currentPracticeIndex = 0;
    practiceTyped = [];
    practicePoints = 0;
    practiceStartTime = Date.now();
    practiceKeystrokes = 0;
    practiceWrongKeys.clear();
    practiceCorrectedKeys.clear();
    practiceDeletedWrongPositions.clear();
    practiceHadMistake = false;
    
    // Update progress and stats
    document.getElementById('practiceProgress').textContent = '1';
    document.getElementById('practiceTotal').textContent = practiceCombinations.length;
    document.getElementById('practicePoints').textContent = '0';
    document.getElementById('practiceKPM').textContent = '0';
    
    // Show practice modal
    practiceModal.classList.add('visible');
    practiceModalVisible = true;
    
    // Start practice with first combination
    startPracticeCombination();
    
    // Start KPM update interval
    practiceKPMInterval = setInterval(updatePracticeKPM, 500);
}

// Start practicing a combination
function startPracticeCombination() {
    if (currentPracticeIndex >= practiceCombinations.length) {
        // All combinations completed
        hidePracticeMode();
        return;
    }
    
    const combination = practiceCombinations[currentPracticeIndex];
    
    // Reset typing state for this word
    practiceTyped = [];
    practiceWrongKeys.clear();
    practiceCorrectedKeys.clear();
    practiceDeletedWrongPositions.clear();
    practiceHadMistake = false;
    
    // Render keys using tutorial design
    renderPracticeKeys(combination);
    
    // Update display
    updatePracticeKeys();
}

// Update practice KPM display
function updatePracticeKPM() {
    if (!practiceModalVisible || practiceStartTime === 0) return;
    
    const elapsedMinutes = (Date.now() - practiceStartTime) / 60000;
    if (elapsedMinutes < 0.01) {
        document.getElementById('practiceKPM').textContent = '0';
        return;
    }
    
    const kpm = Math.round(practiceKeystrokes / elapsedMinutes);
    document.getElementById('practiceKPM').textContent = kpm;
}

// Render practice keys using tutorial design
function renderPracticeKeys(combination) {
    if (!practiceKeysElement) return;
    
    const keys = combination.split('').map((key, index) => {
        const keyUpper = key.toUpperCase();
        const keyLower = key.toLowerCase();
        const fingerClass = getFingerClass(keyLower);
        
        if (key === ' ') {
            return `<span class="home-row-key-wrapper">
                <span class="home-row-key-animate keyboard-space" data-key=" " data-index="${index}">SPACE</span>
                <span class="home-row-checkmark" data-index="${index}">✓</span>
                <span class="home-row-corrected-mark" data-index="${index}">✕</span>
                <span class="home-row-wrong-mark" data-index="${index}">✕</span>
            </span>`;
        }
        
        return `<span class="home-row-key-wrapper">
            <span class="home-row-key-animate ${fingerClass}" data-key="${keyLower}" data-index="${index}">${keyUpper}</span>
            <span class="home-row-checkmark" data-index="${index}">✓</span>
            <span class="home-row-corrected-mark" data-index="${index}">✕</span>
            <span class="home-row-wrong-mark" data-index="${index}">✕</span>
        </span>`;
    }).join('');
    
    practiceKeysElement.innerHTML = keys;
}

// Update practice keys display
function updatePracticeKeys() {
    const combination = practiceCombinations[currentPracticeIndex];
    if (!combination || !practiceKeysElement) {
        return;
    }
    
    const checkmarks = practiceKeysElement.querySelectorAll('.home-row-checkmark');
    const correctedMarks = practiceKeysElement.querySelectorAll('.home-row-corrected-mark');
    const wrongMarks = practiceKeysElement.querySelectorAll('.home-row-wrong-mark');
    const keyElements = practiceKeysElement.querySelectorAll('.home-row-key-animate');
    
    // Update checkmarks
    checkmarks.forEach((checkmark, index) => {
        if (index < practiceTyped.length && !practiceWrongKeys.has(index)) {
            checkmark.classList.add('checked');
        } else {
            checkmark.classList.remove('checked');
        }
    });
    
    // Update wrong marks (red cross) - show for wrong keys in typed sequence
    wrongMarks.forEach((mark, index) => {
        if (practiceWrongKeys.has(index) && index < practiceTyped.length) {
            mark.classList.add('visible');
        } else {
            mark.classList.remove('visible');
        }
    });
    
    // Update corrected marks (yellow/orange cross)
    correctedMarks.forEach((mark, index) => {
        if (practiceCorrectedKeys.has(index)) {
            mark.classList.add('visible');
        } else {
            mark.classList.remove('visible');
        }
    });
    
    // Remove wrong class from keys (we use red cross instead)
    keyElements.forEach((keyEl) => {
        keyEl.classList.remove('wrong');
    });
    
    // Highlight the next expected key
    if (practiceTyped.length < combination.length) {
        // Remove active class from all keys
        keyElements.forEach(el => el.classList.remove('active'));
        
        // Add active class to next expected key
        const nextKeyIndex = practiceTyped.length;
        if (keyElements[nextKeyIndex]) {
            keyElements[nextKeyIndex].classList.add('active');
        }
    }
}

// Handle practice mode backspace/delete
function handlePracticeBackspace() {
    if (!practiceModalVisible || currentPracticeIndex >= practiceCombinations.length) {
        return false;
    }
    
    if (practiceTyped.length === 0) {
        return false; // Nothing to delete
    }
    
    // Track keystroke (also count in main game for statistics)
    practiceKeystrokes++;
    totalKeystrokes++; // Add to main game keystrokes for KPM calculation
    
    const lastIndex = practiceTyped.length - 1;
    const wasWrong = practiceWrongKeys.has(lastIndex);
    
    // Remove the last character
    practiceTyped.pop();
    
    // If it was a wrong key, remember this position had a wrong key that was deleted
    if (wasWrong) {
        practiceWrongKeys.delete(lastIndex);
        // Remember this position - when correct key is typed here, show corrected mark
        practiceDeletedWrongPositions.add(lastIndex);
    } else {
        // If it was a correct key, don't remove corrected mark (yellow crosses should persist)
        // Just remove from deleted positions if it was there
        practiceDeletedWrongPositions.delete(lastIndex);
    }
    
    // Update display
    updatePracticeKeys();
    
    return true;
}

// Handle practice mode key input
function handlePracticeKey(key, event) {
    if (!practiceModalVisible || currentPracticeIndex >= practiceCombinations.length) {
        return false;
    }
    
    const combination = practiceCombinations[currentPracticeIndex];
    const expectedChar = combination[practiceTyped.length];
    const normalizedKey = (key === ' ' || (event && event.code === 'Space')) ? ' ' : key.toLowerCase();
    
    // Track keystroke (also count in main game for statistics)
    practiceKeystrokes++;
    totalKeystrokes++; // Add to main game keystrokes for KPM calculation
    
    if (normalizedKey === expectedChar.toLowerCase()) {
        // Correct key
        const currentIndex = practiceTyped.length;
        
        // If this position had a wrong key that was deleted, mark it as corrected
        if (practiceDeletedWrongPositions.has(currentIndex)) {
            practiceCorrectedKeys.add(currentIndex);
            practiceDeletedWrongPositions.delete(currentIndex);
        }
        
        // If this position was still marked as wrong (user typed wrong then correct without deleting)
        if (practiceWrongKeys.has(currentIndex)) {
            // Mark as corrected since they typed the right key
            practiceCorrectedKeys.add(currentIndex);
            practiceWrongKeys.delete(currentIndex);
        }
        
        // IMPORTANT: Once a position is marked as corrected, it stays corrected forever
        // Yellow marks should never disappear, even if the key is deleted and retyped
        // If this position was ever corrected (even if deleted), ensure it stays marked
        // This handles the case where a corrected key is deleted and retyped
        if (practiceCorrectedKeys.has(currentIndex)) {
            // Position was already corrected - ensure it stays in the set
            // This is redundant since we never remove from practiceCorrectedKeys,
            // but makes the intent explicit: yellow marks persist forever
            practiceCorrectedKeys.add(currentIndex); // No-op if already there, but explicit
        }
        
        practiceTyped.push(normalizedKey);
        
        // Update display
        updatePracticeKeys();
        
        // Check if combination is complete
        if (practiceTyped.length >= combination.length) {
            // Only award points if no mistakes were ever made (all keys typed correctly on first try)
            // Check both the mistake flag and if any corrected marks exist
            if (!practiceHadMistake && practiceCorrectedKeys.size === 0) {
                // Award points for correct word (1 point per word)
                practicePoints += 1;
                document.getElementById('practicePoints').textContent = practicePoints;
                
                // Add practice points to main game score
                const oldScore = score;
                score += 1;
                scoreElement.textContent = score;
                
                // Check for level change (points in current level are tracked in checkLevelChange)
                checkLevelChange(oldScore, score);
            }
            
            // Update progress
            document.getElementById('practiceProgress').textContent = currentPracticeIndex + 1;
            
            // Move to next combination after short delay
            setTimeout(() => {
                currentPracticeIndex++;
                startPracticeCombination();
            }, 500);
        }
        
        return true;
    } else {
        // Wrong key - add it to typed sequence and mark as wrong, but allow continuing
        const currentIndex = practiceTyped.length;
        if (currentIndex < combination.length) {
            practiceTyped.push(normalizedKey);
            practiceWrongKeys.add(currentIndex);
            practiceHadMistake = true; // Mark that a mistake was made
        }
        
        // Update display to show wrong key with red cross
        updatePracticeKeys();
        
        return false;
    }
}

// Hide practice mode
function hidePracticeMode() {
    practiceModal.classList.remove('visible');
    practiceModalVisible = false;
    
    // Clear KPM interval
    if (practiceKPMInterval) {
        clearInterval(practiceKPMInterval);
        practiceKPMInterval = null;
    }
    
    // Practice keystrokes are already added to totalKeystrokes during practice
    // (they're added in handlePracticeKey and handlePracticeBackspace)
    // So we just need to update the KPM display
    if (gameRunning && !gamePaused) {
        updateKPMDisplay();
    }
    
    // If there's a pending level change, show it now (after practice completes)
    if (pendingLevelChange) {
        showLevelChangeModal(pendingLevelChange.level, pendingLevelChange.levelNumber);
        pendingLevelChange = null;
    } else {
        // Resume game if no pending level change
        if (gameRunning) {
            gamePaused = false;
            lastUpdate = Date.now();
            gameLoop = requestAnimationFrame(update);
            kpmUpdateInterval = setInterval(updateKPMDisplay, 500);
        }
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
            <span class="tutorial-mini-score-label">T/Min:</span>
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

// ============= LOGGING FUNCTIONS =============

// Log an event
function logEvent(eventType, data) {
    if (!loggingEnabled) return;
    
    const logEntry = {
        type: eventType,
        data: data,
        timestamp: new Date().toISOString(),
        gameState: {
            score: score,
            gameRunning: gameRunning,
            gamePaused: gamePaused,
            level: currentLevelIndex
        }
    };
    
    logBuffer.push(logEntry);
    
    // Send logs in batches
    if (logBuffer.length >= LOG_BUFFER_SIZE) {
        sendLogsToServer();
    }
}

// Send logs to server
async function sendLogsToServer() {
    if (logBuffer.length === 0) return;
    
    const logsToSend = [...logBuffer];
    logBuffer = []; // Clear buffer
    
    try {
        const response = await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs: logsToSend })
        });
        
        if (!response.ok) {
            console.error('Failed to send logs to server');
            // Re-add logs to buffer if send failed (for retry)
            logBuffer.unshift(...logsToSend);
        }
    } catch (error) {
        console.error('Error sending logs:', error);
        // Re-add logs to buffer if send failed (for retry)
        logBuffer.unshift(...logsToSend);
    }
}

// Toggle logging on/off
function toggleLogging() {
    loggingEnabled = !loggingEnabled;
    
    if (loggingEnabled) {
        // Log that logging started
        logEvent('logging_started', {
            timestamp: new Date().toISOString()
        });
        // Send any buffered logs immediately
        sendLogsToServer();
    } else {
        // Send any remaining logs before stopping
        sendLogsToServer();
        // Log that logging stopped
        logBuffer.push({
            type: 'logging_stopped',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
            gameState: {
                score: score,
                gameRunning: gameRunning,
                gamePaused: gamePaused,
                level: currentLevelIndex
            }
        });
        sendLogsToServer();
    }
    
    updateLoggingUI();
}

// Update logging UI
function updateLoggingUI() {
    const toggleLoggingBtn = document.getElementById('toggleLogging');
    const logStatusElement = document.getElementById('logStatus');
    
    if (toggleLoggingBtn && logStatusElement) {
        if (loggingEnabled) {
            toggleLoggingBtn.textContent = 'Stop Logging';
            logStatusElement.textContent = 'Logging: ON';
            logStatusElement.classList.add('logging');
        } else {
            toggleLoggingBtn.textContent = 'Start Logging';
            logStatusElement.textContent = 'Logging: OFF';
            logStatusElement.classList.remove('logging');
        }
    }
}

// Send logs periodically and on page unload
setInterval(() => {
    if (loggingEnabled && logBuffer.length > 0) {
        sendLogsToServer();
    }
}, 5000); // Send every 5 seconds

// Send logs on page unload
window.addEventListener('beforeunload', () => {
    if (loggingEnabled && logBuffer.length > 0) {
        // Use sendBeacon for reliable delivery on page unload
        const logsToSend = JSON.stringify({ logs: logBuffer });
        const blob = new Blob([logsToSend], { type: 'application/json' });
        navigator.sendBeacon('/api/logs', blob);
    }
});

// ============= DEBUG MENU FUNCTIONS =============

// Simulate game end with random data
function simulateGameEndWithRandomData() {
    if (!gameRunning) {
        // Generate random game data
        const randomScore = Math.floor(Math.random() * 100) + 10;
        const randomKPM = Math.floor(Math.random() * 200) + 50;
        const randomFingerUsage = {
            'finger-pinky': Math.floor(Math.random() * 20),
            'finger-ring': Math.floor(Math.random() * 30),
            'finger-middle': Math.floor(Math.random() * 25),
            'finger-index': Math.floor(Math.random() * 40)
        };
        
        // Set the game state to simulate game over
        score = randomScore;
        lastGameScore = randomScore;
        lastGameKPM = randomKPM;
        lastGameFingerUsage = randomFingerUsage;
        gameStatsSaved = false;
        
        // Show game over overlay with random data
        showOverlay('Game Over!', `Punkte: ${randomScore}`, true, randomKPM);
    } else {
        // If game is running, just trigger game over normally
        gameOver();
    }
}

// Change game speed (FPS)
function changeGameSpeed(newFPS) {
    if (newFPS > 0 && newFPS <= 20) {
        FPS = newFPS;
        const debugSpeedInput = document.getElementById('debugSpeed');
        if (debugSpeedInput) {
            debugSpeedInput.value = FPS;
        }
        console.log(`Game speed changed to ${FPS} FPS`);
    }
}

// Change key-changing period
function changeKeyChangePeriod(newPeriod) {
    if (newPeriod > 0) {
        PRESSES_PER_CHANGE = newPeriod;
        updateCounters(); // Update the counter displays
        const debugKeyChangePeriodInput = document.getElementById('debugKeyChangePeriod');
        if (debugKeyChangePeriodInput) {
            debugKeyChangePeriodInput.value = PRESSES_PER_CHANGE;
        }
        console.log(`Key change period changed to ${PRESSES_PER_CHANGE} presses`);
    }
}

// Go to specific level
function goToLevel(targetLevel) {
    if (availableLevels.length === 0) {
        console.warn('No levels available');
        return;
    }
    
    const levelIndex = Math.min(targetLevel - 1, availableLevels.length - 1);
    const level = availableLevels[levelIndex];
    
    if (level) {
        // Set the level
        currentLevelIndex = levelIndex + 1;
        currentLevel = level;
        maxLevelReached = Math.max(maxLevelReached, currentLevelIndex);
        
        // Apply level barriers
        applyLevel(level);
        
        // Set score to match the level (10 points per level)
        score = (levelIndex + 1) * 10;
        scoreElement.textContent = score;
        
        // Reset points in current level when jumping to a level
        pointsInCurrentLevel = 0;
        
        // Update debug menu level input
        const debugLevelInput = document.getElementById('debugLevel');
        if (debugLevelInput) {
            debugLevelInput.value = currentLevelIndex;
            debugLevelInput.max = availableLevels.length;
        }
        
        console.log(`Jumped to level ${currentLevelIndex}: ${level.name}`);
        
        // If game is running, show level change modal
        if (gameRunning) {
            showLevelChangeModal(level, currentLevelIndex);
        }
    }
}

// Update debug menu inputs to reflect current game state
function updateDebugMenu() {
    const debugSpeedInput = document.getElementById('debugSpeed');
    const debugKeyChangePeriodInput = document.getElementById('debugKeyChangePeriod');
    const debugLevelInput = document.getElementById('debugLevel');
    const debugForceProgressionInput = document.getElementById('debugForceProgression');
    
    if (debugSpeedInput) {
        debugSpeedInput.value = FPS;
    }
    if (debugKeyChangePeriodInput) {
        debugKeyChangePeriodInput.value = PRESSES_PER_CHANGE;
    }
    if (debugLevelInput && availableLevels.length > 0) {
        debugLevelInput.value = currentLevelIndex || 1;
        debugLevelInput.max = availableLevels.length;
    }
    if (debugForceProgressionInput) {
        debugForceProgressionInput.value = KEY_CHANGES_BEFORE_FORCE_PROGRESSION;
    }
}

// Initialize on load
init();

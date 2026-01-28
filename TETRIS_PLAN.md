# qwertzis (qwertz Tetris) - Game Plan

## Overview
A classic Tetris game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of movement/rotation keys, they change to new keys
- **Classic Tetris**: Falling tetrominoes, line clearing, increasing speed

## Game Mechanics

### Controls
- **Move Left**: One key (changes after 10 presses)
- **Move Right**: One key (changes after 10 presses)
- **Rotate**: One key (changes after 10 presses)
- **Soft Drop**: One key (changes after 10 presses) - Optional
- **Hard Drop**: One key (changes after 10 presses) - Optional

**Recommended**: Start with 3 keys (left, right, rotate), add drop keys later

### Key Changing System
- Same mechanism as Snake:
  - Each action has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Tetris Mechanics
1. **Tetrominoes**:
   - 7 classic pieces (I, O, T, S, Z, J, L)
   - Spawn at top center
   - Fall down automatically
   - Can be moved left/right
   - Can be rotated clockwise
   - Lock when touching bottom or other pieces

2. **Game Board**:
   - 10 columns × 20 rows (standard)
   - Grid-based placement
   - Filled cells block movement

3. **Line Clearing**:
   - When a row is completely filled, it clears
   - All rows above fall down
   - Multiple lines clear simultaneously (Tetris = 4 lines)
   - Points awarded per line cleared

4. **Scoring**:
   - Points per line cleared
   - Bonus for Tetris (4 lines)
   - Bonus for T-spins (optional)
   - Level increases speed
   - Display in header (same as Snake)

5. **Game Over**:
   - When new piece can't spawn
   - Stack reaches top

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertzis" or "qwertZetris"
- Add: Level display, Lines cleared

### Direction Info Section
- Change from 4 directions to 3-5 actions:
  - **Left** (←) with counter (0/10)
  - **Right** (→) with counter (0/10)
  - **Rotate** (↻) with counter (0/10)
  - **Soft Drop** (↓) with counter (0/10) - Optional
  - **Hard Drop** (↓↓) with counter (0/10) - Optional

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys with icons
- Same finger color coding

### Game Canvas
- Same size (400x400) or slightly taller for Tetris board
- Render:
  - Game board (10×20 grid)
  - Current falling piece
  - Next piece preview (optional)
  - Ghost piece (shows where piece will land)
  - Score overlay

### Key Change Modal
- Reuse existing modal
- Show which action changed (LEFT, RIGHT, ROTATE, etc.)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
tetris.js            # New game logic file
tetris.html          # New HTML (or reuse with game selector)
```

### Shared Components
- Reuse from Snake:
  - Keyboard rendering (`renderKeyboard()`)
  - Key change modal (`showKeyChangeModal()`)
  - Key changing logic (`changeSingleKey()`)
  - Statistics system

### New Components Needed

#### Game State
```javascript
let gameState = {
    board: Array(20).fill(null).map(() => Array(10).fill(0)), // 20 rows × 10 cols
    currentPiece: { type, x, y, rotation },
    nextPiece: { type },
    score: 0,
    level: 1,
    lines: 0,
    gameOver: false,
    dropTimer: 0,
    dropInterval: 1000 // Decreases with level
};
```

#### Tetromino Definitions
```javascript
const TETROMINOES = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]]
};
```

#### Control Keys
```javascript
let controlKeys = {
    left: 'a',     // Initial random assignment
    right: 'd',    // Initial random assignment
    rotate: 'w',   // Initial random assignment
    softDrop: 's', // Optional
    hardDrop: ' '  // Optional (spacebar)
};
```

#### Key Press Counters
```javascript
let keyPressCounters = {
    left: 0,
    right: 0,
    rotate: 0,
    softDrop: 0,   // Optional
    hardDrop: 0    // Optional
};
```

### Game Loop
- Update drop timer
- Move piece down when timer expires
- Check for line clears
- Update score
- Check for game over
- Render board and current piece

### Collision Detection
- Piece vs Board boundaries
- Piece vs Placed blocks
- Wall kicks for rotation (optional)

### Line Clearing
- Check each row for full lines
- Remove full lines
- Drop remaining blocks down
- Award points

## Level System

### Speed Progression
- Level 1: Slow drop speed
- Each level increases drop speed
- Level increases every 10 lines cleared
- Maximum speed cap

### Difficulty Curve
- Start slow, gradually increase
- More points per level
- Visual feedback for level up

## Special Features

### Ghost Piece
- Show where current piece will land
- Helps with placement decisions
- Classic Tetris feature

### Next Piece Preview
- Show next piece in queue
- Helps with planning
- Optional but recommended

### Hold Piece (Optional)
- Store current piece for later
- Adds strategy element
- Requires additional key

### T-Spins (Optional)
- Advanced technique
- Bonus points
- Requires precise rotation

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached
- Lines cleared
- Finger usage
- Duration
- Tetris count (4-line clears)

### Leaderboard
- Same statistics system
- Separate leaderboard for Tetris

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (Tetris instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation
- Add: Tetris-specific controls explanation

## Implementation Phases

### Phase 1: Core Game
1. Create `tetris.js` with basic game loop
2. Implement game board (10×20 grid)
3. Implement tetromino pieces and shapes
4. Implement piece spawning
5. Implement piece movement (left/right)
6. Implement piece rotation
7. Implement piece dropping
8. Implement line clearing
9. Basic scoring

### Phase 2: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for left/right/rotate
3. Add key change modal
4. Update keyboard visualization

### Phase 3: UI Integration
1. Adapt HTML to show left/right/rotate actions
2. Update header title and add level/lines
3. Integrate statistics system
4. Add game over overlay
5. Add next piece preview

### Phase 4: Polish
1. Add ghost piece
2. Add level progression
3. Add tutorial
4. Add sound effects (optional)
5. Add particle effects for line clears
6. Balance difficulty
7. Add hold piece (optional)

## Key Differences from Snake

| Aspect | Snake | Tetris |
|--------|-------|--------|
| Directions | 4 (up, down, left, right) | 3-5 (left, right, rotate, drop) |
| Game object | Snake (grows) | Pieces (fall, lock) |
| Goal | Eat food, avoid walls | Clear lines, avoid stack overflow |
| Movement | Discrete grid | Discrete grid (different mechanics) |
| Collision | Self-collision, walls | Piece vs board, piece vs pieces |
| Progression | Food → grow → levels | Lines → levels → speed |

## Code Reuse Strategy

### High Reuse (90%+)
- Keyboard rendering
- Key change modal
- Key changing logic
- Statistics system
- UI structure (header, overlays)
- Tutorial structure

### Medium Reuse (50-70%)
- Game loop structure
- Overlay system

### New Code Needed
- Tetromino piece system
- Board management
- Rotation logic
- Line clearing algorithm
- Collision detection (different from Snake)
- Drop mechanics

## Questions to Decide

1. **Number of control keys?**
   - Recommendation: Start with 3 (left, right, rotate), add drops later

2. **Soft drop vs Hard drop?**
   - Recommendation: Both optional, start without

3. **Hold piece?**
   - Recommendation: Add later, increases complexity

4. **Ghost piece?**
   - Recommendation: Yes, classic feature

5. **Next piece preview?**
   - Recommendation: Yes, helps planning

6. **T-spins?**
   - Recommendation: Optional, advanced feature

7. **Board size?**
   - Recommendation: Standard 10×20

## File Naming Convention

- `tetris.js` - Main game logic
- `tetris.html` - Tetris game page
- Or: `index.html` with game selector

## Special Considerations

### Rotation System
- Standard Rotation System (SRS) - modern standard
- Or Classic Rotation System - simpler
- Wall kicks for better playability

### Lock Delay
- Piece locks after touching ground
- Small delay allows last-second adjustments
- Classic Tetris feature

### Piece Colors
- Each tetromino type has distinct color
- Helps visual recognition
- Standard colors: I=cyan, O=yellow, T=purple, S=green, Z=red, J=blue, L=orange

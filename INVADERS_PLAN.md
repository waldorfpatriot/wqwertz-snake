# qwertz Invaders - Game Plan

## Overview
A classic Space Invaders game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of movement/shoot keys, they change to new keys
- **Classic Space Invaders**: Aliens moving in formation, player ship, shooting mechanics

## Game Mechanics

### Controls
- **Move Left**: One key (changes after 10 presses)
- **Move Right**: One key (changes after 10 presses)
- **Shoot**: One key (changes after 10 presses)

**Total**: 3 control keys, each changes independently after 10 presses

### Key Changing System
- Same mechanism as Snake:
  - Each action has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Space Invaders Mechanics
1. **Player Ship**:
   - Moves left/right at bottom of screen
   - Can shoot bullets upward
   - Destroyed if hit by alien bullet
   - Lives system (typically 3 lives)

2. **Aliens**:
   - Grid formation at top of screen
   - Move left/right, gradually descending
   - Speed increases as fewer aliens remain
   - Shoot bullets downward randomly
   - Different point values per row

3. **Bullets**:
   - Player bullets: Move upward, destroy aliens
   - Alien bullets: Move downward, destroy player
   - Only one player bullet on screen at a time (classic)

4. **Barriers** (Optional):
   - Destructible shields that protect player
   - Can be destroyed by both player and alien bullets

5. **Scoring**:
   - Points per alien destroyed (varies by row)
   - Bonus for clearing all aliens
   - Display in header (same as Snake)

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertzInvaders"

### Direction Info Section
- Change from 4 directions to 3 actions:
  - **Left** (←) with counter (0/10)
  - **Right** (→) with counter (0/10)
  - **Shoot** (↑ or ⚡) with counter (0/10)

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys (left/right/shoot) with icons
- Same finger color coding

### Game Canvas
- Same size (400x400)
- Render:
  - Alien formation at top
  - Player ship at bottom
  - Bullets (player and alien)
  - Barriers (optional)
  - Score overlay

### Key Change Modal
- Reuse existing modal
- Show which action changed (LEFT, RIGHT, or SHOOT)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
invaders.js          # New game logic file
invaders.html        # New HTML (or reuse with game selector)
```

### Shared Components
- Reuse from Snake:
  - Keyboard rendering (`renderKeyboard()`)
  - Key change modal (`showKeyChangeModal()`)
  - Key changing logic (`changeSingleKey()`)
  - Statistics system
  - Level system (for different alien formations)

### New Components Needed

#### Game State
```javascript
let gameState = {
    player: { x, y, width, height, lives },
    aliens: [{ x, y, type, alive }], // Grid of aliens
    playerBullet: { x, y, active },
    alienBullets: [{ x, y }],
    barriers: [{ x, y, health }], // Optional
    score: 0,
    level: 1,
    alienDirection: 1, // 1 = right, -1 = left
    alienSpeed: 1,
    gameOver: false
};
```

#### Control Keys
```javascript
let controlKeys = {
    left: 'a',    // Initial random assignment
    right: 'd',   // Initial random assignment
    shoot: 'w'    // Initial random assignment
};
```

#### Key Press Counters
```javascript
let keyPressCounters = {
    left: 0,
    right: 0,
    shoot: 0
};
```

### Game Loop
- Update alien positions (move left/right, descend)
- Update bullet positions
- Check collisions (bullets vs aliens, bullets vs player)
- Update player position based on key presses
- Render everything

### Collision Detection
- Player bullet vs Aliens
- Alien bullets vs Player
- Alien bullets vs Barriers (optional)
- Aliens reaching bottom = game over

## Level System

### Alien Formations
- Level 1: Standard 5-row formation
- Level 2+: More aliens, different patterns
- Speed increases per level
- Aliens get closer to player

### Progression
- New level when all aliens destroyed
- Player gets bonus points
- Aliens start lower each level

## Special Features

### Alien Types
- Top row: Highest points, shoots more often
- Middle rows: Medium points
- Bottom rows: Lowest points, but faster

### Shooting Mechanics
- Player: One bullet at a time (classic)
- Aliens: Random shooting from bottom row
- Bullet speed increases with level

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached
- Finger usage
- Duration
- Aliens destroyed

### Leaderboard
- Same statistics system
- Separate leaderboard for Invaders

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (Space Invaders instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation

## Implementation Phases

### Phase 1: Core Game
1. Create `invaders.js` with basic game loop
2. Implement player ship movement (left/right keys)
3. Implement shooting mechanism
4. Implement alien grid and movement
5. Basic collision detection
6. Basic scoring

### Phase 2: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for left/right/shoot
3. Add key change modal
4. Update keyboard visualization

### Phase 3: UI Integration
1. Adapt HTML to show left/right/shoot actions
2. Update header title
3. Integrate statistics system
4. Add game over overlay

### Phase 4: Polish
1. Add levels with different alien formations
2. Add barriers (optional)
3. Add tutorial
4. Add sound effects (optional)
5. Add particle effects for explosions
6. Balance difficulty

## Key Differences from Snake

| Aspect | Snake | Invaders |
|--------|-------|----------|
| Directions | 4 (up, down, left, right) | 3 (left, right, shoot) |
| Game object | Snake (grows) | Ship (moves, shoots) |
| Goal | Eat food, avoid walls | Destroy aliens, avoid bullets |
| Movement | Discrete grid | Continuous movement |
| Collision | Self-collision, walls | Bullets, aliens, player |
| Progression | Food → grow → levels | Aliens → levels |

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
- Level system
- Overlay system

### New Code Needed
- Alien grid management
- Bullet physics
- Collision detection
- Shooting mechanics
- Alien movement patterns

## Questions to Decide

1. **Barriers/Shields?**
   - Recommendation: Yes, adds strategy (classic feature)

2. **Lives system?**
   - Recommendation: Yes, 3 lives (classic)

3. **Alien shooting frequency?**
   - Recommendation: Increases as fewer aliens remain

4. **Multiple bullets?**
   - Recommendation: No, keep classic one-bullet limit

5. **Alien formations?**
   - Recommendation: Predefined patterns per level

6. **UFO/Bonus ship?**
   - Recommendation: Optional, adds excitement

## File Naming Convention

- `invaders.js` - Main game logic
- `invaders.html` - Invaders game page
- Or: `index.html` with game selector → `snake.html`, `breakout.html`, `invaders.html`

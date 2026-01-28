# qwertz Breakout - Game Plan

## Overview
A classic Breakout game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of a paddle direction key, it changes to a new key
- **Classic Breakout**: Ball bouncing, bricks breaking, paddle collision detection

## Game Mechanics

### Controls
- **Left paddle movement**: One key (changes after 10 presses)
- **Right paddle movement**: One key (changes after 10 presses)
- **OR**: Single paddle with left/right movement (2 keys total, each changes independently)

**Recommended**: Single paddle with left/right movement (simpler, matches Snake's 4-direction pattern)

### Key Changing System
- Same mechanism as Snake:
  - Each direction has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Breakout Mechanics
1. **Ball Physics**:
   - Ball starts moving at game start
   - Bounces off walls (top, left, right)
   - Bounces off paddle (angle depends on hit position)
   - Bounces off bricks (destroys brick on hit)
   - Game over if ball falls below paddle

2. **Bricks**:
   - Grid of bricks at top of screen
   - Different colors/points for different rows
   - Destroyed on ball contact
   - Level progression when all bricks destroyed

3. **Paddle**:
   - Moves left/right based on key presses
   - Collision detection with ball
   - Ball angle changes based on where it hits paddle

4. **Scoring**:
   - Points per brick destroyed
   - Bonus points for completing level
   - Display in header (same as Snake)

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertzBreakout" or "qwertZreakout"

### Direction Info Section
- Change from 4 directions to 2:
  - **Left** (←) with counter (0/10)
  - **Right** (→) with counter (0/10)
- Remove: Up (↑) and Down (↓)

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys (left/right) with arrows
- Same finger color coding

### Game Canvas
- Same size (400x400)
- Render:
  - Bricks grid at top
  - Paddle at bottom
  - Ball moving around
  - Score overlay (if needed)

### Key Change Modal
- Reuse existing modal
- Show which direction changed (LEFT or RIGHT)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
breakout.js          # New game logic file
breakout.html        # New HTML (or reuse index.html with game selector)
breakout-style.css   # Additional styles if needed
```

### Shared Components
- Reuse from Snake:
  - Keyboard rendering (`renderKeyboard()`)
  - Key change modal (`showKeyChangeModal()`)
  - Key changing logic (`changeSingleKey()`)
  - Statistics system
  - Level system (for different brick layouts)

### New Components Needed

#### Game State
```javascript
let gameState = {
    ball: { x, y, vx, vy, radius },
    paddle: { x, y, width, height },
    bricks: [{ x, y, width, height, color, destroyed }],
    score: 0,
    level: 1,
    lives: 3, // Optional
    gameOver: false
};
```

#### Control Keys
```javascript
let controlKeys = {
    left: 'a',   // Initial random assignment
    right: 'd'   // Initial random assignment
};
```

#### Key Press Counters
```javascript
let keyPressCounters = {
    left: 0,
    right: 0
};
```

### Game Loop
- Similar to Snake's game loop
- Update ball position
- Check collisions (walls, paddle, bricks)
- Update paddle position based on key presses
- Render everything

### Collision Detection
- Ball vs Walls
- Ball vs Paddle (with angle calculation)
- Ball vs Bricks (destroy brick on hit)

## Level System

### Brick Layouts
- Level 1: Simple grid (few rows)
- Level 2+: More rows, different patterns
- Use same level editor system (optional)
- Or predefined brick layouts

### Progression
- New level when all bricks destroyed
- Ball speed increases slightly each level
- More bricks per level

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached
- Finger usage
- Duration

### Leaderboard
- Same statistics system
- Separate leaderboard or combined?

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (Breakout instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation

## Game Modes (Optional)

### Classic Mode
- Single paddle, left/right movement
- Ball physics
- Brick breaking

### Two-Player Mode (Future)
- Two paddles (top and bottom)
- Each player has left/right keys
- Competitive or cooperative

## Implementation Phases

### Phase 1: Core Game
1. Create `breakout.js` with basic game loop
2. Implement paddle movement (left/right keys)
3. Implement ball physics and collision
4. Implement brick grid and destruction
5. Basic scoring

### Phase 2: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for left/right
3. Add key change modal
4. Update keyboard visualization

### Phase 3: UI Integration
1. Adapt HTML to show left/right directions
2. Update header title
3. Integrate statistics system
4. Add game over overlay

### Phase 4: Polish
1. Add levels with different brick layouts
2. Add tutorial
3. Add sound effects (optional)
4. Add particle effects for brick destruction
5. Balance difficulty

### Phase 5: Game Selector (Optional)
1. Add menu to choose between Snake and Breakout
2. Shared statistics or separate?
3. Shared level editor or separate?

## Key Differences from Snake

| Aspect | Snake | Breakout |
|--------|-------|----------|
| Directions | 4 (up, down, left, right) | 2 (left, right) |
| Game object | Snake (grows) | Ball (bounces) |
| Goal | Eat food, avoid walls | Break bricks, avoid falling |
| Movement | Discrete grid | Continuous physics |
| Collision | Self-collision, walls | Walls, paddle, bricks |
| Progression | Food → grow → levels | Bricks → levels |

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
- Ball physics
- Collision detection
- Brick rendering
- Paddle movement
- Breakout-specific game logic

## Questions to Decide

1. **Single paddle or two paddles?**
   - Recommendation: Single paddle (simpler, matches Snake pattern)

2. **Lives system?**
   - Recommendation: Yes, 3 lives (classic Breakout)

3. **Ball speed increase?**
   - Recommendation: Yes, gradually increases per level

4. **Brick patterns?**
   - Recommendation: Predefined layouts, can add level editor later

5. **Shared or separate statistics?**
   - Recommendation: Separate (different game types)

6. **Game selector on main page?**
   - Recommendation: Yes, allow choosing between games

## File Naming Convention

- `breakout.js` - Main game logic
- `breakout.html` - Breakout game page
- Or: `index.html` with game selector → `snake.html` and `breakout.html`

## Next Steps

1. Review and approve this plan
2. Create basic Breakout game structure
3. Implement core game mechanics
4. Integrate key-changing system
5. Polish and test

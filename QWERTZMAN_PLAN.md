# qwertz-man - Game Plan

## Overview
A classic Pac-Man style game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of movement keys, they change to new keys
- **Classic Pac-Man**: Labyrinth navigation, ghost avoidance, dot collection, power pellets

## Game Mechanics

### Controls
- **Move Left**: One key (changes after 10 presses)
- **Move Right**: One key (changes after 10 presses)
- **Move Up**: One key (changes after 10 presses)
- **Move Down**: One key (changes after 10 presses)

**Total**: 4 control keys, each changes independently after 10 presses

### Key Changing System
- Same mechanism as Snake:
  - Each direction has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Pac-Man Mechanics
1. **Player Character (qwertz-man)**:
   - Moves through labyrinth on grid
   - Can change direction at intersections
   - Eats dots while moving
   - Can eat power pellets
   - Has lives (typically 3)
   - Dies if touched by ghost (unless powered up)

2. **Labyrinth**:
   - Grid-based maze layout
   - Walls block movement
   - Dots scattered throughout
   - Power pellets at corners (typically 4)
   - Tunnels on sides (wrap around)

3. **Dots**:
   - Small dots: 10 points each
   - Power pellets: 50 points each
   - All dots must be eaten to complete level
   - Visual feedback when eaten

4. **Ghosts**:
   - 4 ghosts with different behaviors:
     - **Blinky** (Red): Chases directly
     - **Pinky** (Pink): Ambushes ahead
     - **Inky** (Cyan): Unpredictable
     - **Clyde** (Orange): Random behavior
   - Move on grid, turn at intersections
   - Vulnerable when power pellet eaten (blue, flashing)
   - Return to center when eaten
   - Points: 200, 400, 800, 1600 (increasing)

5. **Power Pellet Mode**:
   - Lasts ~6 seconds
   - Ghosts turn blue and flee
   - Can eat ghosts for points
   - Ghosts return to center after eaten
   - Speed increases during mode

6. **Scoring**:
   - Dots: 10 points each
   - Power pellets: 50 points each
   - Ghosts: 200, 400, 800, 1600 (first, second, third, fourth)
   - Bonus fruit: 100-5000 points (optional)
   - Display in header (same as Snake)

7. **Level Progression**:
   - Complete level by eating all dots
   - New level loads automatically
   - Ghosts get faster each level
   - Power pellet duration decreases
   - More difficult patterns

8. **Lives System**:
   - Start with 3 lives
   - Lose life when touched by ghost (unless powered up)
   - Game over when all lives lost
   - Extra life at 10,000 points (optional)

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertz-man"
- Add: Lives display (Lives: X), Level number, High score

### Direction Info Section
- Keep 4 directions (same as Snake):
  - **Left** (←) with counter (0/10)
  - **Right** (→) with counter (0/10)
  - **Up** (↑) with counter (0/10)
  - **Down** (↓) with counter (0/10)

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys (all 4 directions) with arrows
- Same finger color coding

### Game Canvas
- Same size (400x400) or slightly larger for labyrinth
- Render:
  - Labyrinth walls (maze pattern)
  - Dots (small yellow circles)
  - Power pellets (larger circles, flashing)
  - qwertz-man character (circular, mouth animation)
  - Ghosts (4 different colors)
  - Score overlay

### Key Change Modal
- Reuse existing modal
- Show which direction changed (LEFT, RIGHT, UP, DOWN)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
qwertzman.js         # New game logic file
qwertzman.html       # New HTML (or reuse with game selector)
```

### Shared Components
- Reuse from Snake:
  - Keyboard rendering (`renderKeyboard()`)
  - Key change modal (`showKeyChangeModal()`)
  - Key changing logic (`changeSingleKey()`)
  - Statistics system
  - Level system (for different labyrinth layouts)

### New Components Needed

#### Game State
```javascript
let gameState = {
    player: {
        x, y,           // Grid position
        direction: 'left' | 'right' | 'up' | 'down',
        nextDirection: null,  // Queued direction
        speed: 1,       // Tiles per frame
        lives: 3
    },
    ghosts: [{
        x, y,
        direction,
        mode: 'chase' | 'scatter' | 'frightened' | 'eaten',
        color: 'red' | 'pink' | 'cyan' | 'orange',
        targetTile: { x, y }
    }],
    labyrinth: {
        width: 28,      // Classic Pac-Man width
        height: 31,     // Classic Pac-Man height
        walls: [],      // Array of wall positions
        dots: [],       // Array of dot positions
        powerPellets: [] // Array of power pellet positions
    },
    score: 0,
    level: 1,
    dotsRemaining: 0,
    powerPelletActive: false,
    powerPelletTimer: 0,
    gameOver: false
};
```

#### Labyrinth Layout
```javascript
// Classic Pac-Man labyrinth pattern
// 0 = empty, 1 = wall, 2 = dot, 3 = power pellet
const LABYRINTH_LAYOUT = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,3,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,3,1],
    // ... rest of labyrinth
];
```

#### Control Keys
```javascript
let controlKeys = {
    left: 'a',   // Initial random assignment
    right: 'd',  // Initial random assignment
    up: 'w',     // Initial random assignment
    down: 's'    // Initial random assignment
};
```

#### Key Press Counters
```javascript
let keyPressCounters = {
    left: 0,
    right: 0,
    up: 0,
    down: 0
};
```

### Game Loop
- Update player position (grid-based movement)
- Update ghost positions (AI-based movement)
- Check collisions (player vs ghosts, player vs dots)
- Check for power pellet activation
- Update power pellet timer
- Render everything

### Collision Detection
- Player vs Walls (can't move through)
- Player vs Dots (collect, remove dot)
- Player vs Power Pellets (activate power mode)
- Player vs Ghosts (die or eat ghost)
- Ghosts vs Walls (turn at intersections)

### Ghost AI
- **Chase Mode**: Move toward target tile (player position)
- **Scatter Mode**: Move toward corner
- **Frightened Mode**: Random movement (when powered up)
- **Eaten Mode**: Return to center quickly
- Turn at intersections based on target
- Can't reverse direction (except when eaten)

### Movement System
- Grid-based movement (tile-by-tile)
- Can queue next direction at intersections
- Smooth animation between tiles
- Direction changes only at intersections

## Level System

### Labyrinth Layouts
- Level 1: Classic Pac-Man layout
- Level 2+: Same layout, faster ghosts
- Optional: Different layouts per level

### Level Progression
- Complete level by eating all dots
- New level loads automatically
- Ghosts get faster
- Power pellet duration decreases
- More challenging patterns

### Difficulty Scaling
- Ghost speed increases
- Power pellet duration decreases
- Scatter/chase timing changes
- More aggressive ghost behavior

## Special Features

### Ghost Behaviors
- **Blinky (Red)**: Direct chase, most aggressive
- **Pinky (Pink)**: Ambush ahead of player
- **Inky (Cyan)**: Unpredictable, uses Blinky's position
- **Clyde (Orange)**: Random when close, chases when far

### Power Pellet Mode
- Ghosts turn blue and flee
- Can eat ghosts for points
- Increasing point values (200, 400, 800, 1600)
- Ghosts return to center after eaten
- Mode ends after timer or all ghosts eaten

### Bonus Fruit (Optional)
- Appears periodically
- Different fruits = different points
- 100-5000 points depending on level
- Disappears after time limit

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached
- Finger usage
- Duration
- Dots collected
- Ghosts eaten
- Lives remaining

### Leaderboard
- Same statistics system
- Separate leaderboard for qwertz-man
- Track highest level reached
- Track highest score

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (qwertz-man instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation
- Add: qwertz-man-specific controls explanation
- Add: Ghost avoidance strategies
- Add: Power pellet usage tips
- Add: Labyrinth navigation tips

## Implementation Phases

### Phase 1: Core Game
1. Create `qwertzman.js` with basic game loop
2. Implement labyrinth layout (grid system)
3. Implement player movement (grid-based, 4 directions)
4. Implement dot collection
5. Basic collision detection (walls, dots)

### Phase 2: Ghosts and AI
1. Add ghosts (4 different colors)
2. Implement ghost AI (chase, scatter, frightened modes)
3. Implement ghost movement (grid-based)
4. Add ghost collision (damage or eat)
5. Add power pellet system

### Phase 3: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for all 4 directions
3. Add key change modal
4. Update keyboard visualization

### Phase 4: UI Integration
1. Adapt HTML to show 4 directions (same as Snake)
2. Update header title
3. Integrate statistics system
4. Add game over overlay
5. Add level complete overlay

### Phase 5: Polish
1. Add multiple levels
2. Add ghost behaviors (different AI patterns)
3. Add bonus fruit (optional)
4. Add tutorial
5. Add sound effects (optional)
6. Add visual effects (animations, particles)
7. Balance difficulty
8. Add smooth animations

## Key Differences from Snake

| Aspect | Snake | qwertz-man |
|--------|-------|------------|
| Directions | 4 (up, down, left, right) | 4 (up, down, left, right) |
| Game object | Snake (grows) | qwertz-man (moves) |
| Goal | Eat food, avoid walls | Eat dots, avoid ghosts |
| Movement | Discrete grid | Discrete grid (same) |
| Collision | Self-collision, walls | Ghosts, walls, dots |
| Progression | Food → grow → levels | Dots → power pellets → levels |

## Code Reuse Strategy

### High Reuse (95%+)
- Keyboard rendering
- Key change modal
- Key changing logic
- Statistics system
- UI structure (header, overlays)
- Tutorial structure
- 4-direction control system (same as Snake!)

### Medium Reuse (50-70%)
- Game loop structure
- Level system
- Overlay system

### New Code Needed
- Labyrinth rendering
- Ghost AI system
- Grid-based movement (different from Snake's continuous)
- Power pellet system
- Dot collection system

## Questions to Decide

1. **Labyrinth size?**
   - Recommendation: Classic 28×31 (or scaled to fit canvas)

2. **Number of lives?**
   - Recommendation: 3 lives (classic)

3. **Ghost AI complexity?**
   - Recommendation: Start simple, add complexity later

4. **Power pellet duration?**
   - Recommendation: ~6 seconds, decreases per level

5. **Bonus fruit?**
   - Recommendation: Optional, adds variety

6. **Level layouts?**
   - Recommendation: Start with classic, add variations later

7. **Animation smoothness?**
   - Recommendation: Smooth tile-to-tile animation

## File Naming Convention

- `qwertzman.js` - Main game logic
- `qwertzman.html` - qwertz-man game page
- Or: `index.html` with game selector

## Special Considerations

### Grid-Based Movement
- Movement is tile-by-tile (not continuous)
- Can queue next direction at intersections
- Smooth animation between tiles
- Direction changes only at valid intersections

### Ghost AI Complexity
- Start with simple chase behavior
- Add scatter mode (ghosts go to corners)
- Add frightened mode (random when powered)
- Add individual ghost personalities later

### Performance
- Grid-based is efficient
- Few collision checks needed
- Smooth 60 FPS achievable
- Ghost AI calculations per frame

### Visual Design
- Classic Pac-Man aesthetic
- Clear labyrinth walls
- Distinct ghost colors
- Smooth character animations
- Power pellet flashing effect

### Difficulty Balance
- Start easy (slow ghosts)
- Increase speed gradually
- Power pellet duration decreases
- More aggressive ghost behavior

## Advanced Features (Future)

### Different Labyrinth Layouts
- Multiple level designs
- Themed labyrinths
- Custom layouts

### Ghost Personalities
- More distinct behaviors
- Advanced AI patterns
- Unpredictable movements

### Multiplayer (Optional)
- Two players alternate
- Competitive scoring
- Ghost control (one player)

## Next Steps

1. Review and approve this plan
2. Create basic qwertz-man game structure
3. Implement labyrinth layout system
4. Implement grid-based movement
5. Integrate key-changing system
6. Add ghosts and AI
7. Polish and test

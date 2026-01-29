# frogqwertz - Game Plan

## Overview
A classic Frogger style game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of movement keys, they change to new keys
- **Classic Frogger**: Cross road and river, avoid cars, jump on logs, reach home

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

### Frogger Mechanics
1. **Player Character (Frog)**:
   - Moves one tile at a time (grid-based)
   - Can move in 4 directions
   - Must reach home at top
   - Dies if hit by car or falls in water
   - Has lives (typically 3-5)
   - Respawns at bottom when dies

2. **Road Section**:
   - Multiple lanes of traffic
   - Cars/trucks moving left and right
   - Different speeds per lane
   - Must avoid all vehicles
   - Die if hit by vehicle

3. **River Section**:
   - Moving logs and turtles
   - Must jump on logs/turtles to cross
   - Fall in water if not on log/turtle
   - Logs move left and right
   - Turtles dive underwater (optional)

4. **Home Area**:
   - 5 home slots at top
   - Must reach empty slot
   - Bonus points for reaching home
   - Level complete when all 5 homes filled
   - Crocodile/alligator in home (optional, kills frog)

5. **Scoring**:
   - Reaching home: 10 points × remaining time
   - Bonus: 50 points for all 5 homes
   - Bonus: Extra life every 20,000 points
   - Time bonus decreases as time passes
   - Display in header (same as Snake)

6. **Level Progression**:
   - Complete level by filling all 5 homes
   - New level loads automatically
   - Cars move faster
   - More traffic per lane
   - Logs move faster
   - Less time to complete

7. **Lives System**:
   - Start with 3-5 lives
   - Lose life when hit by car or falls in water
   - Game over when all lives lost
   - Extra life at score milestones

8. **Time Limit**:
   - Timer counts down
   - Must complete level before time runs out
   - Time bonus decreases as timer runs
   - Lose life if time runs out (optional)

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "frogqwertz"
- Add: Lives display (Lives: X), Level number, Time remaining

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
- Same size (400x400) or taller for vertical layout
- Render:
  - Home area (top, 5 slots)
  - River section (logs, turtles)
  - Road section (cars, trucks)
  - Starting area (bottom)
  - Frog character
  - Score overlay

### Key Change Modal
- Reuse existing modal
- Show which direction changed (LEFT, RIGHT, UP, DOWN)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
frogqwertz.js       # New game logic file
frogqwertz.html     # New HTML (or reuse with game selector)
```

### Shared Components
- Reuse from Snake:
  - Keyboard rendering (`renderKeyboard()`)
  - Key change modal (`showKeyChangeModal()`)
  - Key changing logic (`changeSingleKey()`)
  - Statistics system
  - Level system (for different road/river layouts)

### New Components Needed

#### Game State
```javascript
let gameState = {
    frog: {
        x, y,           // Grid position
        tileX: 0,       // Tile X position
        tileY: 0,       // Tile Y position
        lives: 3,
        onLog: null     // Reference to log if on one
    },
    road: {
        lanes: [{
            y: number,          // Y position
            vehicles: [{        // Cars/trucks
                x: number,
                speed: number,
                direction: 'left' | 'right',
                width: number
            }],
            speed: number
        }]
    },
    river: {
        lanes: [{
            y: number,          // Y position
            logs: [{            // Logs/turtles
                x: number,
                speed: number,
                direction: 'left' | 'right',
                width: number,
                type: 'log' | 'turtle'
            }],
            speed: number
        }]
    },
    homes: [
        { x: number, filled: boolean, hasCrocodile: boolean }
    ],
    score: 0,
    level: 1,
    timeRemaining: 60,  // Seconds
    gameOver: false
};
```

#### Grid Layout
```javascript
const GRID = {
    width: 10,          // Tiles wide
    height: 15,         // Tiles tall
    tileSize: 26,       // Pixels per tile
    homeY: 0,           // Top row
    startY: 14          // Bottom row
};

// Layout:
// Row 0: Home slots (5)
// Rows 1-2: Safe zone / River edge
// Rows 3-7: River (logs/turtles)
// Rows 8-9: Safe zone
// Rows 10-13: Road (cars)
// Row 14: Starting area
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
- Update vehicle positions (road lanes)
- Update log positions (river lanes)
- Update frog position (if on log, move with log)
- Check collisions (frog vs vehicles, frog vs water)
- Update timer
- Check for level completion
- Render everything

### Collision Detection
- Frog vs Vehicles (die if hit)
- Frog vs Water (die if not on log)
- Frog vs Home (reach home, fill slot)
- Frog vs Logs (attach to log, move with it)

### Movement System
- Grid-based movement (one tile at a time)
- Frog moves instantly to next tile
- Smooth animation between tiles (optional)
- Can't move off screen edges (left/right)
- Can move up/down between sections

### Vehicle Movement
- Cars move left or right
- Different speeds per lane
- Wrap around screen edges
- Spawn continuously
- Different vehicle types (cars, trucks)

### Log Movement
- Logs move left or right
- Different speeds per lane
- Wrap around screen edges
- Frog moves with log when on it
- Must stay on log or fall in water

## Level System

### Road Layouts
- Level 1: Few lanes, slow cars
- Level 2+: More lanes, faster cars
- Different vehicle patterns per level

### River Layouts
- Level 1: Slow logs, many gaps
- Level 2+: Faster logs, fewer gaps
- Different log patterns per level

### Level Progression
- Complete level by filling all 5 homes
- New level loads automatically
- Cars move faster
- Logs move faster
- Less time to complete
- More traffic

### Difficulty Scaling
- Vehicle speed increases
- Log speed increases
- More vehicles per lane
- Fewer logs (harder to cross)
- Less time per level

## Special Features

### Home Slots
- 5 slots at top
- Must reach empty slot
- Bonus points for filling
- Crocodile in slot (optional, kills frog)
- Visual indicator for filled slots

### Time Bonus
- Points = 10 × remaining time
- Decreases as timer runs
- Encourages fast completion
- Strategic timing

### Vehicle Types
- **Cars**: Small, fast
- **Trucks**: Large, slower
- **Turtles**: Can dive (optional)
- Different point values (optional)

### Safe Zones
- Areas between road and river
- No danger in safe zones
- Can pause and plan next move
- Strategic positioning

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached
- Finger usage
- Duration
- Homes reached
- Lives remaining

### Leaderboard
- Same statistics system
- Separate leaderboard for frogqwertz
- Track highest level reached
- Track highest score

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (frogqwertz instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation
- Add: frogqwertz-specific controls explanation
- Add: Road crossing strategies
- Add: River crossing strategies
- Add: Timing and planning tips

## Implementation Phases

### Phase 1: Core Game
1. Create `frogqwertz.js` with basic game loop
2. Implement grid system
3. Implement frog movement (4 directions, grid-based)
4. Implement road section (vehicles moving)
5. Basic collision detection (frog vs vehicles)

### Phase 2: River and Home
1. Add river section (logs moving)
2. Implement log attachment (frog moves with log)
3. Implement water collision (die if not on log)
4. Add home area (5 slots)
5. Implement home reaching logic

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
2. Add timer system
3. Add scoring system
4. Add tutorial
5. Add sound effects (optional)
6. Add visual effects (animations)
7. Balance difficulty

## Key Differences from Snake

| Aspect | Snake | frogqwertz |
|--------|-------|------------|
| Directions | 4 (up, down, left, right) | 4 (up, down, left, right) |
| Game object | Snake (grows) | Frog (moves) |
| Goal | Eat food, avoid walls | Reach home, avoid cars/water |
| Movement | Discrete grid | Discrete grid (same) |
| Collision | Self-collision, walls | Vehicles, water, boundaries |
| Progression | Food → grow → levels | Homes → levels → faster |

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
- Grid-based movement (similar to Snake)
- Vehicle movement system
- Log movement system
- Collision detection (vehicles, water)
- Home slot system
- Timer system

## Questions to Decide

1. **Grid size?**
   - Recommendation: 10×15 tiles (classic)

2. **Number of lives?**
   - Recommendation: 3-5 lives (classic)

3. **Time limit?**
   - Recommendation: 60 seconds, decreases per level

4. **Vehicle speed?**
   - Recommendation: Varies per lane, increases per level

5. **Log speed?**
   - Recommendation: Varies per lane, increases per level

6. **Turtle diving?**
   - Recommendation: Optional, adds difficulty

7. **Crocodile in home?**
   - Recommendation: Optional, adds risk

8. **Animation smoothness?**
   - Recommendation: Smooth tile-to-tile animation

## File Naming Convention

- `frogqwertz.js` - Main game logic
- `frogqwertz.html` - frogqwertz game page
- Or: `index.html` with game selector

## Special Considerations

### Grid-Based Movement
- Movement is tile-by-tile (not continuous)
- Instant movement to next tile
- Smooth animation optional
- Can't move off screen (left/right)

### Timing and Strategy
- Must time vehicle crossings
- Must plan log jumps
- Time pressure adds challenge
- Strategic positioning important

### Performance
- Grid-based is efficient
- Few collision checks needed
- Smooth 60 FPS achievable
- Vehicle/log updates per frame

### Visual Design
- Classic Frogger aesthetic
- Clear road lanes
- Distinct vehicle types
- Clear log/turtle distinction
- Smooth character animations

### Difficulty Balance
- Start easy (slow vehicles, many logs)
- Increase speed gradually
- More traffic per level
- Less time per level
- Strategic challenge

## Advanced Features (Future)

### Different Themes
- City theme
- Forest theme
- Desert theme
- Each with unique vehicles/logs

### Power-ups (Optional)
- Extra time
- Slow motion
- Invincibility (brief)
- Extra life

### Multiplayer (Optional)
- Two frogs
- Competitive scoring
- Shared road/river

## Next Steps

1. Review and approve this plan
2. Create basic frogqwertz game structure
3. Implement grid system
4. Implement vehicle/log movement
5. Integrate key-changing system
6. Add collision detection
7. Polish and test

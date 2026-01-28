# qwertz Pinball - Game Plan

## Overview
A classic Pinball game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of flipper/launch keys, they change to new keys
- **Classic Pinball**: Ball physics, flippers, bumpers, targets, ramps, scoring zones

## Game Mechanics

### Controls
- **Left Flipper**: One key (changes after 10 presses)
- **Right Flipper**: One key (changes after 10 presses)
- **Launch/Plunger**: One key (changes after 10 presses) - Optional

**Recommended**: Start with 2 keys (left/right flippers), add launch key later

### Key Changing System
- Same mechanism as Snake:
  - Each action has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Pinball Mechanics
1. **Ball Physics**:
   - Ball starts in plunger/launch area
   - Gravity and physics simulation
   - Bounces off all surfaces
   - Friction and damping
   - Can fall through drain (lose ball)

2. **Flippers**:
   - Left and right flippers at bottom
   - Activate when key pressed
   - Flip ball upward
   - Can hold flipper up (continuous press)
   - Ball angle depends on where it hits flipper

3. **Bumpers**:
   - Circular bumpers that bounce ball
   - Award points on hit
   - Can have different point values
   - Visual/audio feedback on hit

4. **Targets**:
   - Stationary targets that award points
   - Can be drop targets (fall when hit)
   - Can be rollover targets (ball rolls over)
   - Different point values

5. **Ramps**:
   - Inclined surfaces ball can roll up
   - Lead to different areas of playfield
   - Can have scoring zones at top

6. **Scoring Zones**:
   - Areas that award points when ball passes through
   - Can be multipliers
   - Can trigger special modes

7. **Special Features**:
   - Multi-ball mode (multiple balls)
   - Bonus multipliers
   - Jackpot scoring
   - Extra ball awards

8. **Lives/Balls**:
   - Typically 3 balls per game
   - Lose ball when it drains
   - Game over when all balls lost

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertzPinball"
- Add: Ball count (Balls: X), Bonus multiplier

### Direction Info Section
- Change from 4 directions to 2-3 actions:
  - **Left Flipper** (⬅ or ⚡) with counter (0/10)
  - **Right Flipper** (➡ or ⚡) with counter (0/10)
  - **Launch** (⬆ or 🚀) with counter (0/10) - Optional

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys with icons
- Same finger color coding
- Show flipper keys prominently

### Game Canvas
- Same size (400x400) or taller for pinball table
- Render:
  - Pinball playfield (angled view or top-down)
  - Flippers at bottom
  - Ball
  - Bumpers, targets, ramps
  - Score zones
  - Ball drain area

### Key Change Modal
- Reuse existing modal
- Show which action changed (LEFT FLIPPER, RIGHT FLIPPER, LAUNCH)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
pinball.js           # New game logic file
pinball.html         # New HTML (or reuse with game selector)
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
    ball: { x, y, vx, vy, radius, mass },
    leftFlipper: { x, y, angle, length, active },
    rightFlipper: { x, y, angle, length, active },
    bumpers: [{ x, y, radius, points }],
    targets: [{ x, y, width, height, points, hit }],
    ramps: [{ x1, y1, x2, y2, angle }],
    score: 0,
    bonus: 0,
    multiplier: 1,
    ballsRemaining: 3,
    ballInPlay: false,
    gameOver: false
};
```

#### Physics Constants
```javascript
const PHYSICS = {
    gravity: 0.5,
    friction: 0.98,
    ballRadius: 5,
    flipperLength: 40,
    flipperSpeed: 0.3,
    bumperForce: 5,
    minBallSpeed: 0.1
};
```

#### Control Keys
```javascript
let controlKeys = {
    leftFlipper: 'a',   // Initial random assignment
    rightFlipper: 'd',   // Initial random assignment
    launch: 'w'          // Optional
};
```

#### Key Press Counters
```javascript
let keyPressCounters = {
    leftFlipper: 0,
    rightFlipper: 0,
    launch: 0            // Optional
};
```

### Game Loop
- Update ball physics (gravity, velocity, position)
- Update flipper positions (based on key presses)
- Check collisions (ball vs flippers, bumpers, targets, walls, ramps)
- Check for drain (ball falls through)
- Update score
- Render everything

### Collision Detection
- Ball vs Flippers (with angle calculation)
- Ball vs Bumpers (bounce with force)
- Ball vs Targets (award points, may fall/disappear)
- Ball vs Ramps (slide up/down)
- Ball vs Walls (bounce)
- Ball vs Drain (lose ball)

### Physics Simulation
- Gravity: Constant downward acceleration
- Friction: Reduces velocity over time
- Bounce: Elastic collisions with energy loss
- Flipper mechanics: Rotate upward when activated
- Ball trajectory: Realistic physics

## Level System

### Pinball Tables
- Level 1: Simple table (few bumpers, basic targets)
- Level 2+: More complex layouts
- Different table themes:
  - Classic arcade
  - Space theme
  - Adventure theme
  - Each with unique layout

### Progression
- New table when score threshold reached
- More complex layouts per level
- Higher point values
- More special features

## Special Features

### Multi-Ball Mode
- Multiple balls in play simultaneously
- Triggered by hitting specific targets
- Increases scoring potential
- More challenging to control

### Bonus Multipliers
- Increase score multiplier
- Triggered by specific actions
- Can stack up to 10x or more

### Extra Ball
- Awarded at certain score thresholds
- Gives player additional chance
- Classic pinball feature

### Special Modes
- Jackpot mode: High scoring opportunity
- Combo mode: Chain multiple hits
- Time bonus: Limited time high scoring

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached (table number)
- Finger usage
- Duration
- Balls played
- Highest combo
- Special modes triggered

### Leaderboard
- Same statistics system
- Separate leaderboard for Pinball
- Track high scores per table

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (Pinball instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation
- Add: Pinball-specific controls explanation
- Add: Flipper timing tips
- Add: Scoring strategies

## Implementation Phases

### Phase 1: Core Game
1. Create `pinball.js` with basic game loop
2. Implement ball physics (gravity, velocity, collision)
3. Implement flippers (left/right, rotation, activation)
4. Implement basic playfield (walls, drain)
5. Basic collision detection
6. Basic scoring

### Phase 2: Pinball Elements
1. Add bumpers (circular, bounce ball)
2. Add targets (stationary, award points)
3. Add ramps (inclined surfaces)
4. Add scoring zones
5. Improve physics (friction, bounce damping)

### Phase 3: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for flippers/launch
3. Add key change modal
4. Update keyboard visualization

### Phase 4: UI Integration
1. Adapt HTML to show flipper/launch actions
2. Update header title and add ball count
3. Integrate statistics system
4. Add game over overlay
5. Add ball launch mechanism

### Phase 5: Polish
1. Add multiple tables/levels
2. Add special modes (multi-ball, bonus multipliers)
3. Add tutorial
4. Add sound effects (optional)
5. Add visual effects (particles, lights)
6. Balance difficulty
7. Add launch/plunger mechanism

## Key Differences from Snake

| Aspect | Snake | Pinball |
|--------|-------|---------|
| Directions | 4 (up, down, left, right) | 2-3 (left flipper, right flipper, launch) |
| Game object | Snake (grows) | Ball (bounces) |
| Goal | Eat food, avoid walls | Score points, keep ball in play |
| Movement | Discrete grid | Continuous physics |
| Collision | Self-collision, walls | Ball vs flippers, bumpers, targets, walls |
| Progression | Food → grow → levels | Score → levels → new tables |

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
- Ball physics engine
- Flipper mechanics
- Collision detection (complex, many object types)
- Bumper/target/ramp systems
- Scoring system
- Multi-ball mode
- Special effects

## Questions to Decide

1. **Launch/Plunger key?**
   - Recommendation: Yes, adds control over ball start

2. **Number of balls?**
   - Recommendation: 3 balls (classic)

3. **Table complexity?**
   - Recommendation: Start simple, add complexity per level

4. **Multi-ball mode?**
   - Recommendation: Yes, classic feature

5. **Bonus multipliers?**
   - Recommendation: Yes, adds strategy

6. **Table themes?**
   - Recommendation: Multiple themes, different layouts

7. **View angle?**
   - Recommendation: Angled view (classic) or top-down (easier)

8. **Ball speed?**
   - Recommendation: Moderate, can increase with level

## File Naming Convention

- `pinball.js` - Main game logic
- `pinball.html` - Pinball game page
- Or: `index.html` with game selector

## Special Considerations

### Physics Engine
- Need accurate ball physics
- Gravity, friction, bounce damping
- Realistic flipper mechanics
- Smooth collision detection

### Flipper Mechanics
- Rotate upward when key pressed
- Hold position when key held
- Return to rest position when released
- Ball angle depends on hit position
- Can "catch" ball on flipper tip

### Ball Control
- Flipper timing is crucial
- Can nudge table (optional, advanced)
- Ball speed management
- Strategic flipper use

### Visual Design
- Classic pinball aesthetic
- Bright colors for targets/bumpers
- Clear playfield layout
- Visual feedback for hits
- Score displays on playfield (optional)

### Difficulty Balance
- Start easy (slow ball, simple layout)
- Increase complexity gradually
- More elements per level
- Faster ball speed
- More challenging layouts

## Advanced Features (Future)

### Table Editor
- Custom pinball table creation
- Place bumpers, targets, ramps
- Set point values
- Share tables

### Online Leaderboards
- Global high scores
- Per-table rankings
- Weekly challenges

### Achievements
- Score milestones
- Special mode completions
- Combo achievements
- Perfect games

### Sound Design
- Ball rolling sounds
- Bumper hits
- Flipper activation
- Score chimes
- Background music

## Implementation Challenges

### Physics Accuracy
- Realistic ball movement
- Proper collision response
- Flipper-ball interaction
- Ramp physics

### Performance
- Many collision checks per frame
- Multiple balls in multi-ball mode
- Particle effects
- Smooth 60 FPS

### Control Responsiveness
- Flippers must respond instantly
- No input lag
- Smooth key press handling
- Key change doesn't interrupt gameplay

## Next Steps

1. Review and approve this plan
2. Research pinball physics libraries (optional)
3. Create basic pinball game structure
4. Implement core physics engine
5. Implement flippers and basic playfield
6. Integrate key-changing system
7. Add pinball elements (bumpers, targets)
8. Polish and test

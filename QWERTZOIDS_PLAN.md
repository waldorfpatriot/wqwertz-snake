# qwertzoids - Game Plan

## Overview
A classic Asteroids style game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of movement/shoot keys, they change to new keys
- **Classic Asteroids**: Space physics, rotation, inertia, asteroid destruction, UFOs

## Game Mechanics

### Controls
- **Rotate Left**: One key (changes after 10 presses)
- **Rotate Right**: One key (changes after 10 presses)
- **Thrust/Forward**: One key (changes after 10 presses)
- **Shoot**: One key (changes after 10 presses)

**Total**: 4 control keys, each changes independently after 10 presses

### Key Changing System
- Same mechanism as Snake:
  - Each action has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Asteroids Mechanics
1. **Player Ship**:
   - Rotates left/right
   - Thrust forward (adds velocity)
   - Shoots bullets
   - Has inertia (continues moving)
   - Wraps around screen edges
   - Has lives (typically 3)
   - Destroyed if hit by asteroid or UFO bullet

2. **Asteroids**:
   - Large asteroids: Break into 2 medium asteroids
   - Medium asteroids: Break into 2 small asteroids
   - Small asteroids: Destroyed completely
   - Move in random directions
   - Rotate slowly
   - Points: Large=20, Medium=50, Small=100

3. **UFOs**:
   - Large UFO: 200 points, shoots at player
   - Small UFO: 1000 points, moves erratically
   - Appear periodically
   - Shoot bullets at player
   - Can be destroyed by player bullets

4. **Bullets**:
   - Player bullets: Move forward in ship direction
   - UFO bullets: Move toward player
   - Limited bullets on screen (typically 4)
   - Destroy asteroids and UFOs on hit

5. **Physics**:
   - Inertia: Ship continues moving after thrust
   - Friction: Velocity decreases slowly over time
   - Rotation: Ship rotates smoothly
   - Wrap-around: Ship/asteroids wrap screen edges

6. **Scoring**:
   - Large asteroid: 20 points
   - Medium asteroid: 50 points
   - Small asteroid: 100 points
   - Large UFO: 200 points
   - Small UFO: 1000 points
   - Display in header (same as Snake)

7. **Level Progression**:
   - Complete level by destroying all asteroids
   - New level loads automatically
   - More asteroids per level
   - Asteroids move faster
   - UFOs appear more frequently

8. **Lives System**:
   - Start with 3 lives
   - Lose life when hit by asteroid or UFO bullet
   - Game over when all lives lost
   - Extra life every 10,000 points (optional)

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertzoids"
- Add: Lives display (Lives: X), Level number, High score

### Direction Info Section
- Change from 4 directions to 4 actions:
  - **Rotate Left** (↺) with counter (0/10)
  - **Rotate Right** (↻) with counter (0/10)
  - **Thrust** (↑) with counter (0/10)
  - **Shoot** (⚡) with counter (0/10)

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys with icons
- Same finger color coding

### Game Canvas
- Same size (400x400)
- Render:
  - Black space background
  - Player ship (triangle, rotates)
  - Asteroids (various sizes, rotating)
  - UFOs (when present)
  - Bullets (player and UFO)
  - Particle effects (explosions)
  - Score overlay

### Key Change Modal
- Reuse existing modal
- Show which action changed (ROTATE LEFT, ROTATE RIGHT, THRUST, SHOOT)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
qwertzoids.js        # New game logic file
qwertzoids.html      # New HTML (or reuse with game selector)
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
    ship: {
        x, y,           // Position
        angle: 0,       // Rotation angle (radians)
        vx: 0,          // Velocity X
        vy: 0,          // Velocity Y
        rotationSpeed: 0.1,  // Radians per frame
        thrustPower: 0.1,    // Acceleration
        lives: 3
    },
    asteroids: [{
        x, y,
        vx, vy,
        size: 'large' | 'medium' | 'small',
        angle: 0,
        rotationSpeed: 0.02
    }],
    bullets: [{
        x, y,
        vx, vy,
        owner: 'player' | 'ufo',
        lifetime: 0
    }],
    ufos: [{
        x, y,
        vx, vy,
        size: 'large' | 'small',
        shootTimer: 0
    }],
    score: 0,
    level: 1,
    gameOver: false
};
```

#### Physics Constants
```javascript
const PHYSICS = {
    friction: 0.98,           // Velocity decay
    rotationSpeed: 0.1,       // Radians per frame
    thrustPower: 0.1,         // Acceleration
    bulletSpeed: 8,           // Pixels per frame
    bulletLifetime: 60,        // Frames
    maxBullets: 4,            // Max bullets on screen
    wrapMargin: 20            // Pixels for wrap-around
};
```

#### Control Keys
```javascript
let controlKeys = {
    rotateLeft: 'a',   // Initial random assignment
    rotateRight: 'd',  // Initial random assignment
    thrust: 'w',       // Initial random assignment
    shoot: 's'         // Initial random assignment
};
```

#### Key Press Counters
```javascript
let keyPressCounters = {
    rotateLeft: 0,
    rotateRight: 0,
    thrust: 0,
    shoot: 0
};
```

### Game Loop
- Update ship rotation (if rotating)
- Update ship velocity (if thrusting)
- Update ship position (apply velocity, wrap around)
- Update asteroid positions (move, rotate, wrap around)
- Update bullet positions (move, check lifetime)
- Update UFO positions and AI
- Check collisions (ship vs asteroids, bullets vs asteroids)
- Spawn new asteroids if all destroyed
- Render everything

### Collision Detection
- Ship vs Asteroids (circular collision)
- Bullets vs Asteroids (circular collision)
- Bullets vs UFOs (circular collision)
- UFO Bullets vs Ship (circular collision)
- Wrap-around for all objects

### Physics Simulation
- **Rotation**: Ship rotates smoothly based on input
- **Thrust**: Adds velocity in ship direction
- **Inertia**: Ship continues moving after thrust
- **Friction**: Velocity decreases over time
- **Wrap-around**: Objects wrap screen edges

### Asteroid Splitting
- Large asteroid → 2 medium asteroids
- Medium asteroid → 2 small asteroids
- Small asteroid → destroyed
- New asteroids get random velocities
- Maintain momentum (optional)

### UFO AI
- **Large UFO**: Moves slowly, shoots at player
- **Small UFO**: Moves erratically, faster
- Appears periodically (every N seconds)
- Shoots bullets toward player
- Disappears after time limit or when destroyed

## Level System

### Asteroid Spawning
- Level 1: 4 large asteroids
- Level 2+: More asteroids, faster movement
- Asteroids spawn at screen edges
- Random positions and velocities

### Level Progression
- Complete level by destroying all asteroids
- New level loads automatically
- More asteroids per level (4 + level number)
- Faster asteroid movement
- More frequent UFO appearances

### Difficulty Scaling
- Asteroid speed increases
- More asteroids per level
- UFOs appear more often
- UFOs shoot more frequently

## Special Features

### Particle Effects
- Explosion particles when asteroid destroyed
- Ship explosion when destroyed
- UFO explosion
- Thruster particles (optional)

### Screen Wrap-Around
- Ship wraps around edges
- Asteroids wrap around edges
- Bullets wrap around edges
- Smooth transition

### Hyperspace (Optional)
- Teleport ship to random location
- Risk: Could teleport into asteroid
- Emergency escape mechanism
- Requires additional key

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached
- Finger usage
- Duration
- Asteroids destroyed
- UFOs destroyed
- Lives remaining

### Leaderboard
- Same statistics system
- Separate leaderboard for qwertzoids
- Track highest level reached
- Track highest score

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (qwertzoids instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation
- Add: qwertzoids-specific controls explanation
- Add: Rotation and thrust mechanics
- Add: Inertia and physics tips
- Add: Asteroid destruction strategies

## Implementation Phases

### Phase 1: Core Game
1. Create `qwertzoids.js` with basic game loop
2. Implement ship rendering (triangle, rotates)
3. Implement ship rotation (left/right)
4. Implement ship thrust (forward acceleration)
5. Implement ship movement (velocity, inertia, friction)
6. Implement wrap-around physics

### Phase 2: Asteroids and Collisions
1. Add asteroids (large, medium, small)
2. Implement asteroid movement and rotation
3. Implement asteroid splitting (when shot)
4. Add collision detection (ship vs asteroids)
5. Add bullet system
6. Add bullet vs asteroid collision

### Phase 3: UFOs and Polish
1. Add UFOs (large and small)
2. Implement UFO AI (movement, shooting)
3. Add UFO bullet collision
4. Add particle effects
5. Add level progression

### Phase 4: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for all 4 actions
3. Add key change modal
4. Update keyboard visualization

### Phase 5: UI Integration
1. Adapt HTML to show 4 actions
2. Update header title
3. Integrate statistics system
4. Add game over overlay
5. Add level complete overlay

### Phase 6: Final Polish
1. Add tutorial
2. Add sound effects (optional)
3. Add visual effects (particles, explosions)
4. Balance difficulty
5. Add hyperspace (optional)

## Key Differences from Snake

| Aspect | Snake | qwertzoids |
|--------|-------|------------|
| Directions | 4 (up, down, left, right) | 4 (rotate left, rotate right, thrust, shoot) |
| Game object | Snake (grows) | Ship (rotates, moves) |
| Goal | Eat food, avoid walls | Destroy asteroids, avoid collisions |
| Movement | Discrete grid | Continuous physics (inertia) |
| Collision | Self-collision, walls | Asteroids, UFOs, bullets |
| Progression | Food → grow → levels | Asteroids → levels → more asteroids |

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
- Physics engine (rotation, inertia, friction)
- Wrap-around system
- Asteroid splitting logic
- UFO AI
- Collision detection (circular)
- Particle effects

## Questions to Decide

1. **Ship rotation speed?**
   - Recommendation: Moderate, feels responsive

2. **Thrust power?**
   - Recommendation: Moderate acceleration

3. **Friction amount?**
   - Recommendation: Slow decay (0.98 per frame)

4. **Number of lives?**
   - Recommendation: 3 lives (classic)

5. **Max bullets?**
   - Recommendation: 4 bullets (classic)

6. **Asteroid count?**
   - Recommendation: 4 + level number

7. **UFO frequency?**
   - Recommendation: Every 10-15 seconds

8. **Hyperspace?**
   - Recommendation: Optional, adds risk/reward

## File Naming Convention

- `qwertzoids.js` - Main game logic
- `qwertzoids.html` - qwertzoids game page
- Or: `index.html` with game selector

## Special Considerations

### Physics Accuracy
- Smooth rotation (not discrete)
- Realistic inertia
- Proper friction
- Accurate collision detection

### Performance
- Many objects (asteroids, bullets)
- Collision checks per frame
- Particle effects
- Smooth 60 FPS required

### Control Responsiveness
- Rotation must feel immediate
- Thrust must be responsive
- Shooting must be instant
- Key change doesn't interrupt gameplay

### Visual Design
- Classic Asteroids aesthetic
- Clear ship shape (triangle)
- Distinct asteroid sizes
- Smooth rotation animations
- Particle explosion effects

### Difficulty Balance
- Start easy (slow asteroids)
- Increase speed gradually
- More asteroids per level
- UFOs add challenge

## Advanced Features (Future)

### Power-ups (Optional)
- Rapid fire
- Shield
- Multi-shot
- Slower asteroids

### Different Ship Types
- Different speeds
- Different rotation rates
- Different bullet types

### Multiplayer (Optional)
- Two ships
- Competitive scoring
- Shared asteroid field

## Next Steps

1. Review and approve this plan
2. Research physics libraries (optional)
3. Create basic qwertzoids game structure
4. Implement physics engine
5. Implement ship controls
6. Integrate key-changing system
7. Add asteroids and collisions
8. Polish and test

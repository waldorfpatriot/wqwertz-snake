# qwertz Mario - Game Plan

## Overview
A classic Super Mario Bros. style platformer game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of movement/action keys, they change to new keys
- **Classic Super Mario**: Side-scrolling platformer, jumping, enemies, power-ups, coins, levels

## Game Mechanics

### Controls
- **Move Left**: One key (changes after 10 presses)
- **Move Right**: One key (changes after 10 presses)
- **Jump**: One key (changes after 10 presses)
- **Run/Shoot** (optional): One key (changes after 10 presses) - For running faster or shooting fireballs

**Recommended**: Start with 3 keys (left, right, jump), add run/shoot later

### Key Changing System
- Same mechanism as Snake:
  - Each action has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Super Mario Mechanics
1. **Player Character (Mario)**:
   - Moves left/right on ground
   - Can jump (with gravity)
   - Can run (faster movement, optional)
   - Can shoot fireballs (if power-up, optional)
   - Has lives (typically 3)
   - Can be small or big (power-up)

2. **Platforms**:
   - Static platforms to jump on
   - Moving platforms (optional)
   - Breakable blocks (optional)
   - Question blocks (contain power-ups/coins)
   - Brick blocks (can be broken if big Mario)

3. **Enemies**:
   - Goombas: Walk left/right, die when jumped on
   - Koopas: Walk left/right, can be kicked as shell
   - Piranha Plants: Pop out of pipes (optional)
   - Different point values per enemy

4. **Power-ups**:
   - Mushroom: Makes Mario big (can break bricks)
   - Fire Flower: Allows shooting fireballs (optional)
   - Star: Temporary invincibility (optional)
   - 1-Up Mushroom: Extra life

5. **Collectibles**:
   - Coins: 100 coins = extra life
   - Power-ups: Various abilities
   - Score items: Hidden blocks, enemies

6. **Level Design**:
   - Side-scrolling (camera follows player)
   - Multiple platforms at different heights
   - Pipes (can enter, optional)
   - Flag pole at end (optional)
   - Goal: Reach end of level

7. **Scoring**:
   - Points for enemies defeated
   - Points for coins collected
   - Points for time bonus
   - Points for power-ups collected
   - Display in header (same as Snake)

8. **Lives System**:
   - Start with 3 lives
   - Lose life when hit by enemy (small Mario) or fall in pit
   - Game over when all lives lost
   - Extra lives from 1-Up mushrooms or 100 coins

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertzMario"
- Add: Lives display (Lives: X), Coins counter (Coins: X), Level number

### Direction Info Section
- Change from 4 directions to 3-4 actions:
  - **Left** (←) with counter (0/10)
  - **Right** (→) with counter (0/10)
  - **Jump** (↑) with counter (0/10)
  - **Run/Shoot** (⚡) with counter (0/10) - Optional

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys with icons
- Same finger color coding
- Show movement keys prominently

### Game Canvas
- Same size (400x400) or wider for side-scrolling
- Render:
  - Side-scrolling level (camera follows player)
  - Mario character
  - Platforms
  - Enemies
  - Coins and power-ups
  - Background (optional parallax)
  - UI overlay (score, lives, coins)

### Key Change Modal
- Reuse existing modal
- Show which action changed (LEFT, RIGHT, JUMP, RUN)
- Show old key → new key
- Same finger indicator

## Technical Implementation

### File Structure
```
mario.js              # New game logic file
mario.html            # New HTML (or reuse with game selector)
```

### Shared Components
- Reuse from Snake:
  - Keyboard rendering (`renderKeyboard()`)
  - Key change modal (`showKeyChangeModal()`)
  - Key changing logic (`changeSingleKey()`)
  - Statistics system
  - Level system (for different level layouts)

### New Components Needed

#### Game State
```javascript
let gameState = {
    mario: {
        x, y, vx, vy,
        width, height,
        state: 'small' | 'big' | 'fire',
        onGround: boolean,
        facing: 'left' | 'right',
        lives: 3,
        invincible: boolean,
        invincibleTimer: 0
    },
    camera: { x, y }, // Camera position for side-scrolling
    platforms: [{ x, y, width, height, type }],
    enemies: [{ x, y, vx, type, alive }],
    coins: [{ x, y, collected }],
    powerUps: [{ x, y, type, collected }],
    score: 0,
    coins: 0,
    level: 1,
    gameOver: false
};
```

#### Physics Constants
```javascript
const PHYSICS = {
    gravity: 0.8,
    jumpStrength: -12,
    walkSpeed: 2,
    runSpeed: 4,
    maxFallSpeed: 12,
    marioWidth: 16,
    marioHeight: 16, // Small: 16, Big: 32
    enemySpeed: 1
};
```

#### Control Keys
```javascript
let controlKeys = {
    left: 'a',    // Initial random assignment
    right: 'd',   // Initial random assignment
    jump: 'w',    // Initial random assignment
    run: 's'      // Optional
};
```

#### Key Press Counters
```javascript
let keyPressCounters = {
    left: 0,
    right: 0,
    jump: 0,
    run: 0        // Optional
};
```

### Game Loop
- Update Mario physics (gravity, velocity, position)
- Update camera (follow Mario)
- Update enemies (movement, AI)
- Check collisions (Mario vs platforms, enemies, coins, power-ups)
- Check for level completion
- Render everything

### Collision Detection
- Mario vs Platforms (landing, side collisions)
- Mario vs Enemies (damage or defeat)
- Mario vs Coins (collect)
- Mario vs Power-ups (collect)
- Mario vs Pits (lose life)
- Enemies vs Platforms (turn around)

### Side-Scrolling Camera
- Camera follows Mario horizontally
- Smooth scrolling
- Keep Mario centered or slightly ahead
- Don't scroll past level boundaries

## Level System

### Level Design
- Level 1: Simple platforms, few enemies
- Level 2+: More complex layouts
- Different themes:
  - Grassland (Level 1)
  - Underground (optional)
  - Sky/Clouds (optional)
  - Castle (optional)

### Level Progression
- Complete level by reaching end
- New level loads automatically
- Difficulty increases per level
- More enemies, longer levels, more complex layouts

### Level Elements
- Platforms at various heights
- Enemies (Goombas, Koopas)
- Coins (floating or in blocks)
- Question blocks (power-ups)
- Brick blocks (breakable if big Mario)
- Pipes (can enter, optional)
- Flag pole (level end, optional)

## Special Features

### Power-Up System
- **Mushroom**: Makes Mario big
  - Can break brick blocks
  - Can take one hit (becomes small)
- **Fire Flower**: Allows shooting fireballs
  - Fireballs destroy enemies
  - Optional feature
- **Star**: Temporary invincibility
  - Can defeat enemies by touching
  - Optional feature

### Enemy Types
- **Goomba**: Basic enemy, walks left/right
  - Defeated by jumping on
  - Points: 100
- **Koopa**: Shell enemy, can be kicked
  - Defeated by jumping on (becomes shell)
  - Shell can defeat other enemies
  - Points: 200
- **Piranha Plant**: Pops out of pipes
  - Optional, more advanced enemy
  - Points: 400

### Collectibles
- **Coins**: 100 coins = extra life
- **1-Up Mushroom**: Extra life immediately
- **Score items**: Hidden blocks, defeated enemies

## Statistics

### Track Same Metrics as Snake
- Score
- KPM (keys per minute)
- Level reached
- Finger usage
- Duration
- Coins collected
- Enemies defeated
- Lives remaining

### Leaderboard
- Same statistics system
- Separate leaderboard for Mario
- Track highest level reached
- Track highest score

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (Mario platformer instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation
- Add: Mario-specific controls explanation
- Add: Jumping and platforming tips
- Add: Enemy defeat strategies
- Add: Power-up collection tips

## Implementation Phases

### Phase 1: Core Game
1. Create `mario.js` with basic game loop
2. Implement Mario movement (left/right, jump)
3. Implement gravity and physics
4. Implement basic platforms
5. Implement camera scrolling
6. Basic collision detection

### Phase 2: Enemies and Gameplay
1. Add enemies (Goombas, Koopas)
2. Add enemy AI (walking, turning)
3. Add enemy collision (defeat or damage)
4. Add coins and power-ups
5. Add scoring system
6. Add lives system

### Phase 3: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for left/right/jump
3. Add key change modal
4. Update keyboard visualization

### Phase 4: UI Integration
1. Adapt HTML to show left/right/jump actions
2. Update header title and add lives/coins
3. Integrate statistics system
4. Add game over overlay
5. Add level complete overlay

### Phase 5: Polish
1. Add multiple levels
2. Add power-ups (mushroom, fire flower)
3. Add more enemy types
4. Add tutorial
5. Add sound effects (optional)
6. Add visual effects (particles, animations)
7. Balance difficulty
8. Add run/shoot mechanics (optional)

## Key Differences from Snake

| Aspect | Snake | Mario |
|--------|-------|-------|
| Directions | 4 (up, down, left, right) | 3-4 (left, right, jump, run) |
| Game object | Snake (grows) | Mario (moves, jumps) |
| Goal | Eat food, avoid walls | Reach end, defeat enemies |
| Movement | Discrete grid | Continuous physics |
| Collision | Self-collision, walls | Platforms, enemies, collectibles |
| Progression | Food → grow → levels | Level completion → new levels |

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
- Side-scrolling camera system
- Platform physics
- Jump mechanics
- Enemy AI
- Collision detection (platforms, enemies)
- Power-up system
- Level loading/rendering

## Questions to Decide

1. **Run/Shoot key?**
   - Recommendation: Add later, start with 3 keys

2. **Number of lives?**
   - Recommendation: 3 lives (classic)

3. **Level length?**
   - Recommendation: Moderate length, scrollable

4. **Power-ups?**
   - Recommendation: Start with mushroom, add fire flower later

5. **Enemy types?**
   - Recommendation: Start with Goombas, add Koopas, then others

6. **Pipes (enterable)?**
   - Recommendation: Optional, adds complexity

7. **Flag pole?**
   - Recommendation: Yes, clear level end indicator

8. **Coin system?**
   - Recommendation: Yes, 100 coins = extra life

## File Naming Convention

- `mario.js` - Main game logic
- `mario.html` - Mario game page
- Or: `index.html` with game selector

## Special Considerations

### Physics Engine
- Gravity: Constant downward acceleration
- Jump: Upward velocity impulse
- Friction: Stop when not pressing movement key
- Platform collision: Land on top, bounce off sides
- Enemy collision: Damage or defeat based on position

### Side-Scrolling
- Camera follows Mario horizontally
- Smooth scrolling (not instant)
- Keep Mario visible, slightly ahead
- Don't scroll past level start/end
- Render only visible portion of level

### Enemy AI
- Simple: Walk left/right
- Turn around at platform edges
- Turn around when hitting walls
- Can fall off platforms (optional)

### Level Design
- Platforms at various heights
- Enough space to jump between platforms
- Enemies placed strategically
- Coins guide player path
- Progressive difficulty

### Visual Design
- Classic Mario aesthetic
- Clear platform boundaries
- Distinct enemy sprites
- Power-up visual feedback
- Coin sparkle effects
- Background parallax (optional)

### Difficulty Balance
- Start easy (few enemies, simple platforms)
- Increase complexity gradually
- More enemies per level
- More complex platform layouts
- Faster enemies (optional)

## Advanced Features (Future)

### Level Editor
- Custom level creation
- Place platforms, enemies, coins
- Set level length
- Share levels

### Multiple Worlds
- World 1: Grassland
- World 2: Underground
- World 3: Sky
- World 4: Castle
- Each with unique theme and enemies

### Boss Battles
- Bowser at end of each world
- Unique mechanics
- High score rewards

### Sound Design
- Jump sound
- Coin collection sound
- Enemy defeat sound
- Power-up sound
- Background music
- Level complete fanfare

## Implementation Challenges

### Side-Scrolling Camera
- Smooth following
- Boundary handling
- Performance optimization
- Only render visible area

### Platform Physics
- Accurate collision detection
- Landing on platforms
- Sliding off edges
- Jumping through platforms from below (optional)

### Enemy AI
- Pathfinding around platforms
- Turning at edges
- Falling behavior
- Interaction with other enemies

### Performance
- Many collision checks per frame
- Multiple enemies
- Smooth 60 FPS scrolling
- Efficient rendering

### Control Responsiveness
- Jump must feel responsive
- No input lag
- Smooth key press handling
- Key change doesn't interrupt gameplay

## Sprite/Visual Considerations

### Mario States
- Small Mario: 16×16 pixels
- Big Mario: 16×32 pixels
- Fire Mario: 16×32 pixels (optional)
- Walking animation (optional)
- Jumping sprite

### Enemies
- Goomba: Simple walking sprite
- Koopa: Walking and shell sprites
- Piranha Plant: Up/down animation (optional)

### Platforms
- Ground blocks: Repeated tiles
- Brick blocks: Breakable
- Question blocks: Animated (optional)

## Next Steps

1. Review and approve this plan
2. Research platformer physics (optional)
3. Create basic Mario game structure
4. Implement core physics engine
5. Implement platforms and collision
6. Integrate key-changing system
7. Add enemies and gameplay elements
8. Polish and test

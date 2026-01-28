# qwertz Pong - Game Plan

## Overview
A classic Pong game that uses the same UI structure as qwertZnake, with the same key-changing mechanism to practice 10-finger typing.

## Core Concept
- **Same UI**: Reuse the existing UI structure (header, keyboard visualization, direction info, game canvas)
- **Key-changing mechanism**: After 10 presses of paddle movement keys, they change to new keys
- **Classic Pong**: Ball bouncing, two paddles, simple physics

## Game Mechanics

### Controls

#### Single Player Mode (vs AI)
- **Left Paddle Up**: One key (changes after 10 presses)
- **Left Paddle Down**: One key (changes after 10 presses)
- **Right Paddle**: Controlled by AI

#### Two Player Mode
- **Left Paddle Up**: One key (changes after 10 presses)
- **Left Paddle Down**: One key (changes after 10 presses)
- **Right Paddle Up**: One key (changes after 10 presses)
- **Right Paddle Down**: One key (changes after 10 presses)

**Recommended**: Start with single player (2 keys), add two-player later (4 keys)

### Key Changing System
- Same mechanism as Snake:
  - Each action has a counter (0/10)
  - After 10 presses, the key changes
  - Key change modal appears (same as Snake)
  - Keys selected from QWERTZ layout based on finger types
  - Progression through finger types (index → ring → middle → pinky)

### Pong Mechanics
1. **Ball**:
   - Starts moving at game start
   - Bounces off top and bottom walls
   - Bounces off paddles (angle depends on hit position)
   - Scores point when passing paddle
   - Speed increases slightly after each paddle hit

2. **Paddles**:
   - Left paddle: Player controlled (up/down)
   - Right paddle: AI controlled (single player) or Player 2 (two player)
   - Move vertically only
   - Collision detection with ball

3. **Scoring**:
   - Point when ball passes opponent's paddle
   - First to reach score limit wins (typically 11)
   - Display scores in header

4. **Game Modes**:
   - Single Player: vs AI
   - Two Player: Local multiplayer

## UI Adaptations

### Header
- Keep: Score display, KPM (keys per minute), stats button
- Change: Title to "qwertzPong"
- Add: Player scores (Left: X | Right: Y)

### Direction Info Section

#### Single Player Mode
- Show 2 actions:
  - **Up** (↑) with counter (0/10)
  - **Down** (↓) with counter (0/10)

#### Two Player Mode
- Show 4 actions:
  - **Left Up** (↑) with counter (0/10)
  - **Left Down** (↓) with counter (0/10)
  - **Right Up** (↑) with counter (0/10)
  - **Right Down** (↓) with counter (0/10)

### Keyboard Visualization
- Same virtual keyboard display
- Highlight active control keys with arrows
- Same finger color coding
- In two-player mode, show which keys belong to which player

### Game Canvas
- Same size (400x400)
- Render:
  - Center line (dashed)
  - Left paddle
  - Right paddle
  - Ball
  - Scores

### Key Change Modal
- Reuse existing modal
- Show which action changed (UP, DOWN, LEFT UP, etc.)
- Show old key → new key
- Same finger indicator
- In two-player mode, indicate which player's key changed

## Technical Implementation

### File Structure
```
pong.js              # New game logic file
pong.html            # New HTML (or reuse with game selector)
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
    ball: { x, y, vx, vy, radius, speed },
    leftPaddle: { x, y, width, height },
    rightPaddle: { x, y, width, height },
    leftScore: 0,
    rightScore: 0,
    gameMode: 'single', // 'single' or 'twoPlayer'
    aiDifficulty: 'medium', // 'easy', 'medium', 'hard'
    gameOver: false,
    winner: null
};
```

#### Control Keys

##### Single Player Mode
```javascript
let controlKeys = {
    leftUp: 'w',     // Initial random assignment
    leftDown: 's'    // Initial random assignment
};
```

##### Two Player Mode
```javascript
let controlKeys = {
    leftUp: 'w',     // Player 1
    leftDown: 's',   // Player 1
    rightUp: 'o',    // Player 2
    rightDown: 'l'   // Player 2
};
```

#### Key Press Counters

##### Single Player Mode
```javascript
let keyPressCounters = {
    leftUp: 0,
    leftDown: 0
};
```

##### Two Player Mode
```javascript
let keyPressCounters = {
    leftUp: 0,
    leftDown: 0,
    rightUp: 0,
    rightDown: 0
};
```

### Game Loop
- Update ball position
- Update paddle positions (player + AI if single player)
- Check collisions (ball vs walls, ball vs paddles)
- Check scoring (ball passes paddle)
- Render everything

### Collision Detection
- Ball vs Top/Bottom walls (bounce)
- Ball vs Left paddle (bounce, angle calculation)
- Ball vs Right paddle (bounce, angle calculation)
- Ball passes paddle (score point)

### AI (Single Player Mode)
- Simple AI: Follow ball with slight delay
- Difficulty levels:
  - Easy: Slow reaction, imperfect tracking
  - Medium: Moderate reaction, good tracking
  - Hard: Fast reaction, near-perfect tracking

### Ball Physics
- Ball speed increases slightly after each paddle hit
- Angle depends on where ball hits paddle:
  - Center: Straight angle
  - Edges: Sharp angle
- Maximum speed cap

## Level System

### Score Limit
- Standard: First to 11 points wins
- Configurable: 5, 7, 11, 15, 21
- Match mode: Best of 3/5 games

### Difficulty Progression
- Not really levels, but:
  - AI difficulty increases with score difference
  - Ball speed increases over time
  - Paddle size decreases (optional)

## Special Features

### Power-ups (Optional)
- Larger paddle
- Slower ball
- Faster paddle
- Multi-ball
- Not classic Pong, but adds variety

### Visual Effects
- Ball trail
- Paddle glow on hit
- Score celebration
- Particle effects

## Statistics

### Track Same Metrics as Snake
- Score (final score)
- KPM (keys per minute)
- Finger usage
- Duration
- Paddle hits
- Points scored

### Leaderboard
- Same statistics system
- Separate leaderboard for Pong
- Track wins/losses (for single player)

## Tutorial

### Adapt Existing Tutorial
- Step 1: Why this game? (same concept)
- Step 2: Game principle (Pong instead of Snake)
- Step 3-6: Same finger placement, colors, UI explanation
- Add: Pong-specific controls explanation

## Implementation Phases

### Phase 1: Core Game
1. Create `pong.js` with basic game loop
2. Implement paddle movement (up/down keys)
3. Implement ball physics and collision
4. Implement scoring system
5. Basic AI for single player mode

### Phase 2: Key Changing Integration
1. Integrate key changing mechanism from Snake
2. Add key change counters for paddle movements
3. Add key change modal
4. Update keyboard visualization

### Phase 3: UI Integration
1. Adapt HTML to show up/down actions
2. Update header title and add scores
3. Integrate statistics system
4. Add game over overlay
5. Add mode selection (single/two player)

### Phase 4: Polish
1. Improve AI difficulty levels
2. Add two-player mode
3. Add tutorial
4. Add sound effects (optional)
5. Add visual effects
6. Balance difficulty

## Key Differences from Snake

| Aspect | Snake | Pong |
|--------|-------|------|
| Directions | 4 (up, down, left, right) | 2-4 (up, down per paddle) |
| Game object | Snake (grows) | Ball (bounces) |
| Goal | Eat food, avoid walls | Score points, prevent opponent scoring |
| Movement | Discrete grid | Continuous physics |
| Collision | Self-collision, walls | Ball vs paddles, ball vs walls |
| Progression | Food → grow → levels | Points → win game |

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
- Ball physics
- Paddle collision detection
- AI logic
- Scoring system
- Two-player input handling

## Questions to Decide

1. **Single player or two player first?**
   - Recommendation: Start with single player (simpler)

2. **AI difficulty?**
   - Recommendation: Multiple levels (easy, medium, hard)

3. **Score limit?**
   - Recommendation: Configurable, default 11

4. **Ball speed increase?**
   - Recommendation: Yes, gradually increases

5. **Paddle size?**
   - Recommendation: Fixed size (classic)

6. **Power-ups?**
   - Recommendation: No, keep classic Pong

7. **Match mode?**
   - Recommendation: Single game, optional best-of-3/5

## File Naming Convention

- `pong.js` - Main game logic
- `pong.html` - Pong game page
- Or: `index.html` with game selector

## Special Considerations

### Two-Player Mode
- Both players use same keyboard
- Need clear visual distinction of which keys belong to which player
- Consider using different sides of keyboard (left side = Player 1, right side = Player 2)

### AI Implementation
- Simple: Move paddle toward ball Y position
- Add delay/reaction time for difficulty
- Add slight randomness for imperfection
- Don't make it too perfect (boring) or too bad (too easy)

### Ball Physics
- Classic Pong: Ball bounces at angle based on paddle hit position
- Center hit: Straight angle
- Edge hit: Sharp angle
- Speed increases slightly each hit
- Maximum speed cap to keep playable

### Visual Design
- Classic: Black background, white paddles and ball
- Modern: Can add colors, gradients, effects
- Keep it readable and clear

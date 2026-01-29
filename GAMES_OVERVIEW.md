# qwertz Games Collection - Overview

This document provides an overview of all planned games in the qwertz typing practice collection.

## Games List

1. **qwertZnake** ✅ (Implemented)
2. **qwertz Breakout** 📋 (Planned)
3. **qwertz Invaders** 📋 (Planned)
4. **qwertzis (Tetris)** 📋 (Planned)
5. **qwertz Pong** 📋 (Planned)
6. **qwertz Pinball** 📋 (Planned)
7. **qwertz Mario** 📋 (Planned)
8. **qwertz-man** 📋 (Planned)
9. **qwertzoids** 📋 (Planned)
10. **frogqwertz** 📋 (Planned)

## Common Features

All games share:
- **Same UI structure**: Header, keyboard visualization, direction info, game canvas
- **Key-changing mechanism**: Keys change after 10 presses
- **Statistics system**: Score, KPM, level, finger usage tracking
- **Tutorial system**: Step-by-step typing instruction
- **Leaderboard**: Top scores and statistics
- **QWERTZ layout**: German keyboard layout support

## Game Comparison

| Game | Controls | Key Count | Main Goal | Complexity |
|------|----------|-----------|-----------|------------|
| **Snake** | Up, Down, Left, Right | 4 | Eat food, grow, avoid collisions | Medium |
| **Breakout** | Left, Right | 2 | Break bricks, keep ball in play | Medium |
| **Invaders** | Left, Right, Shoot | 3 | Destroy aliens, avoid bullets | Medium-High |
| **Tetris** | Left, Right, Rotate | 3-5 | Clear lines, prevent stack overflow | High |
| **Pong** | Up, Down (per paddle) | 2-4 | Score points, prevent opponent scoring | Low-Medium |
| **Pinball** | Left Flipper, Right Flipper, Launch | 2-3 | Score points, keep ball in play | Medium-High |
| **Mario** | Left, Right, Jump, Run | 3-4 | Reach end, defeat enemies, collect coins | Medium-High |
| **qwertz-man** | Left, Right, Up, Down | 4 | Eat dots, avoid ghosts, complete maze | Medium |
| **qwertzoids** | Rotate Left, Rotate Right, Thrust, Shoot | 4 | Destroy asteroids, avoid collisions | Medium-High |
| **frogqwertz** | Left, Right, Up, Down | 4 | Cross road and river, reach home | Medium |

## Implementation Priority

### Phase 1: Foundation ✅
- [x] qwertZnake (base game)
- [x] UI structure
- [x] Key-changing system
- [x] Statistics system
- [x] Tutorial system

### Phase 2: Classic Arcade Games
1. **qwertz Breakout** - Simple controls (2 keys), classic gameplay
2. **qwertz Pong** - Simple controls (2-4 keys), classic gameplay

### Phase 3: Action Games
3. **qwertz Invaders** - Medium complexity (3 keys), action-packed

### Phase 4: Puzzle Games
4. **qwertzis (Tetris)** - High complexity (3-5 keys), strategic gameplay

### Phase 5: Physics Games
5. **qwertz Pinball** - Medium-High complexity (2-3 keys), physics-based gameplay

### Phase 6: Platform Games
6. **qwertz Mario** - Medium-High complexity (3-4 keys), side-scrolling platformer

### Phase 7: Classic Arcade Games
7. **qwertz-man** - Medium complexity (4 keys), maze navigation
8. **qwertzoids** - Medium-High complexity (4 keys), physics-based space shooter
9. **frogqwertz** - Medium complexity (4 keys), road/river crossing

## Code Reuse Strategy

### Shared Components (90%+ reuse)
- Keyboard rendering (`renderKeyboard()`)
- Key change modal (`showKeyChangeModal()`)
- Key changing logic (`changeSingleKey()`)
- Statistics system (API calls, leaderboard)
- UI structure (header, overlays, modals)
- Tutorial structure
- Level system (where applicable)

### Game-Specific Code
Each game needs:
- Game loop
- Game state management
- Collision detection
- Rendering logic
- Game-specific mechanics

## File Structure

```
/
├── index.html              # Main page (game selector)
├── snake.html              # Snake game
├── breakout.html           # Breakout game
├── invaders.html           # Invaders game
├── tetris.html             # Tetris game
├── pong.html               # Pong game
├── pinball.html            # Pinball game
├── mario.html              # Mario game
├── qwertzman.html          # qwertz-man game
├── qwertzoids.html         # qwertzoids game
├── frogqwertz.html         # frogqwertz game
├── game.js                  # Snake game logic
├── breakout.js             # Breakout game logic
├── invaders.js             # Invaders game logic
├── tetris.js               # Tetris game logic
├── pong.js                 # Pong game logic
├── pinball.js              # Pinball game logic
├── mario.js                # Mario game logic
├── qwertzman.js            # qwertz-man game logic
├── qwertzoids.js           # qwertzoids game logic
├── frogqwertz.js           # frogqwertz game logic
├── shared.js                # Shared utilities (keyboard, key changing, etc.)
├── style.css               # Shared styles
├── server.js               # Backend (statistics, levels)
└── [game]_PLAN.md          # Detailed plans for each game
    - BREAKOUT_PLAN.md
    - INVADERS_PLAN.md
    - TETRIS_PLAN.md
    - PONG_PLAN.md
    - PINBALL_PLAN.md
    - MARIO_PLAN.md
    - QWERTZMAN_PLAN.md
    - QWERTZOIDS_PLAN.md
    - FROGQWERTZ_PLAN.md
```

## Game Selector

### Main Page (`index.html`)
- Grid of game cards
- Each card shows:
  - Game name
  - Icon/Preview
  - Description
  - Difficulty indicator
  - Key count
- Click to start game

### Navigation
- Back to game selector from any game
- Shared statistics view (all games)
- Per-game statistics

## Statistics System

### Per-Game Statistics
- Score
- KPM (keys per minute)
- Level reached
- Finger usage
- Duration
- Game-specific metrics

### Combined Statistics
- Total games played
- Total KPM across all games
- Favorite game
- Overall finger usage
- Achievement system (optional)

## Tutorial System

### Shared Tutorial Steps
1. Why this game? (typing practice concept)
2. Game principle (game-specific)
3. Finger placement and home row
4. Finger assignment
5. Color coding
6. UI explanation

### Game-Specific Tutorial
- Controls explanation
- Game mechanics
- Tips and strategies

## Key-Changing System

### Common Mechanism
- Each control action has a counter (0/10)
- After 10 presses, key changes
- Key change modal appears
- New key selected from QWERTZ layout
- Finger type progression (index → ring → middle → pinky)

### Per-Game Variations
- **Snake**: 4 directions (up, down, left, right)
- **Breakout**: 2 directions (left, right)
- **Invaders**: 3 actions (left, right, shoot)
- **Tetris**: 3-5 actions (left, right, rotate, drop)
- **Pong**: 2-4 actions (up, down per paddle)
- **Pinball**: 2-3 actions (left flipper, right flipper, launch)
- **Mario**: 3-4 actions (left, right, jump, run)
- **qwertz-man**: 4 actions (left, right, up, down)
- **qwertzoids**: 4 actions (rotate left, rotate right, thrust, shoot)
- **frogqwertz**: 4 actions (left, right, up, down)

## Development Roadmap

### Milestone 1: Breakout ✅
- [ ] Implement core Breakout game
- [ ] Integrate key-changing system
- [ ] Add statistics
- [ ] Add tutorial

### Milestone 2: Pong
- [ ] Implement core Pong game
- [ ] Integrate key-changing system
- [ ] Add single-player AI
- [ ] Add two-player mode
- [ ] Add statistics
- [ ] Add tutorial

### Milestone 3: Invaders
- [ ] Implement core Invaders game
- [ ] Integrate key-changing system
- [ ] Add levels and alien formations
- [ ] Add statistics
- [ ] Add tutorial

### Milestone 4: Tetris
- [ ] Implement core Tetris game
- [ ] Integrate key-changing system
- [ ] Add rotation system
- [ ] Add line clearing
- [ ] Add statistics
- [ ] Add tutorial

### Milestone 5: Pinball
- [ ] Implement core Pinball game
- [ ] Integrate key-changing system
- [ ] Add physics engine
- [ ] Add flippers, bumpers, targets
- [ ] Add multi-ball mode
- [ ] Add statistics
- [ ] Add tutorial

### Milestone 6: Mario
- [ ] Implement core Mario game
- [ ] Integrate key-changing system
- [ ] Add side-scrolling camera
- [ ] Add platform physics
- [ ] Add enemies and power-ups
- [ ] Add multiple levels
- [ ] Add statistics
- [ ] Add tutorial

### Milestone 7: Polish
- [ ] Game selector UI
- [ ] Combined statistics
- [ ] Achievement system (optional)
- [ ] Sound effects (optional)
- [ ] Performance optimization
- [ ] Mobile responsiveness

## Design Principles

1. **Consistency**: Same UI/UX across all games
2. **Simplicity**: Start simple, add complexity gradually
3. **Typing Focus**: Games are tools for typing practice
4. **Progression**: Difficulty increases naturally
5. **Feedback**: Clear visual feedback for all actions
6. **Accessibility**: Keyboard-only controls, clear visuals

## Technical Considerations

### Performance
- Efficient game loops
- Canvas optimization
- Minimal DOM manipulation
- RequestAnimationFrame for smooth animation

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Canvas API support
- ES6+ JavaScript features

### Mobile Support
- Touch controls (optional)
- Responsive design
- Virtual keyboard integration

## Future Enhancements

### Potential Features
- Sound effects and music
- Particle effects
- Animations
- Themes (dark mode, color schemes)
- Customizable key change frequency
- Practice mode (no key changes)
- Multiplayer (online)
- Replays/Recordings

### Additional Games (Future)
- qwertz Pac-Man
- qwertz Asteroids
- qwertz Frogger
- qwertz Centipede
- qwertz Pinball ✅ (Planned)
- qwertz Mario ✅ (Planned)
- qwertz-man ✅ (Planned)
- qwertzoids ✅ (Planned)
- frogqwertz ✅ (Planned)

## Documentation

Each game has a detailed plan document:
- `BREAKOUT_PLAN.md` - Breakout game plan
- `INVADERS_PLAN.md` - Invaders game plan
- `TETRIS_PLAN.md` - Tetris game plan
- `PONG_PLAN.md` - Pong game plan
- `PINBALL_PLAN.md` - Pinball game plan
- `MARIO_PLAN.md` - Mario game plan
- `QWERTZMAN_PLAN.md` - qwertz-man game plan
- `QWERTZOIDS_PLAN.md` - qwertzoids game plan
- `FROGQWERTZ_PLAN.md` - frogqwertz game plan

## Questions & Decisions

### Shared Statistics?
- **Decision**: Separate per-game statistics + combined overview
- **Reason**: Each game has different metrics, but users want overall progress

### Game Selector Location?
- **Decision**: Main page (`index.html`) with game cards
- **Reason**: Easy navigation, clear game selection

### Shared Code Location?
- **Decision**: `shared.js` for common utilities
- **Reason**: DRY principle, easier maintenance

### Tutorial Per Game?
- **Decision**: Shared tutorial structure, game-specific content
- **Reason**: Consistency, but each game needs unique explanation

## Next Steps

1. Review all game plans
2. Prioritize implementation order
3. Create shared utilities module
4. Implement first new game (Breakout recommended)
5. Iterate based on feedback

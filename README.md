# Crypto Tower Defense

A polished tower defense game built with React and TypeScript. Defend against waves of cryptocurrency-themed enemies by strategically placing towers.

## Features

- **Strategic Tower Placement**: 10 unique tower types with different abilities
- **Procedurally Generated Paths**: Unique multi-spawn paths for each stage
- **Dynamic Difficulty**: 10 stages with increasing complexity and boss enemies
- **Polished Effects**: 
  - Wave announcements with scaling animations
  - Lightning attack effects for boss tower destruction
  - Particle systems for impact, explosions, and particle effects
  - Smooth health bar tweening
  - Screen flashes and visual feedback
  - Victory and stage transition effects
  - Coin flow animations
- **Endless Mode**: Available from the title screen as a separate mode
- **Endless Heavy Bosses**: Heavy tower-destroying bosses return every 5 endless stages
- **Commander Abilities**: Ion Storm, Orbital Freeze, and Emergency Repair cooldown powers
- **Elite Enemy Traits**: Shielded, armored, phase, splitter, and blink enemies appear in later waves
- **HQ Upgrades**: Spend CR to reinforce Earth HQ and increase repair capacity
- **Ship Synergies**: Nearby specialist ships unlock rate, damage, range, and barrage bonuses
- **Sound Design**: Procedurally generated audio feedback (toggle with button)
- **High Score Tracking**: Local storage for persistent high scores

## Tower Types

- **Fast**: High fire rate, low range (60 cost)
- **Sniper**: Long range, heavy damage (120 cost)
- **AoE**: Splash damage nearby enemies (100 cost)
- **Slow**: Slows enemies by 50% (80 cost)
- **Burst**: High burst damage, slow reload (200 cost)
- **Gatling**: Extremely fast fire rate (400 cost)
- **Rocket**: Huge AOE blast (600 cost)
- **Laser**: Beam tower with 10s fire + 5s exhaust (2000 cost)
- **Artillery**: Global range with 3-rocket barrage (3500 cost)
- **Dreadnought**: 2x2 capital ship with global range, AOE lance barrage, 3s attack interval, and scaling returning Gatling drones every 10s (5000 cost)

## Getting Started

### Prerequisites
- Node.js 16+ with npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Opens the game at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

Output goes to the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Game Mechanics

### Wave Progression
- 5 waves per stage
- 10 stages total
- Wave 5 of each stage has a boss enemy
- Stage 10 final boss destroys towers and requires more strategy

### Enemy Types
- **Normal Enemies**: Standard enemies with varying stats
- **Boss Enemies**: High HP, reduced speed, tower destruction ability (stage 10)

### Towers
- Click a tower button and place on the grid
- Click existing tower to select and see upgrade/sell options
- Upgrade increases damage and fire rate
- Sell returns 70% of tower cost

### Resources
- **Gold**: Earned from defeating enemies, spent on towers and upgrades
- **Lives**: Start with 20, lose lives when enemies reach the end
- **Score**: Accumulated from enemy rewards

## Architecture

Built with:
- **React 19**: UI framework with hooks
- **TypeScript**: Type-safe game logic
- **Vite 7**: Build tool and dev server
- **Web Audio API**: Procedural sound generation

### Key Components
- `SpaceImpactDefense.tsx`: Main game orchestration component
- `sound.ts`: Audio engine with 13+ sound effects
- `types.ts`: Shared TypeScript types

## Performance

- 60 FPS game loop using requestAnimationFrame
- Frame time capped at 100ms to prevent simulation jumps
- Efficient ref-based state management for game data
- ~187KB gzipped bundle size

## Controls

- **Mouse**: Click to place towers and interact with UI
- **Settings Modal**: Configure audio mix (master/BGM/explosions/beams/UI), SFX toggle, and mobile layout mode
- **Auto-Play**: Automatically start next wave (optional)

## License

MIT

## Author

nbernardo1411

---

**Deploy to Netlify**: Add `_redirects` file or configure `netlify.toml` for SPA routing.

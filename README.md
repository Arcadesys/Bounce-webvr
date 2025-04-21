# Bounce WebVR 🎮

A playful WebVR music maker where you create bouncing balls that trigger musical notes. Think Super Hexagon meets Beat Saber, but with your own musical touch!

## 🎯 Current State

### ✅ Already Working
- Basic 3D scene with Three.js
- Physics world with Cannon.js
- Ball creation and basic physics
- Wall creation system
- Basic audio system structure
- Touch/pointer input handling

## 🎮 MVP Features (Next 2-3 Days)

### Day 1: Core Gameplay
- [ ] **Ball System** (2 hours)
  - Space key to spawn balls
  - Simple neon glow effect
  - Basic collision sounds

- [ ] **Wall System** (2 hours)
  - Click and drag to create walls
  - Basic neon effect
  - Delete walls with right-click

### Day 2: Sound & Accessibility
- [ ] **Sound System** (2 hours)
  - Four-note scale (C, E, G, A)
  - Collision sounds
  - UI feedback sounds

- [ ] **Accessibility** (2 hours)
  - ARIA labels
  - Keyboard navigation
  - Sound cues for interactions

### Day 3: Polish & Ship
- [ ] **Visual Polish** (2 hours)
  - Basic neon shader
  - High contrast mode
  - UI polish

- [ ] **Testing & Deploy** (2 hours)
  - Basic unit tests
  - Mobile testing
  - Deploy to Vercel

## 🎮 Controls

- **Space**: Spawn a ball
- **Click + Drag**: Create a wall
- **Right Click**: Delete wall
- **R**: Reset scene
- **M**: Toggle menu
- **Tab**: Focus trap for accessibility

## 🎨 Visual Style

- Simple neon aesthetic
- High contrast for accessibility
- Clear visual feedback

## 🎵 Sound Design

- Four-note scale (C major)
- Simple collision sounds
- UI feedback sounds

## 🛠 Tech Stack

- Vite + React
- Three.js for 3D
- Cannon.js for physics
- Tone.js for audio
- Vitest for testing

## 📝 Future Features (v0.2)

- Pattern recorder
- MIDI export
- Complex sound mapping
- Advanced physics settings
- Sequencer
- "Trash" hole for unwanted balls
- ASDR controls per beam
- Beam-specific sounds (e.g., drums)

## 🚀 Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

*Note: This is a one-week prototype focused on core gameplay. We're keeping it simple and fun! 🎮* 
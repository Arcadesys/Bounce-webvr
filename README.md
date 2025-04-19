# Bounce WebVR

A musical physics playground built with Three.js and Web Audio API. Create musical walls, drop bouncing balls, and make music through physics!

## Overview

Bounce WebVR is a pure Three.js application that combines 3D physics with musical synthesis. Each wall you create has a musical note associated with its length, and balls create music as they bounce off these walls.

## Features

- Real-time 3D physics using Cannon.js
- Musical synthesis using Tone.js
- Cyberpunk-inspired neon visuals
- Accessible design with audio feedback

## Controls

- **Left Click**: Drop a ball
- **Shift + Drag**: Draw a musical wall (length determines pitch)
- **Right Click** or **Cmd/Ctrl + Click**: Create a ball dispenser (coming soon)

## Technical Stack

- Three.js for 3D graphics
- Cannon.js for physics
- Tone.js for audio synthesis
- Vanilla JavaScript (no framework dependencies)

## Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/Bounce-webvr.git
cd Bounce-webvr
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Testing

Run the test suite:
```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT License](LICENSE)

## Acknowledgments

- Three.js for 3D graphics
- Cannon.js for physics simulation
- Tone.js for audio synthesis 
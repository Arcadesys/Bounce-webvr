import { vi } from 'vitest';

// Add any global setup for tests here

// Set up globals for THREE.js and window mocks
global.AudioContext = class AudioContext {
  createOscillator() {
    return {
      type: '',
      frequency: { 
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    };
  }
  
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    };
  }
};

global.webkitAudioContext = global.AudioContext;

// Setup window events
global.requestAnimationFrame = vi.fn(); 
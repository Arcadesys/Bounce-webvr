import { vi } from 'vitest';
import { Window } from 'happy-dom';

// Create a mock window object
const window = new Window();
global.window = window;
global.document = window.document;

// Mock AudioContext and related APIs
class MockAudioContext {
  constructor() {
    this.state = 'suspended';
  }
  
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(callback => setTimeout(callback, 0));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id)); 
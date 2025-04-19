import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BounceScene from '../../components/BounceScene';
import * as physics from '../../physics';

// Mock Tone.js
vi.mock('tone', () => ({
  default: {
    start: vi.fn(),
    context: {
      state: 'suspended',
      resume: vi.fn(),
    },
    Transport: {
      bpm: { value: 120 }
    }
  }
}));

// Mock physics
vi.mock('../../physics', () => ({
  createPhysicsWorld: vi.fn(() => ({
    addBody: vi.fn(),
    step: vi.fn(),
    gravity: { set: vi.fn() }
  })),
  createBallBody: vi.fn(() => ({
    position: { set: vi.fn() },
    velocity: { set: vi.fn() },
    addEventListener: vi.fn()
  })),
  createWallBody: vi.fn(() => ({
    body: {
      position: { set: vi.fn() },
      quaternion: { setFromAxisAngle: vi.fn() }
    },
    contactMaterial: {}
  }))
}));

describe('BounceScene', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<BounceScene />);
    expect(screen.getByRole('button', { name: /start experience/i })).toBeInTheDocument();
  });

  it('shows audio permission modal when start button is clicked', () => {
    render(<BounceScene />);
    const startButton = screen.getByRole('button', { name: /start experience/i });
    fireEvent.click(startButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/audio permissions/i)).toBeInTheDocument();
  });

  it('initializes audio when permission is granted', async () => {
    render(<BounceScene />);
    const startButton = screen.getByRole('button', { name: /start experience/i });
    fireEvent.click(startButton);
    
    const allowButton = screen.getByRole('button', { name: /allow/i });
    fireEvent.click(allowButton);
    
    // Check if Tone.js start was called
    expect(require('tone').default.start).toHaveBeenCalled();
    
    // Check if physics world was created
    expect(physics.createPhysicsWorld).toHaveBeenCalled();
  });
}); 
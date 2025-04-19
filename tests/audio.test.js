import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Tone from 'tone';
import { initAudio } from '../src/main.js';

// Mock Tone.js
vi.mock('tone', () => ({
  start: vi.fn().mockResolvedValue(undefined),
  context: {
    state: 'suspended',
  }
}));

describe('Audio Context Initialization', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset our audio initialization state
    window.audioInitialized = false;
  });

  afterEach(() => {
    // Clean up any listeners we might have added
    vi.restoreAllMocks();
  });

  it('should not start audio context automatically on page load', () => {
    expect(Tone.context.state).toBe('suspended');
    expect(Tone.start).not.toHaveBeenCalled();
  });

  it('should initialize audio context after user click', async () => {
    // Simulate user click
    const clickEvent = new MouseEvent('click');
    window.dispatchEvent(clickEvent);
    
    // Wait for any promises to resolve
    await vi.runAllTimersAsync();
    
    expect(Tone.start).toHaveBeenCalled();
  });

  it('should initialize audio context after user touch', async () => {
    // Simulate touch event
    const touchEvent = new TouchEvent('touchstart');
    window.dispatchEvent(touchEvent);
    
    // Wait for any promises to resolve
    await vi.runAllTimersAsync();
    
    expect(Tone.start).toHaveBeenCalled();
  });

  it('should only initialize audio context once', async () => {
    // Simulate multiple user interactions
    const clickEvent = new MouseEvent('click');
    window.dispatchEvent(clickEvent);
    window.dispatchEvent(clickEvent);
    
    await vi.runAllTimersAsync();
    
    // Should only call start once
    expect(Tone.start).toHaveBeenCalledTimes(1);
  });

  it('should handle audio context initialization failure', async () => {
    // Mock Tone.start to reject
    vi.mocked(Tone.start).mockRejectedValueOnce(new Error('Audio context failed'));
    
    const consoleSpy = vi.spyOn(console, 'error');
    
    // Simulate user interaction
    const clickEvent = new MouseEvent('click');
    window.dispatchEvent(clickEvent);
    
    await vi.runAllTimersAsync();
    
    // Should log error
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to start audio context:',
      expect.any(Error)
    );
  });

  it('should initialize before wall creation', async () => {
    const mockCreateWall = vi.fn();
    
    // Simulate creating a wall without user interaction
    try {
      await mockCreateWall();
    } catch (e) {
      expect(e.message).toContain('Audio context not initialized');
    }
    
    // Now simulate user interaction and try again
    const clickEvent = new MouseEvent('click');
    window.dispatchEvent(clickEvent);
    
    await vi.runAllTimersAsync();
    
    // Should succeed now
    await mockCreateWall();
    expect(mockCreateWall).toHaveBeenCalled();
  });
}); 
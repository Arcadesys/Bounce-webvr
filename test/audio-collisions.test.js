import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { createPhysicsWorld, createBallBody, createWallBody } from '../src/physics';
import { playBounceSound } from '../utils/synthManager';

describe('Audio Collision Feedback', () => {
  let world;
  let ball;
  let wall;
  let collisionCount;
  let lastCollisionTime;
  
  beforeEach(() => {
    // Create a fresh physics world for each test
    world = createPhysicsWorld();
    
    // Create a ball
    ball = createBallBody({ x: 0, y: 2, z: 0 }, 0.2, world);
    
    // Create a wall
    const wallResult = createWallBody(
      { x: -2, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 }
    );
    wall = wallResult.body;
    world.addBody(wall);
    world.addContactMaterial(wallResult.contactMaterial);
    
    // Reset collision tracking
    collisionCount = 0;
    lastCollisionTime = 0;
    
    // Mock the bounce sound function
    vi.spyOn(global, 'playBounceSound');
  });
  
  it('should handle rapid collisions without audio overload', () => {
    // Position ball above wall
    ball.position.set(0, 1, 0);
    
    // Set high velocity for rapid bouncing
    ball.velocity.set(0, -5, 0);
    
    // Track collisions and their timing
    const collisionTimes = [];
    ball.addEventListener('collide', (event) => {
      const now = Tone.now();
      collisionTimes.push(now);
      collisionCount++;
    });
    
    // Step world forward rapidly to simulate many collisions
    for (let i = 0; i < 100; i++) {
      world.step(1/60);
    }
    
    // Should have detected multiple collisions
    expect(collisionCount).toBeGreaterThan(1);
    
    // Calculate time between collisions
    const timeBetweenCollisions = [];
    for (let i = 1; i < collisionTimes.length; i++) {
      timeBetweenCollisions.push(collisionTimes[i] - collisionTimes[i-1]);
    }
    
    // Convert 32nd note duration to seconds at 120 BPM
    const minTimeBetweenCollisions = Tone.Time('32n').toSeconds();
    
    // Verify that collisions are properly spaced
    // This ensures we're not getting audio overload
    const collisionsTooClose = timeBetweenCollisions.some(time => time < minTimeBetweenCollisions);
    expect(collisionsTooClose).toBe(false);
    
    // Verify that bounce sounds were played with appropriate intensity
    const bounceSoundCalls = vi.mocked(playBounceSound).mock.calls;
    expect(bounceSoundCalls.length).toBeGreaterThan(0);
    
    // Check that intensities are within reasonable range (0-1)
    bounceSoundCalls.forEach(([intensity]) => {
      expect(intensity).toBeGreaterThanOrEqual(0);
      expect(intensity).toBeLessThanOrEqual(1);
    });
  });
  
  it('should scale audio intensity with collision velocity', () => {
    // Position ball above wall
    ball.position.set(0, 1, 0);
    
    // Set different velocities and track resulting intensities
    const velocities = [2, 5, 10];
    const intensities = [];
    
    velocities.forEach(velocity => {
      // Reset ball position and set new velocity
      ball.position.set(0, 1, 0);
      ball.velocity.set(0, -velocity, 0);
      
      // Clear previous collision data
      collisionCount = 0;
      vi.mocked(playBounceSound).mockClear();
      
      // Step world forward
      for (let i = 0; i < 20; i++) {
        world.step(1/60);
      }
      
      // Get the intensity from the bounce sound call
      if (vi.mocked(playBounceSound).mock.calls.length > 0) {
        intensities.push(vi.mocked(playBounceSound).mock.calls[0][0]);
      }
    });
    
    // Verify that higher velocities result in higher intensities
    expect(intensities.length).toBe(velocities.length);
    for (let i = 1; i < intensities.length; i++) {
      expect(intensities[i]).toBeGreaterThan(intensities[i-1]);
    }
  });
}); 
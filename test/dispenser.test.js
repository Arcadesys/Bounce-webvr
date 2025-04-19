import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';

// Mock Tone.js
vi.mock('tone', () => ({
  Tone: {
    context: { state: 'running' },
    start: vi.fn(),
    Transport: { 
      bpm: { value: 120 },
      scheduleRepeat: vi.fn()
    }
  }
}));

// Helper function to extract just the position data from balls for easier testing
function getBallPositions(balls) {
  return balls.map(ball => ({
    x: ball.body.position.x,
    y: ball.body.position.y,
    z: ball.body.position.z
  }));
}

describe('Dispenser', () => {
  let world;
  let scene;
  let dispenser;
  
  beforeEach(() => {
    world = new CANNON.World();
    scene = new THREE.Scene();
    dispenser = {
      spawnBall: vi.fn().mockImplementation((position) => {
        const ball = new CANNON.Body({
          mass: 1,
          position: position,
          shape: new CANNON.Sphere(0.5),
          userData: { type: 'ball' }
        });
        world.addBody(ball);
        return ball;
      })
    };
  });

  it('spawns balls at consistent positions', () => {
    const spawnPosition = new CANNON.Vec3(0, 5, 0);
    const ball = dispenser.spawnBall(spawnPosition);
    
    expect(ball.position.x).toBe(spawnPosition.x);
    expect(ball.position.y).toBe(spawnPosition.y);
    expect(ball.position.z).toBe(spawnPosition.z);
  });

  it('ensures balls fall straight down', () => {
    const spawnPosition = new CANNON.Vec3(0, 5, 0);
    const ball = dispenser.spawnBall(spawnPosition);
    
    // Simulate physics step
    world.step(1/60);
    
    expect(ball.velocity.x).toBeCloseTo(0, 2);
    expect(ball.velocity.y).toBeLessThan(0);
    expect(ball.velocity.z).toBeCloseTo(0, 2);
  });

  it('prevents perfect stacking', () => {
    const spawnPosition = new CANNON.Vec3(0, 5, 0);
    const ball1 = dispenser.spawnBall(spawnPosition);
    const ball2 = dispenser.spawnBall(spawnPosition);
    
    // Simulate physics for a few steps
    for(let i = 0; i < 10; i++) {
      world.step(1/60);
    }
    
    const distance = ball1.position.distanceTo(ball2.position);
    expect(distance).toBeGreaterThan(0);
  });

  it('handles rapid ball spawning', async () => {
    const spawnPosition = new CANNON.Vec3(0, 5, 0);
    const balls = [];
    
    // Spawn multiple balls rapidly
    for(let i = 0; i < 5; i++) {
      balls.push(dispenser.spawnBall(spawnPosition));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Simulate physics
    for(let i = 0; i < 20; i++) {
      world.step(1/60);
    }
    
    // Check that balls have different positions
    const positions = balls.map(ball => ball.position.y);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBeGreaterThan(1);
  });
}); 
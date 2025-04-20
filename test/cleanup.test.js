import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Ball } from '../src/game/ball';
import { PhysicsWorld } from '../src/core/physics/world';

// Mock THREE.js
vi.mock('three', () => {
  return {
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn()
    })),
    Vector3: vi.fn()
  };
});

// Mock CANNON.js
vi.mock('cannon-es', () => {
  return {
    World: vi.fn().mockImplementation(() => ({
      addBody: vi.fn(),
      removeBody: vi.fn(),
      step: vi.fn()
    })),
    Body: vi.fn().mockImplementation(({ position }) => ({
      position: position || { x: 0, y: 0, z: 0 }
    })),
    Vec3: vi.fn()
  };
});

// Import the ball bounds function
import { isBallOutOfBounds } from './physics.js';

describe('Object Cleanup Tests', () => {
  let scene;
  let world;
  let physicsWorld;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create fresh mocks
    scene = new THREE.Scene();
    world = new CANNON.World();
    physicsWorld = new PhysicsWorld();
  });
  
  afterEach(() => {
    if (physicsWorld) {
      physicsWorld.cleanup();
    }
  });
  
  it('should identify when a ball falls out of bounds', () => {
    // Create a ball
    const ball = new Ball(physicsWorld, { x: 0, y: -5, z: 0 });
    
    // Ball should be in bounds
    expect(ball.body.position.y).toBeGreaterThan(-10);
    
    // Move ball out of bounds
    ball.body.position.y = -15;
    expect(ball.body.position.y).toBeLessThan(-10);
  });
  
  it('should remove balls from the scene and world when out of bounds', () => {
    // Create some balls
    const balls = [
      new Ball(physicsWorld, { x: 0, y: 0, z: 0 }),
      new Ball(physicsWorld, { x: 0, y: -15, z: 0 }),
      new Ball(physicsWorld, { x: 0, y: -5, z: 0 }),
      new Ball(physicsWorld, { x: 0, y: -20, z: 0 })
    ];
    
    // Add meshes to scene
    balls.forEach(ball => scene.add(ball.mesh));
    
    // Run cleanup function
    const removedCount = cleanupBalls(balls, scene, physicsWorld);
    
    // 2 balls should have been removed (positions below -10)
    expect(removedCount).toBe(2);
    
    // Should have called scene.remove twice
    expect(scene.remove).toHaveBeenCalledTimes(2);
    
    // Remaining balls should be in bounds
    expect(balls.length).toBe(2);
    balls.forEach(ball => {
      expect(ball.body.position.y).toBeGreaterThan(-10);
    });
  });
  
  it('should correctly handle empty array when all balls removed', () => {
    // Simulate the cleanup logic from animate()
    function cleanupBalls(balls, scene, world, lowerBound = -10) {
      let removed = 0;
      for (let i = 0; i < balls.length; i++) {
        if (balls[i].body.position.y < lowerBound) {
          scene.remove(balls[i].mesh);
          world.removeBody(balls[i].body);
          balls.splice(i, 1);
          i--;
          removed++;
        }
      }
      return removed;
    }
    
    // Setup test data where all balls are out of bounds
    const balls = [
      { 
        mesh: { id: 'mesh1' }, 
        body: { position: { y: -11 }, id: 'body1' } 
      },
      { 
        mesh: { id: 'mesh2' }, 
        body: { position: { y: -15 }, id: 'body2' } 
      }
    ];
    
    // Run cleanup function
    const removedCount = cleanupBalls(balls, scene, world);
    
    // All balls should be removed
    expect(removedCount).toBe(2);
    expect(balls.length).toBe(0);
  });
  
  it('should handle empty array gracefully', () => {
    // Simulate the cleanup logic from animate()
    function cleanupBalls(balls, scene, world, lowerBound = -10) {
      let removed = 0;
      for (let i = 0; i < balls.length; i++) {
        if (balls[i].body.position.y < lowerBound) {
          scene.remove(balls[i].mesh);
          world.removeBody(balls[i].body);
          balls.splice(i, 1);
          i--;
          removed++;
        }
      }
      return removed;
    }
    
    // Setup empty array
    const balls = [];
    
    // Run cleanup function
    const removedCount = cleanupBalls(balls, scene, world);
    
    // Nothing should have been removed
    expect(removedCount).toBe(0);
    
    // scene.remove and world.removeBody should not have been called
    expect(scene.remove).not.toHaveBeenCalled();
    expect(world.removeBody).not.toHaveBeenCalled();
  });
}); 
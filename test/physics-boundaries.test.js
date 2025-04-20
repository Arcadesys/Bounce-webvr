import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/core/physics/world';
import { Ball } from '../src/game/ball';

describe('Physics Boundaries and Collision Tests', () => {
  let physicsWorld;
  
  beforeEach(() => {
    physicsWorld = new PhysicsWorld();
  });
  
  afterEach(() => {
    if (physicsWorld) {
      physicsWorld.cleanup();
    }
  });

  it('should allow balls to fall straight down without hitting invisible walls', () => {
    // Create test points across the visible area
    const testPoints = [
      { x: 0, y: 2, z: 0 },    // Center
      { x: -2, y: 2, z: 0 },   // Left
      { x: 2, y: 2, z: 0 },    // Right
      { x: -1, y: 2, z: 0 },   // Center-left
      { x: 1, y: 2, z: 0 }     // Center-right
    ];

    // Create balls at each test point
    const balls = testPoints.map(point => new Ball(physicsWorld, point));

    // Track collisions
    const collisions = new Set();
    balls.forEach(ball => {
      ball.body.addEventListener('collide', () => {
        collisions.add(ball);
      });
    });

    // Step physics forward multiple times
    for (let i = 0; i < 60; i++) {
      physicsWorld.update(1/60);
      balls.forEach(ball => ball.update());
    }

    // No balls should have collided with anything
    expect(collisions.size).toBe(0);

    // All balls should have fallen straight down
    balls.forEach((ball, index) => {
      const startX = testPoints[index].x;
      expect(ball.body.position.x).toBeCloseTo(startX, 1);
      expect(ball.body.position.y).toBeLessThan(testPoints[index].y);
      expect(ball.body.position.z).toBeCloseTo(0, 1);
    });
  });

  it('should allow balls to fall through the visible play area without collisions', () => {
    // Create a ball in the center
    const ball = new Ball(physicsWorld, { x: 0, y: 2, z: 0 });
    let collisionDetected = false;

    // Add collision detection
    ball.body.addEventListener('collide', () => {
      collisionDetected = true;
    });

    // Step physics until ball would have hit any invisible barrier
    for (let i = 0; i < 120; i++) {
      physicsWorld.update(1/60);
      ball.update();

      // Stop if collision detected
      if (collisionDetected) break;
    }

    // Should have no collisions at all
    expect(collisionDetected).toBe(false);
    
    // Ball should have fallen straight down
    expect(ball.body.position.x).toBeCloseTo(0, 1);
    expect(ball.body.position.y).toBeLessThan(2);
    expect(ball.body.position.z).toBeCloseTo(0, 1);
  });
}); 
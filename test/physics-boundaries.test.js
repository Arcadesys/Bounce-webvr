import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/core/physics/world';
import { Ball } from '../src/game/ball';

describe('Physics Boundaries and Collision Tests', () => {
  let physicsWorld;
  let camera;
  
  beforeEach(() => {
    // Create fresh physics world
    physicsWorld = new PhysicsWorld();
    
    // Mock camera for frustum checks
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.set(0, 1.5, 12);
    camera.lookAt(0, 0, 0);
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
    const balls = testPoints.map(point => {
      const ball = new Ball(physicsWorld, point);
      return ball;
    });

    // Track collisions
    const collisions = new Set();
    balls.forEach(ball => {
      ball.body.addEventListener('collide', () => {
        collisions.add(ball);
      });
    });

    // Step physics forward multiple times
    for (let i = 0; i < 60; i++) {
      physicsWorld.step(1/60);
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

  it('should only have the explicitly created boundary walls', () => {
    // Get all bodies in the physics world
    const bodies = physicsWorld.world.bodies;
    
    // Count static bodies (walls only, no ground)
    const staticBodies = bodies.filter(body => body.type === 'static');
    
    // Should have exactly 3 static bodies (boundary walls)
    expect(staticBodies.length).toBe(3);
    
    // Verify boundary positions
    const boundaries = staticBodies.filter(body => body.userData?.isBoundary);
    expect(boundaries.length).toBe(3);
    
    // Check that boundaries are far from play area
    boundaries.forEach(body => {
      const pos = body.position;
      const isFarOut = 
        (Math.abs(pos.x) >= 15 && Math.abs(pos.y) < 5) || // Side walls
        (Math.abs(pos.x) < 5 && pos.y >= 15);             // Top wall
      expect(isFarOut).toBe(true);
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
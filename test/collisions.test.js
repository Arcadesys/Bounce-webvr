import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PhysicsWorld } from '../src/core/physics/world';
import { Ball } from '../src/game/ball';

describe('Physics Collisions', () => {
  let physicsWorld;
  let ball1, ball2;
  let wall;
  let contactListener;
  
  beforeEach(() => {
    // Create a fresh physics world for each test
    physicsWorld = new PhysicsWorld();
    physicsWorld.world.gravity.set(0, -9.82, 0); // Ensure gravity is set
    
    // Create balls with smaller radius for more precise testing
    ball1 = new Ball(physicsWorld, { x: -0.5, y: 0.5, z: 0 }, { radius: 0.1 });
    ball2 = new Ball(physicsWorld, { x: 0.5, y: 0.5, z: 0 }, { radius: 0.1 });
    
    // Create wall
    const wallStart = new THREE.Vector3(-1, 0, 0);
    const wallEnd = new THREE.Vector3(1, 0, 0);
    wall = physicsWorld.createWall(wallStart, wallEnd);
    
    // Set up collision listener
    contactListener = {
      collisions: [],
      reset: function() { this.collisions = []; }
    };
    
    // Add collision event listeners
    ball1.body.addEventListener('collide', (e) => {
      contactListener.collisions.push({
        bodyA: ball1.body,
        bodyB: e.body,
        contact: e.contact
      });
    });
    
    ball2.body.addEventListener('collide', (e) => {
      contactListener.collisions.push({
        bodyA: ball2.body,
        bodyB: e.body,
        contact: e.contact
      });
    });
  });

  afterEach(() => {
    // Clean up physics world
    if (physicsWorld) {
      physicsWorld.dispose();
    }
  });
  
  it('should detect collisions between balls and walls', async () => {
    // Position ball directly above wall
    ball1.body.position.set(0, 1, 0);
    ball1.body.velocity.set(0, -2, 0);
    ball1.body.allowSleep = false;
    
    // Step world forward with smaller timesteps
    for (let i = 0; i < 60; i++) {
      physicsWorld.update(1/120);
    }
    
    // Should have detected at least one collision
    expect(contactListener.collisions.length).toBeGreaterThan(0);
    
    // Find collision with wall
    const wallCollision = contactListener.collisions.find(c => c.bodyB === wall);
    expect(wallCollision).toBeDefined();
  });
  
  it('should detect collisions between two balls', async () => {
    // Position balls on collision course
    ball1.body.position.set(-0.3, 0.5, 0);
    ball2.body.position.set(0.3, 0.5, 0);
    
    ball1.body.velocity.set(2, 0, 0);  // Moving right
    ball2.body.velocity.set(-2, 0, 0); // Moving left
    
    ball1.body.allowSleep = false;
    ball2.body.allowSleep = false;
    
    // Reset collision tracking
    contactListener.reset();
    
    // Step world forward with smaller timesteps
    for (let i = 0; i < 60; i++) {
      physicsWorld.update(1/120);
    }
    
    // Should have detected ball-ball collision
    const ballCollision = contactListener.collisions.find(c => 
      (c.bodyA === ball1.body && c.bodyB === ball2.body) || 
      (c.bodyA === ball2.body && c.bodyB === ball1.body)
    );
    
    expect(ballCollision).toBeDefined();
  });
  
  it('should handle high-velocity collisions without tunneling', async () => {
    // Position ball above wall with high velocity
    ball1.body.position.set(0, 1, 0);
    ball1.body.velocity.set(0, -5, 0);
    ball1.body.allowSleep = false;
    
    // Reset collision tracking
    contactListener.reset();
    
    // Step world forward with much smaller timesteps to prevent tunneling
    for (let i = 0; i < 120; i++) {
      physicsWorld.update(1/240);
    }
    
    // Should have detected collision with wall (not tunneled through)
    const wallCollision = contactListener.collisions.find(c => c.bodyB === wall);
    expect(wallCollision).toBeDefined();
    
    // Position should be above the wall (not tunneled through)
    expect(ball1.body.position.y).toBeGreaterThan(-0.1);
  });
  
  it('should conserve momentum in elastic collisions', async () => {
    // Disable gravity for this test
    physicsWorld.world.gravity.set(0, 0, 0);
    
    // Position balls for direct collision
    ball1.body.position.set(-0.5, 0.5, 0);
    ball2.body.position.set(0.5, 0.5, 0);
    
    // Initial velocities
    ball1.body.velocity.set(2, 0, 0);
    ball2.body.velocity.set(-2, 0, 0);
    
    ball1.body.allowSleep = false;
    ball2.body.allowSleep = false;
    
    // Calculate initial momentum
    const getMomentum = (body) => {
      return {
        x: body.mass * body.velocity.x,
        y: body.mass * body.velocity.y,
        z: body.mass * body.velocity.z
      };
    };
    
    const initialMomentum1 = getMomentum(ball1.body);
    const initialMomentum2 = getMomentum(ball2.body);
    const initialTotalMomentum = {
      x: initialMomentum1.x + initialMomentum2.x,
      y: initialMomentum1.y + initialMomentum2.y,
      z: initialMomentum1.z + initialMomentum2.z
    };
    
    // Step world forward with smaller timesteps
    for (let i = 0; i < 60; i++) {
      physicsWorld.update(1/120);
    }
    
    // Calculate final momentum
    const finalMomentum1 = getMomentum(ball1.body);
    const finalMomentum2 = getMomentum(ball2.body);
    const finalTotalMomentum = {
      x: finalMomentum1.x + finalMomentum2.x,
      y: finalMomentum1.y + finalMomentum2.y,
      z: finalMomentum1.z + finalMomentum2.z
    };
    
    // Momentum should be conserved (within numerical precision)
    expect(Math.abs(finalTotalMomentum.x - initialTotalMomentum.x)).toBeLessThan(0.1);
    expect(Math.abs(finalTotalMomentum.y - initialTotalMomentum.y)).toBeLessThan(0.1);
    expect(Math.abs(finalTotalMomentum.z - initialTotalMomentum.z)).toBeLessThan(0.1);
  });
  
  it('should apply impulses correctly in angled collisions', async () => {
    // Create angled wall
    const wallStart = new THREE.Vector3(-1, -1, 0);
    const wallEnd = new THREE.Vector3(1, 1, 0);
    const angledWall = physicsWorld.createWall(wallStart, wallEnd);
    
    // Position ball above and to the left of angled wall
    ball1.body.position.set(-0.5, 1, 0);
    ball1.body.allowSleep = false;
    
    // Set velocity towards wall
    ball1.body.velocity.set(2, -1, 0);
    
    // Step world forward with smaller timesteps
    for (let i = 0; i < 60; i++) {
      physicsWorld.update(1/120);
    }
    
    // After angled collision, the velocity should have components in both x and y
    // And the y component should be positive (bouncing upward)
    expect(ball1.body.velocity.y).toBeGreaterThan(0);
    
    // The x velocity should be affected as well
    expect(Math.abs(ball1.body.velocity.x)).toBeGreaterThan(0);
  });
}); 
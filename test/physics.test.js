import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Mock dependencies
vi.mock('tone', () => ({
  Tone: {
    context: { state: 'running' },
    start: vi.fn(),
    Transport: { bpm: { value: 120 } }
  }
}));

describe('Physics System', () => {
  let world;
  let ballBody;
  let wallBody;

  beforeEach(() => {
    // Initialize a fresh physics world for each test
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    // Create materials
    const ballMaterial = new CANNON.Material("ballMaterial");
    const wallMaterial = new CANNON.Material("wallMaterial");
    
    // Configure material properties
    ballMaterial.friction = 0.3;
    ballMaterial.restitution = 0.7;
    
    wallMaterial.friction = 0.1;
    wallMaterial.restitution = 0.9;
    
    // Create contact material
    const contactMaterial = new CANNON.ContactMaterial(
      ballMaterial,
      wallMaterial,
      {
        friction: 0.1,
        restitution: 0.97,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e7,
        contactEquationStiffness: 1e8
      }
    );
    
    world.addContactMaterial(contactMaterial);
    
    // Create a ball body
    const radius = 0.1;
    const mass = 0.05;
    const sphereShape = new CANNON.Sphere(radius);
    
    ballBody = new CANNON.Body({
      mass: mass,
      shape: sphereShape,
      position: new CANNON.Vec3(0, 1, 0),
      material: ballMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    
    // Create a wall body
    const wallShape = new CANNON.Box(new CANNON.Vec3(2, 0.1, 0.1));
    wallBody = new CANNON.Body({
      mass: 0, // Static body
      shape: wallShape,
      position: new CANNON.Vec3(0, 0, 0),
      material: wallMaterial
    });
    
    // Add bodies to world
    world.addBody(ballBody);
    world.addBody(wallBody);
  });
  
  afterEach(() => {
    // Clean up
    world = null;
    ballBody = null;
    wallBody = null;
  });

  it('should apply gravity to a ball', () => {
    const initialVelocity = ballBody.velocity.y;
    
    // Step the world forward
    world.step(1/60);
    
    // Ball should accelerate downward due to gravity
    expect(ballBody.velocity.y).toBeLessThan(initialVelocity);
  });
  
  it('should bounce off a horizontal surface', () => {
    // Position ball directly above wall
    ballBody.position.set(0, 0.5, 0);
    ballBody.velocity.set(0, -1, 0);
    
    // Initial downward velocity
    const initialVelocityY = ballBody.velocity.y;
    
    // Step the world forward until collision occurs
    for (let i = 0; i < 10; i++) {
      world.step(1/60);
      
      // If ball starts moving upward, collision occurred
      if (ballBody.velocity.y > 0) break;
    }
    
    // Ball should be moving upward after bounce
    expect(ballBody.velocity.y).toBeGreaterThan(0);
  });
  
  it('should handle angled collisions correctly', () => {
    // Rotate the wall by 45 degrees
    wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 4);
    
    // Position ball above and to the left of the wall
    ballBody.position.set(-0.5, 0.5, 0);
    ballBody.velocity.set(1, -1, 0); // Moving down and to the right
    
    // Step the world forward until collision occurs
    for (let i = 0; i < 20; i++) {
      world.step(1/60);
    }
    
    // After collision, should have some upward velocity component
    expect(ballBody.velocity.y).toBeGreaterThan(0);
    
    // After collision with angled surface, should have some horizontal velocity
    expect(Math.abs(ballBody.velocity.x)).toBeGreaterThan(0.1);
  });
  
  it('should properly handle multiple simultaneous collisions', () => {
    // Create a second wall
    const wall2Shape = new CANNON.Box(new CANNON.Vec3(0.1, 2, 0.1));
    const wall2Body = new CANNON.Body({
      mass: 0,
      shape: wall2Shape,
      position: new CANNON.Vec3(1, 0, 0),
      material: wallBody.material
    });
    world.addBody(wall2Body);
    
    // Position ball in corner between two walls
    ballBody.position.set(0.9, 0.2, 0);
    ballBody.velocity.set(-1, -1, 0);
    
    // Step the world forward
    for (let i = 0; i < 20; i++) {
      world.step(1/60);
    }
    
    // After collision with two walls, should bounce away from corner
    expect(ballBody.velocity.x).toBeGreaterThan(0);
    expect(ballBody.velocity.y).toBeGreaterThan(0);
  });
  
  it('should conserve energy in bounces (not gain or lose significantly)', () => {
    // Get initial energy
    const getKineticEnergy = (body) => {
      const speed = body.velocity.length();
      return 0.5 * body.mass * speed * speed;
    };
    
    // Position ball above wall
    ballBody.position.set(0, 2, 0);
    // Apply damping to avoid normal energy loss
    ballBody.linearDamping = 0;
    
    const initialEnergy = getKineticEnergy(ballBody) + ballBody.mass * 9.82 * ballBody.position.y;
    
    // Step the world forward through several bounces
    for (let i = 0; i < 300; i++) {
      world.step(1/60);
    }
    
    // Calculate final energy
    const finalEnergy = getKineticEnergy(ballBody) + ballBody.mass * 9.82 * ballBody.position.y;
    
    // Energy should be conserved within a reasonable margin (allowing for some numerical errors)
    // In practice with damping values, energy should decrease, but not wildly
    expect(finalEnergy).toBeLessThan(initialEnergy * 1.1); // Should not gain more than 10% energy
    expect(finalEnergy).toBeGreaterThan(initialEnergy * 0.5); // Should not lose more than 50% energy
  });
  
  it('should handle extreme velocities without breaking', () => {
    // Apply an extreme velocity
    ballBody.velocity.set(0, -100, 0);
    
    // Step the world forward
    for (let i = 0; i < 10; i++) {
      world.step(1/60);
    }
    
    // Physics should not break - velocities should still be finite
    expect(isFinite(ballBody.velocity.x)).toBe(true);
    expect(isFinite(ballBody.velocity.y)).toBe(true);
    expect(isFinite(ballBody.velocity.z)).toBe(true);
    expect(isFinite(ballBody.position.x)).toBe(true);
    expect(isFinite(ballBody.position.y)).toBe(true);
    expect(isFinite(ballBody.position.z)).toBe(true);
  });
}); 
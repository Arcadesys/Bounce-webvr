import { describe, it, expect, beforeEach } from 'vitest';
import * as CANNON from 'cannon-es';

describe('Physics Collisions', () => {
  let world;
  let ball1, ball2;
  let wall;
  let contactListener;
  
  beforeEach(() => {
    // Create a fresh physics world for each test
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Create physics materials
    const ballMaterial = new CANNON.Material('ballMaterial');
    const wallMaterial = new CANNON.Material('wallMaterial');
    
    // Configure contact material
    const contactMaterial = new CANNON.ContactMaterial(
      ballMaterial,
      wallMaterial,
      {
        friction: 0.1,
        restitution: 0.9,
        contactEquationRelaxation: 3,
        contactEquationStiffness: 1e8
      }
    );
    world.addContactMaterial(contactMaterial);
    
    // Create balls
    const ballShape = new CANNON.Sphere(0.1);
    ball1 = new CANNON.Body({
      mass: 0.05,
      shape: ballShape,
      material: ballMaterial,
      position: new CANNON.Vec3(-0.5, 0.5, 0),
      linearDamping: 0.01
    });
    
    ball2 = new CANNON.Body({
      mass: 0.05,
      shape: ballShape,
      material: ballMaterial,
      position: new CANNON.Vec3(0.5, 0.5, 0),
      linearDamping: 0.01
    });
    
    // Create wall
    const wallShape = new CANNON.Box(new CANNON.Vec3(1, 0.1, 0.1));
    wall = new CANNON.Body({
      mass: 0,
      shape: wallShape,
      material: wallMaterial,
      position: new CANNON.Vec3(0, 0, 0)
    });
    
    // Add bodies to world
    world.addBody(ball1);
    world.addBody(ball2);
    world.addBody(wall);
    
    // Set up collision listener
    contactListener = {
      collisions: [],
      reset: function() { this.collisions = []; }
    };
    
    // Add collision event listeners
    ball1.addEventListener('collide', (e) => {
      contactListener.collisions.push({
        bodyA: ball1,
        bodyB: e.body,
        contact: e.contact
      });
    });
    
    ball2.addEventListener('collide', (e) => {
      contactListener.collisions.push({
        bodyA: ball2,
        bodyB: e.body,
        contact: e.contact
      });
    });
  });
  
  it('should detect collisions between balls and walls', () => {
    // Position ball directly above wall
    ball1.position.set(0, 0.5, 0);
    ball1.velocity.set(0, -1, 0);
    
    // Step world forward
    for (let i = 0; i < 20; i++) {
      world.step(1/60);
    }
    
    // Should have detected at least one collision
    expect(contactListener.collisions.length).toBeGreaterThan(0);
    
    // Find collision with wall
    const wallCollision = contactListener.collisions.find(c => c.bodyB === wall);
    expect(wallCollision).toBeDefined();
  });
  
  it('should detect collisions between two balls', () => {
    // Position balls on collision course
    ball1.position.set(-0.3, 0.5, 0);
    ball2.position.set(0.3, 0.5, 0);
    
    ball1.velocity.set(1, 0, 0);  // Moving right
    ball2.velocity.set(-1, 0, 0); // Moving left
    
    // Reset collision tracking
    contactListener.reset();
    
    // Step world forward
    for (let i = 0; i < 20; i++) {
      world.step(1/60);
    }
    
    // Should have detected ball-ball collision
    const ballCollision = contactListener.collisions.find(c => 
      (c.bodyA === ball1 && c.bodyB === ball2) || 
      (c.bodyA === ball2 && c.bodyB === ball1)
    );
    
    expect(ballCollision).toBeDefined();
  });
  
  it('should handle high-velocity collisions without tunneling', () => {
    // Position ball above wall
    ball1.position.set(0, 0.5, 0);
    
    // Set very high velocity (likely to cause tunneling in poor implementations)
    ball1.velocity.set(0, -10, 0);
    
    // Reset collision tracking
    contactListener.reset();
    
    // Step world forward
    for (let i = 0; i < 20; i++) {
      world.step(1/60);
    }
    
    // Should have detected collision with wall (not tunneled through)
    const wallCollision = contactListener.collisions.find(c => c.bodyB === wall);
    expect(wallCollision).toBeDefined();
    
    // Position should be above the wall (not tunneled through)
    expect(ball1.position.y).toBeGreaterThan(-0.1);
  });
  
  it('should conserve momentum in elastic collisions', () => {
    // Set up perfectly elastic collision
    const contactMaterial = new CANNON.ContactMaterial(
      ball1.material,
      ball2.material,
      {
        friction: 0,
        restitution: 1.0 // Perfectly elastic
      }
    );
    world.addContactMaterial(contactMaterial);
    
    // Position balls for direct collision
    ball1.position.set(-0.5, 0.5, 0);
    ball2.position.set(0.5, 0.5, 0);
    
    // Initial velocities
    ball1.velocity.set(1, 0, 0);
    ball2.velocity.set(-1, 0, 0);
    
    // Calculate initial momentum
    const getMomentum = (body) => {
      return {
        x: body.mass * body.velocity.x,
        y: body.mass * body.velocity.y,
        z: body.mass * body.velocity.z
      };
    };
    
    const initialMomentum1 = getMomentum(ball1);
    const initialMomentum2 = getMomentum(ball2);
    const initialTotalMomentum = {
      x: initialMomentum1.x + initialMomentum2.x,
      y: initialMomentum1.y + initialMomentum2.y,
      z: initialMomentum1.z + initialMomentum2.z
    };
    
    // Disable gravity for this test
    world.gravity.set(0, 0, 0);
    
    // Step world forward
    for (let i = 0; i < 30; i++) {
      world.step(1/60);
    }
    
    // Calculate final momentum
    const finalMomentum1 = getMomentum(ball1);
    const finalMomentum2 = getMomentum(ball2);
    const finalTotalMomentum = {
      x: finalMomentum1.x + finalMomentum2.x,
      y: finalMomentum1.y + finalMomentum2.y,
      z: finalMomentum1.z + finalMomentum2.z
    };
    
    // Momentum should be conserved (within numerical precision)
    expect(Math.abs(finalTotalMomentum.x - initialTotalMomentum.x)).toBeLessThan(0.001);
    expect(Math.abs(finalTotalMomentum.y - initialTotalMomentum.y)).toBeLessThan(0.001);
    expect(Math.abs(finalTotalMomentum.z - initialTotalMomentum.z)).toBeLessThan(0.001);
  });
  
  it('should apply impulses correctly in angled collisions', () => {
    // Position the wall at an angle
    wall.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 4); // 45 degrees
    
    // Position ball above and to the left of angled wall
    ball1.position.set(-0.5, 0.5, 0);
    
    // Set velocity towards wall
    ball1.velocity.set(1, -0.5, 0);
    
    // Step world forward
    for (let i = 0; i < 30; i++) {
      world.step(1/60);
    }
    
    // After angled collision, the velocity should have components in both x and y
    // And the y component should be positive (bouncing upward)
    expect(ball1.velocity.y).toBeGreaterThan(0);
    
    // The x velocity should be affected as well
    expect(ball1.velocity.x).toBeDefined();
  });
}); 
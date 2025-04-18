import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

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

describe('Dispenser Functionality', () => {
  let world;
  let dispenserPosition;
  let balls = [];
  let groundBody;

  // Create a simplified version of the createBall function
  function createBall(position) {
    const radius = 0.1;
    const mass = 0.05;
    
    const sphereShape = new CANNON.Sphere(radius);
    const ballMaterial = new CANNON.Material("ballMaterial");
    
    const sphereBody = new CANNON.Body({
      mass: mass,
      shape: sphereShape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      material: ballMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    
    // Add initial velocity with randomness
    sphereBody.velocity.set(
      (Math.random() - 0.5) * 0.1,
      -0.2 - Math.random() * 0.1,
      (Math.random() - 0.5) * 0.1
    );
    
    // Add some random angular velocity
    sphereBody.angularVelocity.set(
      (Math.random() - 0.5) * 1,
      (Math.random() - 0.5) * 1,
      (Math.random() - 0.5) * 1
    );
    
    world.addBody(sphereBody);
    
    // Create a simple mesh (not rendering in tests)
    const sphereGeometry = new THREE.SphereGeometry(radius);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    
    // Add to balls array
    const ball = { body: sphereBody, mesh: sphere };
    balls.push(ball);
    
    return ball;
  }

  beforeEach(() => {
    // Initialize fresh physics world
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    balls = [];
    dispenserPosition = new THREE.Vector3(0, 2, 0);
    
    // Create ground
    const groundShape = new CANNON.Plane();
    const groundMaterial = new CANNON.Material("groundMaterial");
    groundBody = new CANNON.Body({
      mass: 0,
      shape: groundShape,
      material: groundMaterial
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.y = -1;
    groundBody.userData = { isGround: true };
    world.addBody(groundBody);
    
    // Create contact material
    const ballMaterial = new CANNON.Material("ballMaterial");
    const contactMaterial = new CANNON.ContactMaterial(
      ballMaterial,
      groundMaterial,
      {
        friction: 0.1,
        restitution: 0.5
      }
    );
    world.addContactMaterial(contactMaterial);
  });
  
  afterEach(() => {
    world = null;
    balls = [];
    groundBody = null;
  });

  it('should spawn balls with some horizontal randomness', () => {
    // Create multiple balls from same dispenser position
    const numBalls = 10;
    for (let i = 0; i < numBalls; i++) {
      const ballPosition = new THREE.Vector3(
        dispenserPosition.x + (Math.random() * 0.1 - 0.05),
        dispenserPosition.y - 0.35,
        dispenserPosition.z + (Math.random() * 0.1 - 0.05)
      );
      createBall(ballPosition);
    }
    
    // Get ball positions
    const positions = getBallPositions(balls);
    
    // Check that they're not all at the exact same x,z position
    const uniqueXPositions = new Set(positions.map(p => p.x.toFixed(6)));
    const uniqueZPositions = new Set(positions.map(p => p.z.toFixed(6)));
    
    // Should have multiple unique positions (randomness is working)
    expect(uniqueXPositions.size).toBeGreaterThan(1);
    expect(uniqueZPositions.size).toBeGreaterThan(1);
  });
  
  it('should have balls move apart as they fall', () => {
    // Create multiple balls at almost the same position
    const numBalls = 5;
    for (let i = 0; i < numBalls; i++) {
      const ballPosition = new THREE.Vector3(
        dispenserPosition.x + (Math.random() * 0.02 - 0.01), // Very small initial difference
        dispenserPosition.y - 0.35,
        dispenserPosition.z + (Math.random() * 0.02 - 0.01)
      );
      createBall(ballPosition);
    }
    
    // Record initial average distance between balls
    let initialDistances = 0;
    let count = 0;
    
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const dist = balls[i].body.position.distanceTo(balls[j].body.position);
        initialDistances += dist;
        count++;
      }
    }
    const initialAvgDistance = initialDistances / count;
    
    // Step world forward
    for (let i = 0; i < 60; i++) {
      world.step(1/60);
    }
    
    // Calculate final average distance
    let finalDistances = 0;
    count = 0;
    
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const dist = balls[i].body.position.distanceTo(balls[j].body.position);
        finalDistances += dist;
        count++;
      }
    }
    const finalAvgDistance = finalDistances / count;
    
    // Balls should spread out as they fall
    expect(finalAvgDistance).toBeGreaterThan(initialAvgDistance);
  });
  
  it('should not create balls that perfectly stack', () => {
    // Create 10 balls with same X,Z but different Y
    for (let i = 0; i < 10; i++) {
      const ballPosition = new THREE.Vector3(
        dispenserPosition.x,
        dispenserPosition.y - 0.35 - (i * 0.25), // Stack on top of each other
        dispenserPosition.z
      );
      createBall(ballPosition);
    }
    
    // Step world forward for a while
    for (let i = 0; i < 120; i++) {
      world.step(1/60);
    }
    
    // Get final positions
    const positions = getBallPositions(balls);
    
    // Count how many balls ended up with nearly identical x,z values
    let stackedCount = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const xDiff = Math.abs(positions[i].x - positions[j].x);
        const zDiff = Math.abs(positions[i].z - positions[j].z);
        const yDiff = Math.abs(positions[i].y - positions[j].y);
        
        // If balls are directly above each other (stacked)
        if (xDiff < 0.05 && zDiff < 0.05 && yDiff < 0.25 && yDiff > 0.15) {
          stackedCount++;
        }
      }
    }
    
    // Should not have many perfectly stacked balls
    expect(stackedCount).toBeLessThan(positions.length - 1);
  });
  
  it('should handle high ball spawn rate without physics issues', () => {
    // Rapidly spawn 30 balls
    for (let i = 0; i < 30; i++) {
      const ballPosition = new THREE.Vector3(
        dispenserPosition.x + (Math.random() * 0.1 - 0.05),
        dispenserPosition.y - 0.35,
        dispenserPosition.z + (Math.random() * 0.1 - 0.05)
      );
      createBall(ballPosition);
      
      // Step world just a little between spawns
      world.step(1/60);
    }
    
    // Then step world forward for a while
    for (let i = 0; i < 180; i++) {
      world.step(1/60);
    }
    
    // Check for NaN or infinite positions (broken physics)
    for (const ball of balls) {
      expect(isFinite(ball.body.position.x)).toBe(true);
      expect(isFinite(ball.body.position.y)).toBe(true);
      expect(isFinite(ball.body.position.z)).toBe(true);
      expect(isFinite(ball.body.velocity.x)).toBe(true);
      expect(isFinite(ball.body.velocity.y)).toBe(true);
      expect(isFinite(ball.body.velocity.z)).toBe(true);
      
      // Balls shouldn't be too far away
      expect(Math.abs(ball.body.position.x)).toBeLessThan(10);
      expect(Math.abs(ball.body.position.z)).toBeLessThan(10);
      
      // Balls shouldn't tunnel through the ground
      expect(ball.body.position.y + 0.1).toBeGreaterThan(groundBody.position.y);
    }
  });
}); 
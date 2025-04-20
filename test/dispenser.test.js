import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BallDispenser } from '../src/game/ball';

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

describe('Dispenser Functionality', () => {
  let world;
  let dispenser;
  let dispenserPosition;
  let groundBody;

  beforeEach(() => {
    // Initialize fresh physics world
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    dispenserPosition = new THREE.Vector3(0, 2, 0);
    dispenser = new BallDispenser(world, dispenserPosition);
    
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
    dispenser.cleanup();
    world = null;
    dispenser = null;
    groundBody = null;
  });

  it('should spawn balls with consistent positions', () => {
    // Create multiple balls from same dispenser position
    const numBalls = 10;
    for (let i = 0; i < numBalls; i++) {
      dispenser.createBall();
    }
    
    // Get ball positions
    const positions = dispenser.balls.map(ball => ({
      x: ball.body.position.x,
      y: ball.body.position.y,
      z: ball.body.position.z
    }));
    
    // Check that all balls have exactly the same x,z position
    const uniqueXPositions = new Set(positions.map(p => p.x.toFixed(6)));
    const uniqueZPositions = new Set(positions.map(p => p.z.toFixed(6)));
    
    // Should have exactly one unique position for each axis (all balls at same spot)
    expect(uniqueXPositions.size).toBe(1);
    expect(uniqueZPositions.size).toBe(1);
  });
  
  it('should have balls fall straight down', () => {
    // Create multiple balls at the same position
    const numBalls = 5;
    for (let i = 0; i < numBalls; i++) {
      dispenser.createBall();
    }
    
    // Record initial positions
    const initialPositions = dispenser.balls.map(ball => ({
      x: ball.body.position.x,
      y: ball.body.position.y,
      z: ball.body.position.z
    }));
    
    // Step world forward
    for (let i = 0; i < 10; i++) {
      world.step(1/60);
      dispenser.update();
    }
    
    // Get final positions
    const finalPositions = dispenser.balls.map(ball => ({
      x: ball.body.position.x,
      y: ball.body.position.y,
      z: ball.body.position.z
    }));
    
    // Each ball should maintain its exact X and Z position while only Y changes
    for (let i = 0; i < dispenser.balls.length; i++) {
      expect(finalPositions[i].x).toBeCloseTo(initialPositions[i].x, 5);
      expect(finalPositions[i].y).toBeLessThan(initialPositions[i].y); // Y should decrease
      expect(finalPositions[i].z).toBeCloseTo(initialPositions[i].z, 5);
    }
  });
  
  it('should have balls move apart as they fall', () => {
    // Create multiple balls at almost the same position
    const numBalls = 5;
    for (let i = 0; i < numBalls; i++) {
      dispenser.createBall();
    }
    
    // Record initial average distance between balls
    let initialDistances = 0;
    let count = 0;
    
    for (let i = 0; i < dispenser.balls.length; i++) {
      for (let j = i + 1; j < dispenser.balls.length; j++) {
        const dist = dispenser.balls[i].body.position.distanceTo(dispenser.balls[j].body.position);
        initialDistances += dist;
        count++;
      }
    }
    const initialAvgDistance = initialDistances / count;
    
    // Step world forward
    for (let i = 0; i < 60; i++) {
      world.step(1/60);
      dispenser.update();
    }
    
    // Calculate final average distance
    let finalDistances = 0;
    count = 0;
    
    for (let i = 0; i < dispenser.balls.length; i++) {
      for (let j = i + 1; j < dispenser.balls.length; j++) {
        const dist = dispenser.balls[i].body.position.distanceTo(dispenser.balls[j].body.position);
        finalDistances += dist;
        count++;
      }
    }
    const finalAvgDistance = finalDistances / count;
    
    // Balls should spread out as they fall
    expect(finalAvgDistance).toBeGreaterThan(initialAvgDistance);
  });
  
  it('should create balls that stack perfectly', () => {
    // Create 10 balls with same X,Z but different Y
    for (let i = 0; i < 10; i++) {
      dispenser.createBall();
    }
    
    // Step world forward for a while
    for (let i = 0; i < 120; i++) {
      world.step(1/60);
      dispenser.update();
    }
    
    // Get final positions
    const positions = dispenser.balls.map(ball => ({
      x: ball.body.position.x,
      y: ball.body.position.y,
      z: ball.body.position.z
    }));
    
    // Count how many balls ended up with nearly identical x,z values
    let stackedCount = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const xDiff = Math.abs(positions[i].x - positions[j].x);
        const zDiff = Math.abs(positions[i].z - positions[j].z);
        if (xDiff < 0.1 && zDiff < 0.1) {
          stackedCount++;
        }
      }
    }
    
    // Should have at least some balls stacked
    expect(stackedCount).toBeGreaterThan(0);
  });
}); 
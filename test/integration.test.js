import { describe, it, expect, beforeEach } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';

// Mock tone
vi.mock('@tonejs/piano', () => ({
  default: vi.fn()
}));
vi.mock('tone', () => ({
  default: {
    start: vi.fn(),
    Synth: vi.fn().mockImplementation(() => ({
      toDestination: vi.fn().mockReturnThis(),
      triggerAttackRelease: vi.fn()
    })),
    Transport: {
      bpm: { value: 120 },
      start: vi.fn(),
      schedule: vi.fn()
    }
  }
}));

describe('Dispenser and Ball Integration', () => {
  let world;
  let dispensers = [];
  let balls = [];
  let ground;
  
  // Parameters to match the actual app
  const dispenserSize = 0.5;
  const ballRadius = 0.1;
  const dispenserBottomY = -0.35;
  const dispenserCount = 3;
  
  beforeEach(() => {
    // Reset test objects
    dispensers = [];
    balls = [];
    
    // Create physics world
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Create materials
    const ballMaterial = new CANNON.Material('ballMaterial');
    const groundMaterial = new CANNON.Material('groundMaterial');
    const dispenserMaterial = new CANNON.Material('dispenserMaterial');
    
    // Set up contact materials
    const ballGroundContact = new CANNON.ContactMaterial(
      ballMaterial,
      groundMaterial,
      {
        friction: 0.3,
        restitution: 0.6
      }
    );
    
    const ballDispenserContact = new CANNON.ContactMaterial(
      ballMaterial,
      dispenserMaterial,
      {
        friction: 0.1,
        restitution: 0.7
      }
    );
    
    // Add contact materials to world
    world.addContactMaterial(ballGroundContact);
    world.addContactMaterial(ballDispenserContact);
    
    // Add ground
    const groundShape = new CANNON.Plane();
    ground = new CANNON.Body({
      mass: 0,
      shape: groundShape,
      material: groundMaterial
    });
    ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Rotate to be horizontal
    ground.position.set(0, -2, 0);
    world.addBody(ground);
    
    // Create dispensers at different X positions
    for (let i = 0; i < dispenserCount; i++) {
      const x = (i - 1) * 2; // Position dispensers at -2, 0, 2
      const dispenserShape = new CANNON.Box(new CANNON.Vec3(
        dispenserSize / 2,
        dispenserSize / 2,
        dispenserSize / 2
      ));
      
      const dispenser = new CANNON.Body({
        mass: 0, // Static
        shape: dispenserShape,
        material: dispenserMaterial,
        position: new CANNON.Vec3(x, 2, 0)
      });
      
      dispensers.push(dispenser);
      world.addBody(dispenser);
    }
  });
  
  function createBall(x, y, z) {
    // Helper to create a ball with the same properties as in the app
    const ballShape = new CANNON.Sphere(ballRadius);
    
    // Add slight randomness to position as in the app
    const xOffset = (Math.random() - 0.5) * 0.1;
    const zOffset = (Math.random() - 0.5) * 0.1;
    
    const ball = new CANNON.Body({
      mass: 0.05,
      shape: ballShape,
      position: new CANNON.Vec3(x + xOffset, y, z + zOffset),
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    
    // Add slight randomness to velocity
    const vx = (Math.random() - 0.5) * 0.2;
    const vy = (Math.random() - 0.5) * 0.1 - 0.1; // Slight downward bias
    const vz = (Math.random() - 0.5) * 0.2;
    ball.velocity.set(vx, vy, vz);
    
    // Add slight randomness to angular velocity
    const wx = (Math.random() - 0.5) * 1;
    const wy = (Math.random() - 0.5) * 1;
    const wz = (Math.random() - 0.5) * 1;
    ball.angularVelocity.set(wx, wy, wz);
    
    balls.push(ball);
    world.addBody(ball);
    return ball;
  }
  
  function dropMultipleBalls(dispenserIndex, count = 10, delayFrames = 5) {
    // Simulates dropping multiple balls from a dispenser with delay
    const dispenser = dispensers[dispenserIndex];
    const x = dispenser.position.x;
    const y = dispenser.position.y - dispenserSize/2 + dispenserBottomY;
    const z = dispenser.position.z;
    
    const droppedBalls = [];
    
    // Create and drop balls with delay
    for (let i = 0; i < count; i++) {
      // Step the world a few times between ball creation
      for (let j = 0; j < delayFrames; j++) {
        world.step(1/60);
      }
      
      droppedBalls.push(createBall(x, y, z));
    }
    
    return droppedBalls;
  }
  
  it('should drop balls that do not stack perfectly', () => {
    // Drop 10 balls from the middle dispenser
    const droppedBalls = dropMultipleBalls(1, 10);
    
    // Let physics run for a while
    for (let i = 0; i < 120; i++) {
      world.step(1/60);
    }
    
    // Get the positions of all balls
    const yPositions = droppedBalls.map(ball => ball.position.y);
    
    // Sort positions from bottom to top
    yPositions.sort((a, b) => a - b);
    
    // Calculate heights where perfect stack would be
    const perfectStackHeights = [];
    for (let i = 0; i < droppedBalls.length; i++) {
      // For a perfect stack, each ball would be exactly 2*radius higher than the one below
      perfectStackHeights.push(ground.position.y + ballRadius + i * (ballRadius * 2));
    }
    
    // Count how many balls are not at a perfect stack height
    let nonStackedCount = 0;
    for (let i = 0; i < yPositions.length; i++) {
      // Check if this ball is not at a perfect stacking height (with some tolerance)
      const tolerance = 0.01;
      if (!perfectStackHeights.some(h => Math.abs(yPositions[i] - h) < tolerance)) {
        nonStackedCount++;
      }
    }
    
    // At least some balls should not be in a perfect stack
    expect(nonStackedCount).toBeGreaterThan(3);
  });
  
  it('should create balls with different trajectories', () => {
    // Drop 5 balls from the same dispenser
    const droppedBalls = dropMultipleBalls(1, 5, 0); // No delay - drop them at exactly the same time
    
    // Let physics run briefly
    for (let i = 0; i < 30; i++) {
      world.step(1/60);
    }
    
    // Check x and z positions after some time
    const positions = droppedBalls.map(ball => {
      return {
        x: ball.position.x,
        z: ball.position.z
      };
    });
    
    // Calculate how many unique paths we have (approximate by checking final positions)
    // Convert positions to strings for easy comparison
    const uniquePositions = new Set(positions.map(p => `${p.x.toFixed(3)},${p.z.toFixed(3)}`));
    
    // Should have at least 3 different trajectories
    expect(uniquePositions.size).toBeGreaterThan(2);
  });
  
  it('should handle multiple dispensers activating simultaneously', () => {
    // Drop balls from all dispensers
    const dispenser0Balls = dropMultipleBalls(0, 5, 0);
    const dispenser1Balls = dropMultipleBalls(1, 5, 0);
    const dispenser2Balls = dropMultipleBalls(2, 5, 0);
    
    // Let physics run for a while
    for (let i = 0; i < 120; i++) {
      world.step(1/60);
    }
    
    // Verify all balls have valid positions (no NaN, no extreme values)
    const allBalls = [...dispenser0Balls, ...dispenser1Balls, ...dispenser2Balls];
    
    for (const ball of allBalls) {
      expect(isNaN(ball.position.x)).toBe(false);
      expect(isNaN(ball.position.y)).toBe(false);
      expect(isNaN(ball.position.z)).toBe(false);
      
      // Check that balls haven't shot off to infinity
      expect(Math.abs(ball.position.x)).toBeLessThan(100);
      expect(Math.abs(ball.position.y)).toBeLessThan(100);
      expect(Math.abs(ball.position.z)).toBeLessThan(100);
    }
    
    // Check that groups of balls generally stay near their dispenser's x position
    // Calculate average x position for each dispenser's balls
    const avg0X = dispenser0Balls.reduce((sum, ball) => sum + ball.position.x, 0) / dispenser0Balls.length;
    const avg1X = dispenser1Balls.reduce((sum, ball) => sum + ball.position.x, 0) / dispenser1Balls.length;
    const avg2X = dispenser2Balls.reduce((sum, ball) => sum + ball.position.x, 0) / dispenser2Balls.length;
    
    // The average positions should be somewhat near the dispensers they came from
    expect(avg0X).toBeLessThan(avg1X);
    expect(avg1X).toBeLessThan(avg2X);
  });
  
  it('should have consistent, non-explosive behavior even with many balls', () => {
    // Create many balls
    const manyBalls = dropMultipleBalls(1, 20, 2);
    
    // Run simulation for a long time
    for (let i = 0; i < 300; i++) {
      world.step(1/60);
      
      // Check if any ball has exploded after each step
      for (const ball of manyBalls) {
        // Check for NaN
        expect(isNaN(ball.position.x)).toBe(false);
        expect(isNaN(ball.position.y)).toBe(false);
        expect(isNaN(ball.position.z)).toBe(false);
        
        // Check for extremely high velocity
        expect(Math.abs(ball.velocity.x)).toBeLessThan(100);
        expect(Math.abs(ball.velocity.y)).toBeLessThan(100);
        expect(Math.abs(ball.velocity.z)).toBeLessThan(100);
      }
    }
    
    // All balls should eventually rest on ground or on other balls
    const restingBalls = manyBalls.filter(ball => {
      // Consider a ball "at rest" if its vertical velocity is very low
      return Math.abs(ball.velocity.y) < 0.1;
    });
    
    // Most balls should be at rest by now
    expect(restingBalls.length).toBeGreaterThan(manyBalls.length * 0.8); // 80% of balls
  });
}); 
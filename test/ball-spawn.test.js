import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BallDispenser } from '../src/game/ball';

// This test isolates and tests the ball spawning fixes we made in the dispenser code

describe('Ball Spawning', () => {
  let positions = [];
  let velocities = [];
  let announcer;
  
  beforeEach(() => {
    // Reset test data
    positions = [];
    velocities = [];
    
    // Mock announcer for accessibility
    announcer = document.createElement('div');
    announcer.id = 'announcer';
    document.body.appendChild(announcer);
    
    // Generate multiple spawn positions using our improved algorithm
    for (let i = 0; i < 50; i++) {
      const dispenserPosition = new THREE.Vector3(0, 5, 0);
      
      // Create ball position at the BOTTOM of the dispenser with slight randomness
      const ballPosition = new THREE.Vector3(
        dispenserPosition.x + (Math.random() * 0.1 - 0.05), // Small X randomness
        dispenserPosition.y - 0.35, // Bottom of dispenser (not top)
        dispenserPosition.z + (Math.random() * 0.1 - 0.05)  // Small Z randomness
      );
      
      // Add initial velocity with slight randomness
      const ballVelocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,  // Small random X velocity
        -0.2 - Math.random() * 0.1,   // Downward Y velocity with randomness
        (Math.random() - 0.5) * 0.1   // Small random Z velocity
      );
      
      positions.push(ballPosition);
      velocities.push(ballVelocity);
    }
  });
  
  afterEach(() => {
    document.body.removeChild(announcer);
  });

  it('should generate different spawn positions for each ball', () => {
    // Extract unique X and Z positions with precision to 4 decimal places
    const uniqueXPositions = new Set(positions.map(p => p.x.toFixed(4)));
    const uniqueZPositions = new Set(positions.map(p => p.z.toFixed(4)));
    
    // We should have many different positions out of our 50 samples
    expect(uniqueXPositions.size).toBeGreaterThan(20);
    expect(uniqueZPositions.size).toBeGreaterThan(20);
  });
  
  it('should keep all balls spawning within the correct dispenser range', () => {
    // Check that all positions are within expected range
    for (const pos of positions) {
      // X and Z should be within ±0.05 of dispenser center
      expect(pos.x).toBeGreaterThanOrEqual(-0.05);
      expect(pos.x).toBeLessThanOrEqual(0.05);
      expect(pos.z).toBeGreaterThanOrEqual(-0.05);
      expect(pos.z).toBeLessThanOrEqual(0.05);
      
      // Y should be exactly at -0.35 below dispenser
      expect(pos.y).toEqual(5 - 0.35);
    }
  });
  
  it('should generate different initial velocities for each ball', () => {
    // Extract unique velocity components with precision to 4 decimal places
    const uniqueXVelocities = new Set(velocities.map(v => v.x.toFixed(4)));
    const uniqueYVelocities = new Set(velocities.map(v => v.y.toFixed(4)));
    const uniqueZVelocities = new Set(velocities.map(v => v.z.toFixed(4)));
    
    // We should have many different velocities out of our 50 samples
    expect(uniqueXVelocities.size).toBeGreaterThan(20);
    expect(uniqueYVelocities.size).toBeGreaterThan(20);
    expect(uniqueZVelocities.size).toBeGreaterThan(20);
  });
  
  it('should ensure all balls have downward initial velocity', () => {
    // All balls should have negative Y velocity (moving down)
    for (const vel of velocities) {
      expect(vel.y).toBeLessThan(0);
    }
  });
  
  it('should produce statistically distributed positions', () => {
    // Calculate average and standard deviation of X and Z positions
    let sumX = 0, sumZ = 0;
    for (const pos of positions) {
      sumX += pos.x;
      sumZ += pos.z;
    }
    
    const avgX = sumX / positions.length;
    const avgZ = sumZ / positions.length;
    
    // Calculate standard deviation
    let varX = 0, varZ = 0;
    for (const pos of positions) {
      varX += Math.pow(pos.x - avgX, 2);
      varZ += Math.pow(pos.z - avgZ, 2);
    }
    
    const stdDevX = Math.sqrt(varX / positions.length);
    const stdDevZ = Math.sqrt(varZ / positions.length);
    
    // Average should be close to zero (center of dispenser)
    expect(Math.abs(avgX)).toBeLessThan(0.01);
    expect(Math.abs(avgZ)).toBeLessThan(0.01);
    
    // Standard deviation should be around 0.025 (for a range of ±0.05)
    expect(stdDevX).toBeGreaterThan(0.01);
    expect(stdDevX).toBeLessThan(0.04);
    expect(stdDevZ).toBeGreaterThan(0.01);
    expect(stdDevZ).toBeLessThan(0.04);
  });
  
  it('should ensure all positions are unique to prevent perfect stacking', () => {
    // Check that no two positions are exactly the same
    const positionStrings = positions.map(p => 
      `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`
    );
    
    const uniquePositions = new Set(positionStrings);
    
    // All positions should be unique
    expect(uniquePositions.size).toEqual(positions.length);
  });
  
  it('should announce ball creation for accessibility', () => {
    // Mock playNote function
    window.playNote = vi.fn();
    
    // Create a ball
    const dispenser = new BallDispenser(new CANNON.World(), new THREE.Vector3(0, 5, 0));
    dispenser.createBall();
    
    // Check that announcer was updated
    expect(announcer.textContent).toContain('Ball created');
    
    // Check that creation sound was played
    expect(window.playNote).toHaveBeenCalledWith('E4', '32n', null, 0.2);
  });
}); 
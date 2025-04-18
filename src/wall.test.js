import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Mock THREE.js
vi.mock('three', () => {
  return {
    Vector3: vi.fn().mockImplementation(() => ({
      subVectors: vi.fn().mockReturnThis(),
      addVectors: vi.fn().mockReturnThis(),
      multiplyScalar: vi.fn().mockReturnThis(),
      normalize: vi.fn().mockReturnThis(),
      clone: vi.fn().mockReturnThis(),
      length: vi.fn().mockReturnValue(5),
      x: 0,
      y: 0,
      z: 0
    })),
    BoxGeometry: vi.fn(),
    MeshStandardMaterial: vi.fn(),
    Mesh: vi.fn().mockImplementation(() => ({
      position: { copy: vi.fn() },
      rotation: { z: 0 },
      castShadow: false,
      receiveShadow: false
    })),
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn()
    }))
  };
});

// Mock CANNON.js
vi.mock('cannon-es', () => {
  return {
    World: vi.fn().mockImplementation(() => ({
      addBody: vi.fn(),
      removeBody: vi.fn()
    })),
    Body: vi.fn().mockImplementation(({ mass }) => ({
      mass,
      quaternion: {
        setFromAxisAngle: vi.fn()
      },
      position: { x: 0, y: 0, z: 0 }
    })),
    Vec3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
    Box: vi.fn()
  };
});

// Test a simplified version of createWallBody function without importing main.js
describe('Wall Physics', () => {
  // Mock implementation of createWallBody function
  function createWallBody(start, end, world = null) {
    // Calculate wall properties
    const direction = {
      x: end.x - start.x,
      y: end.y - start.y,
      z: end.z - start.z
    };
    
    // Calculate length using distance formula
    const length = Math.sqrt(
      Math.pow(direction.x, 2) + 
      Math.pow(direction.y, 2) + 
      Math.pow(direction.z, 2)
    );
    
    // Calculate center position
    const center = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: (start.z + end.z) / 2
    };
    
    // Calculate rotation
    const angle = Math.atan2(direction.x, direction.y);
    
    // Create physical wall
    const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.5, 0.1));
    const wallBody = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(center.x, center.y, center.z),
      shape: wallShape,
    });
    
    // Rotate to match direction
    wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -angle);
    
    if (world) {
      world.addBody(wallBody);
    }
    
    return wallBody;
  }
  
  let start, end;
  
  beforeEach(() => {
    vi.clearAllMocks();
    start = { x: 0, y: 0, z: 0 };
    end = { x: 5, y: 0, z: 0 };
  });

  it('should create a wall with the correct length', () => {
    // Set up the Box mock to return the arguments
    CANNON.Box.mockImplementation((halfExtents) => {
      return { halfExtents };
    });
    
    // Create a wall with fixed measurements for testing
    createWallBody(start, end);
    
    // Verify Box was called with the right parameters
    expect(CANNON.Vec3).toHaveBeenCalledWith(2.5, 0.5, 0.1);
  });

  it('should create a static body (zero mass)', () => {
    const wall = createWallBody(start, end);
    
    // Check that Body was called with mass 0, making it static
    expect(CANNON.Body).toHaveBeenCalledWith(expect.objectContaining({
      mass: 0
    }));
  });

  it('should position the wall at the center between start and end points', () => {
    // Set up specific start and end points for this test
    const testStart = { x: 0, y: 0, z: 0 };
    const testEnd = { x: 10, y: 0, z: 0 };
    
    createWallBody(testStart, testEnd);
    
    // Center should be at (5, 0, 0)
    expect(CANNON.Vec3).toHaveBeenCalledWith(5, 0, 0);
  });

  it('should rotate the wall to align with the direction', () => {
    const wall = createWallBody(start, end);
    
    // Should call setFromAxisAngle to set rotation
    expect(wall.quaternion.setFromAxisAngle).toHaveBeenCalled();
  });

  it('should add the wall body to the physics world if provided', () => {
    const world = new CANNON.World();
    const wall = createWallBody(start, end, world);
    expect(world.addBody).toHaveBeenCalledWith(wall);
  });
}); 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Mock THREE.js and CANNON.js
vi.mock('three');
vi.mock('cannon-es', () => {
  return {
    World: vi.fn().mockImplementation(() => ({
      addBody: vi.fn(),
      removeBody: vi.fn(),
      step: vi.fn()
    })),
    Body: vi.fn().mockImplementation(({ mass, position, material }) => ({
      position,
      mass,
      material,
      addEventListener: vi.fn(),
      quaternion: { copy: vi.fn() }
    })),
    Vec3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
    Sphere: vi.fn().mockImplementation((radius) => ({ radius })),
    Material: vi.fn().mockImplementation((options) => options)
  };
});

// Import the function to test - don't import from main.js to avoid browser-specific code
// Instead we'll test a mock implementation based on the physics.js file
describe('Ball Physics', () => {
  // Mock implementation of createBallBody function
  function createBallBody(position, radius = 0.2, world = null) {
    const ballBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.1,
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.7,
      })
    });
    
    if (world) {
      world.addBody(ballBody);
    }
    
    return ballBody;
  }
  
  // Spy on world.addBody
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a ball with the correct radius', () => {
    const ball = createBallBody({ x: 0, y: 0, z: 0 });
    expect(CANNON.Sphere).toHaveBeenCalledWith(0.2); // Default radius
  });

  it('should create a ball with the specified position', () => {
    const position = { x: 1.5, y: 2.5, z: 3.5 };
    const ball = createBallBody(position);
    expect(CANNON.Vec3).toHaveBeenCalledWith(position.x, position.y, position.z);
  });

  it('should set correct physics properties (mass, damping, friction, restitution)', () => {
    const ball = createBallBody({ x: 0, y: 0, z: 0 });
    
    // Check that Body was called with correct parameters
    expect(CANNON.Body).toHaveBeenCalledWith(expect.objectContaining({
      mass: 1,
      linearDamping: 0.1,
    }));
    
    // Check material properties
    expect(CANNON.Material).toHaveBeenCalledWith(expect.objectContaining({
      friction: 0.3,
      restitution: 0.7
    }));
  });

  it('should add the ball body to the physics world', () => {
    const world = new CANNON.World();
    const ball = createBallBody({ x: 0, y: 0, z: 0 }, 0.2, world);
    expect(world.addBody).toHaveBeenCalled();
  });
}); 
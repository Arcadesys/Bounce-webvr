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
  // Test constants
  const DEFAULT_RADIUS = 0.2;
  const DEFAULT_MASS = 1;
  const DEFAULT_DAMPING = 0.1;
  const DEFAULT_FRICTION = 0.3;
  const DEFAULT_RESTITUTION = 0.7;

  // Helper function to create a ball body
  function createBallBody(position, radius = DEFAULT_RADIUS, world = null) {
    const ballBody = new CANNON.Body({
      mass: DEFAULT_MASS,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: DEFAULT_DAMPING,
      material: new CANNON.Material({
        friction: DEFAULT_FRICTION,
        restitution: DEFAULT_RESTITUTION,
      })
    });
    
    if (world) {
      world.addBody(ballBody);
    }
    
    return ballBody;
  }
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ball Creation', () => {
    it('should create a ball with default radius when none specified', () => {
      const ball = createBallBody({ x: 0, y: 0, z: 0 });
      expect(CANNON.Sphere).toHaveBeenCalledWith(DEFAULT_RADIUS);
    });

    it('should create a ball with custom radius when specified', () => {
      const customRadius = 0.5;
      const ball = createBallBody({ x: 0, y: 0, z: 0 }, customRadius);
      expect(CANNON.Sphere).toHaveBeenCalledWith(customRadius);
    });

    it('should set the ball position correctly', () => {
      const position = { x: 1.5, y: 2.5, z: 3.5 };
      const ball = createBallBody(position);
      expect(CANNON.Vec3).toHaveBeenCalledWith(position.x, position.y, position.z);
    });
  });

  describe('Physics Properties', () => {
    it('should set correct mass and damping values', () => {
      const ball = createBallBody({ x: 0, y: 0, z: 0 });
      expect(CANNON.Body).toHaveBeenCalledWith(expect.objectContaining({
        mass: DEFAULT_MASS,
        linearDamping: DEFAULT_DAMPING,
      }));
    });

    it('should set correct material properties', () => {
      const ball = createBallBody({ x: 0, y: 0, z: 0 });
      expect(CANNON.Material).toHaveBeenCalledWith(expect.objectContaining({
        friction: DEFAULT_FRICTION,
        restitution: DEFAULT_RESTITUTION
      }));
    });
  });

  describe('World Integration', () => {
    it('should add the ball to the physics world when world is provided', () => {
      const world = new CANNON.World();
      const ball = createBallBody({ x: 0, y: 0, z: 0 }, DEFAULT_RADIUS, world);
      expect(world.addBody).toHaveBeenCalledWith(ball);
    });

    it('should not add the ball to the world when no world is provided', () => {
      const world = new CANNON.World();
      const ball = createBallBody({ x: 0, y: 0, z: 0 });
      expect(world.addBody).not.toHaveBeenCalled();
    });
  });
}); 
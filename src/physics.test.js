import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as CANNON from 'cannon-es';

// Mock CANNON.js
vi.mock('cannon-es', () => {
  const mockWorld = {
    addBody: vi.fn(),
    removeBody: vi.fn(),
    step: vi.fn()
  };
  
  return {
    World: vi.fn().mockImplementation(() => mockWorld),
    Body: vi.fn().mockImplementation(({ mass, position }) => ({
      mass,
      position: position || { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      quaternion: {
        setFromAxisAngle: vi.fn()
      },
      addEventListener: vi.fn()
    })),
    Vec3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
    Sphere: vi.fn().mockImplementation(radius => ({ radius })),
    Box: vi.fn().mockImplementation((x, y, z) => ({ halfExtents: { x, y, z } })),
    Material: vi.fn().mockImplementation(options => options)
  };
});

// Import the functions to test
import { 
  createPhysicsWorld, 
  createBallBody, 
  createWallBody, 
  updatePhysics,
  isBallOutOfBounds
} from './physics.js';

describe('Physics Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('createPhysicsWorld', () => {
    it('should create a world with default gravity', () => {
      const world = createPhysicsWorld();
      expect(CANNON.World).toHaveBeenCalledWith(expect.objectContaining({
        gravity: expect.anything()
      }));
      expect(CANNON.Vec3).toHaveBeenCalledWith(0, -9.82, 0);
    });
  });
  
  describe('createBallBody', () => {
    it('should create a ball with specified position', () => {
      const position = { x: 1, y: 2, z: 3 };
      const ball = createBallBody(position);
      
      expect(CANNON.Body).toHaveBeenCalledWith(expect.objectContaining({
        mass: 1,
        position: expect.anything()
      }));
      
      expect(CANNON.Vec3).toHaveBeenCalledWith(position.x, position.y, position.z);
    });
    
    it('should use the default radius if not specified', () => {
      createBallBody({ x: 0, y: 0, z: 0 });
      expect(CANNON.Sphere).toHaveBeenCalledWith(0.2); // Default radius
    });
    
    it('should use the specified radius', () => {
      const radius = 0.5;
      createBallBody({ x: 0, y: 0, z: 0 }, radius);
      expect(CANNON.Sphere).toHaveBeenCalledWith(radius);
    });
    
    it('should set the correct material properties', () => {
      createBallBody({ x: 0, y: 0, z: 0 });
      expect(CANNON.Material).toHaveBeenCalledWith(expect.objectContaining({
        friction: 0.3,
        restitution: 0.7
      }));
    });
    
    it('should add the ball to the world if provided', () => {
      const world = createPhysicsWorld();
      const ball = createBallBody({ x: 0, y: 0, z: 0 }, 0.2, world);
      
      expect(world.addBody).toHaveBeenCalledWith(ball);
    });
    
    it('should not add the ball to the world if not provided', () => {
      const world = createPhysicsWorld();
      createBallBody({ x: 0, y: 0, z: 0 });
      
      expect(world.addBody).not.toHaveBeenCalled();
    });
  });
  
  describe('createWallBody', () => {
    it('should create a wall between two points', () => {
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 5, y: 0, z: 0 };
      
      const wall = createWallBody(start, end);
      
      expect(CANNON.Body).toHaveBeenCalledWith(expect.objectContaining({
        mass: 0, // Static body
        position: expect.anything()
      }));
    });
    
    it('should calculate the correct length', () => {
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 3, y: 4, z: 0 };
      // Length should be 5 (Pythagorean theorem: 3-4-5 triangle)
      
      createWallBody(start, end);
      
      // Half-length for CANNON.Box is length/2
      expect(CANNON.Box).toHaveBeenCalledWith(expect.objectContaining({
        x: 2.5,
        y: 0.5,
        z: 0.1
      }));
    });
    
    it('should position the wall at the midpoint', () => {
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 10, y: 20, z: 30 };
      const expectedCenter = { x: 5, y: 10, z: 15 };
      
      createWallBody(start, end);
      
      expect(CANNON.Vec3).toHaveBeenCalledWith(
        expectedCenter.x, 
        expectedCenter.y, 
        expectedCenter.z
      );
    });
    
    it('should set the correct rotation', () => {
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 1, y: 1, z: 0 };
      
      const wall = createWallBody(start, end);
      
      expect(wall.quaternion.setFromAxisAngle).toHaveBeenCalled();
    });
    
    it('should add the wall to the world if provided', () => {
      const world = createPhysicsWorld();
      const start = { x: 0, y: 0, z: 0 };
      const end = { x: 5, y: 0, z: 0 };
      
      const wall = createWallBody(start, end, world);
      
      expect(world.addBody).toHaveBeenCalledWith(wall);
    });
  });
  
  describe('updatePhysics', () => {
    it('should call step on the world with the right timestep', () => {
      const world = createPhysicsWorld();
      const timeStep = 1/60;
      
      updatePhysics(world, timeStep);
      
      expect(world.step).toHaveBeenCalledWith(timeStep);
    });
    
    it('should use the default timestep if not provided', () => {
      const world = createPhysicsWorld();
      
      updatePhysics(world);
      
      expect(world.step).toHaveBeenCalledWith(1/60);
    });
  });
  
  describe('isBallOutOfBounds', () => {
    it('should return true if the ball is below the lower bound', () => {
      const ball = { position: { y: -15 } };
      
      const result = isBallOutOfBounds(ball);
      
      expect(result).toBe(true);
    });
    
    it('should return false if the ball is above the lower bound', () => {
      const ball = { position: { y: -5 } };
      
      const result = isBallOutOfBounds(ball, -10);
      
      expect(result).toBe(false);
    });
    
    it('should use the provided lower bound', () => {
      const ball = { position: { y: -25 } };
      
      const result = isBallOutOfBounds(ball, -20);
      
      expect(result).toBe(true);
    });
  });
}); 
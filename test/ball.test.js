import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Ball, BallDispenser } from '../src/game/ball';

// Mock THREE.js and CANNON.js
vi.mock('three');
vi.mock('cannon-es');

describe('Ball', () => {
  let world;
  let ball;
  const position = { x: 0, y: 0, z: 0 };

  beforeEach(() => {
    vi.clearAllMocks();
    world = new CANNON.World();
    ball = new Ball(world, position);
  });

  it('should create a ball with correct properties', () => {
    expect(ball.radius).toBe(0.1);
    expect(ball.mass).toBe(0.05);
    expect(ball.body.position).toEqual(expect.objectContaining(position));
  });

  it('should set initial velocity and angular velocity', () => {
    expect(ball.body.velocity).toEqual(expect.objectContaining({
      x: 0,
      y: -0.25,
      z: 0
    }));
    expect(ball.body.angularVelocity).toEqual(expect.objectContaining({
      x: 0,
      y: 0,
      z: 0
    }));
  });

  it('should mark the ball for collision detection', () => {
    expect(ball.body.userData).toEqual({ isBall: true });
  });

  it('should update mesh position and rotation', () => {
    const newPosition = new CANNON.Vec3(1, 2, 3);
    const newQuaternion = new CANNON.Quaternion(1, 0, 0, 0);
    
    ball.body.position.copy(newPosition);
    ball.body.quaternion.copy(newQuaternion);
    
    ball.update();
    
    expect(ball.mesh.position).toEqual(expect.objectContaining(newPosition));
    expect(ball.mesh.quaternion).toEqual(expect.objectContaining(newQuaternion));
  });

  it('should cleanup properly', () => {
    ball.cleanup();
    expect(world.removeBody).toHaveBeenCalledWith(ball.body);
  });
});

describe('BallDispenser', () => {
  // Test constants matching implementation
  const DEFAULT_RADIUS = 0.1;
  const DEFAULT_MASS = 0.05;
  const DEFAULT_LINEAR_DAMPING = 0.01;
  const DEFAULT_ANGULAR_DAMPING = 0.01;
  const DEFAULT_POSITION = { x: 0, y: 0, z: 0 };

  let world;
  let dispenser;

  beforeEach(() => {
    vi.clearAllMocks();
    world = new CANNON.World();
    dispenser = new BallDispenser(world, DEFAULT_POSITION);
  });

  describe('Ball Creation', () => {
    it('should create a ball with correct radius', () => {
      const ball = dispenser.createBall();
      expect(CANNON.Sphere).toHaveBeenCalledWith(DEFAULT_RADIUS);
    });

    it('should create a ball with correct mass', () => {
      const ball = dispenser.createBall();
      expect(CANNON.Body).toHaveBeenCalledWith(expect.objectContaining({
        mass: DEFAULT_MASS,
      }));
    });

    it('should set the ball position with correct offset', () => {
      const ball = dispenser.createBall();
      expect(CANNON.Vec3).toHaveBeenCalledWith(
        DEFAULT_POSITION.x,
        DEFAULT_POSITION.y - 0.35, // Implementation offset
        DEFAULT_POSITION.z
      );
    });

    it('should set initial velocity and angular velocity', () => {
      const ball = dispenser.createBall();
      expect(ball.body.velocity.set).toHaveBeenCalledWith(0, -0.25, 0);
      expect(ball.body.angularVelocity.set).toHaveBeenCalledWith(0, 0, 0);
    });

    it('should mark the ball for collision detection', () => {
      const ball = dispenser.createBall();
      expect(ball.body.userData).toEqual({ isBall: true });
    });
  });

  describe('Physics Properties', () => {
    it('should set correct damping values', () => {
      const ball = dispenser.createBall();
      expect(CANNON.Body).toHaveBeenCalledWith(expect.objectContaining({
        linearDamping: DEFAULT_LINEAR_DAMPING,
        angularDamping: DEFAULT_ANGULAR_DAMPING,
      }));
    });
  });

  describe('World Integration', () => {
    it('should add the ball to the physics world', () => {
      const ball = dispenser.createBall();
      expect(world.addBody).toHaveBeenCalledWith(ball.body);
    });
  });

  describe('Ball Management', () => {
    it('should track created balls', () => {
      const ball1 = dispenser.createBall();
      const ball2 = dispenser.createBall();
      expect(dispenser.balls).toHaveLength(2);
      expect(dispenser.balls).toContain(ball1);
      expect(dispenser.balls).toContain(ball2);
    });

    it('should cleanup balls properly', () => {
      const ball = dispenser.createBall();
      dispenser.cleanup();
      expect(world.removeBody).toHaveBeenCalledWith(ball.body);
      expect(dispenser.balls).toHaveLength(0);
    });
  });

  describe('Mesh Management', () => {
    it('should create a mesh for each ball', () => {
      dispenser.createBall();
      expect(THREE.SphereGeometry).toHaveBeenCalledWith(DEFAULT_RADIUS);
      expect(THREE.MeshBasicMaterial).toHaveBeenCalledWith({ color: 0xffffff });
      expect(THREE.Mesh).toHaveBeenCalled();
    });
  });
}); 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Ball } from '../src/game/ball';

// Mock THREE.js and CANNON.js
vi.mock('three');

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
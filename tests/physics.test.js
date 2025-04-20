import { PhysicsWorld } from '../src/physics';
import * as CANNON from 'cannon-es';

describe('PhysicsWorld', () => {
  let physics;
  
  beforeEach(() => {
    physics = new PhysicsWorld();
  });

  // ... existing tests ...

  describe('collision handling', () => {
    test('collision listeners are called on contact', () => {
      const listener = jest.fn();
      physics.addCollisionListener(listener);
      
      const ball1 = physics.createBall(1, 0, 0);
      const ball2 = physics.createBall(1, 2, 0);
      
      // Move balls to collide
      ball1.position.set(0, 0, 0);
      ball2.position.set(1.5, 0, 0);
      ball1.velocity.set(1, 0, 0);
      ball2.velocity.set(-1, 0, 0);
      
      physics.update(1/60);
      
      expect(listener).toHaveBeenCalled();
    });

    test('impulse application affects velocity', () => {
      const ball = physics.createBall(1, 0, 0);
      const impulse = new CANNON.Vec3(1, 0, 0);
      const point = new CANNON.Vec3(0, 0, 0);
      
      physics.applyImpulse(ball, impulse, point);
      
      expect(ball.velocity.x).toBeGreaterThan(0);
    });

    test('velocity at point calculation', () => {
      const ball = physics.createBall(1, 0, 0);
      ball.velocity.set(1, 0, 0);
      ball.angularVelocity.set(0, 1, 0);
      
      const point = new CANNON.Vec3(1, 0, 0);
      const velocity = physics.getVelocityAtPoint(ball, point);
      
      expect(velocity).toBeDefined();
      expect(velocity.x).toBeDefined();
      expect(velocity.y).toBeDefined();
      expect(velocity.z).toBeDefined();
    });
  });
}); 
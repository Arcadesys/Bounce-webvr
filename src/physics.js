import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    this.bodies = new Set();
    this.staticBodies = new Set();
    this.collisionListeners = new Set();
    
    // Set up collision event handling
    this.world.addEventListener('beginContact', (event) => {
      const { bodyA, bodyB } = event;
      this.collisionListeners.forEach(listener => {
        try {
          listener({ bodyA, bodyB });
        } catch (error) {
          console.error('Error in collision listener:', error);
        }
      });
    });
  }

  createBoundaries(width, height, depth) {
    // Ground
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);
    this.staticBodies.add(groundBody);

    // Walls
    const wallMaterial = new CANNON.Material('wall');
    const wallContactMaterial = new CANNON.ContactMaterial(
      wallMaterial,
      wallMaterial,
      { friction: 0.3, restitution: 0.7 }
    );
    this.world.addContactMaterial(wallContactMaterial);

    // Left wall
    const leftWallShape = new CANNON.Box(new CANNON.Vec3(0.1, height/2, depth/2));
    const leftWallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
    leftWallBody.addShape(leftWallShape);
    leftWallBody.position.set(-width/2, height/2, 0);
    this.world.addBody(leftWallBody);
    this.staticBodies.add(leftWallBody);

    // Right wall
    const rightWallShape = new CANNON.Box(new CANNON.Vec3(0.1, height/2, depth/2));
    const rightWallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
    rightWallBody.addShape(rightWallShape);
    rightWallBody.position.set(width/2, height/2, 0);
    this.world.addBody(rightWallBody);
    this.staticBodies.add(rightWallBody);

    // Front wall
    const frontWallShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, 0.1));
    const frontWallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
    frontWallBody.addShape(frontWallShape);
    frontWallBody.position.set(0, height/2, -depth/2);
    this.world.addBody(frontWallBody);
    this.staticBodies.add(frontWallBody);

    // Back wall
    const backWallShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, 0.1));
    const backWallBody = new CANNON.Body({ mass: 0, material: wallMaterial });
    backWallBody.addShape(backWallShape);
    backWallBody.position.set(0, height/2, depth/2);
    this.world.addBody(backWallBody);
    this.staticBodies.add(backWallBody);
  }

  createBall(radius, mass, position) {
    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({ mass });
    body.addShape(shape);
    body.position.copy(position);
    this.world.addBody(body);
    this.bodies.add(body);
    return body;
  }

  update(deltaTime) {
    this.world.step(deltaTime);
  }

  checkCollision(body1, body2) {
    return this.world.broadphase.canCollide(body1, body2);
  }

  removeBody(body) {
    this.world.removeBody(body);
    this.bodies.delete(body);
  }

  addCollisionListener(listener) {
    this.collisionListeners.add(listener);
  }

  removeCollisionListener(listener) {
    this.collisionListeners.delete(listener);
  }

  applyImpulse(body, impulse, worldPoint) {
    body.applyImpulse(impulse, worldPoint);
  }

  getVelocityAtPoint(body, point) {
    return body.getVelocityAtPoint(point, new CANNON.Vec3());
  }
} 
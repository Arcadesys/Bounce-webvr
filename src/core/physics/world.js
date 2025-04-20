import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Set up collision detection
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 20;
    this.world.solver.tolerance = 0.001;
    
    // Create materials
    this.ballMaterial = new CANNON.Material('ballMaterial');
    this.wallMaterial = new CANNON.Material('wallMaterial');
    
    // Create contact material between balls and walls
    const ballWallContact = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.wallMaterial,
      {
        friction: 0.1,
        restitution: 0.9,
        contactEquationRelaxation: 3,
        contactEquationStiffness: 1e6
      }
    );
    
    // Create contact material between balls
    const ballBallContact = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.ballMaterial,
      {
        friction: 0.0,
        restitution: 0.9,
        contactEquationRelaxation: 3,
        contactEquationStiffness: 1e6
      }
    );
    
    this.world.addContactMaterial(ballWallContact);
    this.world.addContactMaterial(ballBallContact);
    
    // Set default contact material
    this.world.defaultContactMaterial.friction = 0.1;
    this.world.defaultContactMaterial.restitution = 0.9;
    
    // Track bodies
    this.bodies = new Set();
  }
  
  createBall(radius, mass, position) {
    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
      mass: mass,
      shape: shape,
      material: this.ballMaterial,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.01,
      angularDamping: 0.01,
      allowSleep: false // Prevent bodies from sleeping
    });
    
    this.world.addBody(body);
    this.bodies.add(body);
    return body;
  }
  
  createWall(start, end) {
    // Calculate wall dimensions
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Create wall shape - thicker to prevent tunneling
    const shape = new CANNON.Box(new CANNON.Vec3(length/2, 0.5, 0.5));
    const body = new CANNON.Body({
      mass: 0, // Static body
      shape: shape,
      material: this.wallMaterial,
      position: new CANNON.Vec3(center.x, center.y, center.z)
    });
    
    // Calculate rotation
    const angle = Math.atan2(direction.y, direction.x);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
    
    this.world.addBody(body);
    this.bodies.add(body);
    return body;
  }
  
  update(timestep = 1/60) {
    // Allow variable timestep
    this.world.step(timestep);
  }
  
  cleanup() {
    this.bodies.forEach(body => {
      this.world.removeBody(body);
    });
    this.bodies.clear();
  }
  
  removeBody(body) {
    this.world.removeBody(body);
    this.bodies.delete(body);
  }
  
  setGravity(x, y, z) {
    this.world.gravity.set(x, y, z);
  }
} 
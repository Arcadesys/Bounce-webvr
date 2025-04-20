import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Improve solver for better physics
    this.world.solver.iterations = 20;
    this.world.solver.tolerance = 0.0001;
    
    // Create materials
    this.ballMaterial = new CANNON.Material("ballMaterial");
    this.platformMaterial = new CANNON.Material("platformMaterial");
    
    // Configure materials with very low friction
    this.ballMaterial.friction = 0.01;
    this.ballMaterial.restitution = 0.9;
    
    this.platformMaterial.friction = 0.01;
    this.platformMaterial.restitution = 0.9;
    
    // Create contact material with minimal friction
    this.contactMaterial = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.platformMaterial,
      {
        friction: 0.01,
        restitution: 0.9,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e6,
        contactEquationStiffness: 1e6
      }
    );
    
    this.world.addContactMaterial(this.contactMaterial);
    
    // Create ground plane
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.platformMaterial
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.position.y = -4;
    groundBody.position.z = 0.1; // Move slightly forward in Z
    groundBody.userData = { isGround: true };
    this.world.addBody(groundBody);
  }
  
  step(dt) {
    this.world.step(1/60, dt);
  }
  
  addBody(body) {
    this.world.addBody(body);
  }
  
  removeBody(body) {
    this.world.removeBody(body);
  }
  
  // Helper method to create boundary walls
  createBoundary(x, y, length, width, rotX, rotY) {
    const boundaryShape = new CANNON.Box(new CANNON.Vec3(width/2, length/2, 0.1));
    const boundaryBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y, 0),
      shape: boundaryShape,
      material: this.platformMaterial
    });
    
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotX);
    boundaryBody.quaternion.copy(quat);
    
    boundaryBody.userData = {
      isBoundary: true,
      restitution: 0.7
    };
    
    this.world.addBody(boundaryBody);
    return boundaryBody;
  }
} 
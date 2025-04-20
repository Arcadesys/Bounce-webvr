import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Improve solver for better physics
    this.world.solver.iterations = 10;
    this.world.solver.tolerance = 0.001;
    
    // Create materials
    this.ballMaterial = new CANNON.Material("ballMaterial");
    this.platformMaterial = new CANNON.Material("platformMaterial");
    
    // Configure materials
    this.ballMaterial.friction = 0.2;
    this.ballMaterial.restitution = 0.8;
    
    this.platformMaterial.friction = 0.3;
    this.platformMaterial.restitution = 0.9;
    
    // Create contact material
    this.contactMaterial = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.platformMaterial,
      {
        friction: 0.1,
        restitution: 0.97,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e7,
        contactEquationStiffness: 1e8
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
    groundBody.position.y = -2;
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
    const boundaryShape = new CANNON.Box(new CANNON.Vec3(length/2, width/2, 0.1));
    const boundaryBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y, 0),
      shape: boundaryShape,
      material: this.platformMaterial
    });
    
    const quat = new CANNON.Quaternion();
    quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), rotX);
    const quat2 = new CANNON.Quaternion();
    quat2.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    quat.mult(quat2, quat);
    boundaryBody.quaternion.copy(quat);
    
    boundaryBody.userData = {
      isBoundary: true,
      restitution: 0.97
    };
    
    this.world.addBody(boundaryBody);
    return boundaryBody;
  }
} 
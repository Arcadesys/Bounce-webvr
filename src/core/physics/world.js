import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Improve solver for better physics
    this.world.solver.iterations = 50;
    this.world.solver.tolerance = 0.0001;
    
    // Define collision groups
    this.COLLISION_GROUPS = {
      BALLS: 1,
      WALLS: 2
    };
    
    // Create materials
    this.ballMaterial = new CANNON.Material("ballMaterial");
    this.platformMaterial = new CANNON.Material("platformMaterial");
    
    // Configure materials with very low friction
    this.ballMaterial.friction = 0.01;
    this.ballMaterial.restitution = 0.9;
    
    this.platformMaterial.friction = 0.01;
    this.platformMaterial.restitution = 0.9;
    
    // Create contact material with improved settings
    this.contactMaterial = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.platformMaterial,
      {
        friction: 0.01,
        restitution: 0.9,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e7,
        contactEquationStiffness: 1e7,
        frictionEquationRegularizationTime: 3
      }
    );
    
    // Create ball-to-ball contact material that allows passing through
    this.ballContactMaterial = new CANNON.ContactMaterial(
      this.ballMaterial,
      this.ballMaterial,
      {
        friction: 0,
        restitution: 0,
        contactEquationStiffness: 0,  // Zero stiffness means no collision response
        frictionEquationStiffness: 0
      }
    );
    
    this.world.addContactMaterial(this.contactMaterial);
    this.world.addContactMaterial(this.ballContactMaterial);
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
    
    // Fix rotation to use proper axis
    const quat = new CANNON.Quaternion();
    if (rotX !== 0) {
      quat.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotX);
    }
    if (rotY !== 0) {
      const quatY = new CANNON.Quaternion();
      quatY.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
      quat.mult(quatY, quat);
    }
    boundaryBody.quaternion.copy(quat);
    
    boundaryBody.userData = {
      isBoundary: true,
      restitution: 0.7
    };
    
    this.world.addBody(boundaryBody);
    return boundaryBody;
  }
} 
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class BallDispenser {
  constructor(world, position) {
    this.world = world;
    this.position = position;
    this.balls = [];
    this.ballMaterial = new CANNON.Material("ballMaterial");
    this.ballRadius = 0.1;
    this.ballMass = 0.05;
  }

  createBall() {
    const sphereShape = new CANNON.Sphere(this.ballRadius);
    const sphereBody = new CANNON.Body({
      mass: this.ballMass,
      shape: sphereShape,
      position: new CANNON.Vec3(
        this.position.x,
        this.position.y - 0.35, // Offset to prevent immediate collision
        this.position.z
      ),
      material: this.ballMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    
    // Add initial deterministic velocity
    sphereBody.velocity.set(0, -0.25, 0);
    sphereBody.angularVelocity.set(0, 0, 0);
    
    this.world.addBody(sphereBody);
    
    // Create a simple mesh (not rendering in tests)
    const sphereGeometry = new THREE.SphereGeometry(this.ballRadius);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    
    const ball = { body: sphereBody, mesh: sphere };
    this.balls.push(ball);
    
    return ball;
  }

  update() {
    // Update mesh positions to match physics bodies
    this.balls.forEach(ball => {
      ball.mesh.position.copy(ball.body.position);
      ball.mesh.quaternion.copy(ball.body.quaternion);
    });
  }

  cleanup() {
    this.balls.forEach(ball => {
      this.world.removeBody(ball.body);
    });
    this.balls = [];
  }
} 
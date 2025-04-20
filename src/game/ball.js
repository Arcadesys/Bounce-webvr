import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Ball {
  constructor(world, position) {
    this.world = world;
    this.radius = 0.1;
    this.mass = 0.05;
    
    const sphereShape = new CANNON.Sphere(this.radius);
    this.body = new CANNON.Body({
      mass: this.mass,
      shape: sphereShape,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      material: world.ballMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    
    // Mark as ball for collision detection
    this.body.userData = { isBall: true };
    
    // Add initial deterministic velocity
    this.body.velocity.set(0, -0.25, 0);
    this.body.angularVelocity.set(0, 0, 0);
    
    this.world.addBody(this.body);
    
    // Create mesh
    const sphereGeometry = new THREE.SphereGeometry(this.radius);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    
    // Set up collision event handling
    this.body.addEventListener('collide', this.handleCollision.bind(this));
  }

  handleCollision(event) {
    const velocity = Math.abs(event.contact.getImpactVelocityAlongNormal());
    
    // Only process significant collisions
    if (velocity > 0.5) {
      // Play collision sound
      if (window.playNote) {
        const intensity = Math.min(velocity / 10, 1);
        window.playNote('C4', '32n', null, intensity * 0.2);
      }
      
      // Announce collision for accessibility
      const announcer = document.getElementById('announcer');
      if (announcer) {
        const intensity = velocity > 5 ? 'strong' : velocity > 2 ? 'medium' : 'soft';
        announcer.textContent = `${intensity} collision`;
      }
    }
  }

  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  cleanup() {
    this.world.removeBody(this.body);
  }
}

export class BallDispenser {
  constructor(world, position) {
    this.world = world;
    this.position = position;
    this.balls = [];
    this.ballRadius = 0.1;
    this.ballMass = 0.05;
  }

  createBall() {
    // Add slight randomness to position
    const randomOffset = 0.05; // Maximum offset from center
    const positionOffset = {
      x: (Math.random() * 2 - 1) * randomOffset,
      y: -0.35, // Fixed offset to prevent immediate collision
      z: (Math.random() * 2 - 1) * randomOffset
    };

    const ball = new Ball(this.world, {
      x: this.position.x + positionOffset.x,
      y: this.position.y + positionOffset.y,
      z: this.position.z + positionOffset.z
    });
    
    // Add initial velocity with slight randomness
    const velocityRandomness = 0.1;
    ball.body.velocity.set(
      (Math.random() * 2 - 1) * velocityRandomness,
      -0.25 - Math.random() * 0.1, // Slightly randomized downward velocity
      (Math.random() * 2 - 1) * velocityRandomness
    );
    
    this.balls.push(ball);
    
    // Announce ball creation for accessibility
    const announcer = document.getElementById('announcer');
    if (announcer) {
      announcer.textContent = 'Ball created';
    }
    
    // Play creation sound
    if (window.playNote) {
      window.playNote('E4', '32n', null, 0.2);
    }
    
    return ball;
  }

  update() {
    // Update mesh positions to match physics bodies
    this.balls.forEach(ball => ball.update());
  }

  cleanup() {
    this.balls.forEach(ball => ball.cleanup());
    this.balls = [];
  }
} 
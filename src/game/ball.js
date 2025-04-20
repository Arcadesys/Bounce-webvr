import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class Ball {
  constructor(position, radius = 0.1, world, options = {}) {
    this.radius = radius;
    this.mass = 0.05;
    this.world = world;  // Store world reference
    this.isDeterministic = options.isDeterministic ?? true; // Default to deterministic mode
    
    // Create physics body
    this.body = new CANNON.Body({
      mass: this.mass,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      material: world.ballMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01
    });
    
    // Add initial downward velocity
    this.body.velocity.set(0, -2, 0);
    
    // Create visual mesh
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.3,
      metalness: 0.7,
      emissive: new THREE.Color(0x111111),
      emissiveIntensity: 0.1,
      envMapIntensity: 0.5
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Add to world
    world.addBody(this.body);
    
    // Set up collision handling
    this.setupCollisionHandling(world);
  }
  
  setupCollisionHandling(world) {
    this.body.addEventListener('collide', (event) => {
      const targetBody = event.body;
      
      // Only handle collisions with walls
      if (targetBody.userData && targetBody.userData.isWall) {
        const contactNormal = event.contact.ni;
        const impactVelocity = this.body.velocity.dot(contactNormal);
        
        const restitution = 0.9;
        const bounce = -impactVelocity * (1 + restitution);
        
        const impulse = new CANNON.Vec3(
          contactNormal.x * bounce * this.mass,
          contactNormal.y * bounce * this.mass,
          contactNormal.z * bounce * this.mass
        );
        
        this.body.applyImpulse(impulse, this.body.position);
        
        // Only apply random impulse if not in deterministic mode
        if (!this.isDeterministic) {
          const randomImpulse = new CANNON.Vec3(
            (Math.random() - 0.5) * 0.0005,
            (Math.random() - 0.5) * 0.0005,
            (Math.random() - 0.5) * 0.0005
          );
          this.body.applyImpulse(randomImpulse, this.body.position);
        }
        
        // Emit collision event for sound handling
        const collisionEvent = new CustomEvent('ballCollision', {
          detail: {
            velocity: impactVelocity,
            wallLength: targetBody.userData.length,
            position: this.body.position
          }
        });
        window.dispatchEvent(collisionEvent);
      }
    });
  }
  
  update() {
    // Update visual position to match physics
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    
    // Check if ball is out of viewport bounds
    const viewportBounds = {
      left: -10,
      right: 10,
      top: 10,
      bottom: -10
    };
    
    const pos = this.body.position;
    
    // Check if ball has extremely low velocity and is near the bottom
    const isStuck = this.body.velocity.lengthSquared() < 0.0001 && pos.y < -9;
    
    if (pos.x < viewportBounds.left ||
        pos.x > viewportBounds.right ||
        pos.y < viewportBounds.bottom ||
        pos.y > viewportBounds.top ||
        isStuck) {
      return true; // Signal that ball should be removed
    }
    
    // Only apply extra damping at very low velocities
    if (this.body.velocity.lengthSquared() < 0.01) {
      this.body.linearDamping = Math.min(this.body.linearDamping * 1.01, 0.1);
      
      // Add tiny random impulse to prevent perfect stacking only if not deterministic
      if (!this.isDeterministic && Math.random() < 0.1) { // 10% chance each update
        const tinyImpulse = new CANNON.Vec3(
          (Math.random() - 0.5) * 0.0001,
          (Math.random() - 0.5) * 0.0001,
          (Math.random() - 0.5) * 0.0001
        );
        this.body.applyImpulse(tinyImpulse, this.body.position);
      }
    } else {
      this.body.linearDamping = 0.01;  // Reset damping when moving
    }
    
    return false; // Ball still in play
  }
  
  shouldRemove(camera) {
    // Create a frustum from the camera
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    
    // Check if the ball's position is outside the frustum
    return !frustum.containsPoint(this.mesh.position);
  }
  
  dispose(scene, world) {
    scene.remove(this.mesh);
    world.removeBody(this.body);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
} 
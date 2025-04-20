import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class Ball {
  constructor(position, radius = 0.1, world) {
    this.radius = radius;
    this.mass = 0.05;
    
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
    this.body.velocity.set(0, -0.2, 0);
    
    // Create visual mesh
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.2,
      metalness: 0.1
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
      
      if (targetBody.userData && targetBody.userData.isWall) {
        const contactNormal = event.contact.ni;
        const impactVelocity = this.body.velocity.dot(contactNormal);
        
        const restitution = 0.97;
        const bounce = -impactVelocity * (1 + restitution);
        
        const impulse = new CANNON.Vec3(
          contactNormal.x * bounce * this.mass,
          contactNormal.y * bounce * this.mass,
          contactNormal.z * bounce * this.mass
        );
        
        this.body.applyImpulse(impulse, this.body.position);
        
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
      
      if (targetBody.userData && targetBody.userData.isGround) {
        this.body.userData = this.body.userData || {};
        this.body.userData.shouldRemove = true;
      }
    });
  }
  
  update() {
    // Update visual position to match physics
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    
    // Apply additional damping when nearly at rest
    if (this.body.velocity.lengthSquared() < 0.05) {
      this.body.linearDamping = Math.min(this.body.linearDamping * 1.01, 0.95);
    }
  }
  
  shouldRemove() {
    return (this.body.userData && this.body.userData.shouldRemove) || 
           this.body.position.y < -10;
  }
  
  dispose(scene, world) {
    scene.remove(this.mesh);
    world.removeBody(this.body);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
} 
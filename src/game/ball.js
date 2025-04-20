import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class Ball {
  constructor(position, radius = 0.1, world) {
    this.radius = radius;
    this.mass = 0.05;
    this.world = world;  // Store world reference
    
    // Create physics body
    this.body = new CANNON.Body({
      mass: this.mass,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      material: world.ballMaterial,
      linearDamping: 0.01,
      angularDamping: 0.01,
      // Set collision groups - only collide with walls, not other balls
      collisionFilterGroup: world.COLLISION_GROUPS.BALLS,
      collisionFilterMask: world.COLLISION_GROUPS.WALLS
    });
    
    // Add initial downward velocity
    this.body.velocity.set(0, -2, 0);
    
    // Create visual mesh
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.1,
      metalness: 0.3,
      emissive: new THREE.Color(0x111111),
      emissiveIntensity: 0.1
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
      
      // Only handle collisions with walls, ignore ball-to-ball collisions
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
        
        // Smaller random impulse to maintain momentum
        const randomImpulse = new CANNON.Vec3(
          (Math.random() - 0.5) * 0.0005,
          (Math.random() - 0.5) * 0.0005,
          (Math.random() - 0.5) * 0.0005
        );
        this.body.applyImpulse(randomImpulse, this.body.position);
        
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
      // For ball-to-ball collisions, do nothing - they should pass through each other
    });
  }
  
  update() {
    // Update visual position to match physics
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    
    // Only apply extra damping at very low velocities
    if (this.body.velocity.lengthSquared() < 0.01) {
      this.body.linearDamping = Math.min(this.body.linearDamping * 1.01, 0.1);
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
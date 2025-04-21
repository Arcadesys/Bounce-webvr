import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { VisualConfig, getVelocityFactor, getOscillatingIntensity } from '../core/config/visualConfig.js';

class FlashEffect {
  constructor(position, intensity) {
    const geometry = new THREE.SphereGeometry(0.2, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 0.8, 0.2),
      transparent: true,
      opacity: 1
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    
    this.startTime = performance.now();
    this.duration = VisualConfig.ball.collision.flashDuration;
    this.intensity = intensity;
  }
  
  update() {
    const elapsed = performance.now() - this.startTime;
    if (elapsed > this.duration) {
      return true; // Signal to remove
    }
    
    const t = elapsed / this.duration;
    const baseOpacity = (1 - t) * this.intensity;
    this.mesh.material.opacity = getOscillatingIntensity(t, baseOpacity);
    this.mesh.scale.setScalar(1 + t * 0.5); // Slight expansion effect
    
    return false;
  }
  
  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

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
    const config = VisualConfig.ball.base;
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: config.roughness,
      metalness: config.metalness,
      emissive: new THREE.Color(config.emissiveColor),
      emissiveIntensity: config.emissiveIntensity,
      envMapIntensity: config.envMapIntensity
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Store original material properties
    this.originalEmissiveIntensity = config.emissiveIntensity;
    this.isGlowing = false;
    this.glowStartTime = 0;
    this.GLOW_DURATION = VisualConfig.ball.collision.flashDuration;
    
    // Add to world
    world.addBody(this.body);
    
    // Set up collision handling
    this.setupCollisionHandling(world);
    
    this.flashEffects = [];
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
        
        // Create flash effect at collision point
        const velocityFactor = getVelocityFactor(impactVelocity);
        const flashEffect = new FlashEffect(this.body.position, velocityFactor);
        this.flashEffects.push(flashEffect);
        
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
  
  startSparkle(impactVelocity) {
    const config = VisualConfig.ball.collision;
    this.isGlowing = true;
    this.glowStartTime = performance.now();
    // Scale the glow intensity with impact velocity
    const velocityFactor = getVelocityFactor(impactVelocity);
    this.mesh.material.emissiveIntensity = config.maxFlashIntensity * velocityFactor;
    // Set to warm yellow color (RGB: 1, 0.8, 0.2)
    this.mesh.material.emissive.setRGB(1, 0.8, 0.2);
  }
  
  updateSparkle() {
    if (this.isGlowing) {
      const elapsed = performance.now() - this.glowStartTime;
      if (elapsed > this.GLOW_DURATION) {
        this.isGlowing = false;
        this.mesh.material.emissiveIntensity = this.originalEmissiveIntensity;
        this.mesh.material.emissive.setRGB(0.2, 0.2, 0.2);
      } else {
        const t = elapsed / this.GLOW_DURATION;
        const baseIntensity = this.mesh.material.emissiveIntensity * (1 - t);
        this.mesh.material.emissiveIntensity = getOscillatingIntensity(t, baseIntensity);
      }
    }
  }
  
  update() {
    // Update visual position to match physics
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    
    // Update flash effects
    this.flashEffects = this.flashEffects.filter(effect => !effect.update());
    
    // Update sparkle effect
    this.updateSparkle();
    
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
    // Clean up flash effects
    this.flashEffects.forEach(effect => effect.dispose(scene));
    this.flashEffects = [];
    
    scene.remove(this.mesh);
    world.removeBody(this.body);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
} 
import * as THREE from 'three';
import { Ball } from './ball.js';

export class Dispenser {
  constructor(position, world, options = {}) {
    this.position = position.clone();
    this.world = world;
    this.lastSpawnTime = 0;
    this.spawnInterval = 1000; // 1 second between spawns
    this.isDeterministic = options.isDeterministic ?? true; // Default to deterministic mode
    this.id = Math.random().toString(36).substr(2, 9); // Generate unique ID
    this.isSequenced = options.isSequenced ?? false; // Whether this dispenser follows the sequencer
    
    // Create visual mesh for dispenser
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.3,
      metalness: 0.8,
      emissive: new THREE.Color(0x444444),
      emissiveIntensity: 0.2,
      envMapIntensity: 0.8
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Store original color for highlight effect
    this.originalColor = material.color.clone();
    this.originalEmissiveIntensity = 0.2;
    
    // Store reference to mesh in userData for selection
    this.mesh.userData.dispenser = this;
    this.mesh.userData.id = this.id;
    
    // Listen for sequencer triggers
    this.setupSequencerListener();
  }
  
  setupSequencerListener() {
    window.addEventListener('dispenser-trigger', (event) => {
      const { dispenserId, time } = event.detail;
      if (dispenserId === this.id && this.isSequenced) {
        this.spawnBallAtTime(time);
      }
    });
  }
  
  update(currentTime) {
    // Only spawn balls automatically if not in sequenced mode
    if (!this.isSequenced && currentTime - this.lastSpawnTime >= this.spawnInterval) {
      const ball = this.spawnBall();
      this.lastSpawnTime = currentTime;
      return ball;
    }
    return null;
  }
  
  spawnBallAtTime(time) {
    const ball = this.spawnBall();
    if (ball) {
      // Schedule the ball spawn using Tone.js timing
      this.lastSpawnTime = time * 1000; // Convert to milliseconds
      return ball;
    }
    return null;
  }
  
  spawnBall() {
    // Create ball slightly below dispenser
    const spawnPosition = this.position.clone();
    spawnPosition.y -= 0.35; // Offset to spawn at bottom of dispenser
    
    // Add slight randomness to prevent perfect stacking only if not deterministic
    if (!this.isDeterministic) {
      spawnPosition.x += (Math.random() * 0.1 - 0.05);
      spawnPosition.z += (Math.random() * 0.1 - 0.05);
    }
    
    const ball = new Ball(spawnPosition, 0.1, this.world, {
      isDeterministic: this.isDeterministic
    });
    
    // Ensure the ball is visible
    ball.mesh.visible = true;
    ball.mesh.castShadow = true;
    ball.mesh.receiveShadow = true;
    
    return ball;
  }
  
  setSequenced(isSequenced) {
    this.isSequenced = isSequenced;
    
    // Update visual appearance
    this.mesh.material.emissive.setHex(isSequenced ? 0x444444 : 0x222222);
    this.mesh.material.emissiveIntensity = isSequenced ? 0.2 : 0.1;
  }
  
  highlight(isHighlighted) {
    if (this.isHighlighted !== isHighlighted) {
      this.isHighlighted = isHighlighted;
      this.mesh.material.emissive = isHighlighted ? new THREE.Color(0xFFFF00) : this.originalColor;
      this.mesh.material.emissiveIntensity = isHighlighted ? 0.5 : this.originalEmissiveIntensity;
    }
  }
  
  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
} 
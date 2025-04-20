import * as THREE from 'three';
import { Ball } from './ball.js';

export class Dispenser {
  constructor(position, world) {
    this.position = position.clone();
    this.world = world;
    this.lastSpawnTime = 0;
    this.spawnInterval = 1000; // 1 second between spawns
    
    // Create visual mesh for dispenser
    const geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const material = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 0.7,
      metalness: 0.3
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }
  
  update(currentTime) {
    // Check if it's time to spawn a new ball
    if (currentTime - this.lastSpawnTime >= this.spawnInterval) {
      const ball = this.spawnBall();
      this.lastSpawnTime = currentTime;
      return ball;
    }
    return null;
  }
  
  spawnBall() {
    // Create ball slightly below dispenser
    const spawnPosition = this.position.clone();
    spawnPosition.y -= 0.35; // Offset to spawn at bottom of dispenser
    
    // Add slight randomness only to X to prevent perfect stacking
    spawnPosition.x += (Math.random() * 0.1 - 0.05);
    
    const ball = new Ball(spawnPosition, 0.1, this.world);
    
    // Ensure the ball is visible
    ball.mesh.visible = true;
    ball.mesh.castShadow = true;
    ball.mesh.receiveShadow = true;
    
    return ball;
  }
  
  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
} 
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class TrashHole {
  constructor(world, position, radius = 0.5) {
    this.world = world;
    this.position = position;
    this.radius = radius;
    this.disposedBalls = new Set();
    
    // Create physics body for the hole
    const holeShape = new CANNON.Cylinder(radius, radius, 0.1, 16);
    this.body = new CANNON.Body({ 
      mass: 0,
      material: world.wallMaterial
    });
    this.body.addShape(holeShape);
    this.body.position.copy(position);
    this.body.userData = { isTrashHole: true };
    this.world.addBody(this.body);
    
    // Create visual mesh
    const geometry = new THREE.CylinderGeometry(radius, radius, 0.1, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.7,
      metalness: 0.3
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Set up collision handling
    this.setupCollisionHandling();
  }
  
  setupCollisionHandling() {
    this.body.addEventListener('collide', (event) => {
      const otherBody = event.body;
      
      if (otherBody.userData?.isBall && !this.disposedBalls.has(otherBody)) {
        this.disposedBalls.add(otherBody);
        this.disposeBall(otherBody);
      }
    });
  }
  
  disposeBall(ballBody) {
    // Get velocity for sound effect
    const velocity = ballBody.velocity.length();
    
    // Play disposal sound
    if (window.playNote) {
      const intensity = Math.min(velocity / 10, 1);
      window.playNote('C4', '32n', null, intensity * 0.1);
    }
    
    // Announce disposal for accessibility
    const announcer = document.getElementById('announcer');
    if (announcer) {
      announcer.textContent = 'Ball disposed';
    }
    
    // Remove ball from world
    this.world.removeBody(ballBody);
  }
  
  update() {
    // No update needed for static body
  }
  
  dispose() {
    this.world.removeBody(this.body);
  }
} 
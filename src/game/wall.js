import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class Wall {
  constructor(start, end, world) {
    // Calculate wall properties
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Calculate rotation
    const angle = Math.atan2(direction.y, direction.x);
    
    // Create physics body
    const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.1, 0.1));
    this.body = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(center.x, center.y, center.z),
      shape: wallShape,
      material: world.platformMaterial,
      fixedRotation: true // Prevent rotation for stability
    });
    
    // Store note information with the wall body
    this.body.userData = {
      note: this.getNoteForLength(length),
      length: length,
      isWall: true,
      restitution: 0.95
    };
    
    // Rotate physics body
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
    world.addBody(this.body);
    
    // Create visual mesh
    const geometry = new THREE.BoxGeometry(length, 0.2, 0.2);
    const material = new THREE.MeshStandardMaterial({
      color: this.getColorForLength(length),
      roughness: 0.8,
      metalness: 0.2
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(center);
    this.mesh.rotation.z = angle;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }
  
  getNoteForLength(length) {
    // Map wall length to musical notes (C4 to C5)
    const noteMap = {
      1: 'C4',
      2: 'D4',
      3: 'E4',
      4: 'F4',
      5: 'G4',
      6: 'A4',
      7: 'B4',
      8: 'C5'
    };
    
    const roundedLength = Math.round(length);
    return noteMap[roundedLength] || 'C4';
  }
  
  getColorForLength(length) {
    // Map notes to colors
    const colorMap = {
      'C4': 0xFF0000, // Red
      'D4': 0xFF7F00, // Orange
      'E4': 0xFFFF00, // Yellow
      'F4': 0x00FF00, // Green
      'G4': 0x0000FF, // Blue
      'A4': 0x4B0082, // Indigo
      'B4': 0x9400D3, // Violet
      'C5': 0xFF1493  // Pink
    };
    
    const note = this.getNoteForLength(length);
    return colorMap[note] || 0xFFFFFF;
  }
  
  dispose(scene, world) {
    scene.remove(this.mesh);
    world.removeBody(this.body);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
} 
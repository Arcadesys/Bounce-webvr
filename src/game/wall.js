import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { VisualConfig } from '../core/config/visualConfig.js';

export class Wall {
  constructor(start, end, world) {
    this.start = start.clone();
    this.end = end.clone();
    this.world = world;
    
    // Calculate wall properties
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    // Calculate rotation
    const angle = Math.atan2(direction.y, direction.x);
    
    // Create physics body
    const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.2, 0.2));
    this.body = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(center.x, center.y, center.z),
      shape: wallShape,
      material: world.platformMaterial,
      fixedRotation: true // Prevent rotation for stability
    });
    
    // Set collision group for walls
    this.body.collisionFilterGroup = 1;  // Group for walls
    this.body.collisionFilterMask = 2;   // Only collide with group 2 (balls)
    
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
    const config = VisualConfig.wall.base;
    const material = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: config.roughness,
      metalness: config.metalness,
      emissive: config.color,
      emissiveIntensity: config.emissiveIntensity,
      envMapIntensity: config.envMapIntensity
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(center);
    this.mesh.rotation.z = angle;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    
    // Store original color for hover effect
    this.originalColor = material.color.clone();
    this.originalEmissiveIntensity = config.emissiveIntensity;
  }
  
  updateStart(newStart) {
    this.start.copy(newStart);
    this.updateGeometry();
  }
  
  updateEnd(newEnd) {
    this.end.copy(newEnd);
    this.updateGeometry();
  }
  
  updateGeometry() {
    // Calculate new properties
    const direction = new THREE.Vector3().subVectors(this.end, this.start);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(this.start, this.end).multiplyScalar(0.5);
    const angle = Math.atan2(direction.y, direction.x);
    
    // Update physics body
    const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.2, 0.2));
    this.body.removeShape(this.body.shapes[0]);
    this.body.addShape(wallShape);
    this.body.position.copy(new CANNON.Vec3(center.x, center.y, center.z));
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
    
    // Update user data
    this.body.userData.length = length;
    this.body.userData.note = this.getNoteForLength(length);
    
    // Update visual mesh
    const geometry = new THREE.BoxGeometry(length, 0.2, 0.2);
    this.mesh.geometry.dispose();
    this.mesh.geometry = geometry;
    this.mesh.position.copy(center);
    this.mesh.rotation.z = angle;
    
    // Update material color
    const newColor = this.getColorForLength(length);
    this.mesh.material.color.set(newColor);
    this.originalColor = newColor.clone();
  }
  
  highlight(isHighlighted) {
    const config = VisualConfig.wall.highlight;
    if (this.isHighlighted !== isHighlighted) {
      this.isHighlighted = isHighlighted;
      this.mesh.material.emissive = isHighlighted ? new THREE.Color(config.color) : this.originalColor;
      this.mesh.material.emissiveIntensity = isHighlighted ? config.intensity : this.originalEmissiveIntensity;
    }
  }
  
  getNoteForLength(length) {
    // Map length to musical note (C4 to C5)
    const minLength = 0.2;
    const maxLength = 3.0;
    const normalizedLength = (length - minLength) / (maxLength - minLength);
    const noteIndex = Math.floor(normalizedLength * 12); // 12 notes in an octave
    const notes = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5'];
    return notes[Math.min(noteIndex, notes.length - 1)];
  }
  
  getColorForLength(length) {
    // Map length to color (blue to red)
    const minLength = 0.2;
    const maxLength = 3.0;
    const normalizedLength = (length - minLength) / (maxLength - minLength);
    const hue = 0.6 - normalizedLength * 0.6; // 0.6 is blue, 0 is red
    return new THREE.Color().setHSL(hue, 0.8, 0.5);
  }
  
  dispose(scene, world) {
    scene.remove(this.mesh);
    world.removeBody(this.body);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
} 
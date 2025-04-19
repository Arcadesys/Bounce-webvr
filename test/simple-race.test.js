import { vi, describe, it, expect } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

describe('Simple Race Condition Test', () => {
  it('should handle material initialization', () => {
    // Create a material
    const material = new THREE.MeshStandardMaterial({
      color: 0x2a2a4a,
      roughness: 0.8,
      metalness: 0.2
    });
    
    // Create a mesh with the material
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    
    // Verify the mesh has the material
    expect(mesh.material).toBe(material);
  });
  
  it('should handle physics material initialization', () => {
    // Create a physics material
    const material = new CANNON.Material("testMaterial");
    material.friction = 0.3;
    material.restitution = 0.7;
    
    // Create a physics body with the material
    const shape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    const body = new CANNON.Body({
      mass: 1,
      shape: shape,
      material: material
    });
    
    // Verify the body has the material
    expect(body.material).toBe(material);
  });
}); 
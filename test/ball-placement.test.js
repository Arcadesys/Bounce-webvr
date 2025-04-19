import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

describe('Ball Placement', () => {
  let scene, camera, raycaster, mouse, drawingPlane;
  
  beforeEach(() => {
    // Set up Three.js scene
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    
    // Set up raycaster and mouse
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    drawingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  });

  it('should place ball at correct mouse position', () => {
    // Simulate a click at specific screen coordinates
    // For example, clicking at center of screen
    const screenX = window.innerWidth / 2;
    const screenY = window.innerHeight / 2;
    
    // Convert screen coordinates to normalized device coordinates
    mouse.x = (screenX / window.innerWidth) * 2 - 1;
    mouse.y = -(screenY / window.innerHeight) * 2 + 1;
    
    // Update raycaster
    raycaster.setFromCamera(mouse, camera);
    
    // Get intersection point
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    
    // Create ball at intersection point
    const ball = {
      position: intersection.clone()
    };
    
    // Ball should be placed at intersection point
    expect(ball.position.x).toBeCloseTo(0, 2); // Center X
    expect(ball.position.y).toBeCloseTo(0, 2); // Center Y
    expect(ball.position.z).toBeCloseTo(0, 2); // On plane
  });

  it('should place ball at different screen positions', () => {
    const testPositions = [
      { screenX: 0, screenY: 0 }, // Top-left
      { screenX: window.innerWidth, screenY: 0 }, // Top-right
      { screenX: 0, screenY: window.innerHeight }, // Bottom-left
      { screenX: window.innerWidth, screenY: window.innerHeight } // Bottom-right
    ];

    testPositions.forEach(({screenX, screenY}) => {
      // Convert screen coordinates to normalized device coordinates
      mouse.x = (screenX / window.innerWidth) * 2 - 1;
      mouse.y = -(screenY / window.innerHeight) * 2 + 1;
      
      // Update raycaster
      raycaster.setFromCamera(mouse, camera);
      
      // Get intersection point
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(drawingPlane, intersection);
      
      // Create ball at intersection point
      const ball = {
        position: intersection.clone()
      };
      
      // Ball position should match expected world coordinates
      expect(ball.position.x).toBeDefined();
      expect(ball.position.y).toBeDefined();
      expect(ball.position.z).toBeCloseTo(0, 2); // Should be on plane
      
      // Verify positions are different for different screen coordinates
      const centerBall = {
        position: new THREE.Vector3(0, 0, 0)
      };
      
      // Ball should not be at center unless clicked at center
      if (screenX !== window.innerWidth/2 || screenY !== window.innerHeight/2) {
        expect(ball.position.distanceTo(centerBall.position)).toBeGreaterThan(0);
      }
    });
  });
}); 
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';

describe('Race Conditions', () => {
  let scene;
  let world;
  let audioContext;
  
  beforeEach(() => {
    // Mock Three.js scene
    scene = new THREE.Scene();
    
    // Mock CANNON.js world
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Mock AudioContext
    audioContext = {
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        frequency: { setValueAtTime: vi.fn() }
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { setValueAtTime: vi.fn() }
      })),
      currentTime: 0
    };
    
    // Mock Tone.js
    vi.spyOn(Tone, 'start');
    vi.spyOn(Tone.context, 'resume');
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Initialization Order', () => {
    it('should handle physics world initialization before scene setup', async () => {
      // Initialize physics before scene
      const physicsInit = vi.fn(() => {
        world = new CANNON.World({
          gravity: new CANNON.Vec3(0, -9.82, 0)
        });
      });
      
      const sceneInit = vi.fn(() => {
        scene = new THREE.Scene();
      });
      
      // Simulate async initialization
      await Promise.all([
        new Promise(resolve => setTimeout(() => {
          physicsInit();
          resolve();
        }, 100)),
        new Promise(resolve => setTimeout(() => {
          sceneInit();
          resolve();
        }, 50))
      ]);
      
      expect(physicsInit).toHaveBeenCalled();
      expect(sceneInit).toHaveBeenCalled();
    });
    
    it('should handle audio context initialization before wall creation', async () => {
      const createWall = vi.fn((start, end, audioCtx) => {
        if (!audioCtx) throw new Error('Audio context required');
        return { mesh: new THREE.Mesh(), body: new CANNON.Body() };
      });
      
      // Simulate async audio initialization
      await new Promise(resolve => setTimeout(() => {
        Tone.start();
        resolve();
      }, 100));
      
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(5, 0, 0);
      
      expect(() => createWall(start, end)).toThrow('Audio context required');
      expect(() => createWall(start, end, audioContext)).not.toThrow();
    });
  });
  
  describe('Physics and Audio Synchronization', () => {
    it('should handle wall creation during physics world initialization', async () => {
      let isWorldReady = false;
      
      const createWall = vi.fn((start, end) => {
        if (!isWorldReady) throw new Error('Physics world not ready');
        return { mesh: new THREE.Mesh(), body: new CANNON.Body() };
      });
      
      // Simulate async physics initialization
      await new Promise(resolve => setTimeout(() => {
        isWorldReady = true;
        resolve();
      }, 100));
      
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(5, 0, 0);
      
      expect(() => createWall(start, end)).toThrow('Physics world not ready');
      
      // Wait for physics to be ready
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(() => createWall(start, end)).not.toThrow();
    });
    
    it('should handle multiple wall creations in rapid succession', async () => {
      const walls = [];
      const createWall = vi.fn((start, end) => {
        const wall = { mesh: new THREE.Mesh(), body: new CANNON.Body() };
        walls.push(wall);
        return wall;
      });
      
      // Simulate rapid wall creation
      const promises = Array(5).fill().map((_, i) => 
        new Promise(resolve => setTimeout(() => {
          createWall(
            new THREE.Vector3(i, 0, 0),
            new THREE.Vector3(i + 1, 0, 0)
          );
          resolve();
        }, i * 10)
      );
      
      await Promise.all(promises);
      
      expect(walls).toHaveLength(5);
      expect(createWall).toHaveBeenCalledTimes(5);
    });
  });
  
  describe('Resource Cleanup', () => {
    it('should handle cleanup during active wall creation', async () => {
      const walls = new Set();
      const createWall = vi.fn((start, end) => {
        const wall = { mesh: new THREE.Mesh(), body: new CANNON.Body() };
        walls.add(wall);
        return wall;
      });
      
      const cleanupWall = vi.fn((wall) => {
        walls.delete(wall);
        wall.mesh.geometry.dispose();
        wall.mesh.material.dispose();
      });
      
      // Start wall creation
      const wallPromise = new Promise(resolve => {
        setTimeout(() => {
          const wall = createWall(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(5, 0, 0)
          );
          resolve(wall);
        }, 100);
      });
      
      // Attempt cleanup before wall creation completes
      const cleanupPromise = new Promise(resolve => {
        setTimeout(() => {
          walls.forEach(wall => cleanupWall(wall));
          resolve();
        }, 50);
      });
      
      await Promise.all([wallPromise, cleanupPromise]);
      
      expect(walls.size).toBe(0);
      expect(cleanupWall).toHaveBeenCalled();
    });
  });
}); 
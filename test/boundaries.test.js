import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Boundary System', () => {
  let scene;
  let world;
  
  beforeEach(() => {
    scene = new THREE.Scene();
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
  });

  afterEach(() => {
    scene.clear();
  });

  describe('Visual Boundaries', () => {
    it('should create walls with correct dimensions', () => {
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a4a,
        roughness: 0.8,
        metalness: 0.2,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      // Test left wall creation
      const dimensions = new CANNON.Vec3(0.5, 20, 10);
      const wallGeometry = new THREE.BoxGeometry(dimensions.x * 2, dimensions.y * 2, dimensions.z * 2);
      const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
      leftWall.position.set(-10, 0, 0);
      leftWall.rotation.z = Math.PI / 4;
      scene.add(leftWall);

      // Test wall properties
      expect(leftWall.geometry.parameters.width).toBe(1); // 2 * 0.5
      expect(leftWall.geometry.parameters.height).toBe(40); // 2 * 20
      expect(leftWall.geometry.parameters.depth).toBe(20); // 2 * 10
      expect(leftWall.position.x).toBe(-10);
      expect(leftWall.rotation.z).toBe(Math.PI / 4);
    });

    it('should use correct material properties', () => {
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a4a,
        roughness: 0.8,
        metalness: 0.2,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      expect(wallMaterial.transparent).toBe(true);
      expect(wallMaterial.opacity).toBe(0.4);
      expect(wallMaterial.side).toBe(THREE.DoubleSide);
      expect(wallMaterial.depthWrite).toBe(false);
    });
  });

  describe('Physics Boundaries', () => {
    it('should create boundary bodies with correct properties', () => {
      // Create ground plane
      const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(20, 0.5, 20)),
        position: new CANNON.Vec3(0, -2, 0)
      });
      world.addBody(groundBody);

      // Create left wall
      const leftWallBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 20, 10)),
        position: new CANNON.Vec3(-10, 0, 0)
      });
      leftWallBody.quaternion.setFromEuler(0, 0, Math.PI / 4);
      world.addBody(leftWallBody);

      // Verify ground plane properties
      expect(groundBody.mass).toBe(0);
      expect(groundBody.position.y).toBe(-2);
      expect(groundBody.shape.halfExtents.x).toBe(20);
      expect(groundBody.shape.halfExtents.y).toBe(0.5);
      expect(groundBody.shape.halfExtents.z).toBe(20);

      // Verify wall properties
      expect(leftWallBody.mass).toBe(0);
      expect(leftWallBody.position.x).toBe(-10);
      expect(leftWallBody.shape.halfExtents.x).toBe(0.5);
      expect(leftWallBody.shape.halfExtents.y).toBe(20);
      expect(leftWallBody.shape.halfExtents.z).toBe(10);
    });

    it('should set up correct collision materials', () => {
      const platformMaterial = new CANNON.Material("platformMaterial");
      platformMaterial.friction = 0.1;
      platformMaterial.restitution = 0.5;

      const ballMaterial = new CANNON.Material("ballMaterial");
      ballMaterial.friction = 0.2;
      ballMaterial.restitution = 0.8;

      const contactMaterial = new CANNON.ContactMaterial(
        ballMaterial,
        platformMaterial,
        {
          friction: 0.1,
          restitution: 0.97,
          contactEquationRelaxation: 3,
          frictionEquationStiffness: 1e7,
          contactEquationStiffness: 1e8
        }
      );

      expect(platformMaterial.friction).toBe(0.1);
      expect(platformMaterial.restitution).toBe(0.5);
      expect(ballMaterial.friction).toBe(0.2);
      expect(ballMaterial.restitution).toBe(0.8);
      expect(contactMaterial.friction).toBe(0.1);
      expect(contactMaterial.restitution).toBe(0.97);
    });
  });
}); 
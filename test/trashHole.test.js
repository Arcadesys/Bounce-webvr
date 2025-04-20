import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TrashHole } from '../src/game/trashHole';
import { BallDispenser } from '../src/game/ball';

describe('TrashHole Functionality', () => {
  let world;
  let trashHole;
  let dispenser;
  let holePosition;
  let dispenserPosition;
  let disposalListener;
  let announcer;
  
  beforeEach(() => {
    // Initialize fresh physics world
    world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    holePosition = new THREE.Vector3(0, -1, 0);
    dispenserPosition = new THREE.Vector3(0, 2, 0);
    
    trashHole = new TrashHole(world, holePosition);
    dispenser = new BallDispenser(world, dispenserPosition);
    
    // Mock disposal event listener
    disposalListener = vi.fn();
    window.addEventListener('ballDisposal', disposalListener);
    
    // Mock announcer for accessibility
    announcer = document.createElement('div');
    announcer.id = 'announcer';
    document.body.appendChild(announcer);
  });
  
  afterEach(() => {
    window.removeEventListener('ballDisposal', disposalListener);
    trashHole.dispose();
    dispenser.cleanup();
    document.body.removeChild(announcer);
    world = null;
    trashHole = null;
    dispenser = null;
  });
  
  it('should dispose of balls that fall into it', () => {
    // Create a ball
    const ball = dispenser.createBall();
    ball.body.userData = { isBall: true };
    
    // Move ball to hole position
    ball.body.position.copy(holePosition);
    
    // Step world forward
    for (let i = 0; i < 10; i++) {
      world.step(1/60);
      trashHole.update();
      dispenser.update();
    }
    
    // Check that disposal event was fired
    expect(disposalListener).toHaveBeenCalled();
    
    // Check that ball was removed from world
    expect(world.bodies.includes(ball.body)).toBe(false);
    
    // Check that announcer was updated
    expect(announcer.textContent).toContain('Ball disposed');
  });
  
  it('should not dispose of the same ball twice', () => {
    // Create a ball
    const ball = dispenser.createBall();
    ball.body.userData = { isBall: true };
    
    // Move ball to hole position
    ball.body.position.copy(holePosition);
    
    // Step world forward
    for (let i = 0; i < 10; i++) {
      world.step(1/60);
      trashHole.update();
      dispenser.update();
    }
    
    // Check that disposal event was fired only once
    expect(disposalListener).toHaveBeenCalledTimes(1);
  });
  
  it('should not dispose of balls that miss the hole', () => {
    // Create a ball
    const ball = dispenser.createBall();
    ball.body.userData = { isBall: true };
    
    // Move ball to position away from hole
    ball.body.position.set(2, -1, 0);
    
    // Step world forward
    for (let i = 0; i < 10; i++) {
      world.step(1/60);
      trashHole.update();
      dispenser.update();
    }
    
    // Check that disposal event was not fired
    expect(disposalListener).not.toHaveBeenCalled();
    
    // Check that ball is still in world
    expect(world.bodies.includes(ball.body)).toBe(true);
  });
  
  it('should play disposal sound when ball is disposed', () => {
    // Mock playNote function
    window.playNote = vi.fn();
    
    // Create a ball
    const ball = dispenser.createBall();
    ball.body.userData = { isBall: true };
    
    // Move ball to hole position
    ball.body.position.copy(holePosition);
    
    // Step world forward
    for (let i = 0; i < 10; i++) {
      world.step(1/60);
      trashHole.update();
      dispenser.update();
    }
    
    // Check that disposal sound was played
    expect(window.playNote).toHaveBeenCalledWith('C4', '32n', null, 0.1);
  });
  
  it('should have correct visual appearance', () => {
    expect(trashHole.mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(trashHole.mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(trashHole.mesh.material.color.getHex()).toBe(0x333333);
    expect(trashHole.mesh.castShadow).toBe(true);
    expect(trashHole.mesh.receiveShadow).toBe(true);
  });
}); 
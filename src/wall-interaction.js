import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mapLengthToNote, getNoteColor } from './audio-utils';

const MIN_WALL_LENGTH = 0.2;

/**
 * Creates a wall between two points with audio and haptic feedback
 * @param {THREE.Vector3} start - Starting point
 * @param {THREE.Vector3} end - Ending point
 * @param {AudioContext} audioContext - Optional audio context for sound feedback
 * @returns {Object|null} Wall object or null if wall couldn't be created
 */
export function createWall(start, end, audioContext = null) {
  const length = start.distanceTo(end);
  
  // Don't create walls that are too short
  if (length < MIN_WALL_LENGTH) {
    return null;
  }
  
  // Calculate wall properties
  const direction = new THREE.Vector3().subVectors(end, start);
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const angle = Math.atan2(direction.y, direction.x);
  
  // Create visual wall
  const wallGeometry = new THREE.BoxGeometry(length, 0.2, 0.2);
  const note = mapLengthToNote(length);
  const noteColor = getNoteColor(note);
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: noteColor,
    roughness: 0.8,
    metalness: 0.2
  });
  
  const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  wallMesh.position.copy(center);
  wallMesh.rotation.z = angle;
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  
  // Create physics wall
  const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.1, 0.1));
  const wallBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(center.x, center.y, center.z),
    shape: wallShape,
  });
  
  wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
  wallBody.userData = { note, length };
  
  // Provide haptic feedback if available
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }
  
  // Announce to screen readers
  announceToScreenReader(`Wall created, length ${length.toFixed(1)} units`);
  
  // Play sound if audio context is provided
  if (audioContext) {
    playWallCreationSound(audioContext, note);
  }
  
  return { mesh: wallMesh, body: wallBody, note };
}

/**
 * Updates the temporary wall preview while drawing
 * @param {THREE.Vector3} start - Starting point
 * @param {THREE.Vector3} end - Current end point
 */
export function updateTempWall(start, end) {
  if (currentWallMesh) {
    scene.remove(currentWallMesh);
  }
  
  const length = start.distanceTo(end);
  if (length < MIN_WALL_LENGTH) return;
  
  const direction = new THREE.Vector3().subVectors(end, start);
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const angle = Math.atan2(direction.y, direction.x);
  
  const wallGeometry = new THREE.BoxGeometry(length, 0.2, 0.2);
  const note = mapLengthToNote(length);
  const noteColor = getNoteColor(note);
  
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: noteColor,
    transparent: true,
    opacity: 0.7,
    roughness: 0.8
  });
  
  currentWallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  currentWallMesh.position.copy(center);
  currentWallMesh.rotation.z = angle;
  scene.add(currentWallMesh);
}

/**
 * Cleans up wall resources
 * @param {Object} wall - Wall object containing mesh and body
 */
export function cleanupWall(wall) {
  if (wall.mesh) {
    wall.mesh.geometry.dispose();
    wall.mesh.material.dispose();
    scene.remove(wall.mesh);
  }
  
  if (wall.body && world) {
    world.removeBody(wall.body);
  }
}

/**
 * Announces text to screen readers
 * @param {string} text - Text to announce
 */
function announceToScreenReader(text) {
  let ariaLive = document.querySelector('[aria-live="polite"]');
  if (!ariaLive) {
    ariaLive = document.createElement('div');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.style.position = 'absolute';
    ariaLive.style.width = '1px';
    ariaLive.style.height = '1px';
    ariaLive.style.overflow = 'hidden';
    ariaLive.style.clip = 'rect(0, 0, 0, 0)';
    document.body.appendChild(ariaLive);
  }
  ariaLive.textContent = text;
}

/**
 * Plays a sound when a wall is created
 * @param {AudioContext} audioContext - Audio context to use
 * @param {string} note - Musical note to play
 */
function playWallCreationSound(audioContext, note) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Set frequency based on note
  const frequency = getNoteFrequency(note);
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  // Quick fade in/out
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.3);
} 
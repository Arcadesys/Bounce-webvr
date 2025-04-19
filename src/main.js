// Add initialization logging
console.log('🚀 Starting Bounce WebVR initialization...');

// Log environment info
console.log('📝 Environment:', {
    userAgent: navigator.userAgent,
    webgl: !!window.WebGLRenderingContext,
    webvr: !!window.isSecureContext
});

// Import dependencies
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { mapLengthToNote, getNoteColor, playNoteForLength } from './utils/midiSequencer.js';
import { playBounceSound } from './utils/synthManager.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

console.log('✅ Dependencies imported successfully');

// Sound toggle
let soundEnabled = true;
const soundToggle = document.getElementById('sound-toggle');

// Initialize audio context
let audioInitialized = false;

async function initAudio() {
  if (audioInitialized) return;
  
  try {
    await Tone.start();
    console.log('Audio context started');
    audioInitialized = true;
  } catch (error) {
    console.error('Failed to start audio context:', error);
  }
}

// Initialize audio on first user interaction
window.addEventListener('click', async () => {
  await initAudio();
}, { once: true });

window.addEventListener('touchstart', async () => {
  await initAudio();
}, { once: true });

// Toggle sound
soundToggle?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  soundToggle.setAttribute('aria-label', soundEnabled ? 'Sound On' : 'Sound Off');
  
  // Initialize audio if not already done
  if (soundEnabled) {
    initAudio();
  }
});

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // Pure black background for maximum contrast

// Get canvas element
const canvas = document.getElementById('bounceCanvas');
if (!canvas) {
  console.error('Canvas element not found!');
  throw new Error('Canvas element not found!');
}

// Set up camera first
const activeCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
activeCamera.position.set(0, 5, 10); // Adjusted for better view
activeCamera.lookAt(0, 0, 0);

// Set up renderer
const renderer = new THREE.WebGLRenderer({ 
  canvas: canvas,
  antialias: true,
  alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body?.appendChild(renderer.domElement);

// Create a subtle grid plane for cyberpunk effect
const gridGeometry = new THREE.PlaneGeometry(30, 30, 30, 30);
const gridMaterial = new THREE.LineBasicMaterial({ 
  color: 0x00ff00,
  transparent: true,
  opacity: 0.2
});
const grid = new THREE.LineSegments(
  new THREE.EdgesGeometry(gridGeometry),
  gridMaterial
);
grid.rotation.x = -Math.PI / 2;
grid.position.y = -2;
scene.add(grid);

// Lighting setup for cyberpunk effect
const ambientLight = new THREE.AmbientLight(0x000000, 0.1); // Very dark ambient
scene.add(ambientLight);

// Neon lights
const neonLight1 = new THREE.PointLight(0xff00ff, 2, 10); // Magenta
neonLight1.position.set(-5, 3, -5);
scene.add(neonLight1);

const neonLight2 = new THREE.PointLight(0x00ffff, 2, 10); // Cyan
neonLight2.position.set(5, 3, 5);
scene.add(neonLight2);

// Camera-following light
const followLight = new THREE.PointLight(0xffffff, 1.0, 15);
followLight.position.copy(activeCamera.position);
scene.add(followLight);

// Update point light position when camera moves
function updatePointLight() {
  followLight.position.copy(activeCamera.position);
}

// Physics world
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});

// Ground plane - invisible physics plane
const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
});
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
groundBody.position.y = -2;
groundBody.userData = { isGround: true };
world.addBody(groundBody);

// Container for walls
const walls = [];
const wallBodies = [];

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const drawingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let isDrawing = false;
let wallStart = new THREE.Vector3();
let wallEnd = new THREE.Vector3();
let currentWallMesh = null;
let drawMode = true; // true for drawing walls, false for dropping balls

// Create a UI indicator for current mode
function createModeIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'mode-indicator';
  indicator.style.position = 'absolute';
  indicator.style.bottom = '20px';
  indicator.style.left = '20px';
  indicator.style.padding = '10px';
  indicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  indicator.style.color = 'white';
  indicator.style.fontFamily = 'Arial, sans-serif';
  indicator.style.borderRadius = '5px';
  indicator.style.zIndex = '1000';
  indicator.style.userSelect = 'none';
  updateModeIndicator(indicator);
  document.body.appendChild(indicator);
  return indicator;
}

// Update the mode indicator text based on current mode
function updateModeIndicator(indicator) {
  if (!indicator) return;
  
  if (drawMode) {
    indicator.textContent = '🖊️ Draw Mode (Shift to toggle)';
    indicator.style.borderLeft = '4px solid #4CAF50';
  } else {
    indicator.textContent = '🏀 Ball Mode (Shift to toggle)';
    indicator.style.borderLeft = '4px solid #2196F3';
  }
  
  // Play a gentle tone to notify of mode change
  if (soundEnabled) {
    // Use Tone.js synth for mode change sound
    const modeSynth = new Tone.Synth({
      oscillator: { type: drawMode ? 'sine' : 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }
    }).toDestination();
    
    modeSynth.volume.value = -20; // Quiet notification
    modeSynth.triggerAttackRelease(drawMode ? 440 : 330, 0.3);
    
    // Dispose after playing
    setTimeout(() => modeSynth.dispose(), 500);
  }
}

const modeIndicator = createModeIndicator();

// Create a ball at the specified position
function createBall(position) {
  const radius = 0.2;
  
  // Physical body
  const ballBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: 0.1,
    material: new CANNON.Material({
      friction: 0.3,
      restitution: 0.7, // Bounciness
    })
  });
  
  world.addBody(ballBody);
  
  // Listen for collision events to play sounds and detect ground contact
  ballBody.addEventListener('collide', (event) => {
    const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
    
    // Get the other colliding body
    const otherBody = event.body === ballBody ? event.target : event.body;
    
    // Check if colliding with a wall that has note information
    if (otherBody.userData && otherBody.userData.note && Math.abs(relativeVelocity) > 0.5) {
      // Play the note associated with the wall
      if (soundEnabled) {
        // Velocity affects volume
        const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        playNoteForLength(Tone.context, otherBody.userData.length, 0.5, intensity * 0.5);
      }
    } 
    // Default bounce sound for other collisions
    else if (Math.abs(relativeVelocity) > 0.5) {
      const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
      playBounceSound(intensity);
    }
    
    // If collided with ground, mark for removal
    if (otherBody.userData && otherBody.userData.isGround) {
      ballBody.userData = ballBody.userData || {};
      ballBody.userData.shouldRemove = true;
    }
  });
  
  // Visual ball
  const ballGeometry = new THREE.SphereGeometry(radius, 32, 32);
  const ballMaterial = new THREE.MeshBasicMaterial({ 
    color: Math.random() > 0.5 ? 0xff00ff : 0x00ffff, // Alternate between magenta and cyan
    transparent: true,
    opacity: 0.9
  });
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);
  
  return { body: ballBody, mesh: ballMesh };
}

// Update createWall function to ensure audio is initialized
async function createWall(start, end) {
  // Ensure audio is initialized before creating wall
  await initAudio();
  
  // Get length for note mapping
  const length = start.distanceTo(end);
  
  // Map to note and get color
  const note = mapLengthToNote(length);
  const noteColor = getNoteColor(note);
  
  // Create a simple rectangular wall using EdgesGeometry
  const points = [
    new THREE.Vector3(start.x, start.y, start.z),
    new THREE.Vector3(end.x, end.y, end.z)
  ];
  
  // Create a path from these points
  const path = new THREE.LineCurve3(points[0], points[1]);
  
  // Use TubeGeometry which follows the path with given radius
  const wallHeight = 1.0;
  const wallGeometry = new THREE.TubeGeometry(path, 1, wallHeight/2, 8, false);
  
  // Create material
  const wallMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00, // Neon green
    transparent: true,
    opacity: 0.9
  });
  
  // Create mesh
  const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);
  walls.push(wallMesh);
  
  // Create physics body
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const angle = Math.atan2(direction.y, direction.x);
  
  const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, wallHeight/2, wallHeight/2));
  const wallBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(center.x, center.y, center.z),
    shape: wallShape,
  });
  
  // Store note information with the wall body
  wallBody.userData = {
    note: note,
    length: length
  };
  
  // Rotate physics body to align with the wall direction
  wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
  world.addBody(wallBody);
  wallBodies.push(wallBody);
  
  // Play the note when the wall is created
  if (soundEnabled) {
    playNoteForLength(Tone.context, length, 0.5, 0.3);
  }
  
  return { body: wallBody, mesh: wallMesh, note: note };
}

// Update temporary wall while drawing - using the simpler approach
function updateTempWall() {
  if (currentWallMesh) {
    scene.remove(currentWallMesh);
  }
  
  // Get length
  const length = wallStart.distanceTo(wallEnd);
  
  // If points are too close, don't draw anything
  if (length < 0.1) return;
  
  // Get note based on current length
  const note = mapLengthToNote(length);
  const noteColor = getNoteColor(note);
  
  // Create a path between the two points
  const points = [
    new THREE.Vector3(wallStart.x, wallStart.y, wallStart.z),
    new THREE.Vector3(wallEnd.x, wallEnd.y, wallEnd.z)
  ];
  
  // Create a path and tube geometry
  const path = new THREE.LineCurve3(points[0], points[1]);
  const wallHeight = 1.0;
  const tempWallGeometry = new THREE.TubeGeometry(path, 1, wallHeight/2, 8, false);
  
  // Create material
  const tempWallMaterial = new THREE.MeshBasicMaterial({ 
    color: noteColor,
    transparent: true,
    opacity: 0.7,
    roughness: 0.8
  });
  
  // Create mesh
  currentWallMesh = new THREE.Mesh(tempWallGeometry, tempWallMaterial);
  currentWallMesh.castShadow = true;
  currentWallMesh.receiveShadow = true;
  scene.add(currentWallMesh);
}

// Keep track of objects
const balls = [];

// Mouse event handlers
function onMouseDown(event) {
  // Initialize audio on first interaction
  if (soundEnabled && Tone.context.state !== 'running') {
    initAudio();
  }
  
  // Get mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, activeCamera);
  
  // Toggle draw mode with Shift key
  if (event.shiftKey) {
    drawMode = !drawMode;
    updateModeIndicator(modeIndicator);
    return;
  }
  
  if (drawMode) {
    // Get the exact 3D position where the mouse ray intersects the drawing plane
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    
    // Start drawing a wall - set FIRST endpoint exactly at click position
    isDrawing = true;
    wallStart = intersection.clone();
    wallEnd = intersection.clone(); // Initially same as start
    updateTempWall();
  } else {
    // Drop a ball
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    const ball = createBall(intersection);
    balls.push(ball);
  }
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  if (isDrawing) {
    raycaster.setFromCamera(mouse, activeCamera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    
    // Update the SECOND endpoint continuously during drag
    wallEnd = intersection;
    updateTempWall();
  }
}

// Update the onMouseUp handler to use async createWall
function onMouseUp(event) {
  if (isDrawing) {
    // Get the final mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, activeCamera);
    
    // Set the SECOND endpoint exactly at release position
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    wallEnd = intersection;
    
    // Only create a wall if it has some length
    if (wallStart.distanceTo(wallEnd) > 0.2) {
      createWall(wallStart, wallEnd).catch(console.error);
    }
    
    // Remove temporary wall
    if (currentWallMesh) {
      scene.remove(currentWallMesh);
      currentWallMesh = null;
    }
    
    isDrawing = false;
  }
}

// Event listeners
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

// Handle window resize
window.addEventListener('resize', () => {
  if (activeCamera === activeCamera) {
    // Update perspective camera for VR
    activeCamera.aspect = window.innerWidth / window.innerHeight;
  }
  activeCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Allow drawing or dropping a ball with touch on mobile
window.addEventListener('touchstart', (event) => {
  // Initialize audio on first interaction
  if (soundEnabled && Tone.context.state !== 'running') {
    initAudio();
  }
  
  event.preventDefault();
  const touch = event.touches[0];
  mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  
  raycaster.setFromCamera(mouse, activeCamera);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(drawingPlane, intersection);
  
  if (drawMode) {
    // Start drawing a wall - set FIRST endpoint exactly at touch position
    isDrawing = true;
    wallStart = intersection.clone();
    wallEnd = intersection.clone(); // Initially same as start
    updateTempWall();
  } else {
    // Drop a ball
    const ball = createBall(intersection);
    balls.push(ball);
  }
});

// Handle touch move for drawing
window.addEventListener('touchmove', (event) => {
  if (isDrawing) {
    event.preventDefault();
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, activeCamera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    
    // Update the SECOND endpoint continuously during drag
    wallEnd = intersection;
    updateTempWall();
  }
});

// Handle touch end for completing a wall
window.addEventListener('touchend', (event) => {
  if (isDrawing) {
    // Set the SECOND endpoint exactly at release position
    // We use the last known position since touchend doesn't have coordinates
    
    // Only create a wall if it has some length
    if (wallStart.distanceTo(wallEnd) > 0.2) {
      createWall(wallStart, wallEnd).catch(console.error);
    }
    
    // Remove temporary wall
    if (currentWallMesh) {
      scene.remove(currentWallMesh);
      currentWallMesh = null;
    }
    
    isDrawing = false;
  }
});

// After renderer setup
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, activeCamera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,  // strength
  0.4,  // radius
  0.85  // threshold
);
composer.addPass(bloomPass);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update physics
  world.step(1/60);
  
  // Update point light position
  updatePointLight();
  
  // Update all meshes
  scene.traverse((object) => {
    if (object.userData.body) {
      object.position.copy(object.userData.body.position);
      object.quaternion.copy(object.userData.body.quaternion);
    }
  });
  
  composer.render();
}

// Start animation
animate();

console.log('✨ Application initialized successfully!');



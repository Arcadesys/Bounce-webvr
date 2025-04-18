import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { mapLengthToNote, getNoteColor, playNoteForLength } from '../utils/midiSequencer';
import { playBounceSound } from '../utils/synthManager';

// Sound toggle
let soundEnabled = true;
const soundToggle = document.getElementById('sound-toggle');

// Initialize audio on user interaction
function initAudio() {
  // Ensure Tone.js is started
  if (Tone.context.state !== 'running') {
    Tone.start();
  }
  
  // Use the global playBounceSound function from synthManager
  window.playBounceSound = playBounceSound;
}

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
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body?.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Physics world
export const world = new CANNON.World({
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

// Visible ground plane
const groundGeometry = new THREE.PlaneGeometry(10, 10);
const groundMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x228B22,
  roughness: 0.7,
  metalness: 0.1
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = true;
ground.userData = { isGround: true };
scene.add(ground);

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
export function createBall(position) {
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
  const ballMaterial = new THREE.MeshStandardMaterial({ 
    color: Math.random() * 0xffffff,
    roughness: 0.4,
    metalness: 0.3
  });
  const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);
  
  return { body: ballBody, mesh: ballMesh };
}

// Create a wall between two points - completely rebuilt for simplicity
export function createWall(start, end) {
  // Get length for note mapping
  const length = start.distanceTo(end);
  
  // Map to note and get color
  const note = mapLengthToNote(length);
  const noteColor = getNoteColor(note);
  
  // Create a simple rectangular wall using EdgesGeometry
  // First, create a line between the two points
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
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: noteColor,
    roughness: 0.8,
    metalness: 0.2
  });
  
  // Create mesh
  const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);
  walls.push(wallMesh);
  
  // Create a simple physics body - just a box between the points
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const angle = Math.atan2(direction.y, direction.x);
  
  const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, wallHeight/2, wallHeight/2));
  const wallBody = new CANNON.Body({
    mass: 0, // Static body
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
  const tempWallMaterial = new THREE.MeshStandardMaterial({ 
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
  
  raycaster.setFromCamera(mouse, camera);
  
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
    raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    
    // Update the SECOND endpoint continuously during drag
    wallEnd = intersection;
    updateTempWall();
  }
}

function onMouseUp(event) {
  if (isDrawing) {
    // Get the final mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    
    // Set the SECOND endpoint exactly at release position
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(drawingPlane, intersection);
    wallEnd = intersection;
    
    // Only create a wall if it has some length
    if (wallStart.distanceTo(wallEnd) > 0.2) {
      createWall(wallStart, wallEnd);
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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
  
  raycaster.setFromCamera(mouse, camera);
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
    
    raycaster.setFromCamera(mouse, camera);
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
      createWall(wallStart, wallEnd);
    }
    
    // Remove temporary wall
    if (currentWallMesh) {
      scene.remove(currentWallMesh);
      currentWallMesh = null;
    }
    
    isDrawing = false;
  }
});

// Animation loop
const timeStep = 1 / 60;
function animate() {
  requestAnimationFrame(animate);
  
  // Update physics
  world.step(timeStep);
  
  // Update visual objects to match physics
  for (let i = 0; i < balls.length; i++) {
    balls[i].mesh.position.copy(balls[i].body.position);
    balls[i].mesh.quaternion.copy(balls[i].body.quaternion);
    
    // Remove balls that hit the ground or fall too far
    if ((balls[i].body.userData && balls[i].body.userData.shouldRemove) || 
        balls[i].body.position.y < -10) {
      scene.remove(balls[i].mesh);
      world.removeBody(balls[i].body);
      balls.splice(i, 1);
      i--;
    }
  }
  
  renderer.render(scene, camera);
}

animate(); // Test comment

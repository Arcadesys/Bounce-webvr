import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mapLengthToNote, getNoteColor, playNoteForLength } from '../utils/midiSequencer';

// Audio context for sound effects
let audioContext;
let soundEnabled = true;
const soundToggle = document.getElementById('sound-toggle');

// Initialize audio on user interaction
function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Create success sound function
  window.playBounceSound = (intensity = 1.0) => {
    if (!soundEnabled || !audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(300 + intensity * 200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(intensity * 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
  };
}

// Toggle sound
soundToggle?.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  soundToggle.setAttribute('aria-label', soundEnabled ? 'Sound On' : 'Sound Off');
  
  // Initialize audio if not already done
  if (soundEnabled && !audioContext) {
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
  if (audioContext && soundEnabled) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = drawMode ? 'sine' : 'triangle';
    oscillator.frequency.value = drawMode ? 440 : 330; // A4 or E4
    gainNode.gain.value = 0.1;
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
    oscillator.stop(audioContext.currentTime + 0.3);
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
      if (audioContext && soundEnabled) {
        // Velocity affects volume
        const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        playNoteForLength(audioContext, otherBody.userData.length, 0.5, intensity * 0.5);
      }
    } 
    // Default bounce sound for other collisions
    else if (Math.abs(relativeVelocity) > 0.5) {
      const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
      window.playBounceSound(intensity);
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

// Create a wall between two points
export function createWall(start, end) {
  // Calculate length for notes
  const length = start.distanceTo(end);
  
  // Get note information
  const note = mapLengthToNote(length);
  const noteColor = getNoteColor(note);
  
  // First, let's create visible points at each end
  const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: noteColor });
  
  // Start point sphere
  const startSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  startSphere.position.copy(start);
  scene.add(startSphere);
  
  // End point sphere
  const endSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  endSphere.position.copy(end);
  scene.add(endSphere);
  
  // Create a cyliner between the points
  // We need to position and orient the cylinder to connect the points
  const direction = new THREE.Vector3().subVectors(end, start);
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  // Use cylinder geometry for the wall
  const radius = 0.15;
  const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  const cylinderMaterial = new THREE.MeshStandardMaterial({ 
    color: noteColor,
    roughness: 0.8,
    metalness: 0.2
  });
  
  // Create the cylinder mesh
  const wallMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  
  // Position the cylinder
  wallMesh.position.copy(midpoint);
  
  // Orient the cylinder to point from start to end
  // Cylinders in Three.js are aligned along the Y-axis by default
  // so we need to rotate to align with our direction vector
  const quaternion = new THREE.Quaternion();
  // Default cylinder orientation (up along y-axis)
  const up = new THREE.Vector3(0, 1, 0);
  // Normalize our direction
  direction.normalize();
  // Get the quaternion to rotate from up to our direction
  quaternion.setFromUnitVectors(up, direction);
  // Apply rotation
  wallMesh.setRotationFromQuaternion(quaternion);
  
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);
  
  // Store all meshes for this wall
  const allMeshes = [wallMesh, startSphere, endSphere];
  walls.push(...allMeshes);
  
  // Create physics body
  const wallShape = new CANNON.Cylinder(radius, radius, length, 8);
  const wallBody = new CANNON.Body({
    mass: 0, // Static body
    position: new CANNON.Vec3(midpoint.x, midpoint.y, midpoint.z),
    shape: wallShape,
  });
  
  // Orient the physics body
  wallBody.quaternion.copy(quaternion);
  
  // Store note information with the wall body
  wallBody.userData = {
    note: note,
    length: length
  };
  
  world.addBody(wallBody);
  wallBodies.push(wallBody);
  
  // Play the note when the wall is created
  if (audioContext && soundEnabled) {
    playNoteForLength(audioContext, length, 0.5, 0.3);
  }
  
  return { body: wallBody, mesh: wallMesh, note: note, allMeshes: allMeshes };
}

// Update temporary wall while drawing
function updateTempWall() {
  if (currentWallMesh) {
    scene.remove(currentWallMesh);
    currentWallMesh = null;
  }
  
  // Calculate length
  const length = wallStart.distanceTo(wallEnd);
  
  // If points are too close, don't draw anything
  if (length < 0.1) return;
  
  // Create a simple line preview
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    wallStart.clone(),
    wallEnd.clone()
  ]);
  
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0xffffff,
    linewidth: 3
  });
  
  currentWallMesh = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(currentWallMesh);
}

// Keep track of objects
const balls = [];

// Mouse event handlers
function onMouseDown(event) {
  // Get mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Initialize audio on first interaction
  if (!audioContext) {
    initAudio();
  }
  
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
    
    // Create debug sphere to mark click position
    const markerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(intersection);
    scene.add(marker);
    setTimeout(() => scene.remove(marker), 2000); // Remove after 2 seconds
    
    console.log("Mouse DOWN at:", intersection.x, intersection.y, intersection.z);
    
    // Start drawing a wall
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
    
    // Create debug sphere to mark release position
    const markerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(intersection);
    scene.add(marker);
    setTimeout(() => scene.remove(marker), 2000); // Remove after 2 seconds
    
    console.log("Mouse UP at:", intersection.x, intersection.y, intersection.z);
    
    wallEnd = intersection;
    
    // Create a direct line between points instead of fancy geometry
    if (wallStart.distanceTo(wallEnd) > 0.2) {
      console.log("Creating line from", wallStart, "to", wallEnd);
      
      // Create a direct line between the two points
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        wallStart.clone(),
        wallEnd.clone()
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0xffffff,
        linewidth: 5
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(line);
      
      // Store the line
      walls.push(line);
      
      // Add spheres at endpoints
      const sphereGeometry = new THREE.SphereGeometry(0.1);
      const startSphere = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      startSphere.position.copy(wallStart);
      scene.add(startSphere);
      
      const endSphere = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
      endSphere.position.copy(wallEnd);
      scene.add(endSphere);
      
      walls.push(startSphere, endSphere);
      
      // Skip complex wall creation for now
      // createWall(wallStart, wallEnd);
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
  if (!audioContext) {
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
    if (balls[i] && balls[i].body && balls[i].mesh) {
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
  }
  
  renderer.render(scene, camera);
}

animate(); // Test comment
console.log('Test: The file was updated');

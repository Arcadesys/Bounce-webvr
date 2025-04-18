import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { mapLengthToNote, getNoteColor, playNoteForLength } from '../utils/midiSequencer';
import { playBounceSound, playNote, setInstrumentType, getCurrentInstrumentType, INSTRUMENT_PREFABS } from '../utils/synthManager';
import NoteDisplay from './NoteDisplay';

export default function BounceScene() {
  const mountRef = useRef(null);
  // Reference to contact material for accessing in slider handler
  const contactMaterialRef = useRef(null);
  // Store platform material for access from slider handler
  const platformMaterialRef = useRef(null);
  
  // State for note display
  const [isDrawing, setIsDrawing] = useState(false);
  const [wallLength, setWallLength] = useState(0);
  // State for settings menu
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // State for ball count
  const [ballCount, setBallCount] = useState(0);
  // State to track dispensers
  const [dispenserCount, setDispenserCount] = useState(0);
  // State for tempo (BPM)
  const [tempo, setTempo] = useState(() => {
    // Initialize from localStorage or default to 120 BPM
    const savedTempo = localStorage.getItem('preferredTempo');
    return savedTempo ? parseInt(savedTempo, 10) : 120;
  });
  // State for metronome pulse
  const [metroPulse, setMetroPulse] = useState(false);
  
  // New state for current instrument
  const [currentInstrument, setCurrentInstrument] = useState(() => {
    return getCurrentInstrumentType() || 'marimba';
  });
  
  // Effect to initialize Tone.js Transport with the current tempo
  useEffect(() => {
    if (Tone.Transport) {
      Tone.Transport.bpm.value = tempo;
    }
  }, [tempo]);
  
  // Effect to set up metronome visualization that pulses with the beat
  useEffect(() => {
    let metronomeId = null;
    
    if (Tone.Transport) {
      // Set up a callback that fires on each quarter note to animate the metronome
      metronomeId = Tone.Transport.scheduleRepeat((time) => {
        // Visual feedback - toggle the pulse state
        setMetroPulse(prev => !prev);
      }, '4n');
    }
    
    return () => {
      if (metronomeId !== null && Tone.Transport) {
        Tone.Transport.clear(metronomeId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Scene variables
    let scene, camera, renderer;
    let world;
    let balls = [];
    let walls = [];
    let wallBodies = [];
    let isDrawingInternal = false;
    let wallStart = new THREE.Vector3();
    let wallEnd = new THREE.Vector3();
    let currentWallMesh = null;
    let audioContext;
    let soundEnabled = true;
    let dispensers = []; // Array to hold all dispensers
    let mouse = new THREE.Vector2(); // Mouse position for raycasting
    let raycaster = new THREE.Raycaster(); // Raycaster for mouse interaction
    let drawingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Plane for mouse interaction
    
    // Define physics materials inside the useEffect
    const ballMaterial = new CANNON.Material("ballMaterial");
    ballMaterial.friction = 0.3;
    ballMaterial.restitution = 0.7; // Default ball restitution
    
    const platformMaterial = new CANNON.Material("platformMaterial");
    platformMaterial.friction = 0.1; // Low friction for platforms
    platformMaterial.restitution = 0.5; // Default platform restitution (will be controlled by slider)
    
    // Store in ref for access outside useEffect
    platformMaterialRef.current = platformMaterial;
    
    // Keep track of the shared platform material contact properties
    let ballPlatformContactMaterial;
    
    // Audio context for sound effects
    function initAudio() {
      // Use Tone.context instead of creating a new AudioContext
      // Ensure Tone.js is started
      if (Tone.context.state !== 'running') {
        Tone.start();
      }
      
      // Use the playBounceSound from synthManager
      window.playBounceSound = playBounceSound;
    }
    
    // Initialize Three.js scene
    function initScene() {
      // Scene setup
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000); // Black background
      
      // Camera setup - zoomed out for larger contraptions
      camera = new THREE.PerspectiveCamera(
        75,                                        // FOV
        window.innerWidth / window.innerHeight,    // Aspect ratio
        0.1,                                       // Near clipping plane
        100                                        // Far clipping plane
      );
      // Position the camera for a flat, mostly 2D-like view
      camera.position.set(0, 2, 12);               // Lower height, still zoomed out
      camera.lookAt(0, 0, 0);                      // Look at center of scene
      
      // Renderer setup
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      mountRef.current.appendChild(renderer.domElement);
      
      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 20, 15);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      scene.add(directionalLight);
    }
    
    // Initialize physics world
    function initPhysics() {
      world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0) // Earth gravity
      });
      
      // Improve solver to handle physics more accurately
      world.solver.iterations = 10; // Default is 10, increase for more accuracy
      world.solver.tolerance = 0.001; // Default is 0.001, lower for better accuracy

      // Define default collision behavior
      world.defaultContactMaterial.contactEquationStiffness = 1e7; // Stiffer contacts for trampoline effect
      world.defaultContactMaterial.contactEquationRelaxation = 4; // More relaxation for stability
      
      // Create special materials for trampoline-like behavior
      ballMaterial.friction = 0.2; // Low friction for golf ball
      ballMaterial.restitution = 0.8; // Higher restitution for golf ball
      
      platformMaterial.friction = 0.3; // Medium friction for platforms
      platformMaterial.restitution = 0.9; // High restitution for trampoline effect

      // Create contact material for ball-wall interactions
      ballPlatformContactMaterial = new CANNON.ContactMaterial(
        ballMaterial,
        platformMaterial,
        {
          friction: 0.1, // Low friction for clean bounces
          restitution: 0.97, // Very bouncy for golf ball effect
          contactEquationRelaxation: 3, // Softer contacts
          frictionEquationStiffness: 1e7, // Stiffer friction
          contactEquationStiffness: 1e8 // Very stiff contacts for immediate response
        }
      );
      
      // Store in ref for access outside useEffect
      contactMaterialRef.current = ballPlatformContactMaterial;
      world.addContactMaterial(ballPlatformContactMaterial);
      
      // Special event listener for custom collision behavior
      world.addEventListener('postStep', () => {
        // Custom handling of ball-wall collisions to simulate perfect trampolines
        // This prevents energy gain which can happen in physics engines
        for (let i = 0; i < balls.length; i++) {
          const ball = balls[i];
          if (ball && ball.body) {
            // Apply a constant small damping to simulate minimal air resistance
            ball.body.velocity.scale(0.999, ball.body.velocity); // Even less damping for golf ball
          }
        }
      });
      
      // Ground plane - invisible physics plane - larger for bigger play area
      const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        material: platformMaterial // Assign platform material
      });
      groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
      groundBody.position.y = -4; // Lower position to match expanded view
      groundBody.userData = { isGround: true }; // Add userData for identification
      world.addBody(groundBody);
      
      // Create walls around the play area to keep balls in
      createBoundary(-10, -4, 20, 0.5, 0, Math.PI / 2); // Left wall
      createBoundary(10, -4, 20, 0.5, 0, Math.PI / 2);  // Right wall
      createBoundary(0, 6, 20, 0.5, Math.PI / 2, 0);    // Top wall
      
      // Visible ground plane - larger for bigger play area
      const groundGeometry = new THREE.PlaneGeometry(20, 20); // Expanded from 10x10
      const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x228B22,
        roughness: 0.7,
        metalness: 0.1
      });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -4; // Lower position to match expanded view
      ground.receiveShadow = true;
      ground.userData = { isGround: true }; // Add userData for identification
      scene.add(ground);
    }
    
    // Helper function to create boundary walls around the play area
    function createBoundary(x, y, length, width, rotX, rotY) {
      // Create invisible physics boundary
      const boundaryShape = new CANNON.Box(new CANNON.Vec3(length/2, width/2, 1));
      const boundaryBody = new CANNON.Body({
        mass: 0, // Static body
        position: new CANNON.Vec3(x, y, 0),
        shape: boundaryShape,
        material: platformMaterial
      });
      
      // Rotate the boundary
      const quat = new CANNON.Quaternion();
      quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), rotX);
      const quat2 = new CANNON.Quaternion();
      quat2.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
      quat.mult(quat2, quat);
      boundaryBody.quaternion.copy(quat);
      
      // Add boundary data
      boundaryBody.userData = {
        isBoundary: true,
        restitution: 0.97 // High restitution for bouncy boundaries
      };
      
      world.addBody(boundaryBody);
      return boundaryBody;
    }
    
    // Create a dispenser at the specified position
    function createDispenser(position) {
      // Create visual indicator for dispenser
      const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 16);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x00aaff,
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0x005588,
        emissiveIntensity: 0.3
      });
      const dispenserMesh = new THREE.Mesh(geometry, material);
      dispenserMesh.position.copy(position);
      dispenserMesh.castShadow = true;
      dispenserMesh.receiveShadow = true;
      scene.add(dispenserMesh);
      
      // Add success sound effect for dispenser placement
      playNote('C5', '16n');
      
      // Create sequencer for this dispenser using Tone.js Transport
      let sequencerId = null;
      
      // Function to schedule ball drops
      const startSequence = () => {
        // Create loop that fires on quarter notes
        sequencerId = Tone.Transport.scheduleRepeat((time) => {
          // Create ball position slightly above the dispenser
          const ballPosition = new THREE.Vector3(
            position.x, 
            position.y + 0.5, 
            position.z
          );
          
          // Create the ball
          const ball = createBall(ballPosition);
          balls.push(ball);
          setBallCount(prevCount => prevCount + 1);
          
          // Remove sound when ball is dropped
        }, '4n'); // Schedule on quarter notes
        
        // Make sure transport is using current tempo
        Tone.Transport.bpm.value = tempo;
        
        // Start the transport if it's not already running
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
        }
      };
      
      // Store dispenser data
      const dispenser = {
        mesh: dispenserMesh,
        position: position.clone(),
        sequencerId: sequencerId,
        isActive: true
      };
      
      // Add to dispensers array
      dispensers.push(dispenser);
      setDispenserCount(prevCount => prevCount + 1);
      
      // Start the sequence
      startSequence();
      
      return dispenser;
    }
    
    // Create a ball at the specified position
    function createBall(position) {
      // Ball config - smaller golf ball
      const radius = 0.1; // Smaller radius for golf ball
      const mass = 0.05; // Much lighter for golf ball
      
      // Physics body
      const sphereShape = new CANNON.Sphere(radius);
      const sphereBody = new CANNON.Body({
        mass: mass,
        shape: sphereShape,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        material: ballMaterial,
        linearDamping: 0.01, // Small damping for realistic physics
        angularDamping: 0.01 // Small angular damping too
      });
      
      // Add initial downward velocity for predictable momentum
      sphereBody.velocity.set(0, -0.2, 0); // Small initial velocity for golf ball
      
      // Add a custom userData property to identify this as a ball
      sphereBody.userData = { isBall: true };
      
      // Add collision handling
      sphereBody.addEventListener('collide', function(e) {
        // Get the body that was hit
        const targetBody = e.body;
        
        // Handle different collision types
        if (targetBody.userData && targetBody.userData.isWall) {
          // Wall collision (trampoline effect)
          const contactNormal = e.contact.ni; // Normal vector of collision
          const impactVelocity = sphereBody.velocity.dot(contactNormal); // Velocity along normal
          
          // Custom bounce effect for trampoline walls
          const restitution = 0.97; // High restitution for golf ball bounce
          const bounce = -impactVelocity * (1 + restitution); // Using restitution
          
          // Create impulse vector along the contact normal
          const impulse = new CANNON.Vec3(
            contactNormal.x * bounce * mass,
            contactNormal.y * bounce * mass,
            contactNormal.z * bounce * mass
          );
          
          // Apply impulse to bounce the ball
          sphereBody.applyImpulse(impulse, sphereBody.position);
          
          // Play the musical note associated with the wall
          if (soundEnabled) {
            const volume = Math.min(0.5, Math.abs(impactVelocity) / 10);
            if (targetBody.userData.length) {
              // Play musical note based on wall length - passing null as first arg since midiSequencer handles context
              playNoteForLength(Tone.context, targetBody.userData.length, 0.5, volume);
            }
          }
          
        } else if (targetBody.userData && targetBody.userData.isGround) {
          // Ground collision - mark for removal after a short delay
          sphereBody.userData = sphereBody.userData || {};
          // Set removal timestamp to 500ms in the future
          sphereBody.userData.removeAfter = Date.now() + 500;
          
          // No sound for ground collisions
          
        } else if (targetBody.userData && targetBody.userData.isBoundary) {
          // Boundary collision - no sound, just bounce
          
        } else {
          // Other collisions - no sound
          // Energy loss on general collisions
          sphereBody.velocity.scale(0.99, sphereBody.velocity);
        }
      });
      
      // Add the body to the world
      world.addBody(sphereBody);
      
      // Create Three.js mesh
      const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
      const sphereMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF, // White for golf ball
        roughness: 0.2,  // Smooth surface
        metalness: 0.1   // Slight sheen
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      scene.add(sphere);
      
      // Add to our list of balls
      balls.push({
        body: sphereBody,
        mesh: sphere,
        createdAt: Date.now(),
        markForRemoval: false
      });
      
      // Update ball count
      setBallCount(balls.length);
      
      return { body: sphereBody, mesh: sphere };
    }
    
    // Create a wall between two points
    function createWall(start, end) {
      // Calculate wall properties
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      
      // Update state for NoteDisplay component
      setWallLength(length);
      
      // Calculate rotation with correct direction
      const wallDirection = direction.clone().normalize();
      // This gives proper orientation along the line between points
      const angle = Math.atan2(direction.y, direction.x);
      
      console.log("Creating wall: start=", start, "end=", end);
      console.log("Wall angle (degrees):", angle * (180/Math.PI));
      
      // Get note information based on wall length
      const note = mapLengthToNote(length);
      const noteColor = getNoteColor(note);
      
      // Create physical wall - trampoline properties
      const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.1, 0.1));
      const wallBody = new CANNON.Body({
        mass: 0, // Static body
        position: new CANNON.Vec3(center.x, center.y, center.z),
        shape: wallShape,
        material: platformMaterial, // Assign platform material
        // Add custom properties for trampoline-like behavior
        fixedRotation: true // Prevent rotation for stability
      });
      
      // Store note information with the wall body for collision handling
      wallBody.userData = {
        note: note,
        length: length,
        isWall: true, // Identify as a wall for collision handling
        restitution: 0.95 // High restitution for trampoline effect without adding energy
      };
      
      // Rotate physics body to match visual representation
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
      world.addBody(wallBody);
      wallBodies.push(wallBody);
      
      // Create visual wall
      const wallGeometry = new THREE.BoxGeometry(length, 0.2, 0.2);
      const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: noteColor, // Use note-based color
        roughness: 0.8,
        metalness: 0.2
      });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      wallMesh.position.copy(center);
      
      // Apply the same rotation to the visual mesh
      wallMesh.rotation.z = angle;
      
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);
      walls.push(wallMesh);
      
      // Play the note when the wall is created
      if (soundEnabled) {
        playNoteForLength(Tone.context, length, 0.5, 0.3);
      }
      
      return { body: wallBody, mesh: wallMesh, note: note };
    }
    
    // Update temporary wall while drawing
    function updateTempWall() {
      if (currentWallMesh) {
        scene.remove(currentWallMesh);
      }
      
      const direction = new THREE.Vector3().subVectors(wallEnd, wallStart);
      const length = direction.length();
      const center = new THREE.Vector3().addVectors(wallStart, wallEnd).multiplyScalar(0.5);
      
      // Update state for NoteDisplay component
      setWallLength(length);
      
      // Calculate angle with same formula as in createWall
      const angle = Math.atan2(direction.y, direction.x);
      
      // Get note based on current length
      const note = mapLengthToNote(length);
      const noteColor = getNoteColor(note);
      
      const wallGeometry = new THREE.BoxGeometry(length, 0.2, 0.2);
      const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: noteColor, // Use note-based color
        transparent: true,
        opacity: 0.7,
        roughness: 0.8
      });
      
      currentWallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      currentWallMesh.position.copy(center);
      
      // Apply same rotation as in createWall
      currentWallMesh.rotation.z = angle;
      
      scene.add(currentWallMesh);
    }
    
    // Mouse event handlers
    function onMouseDown(event) {
      // Get mouse position
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Initialize audio on first interaction
      if (!audioContext) {
        initAudio();
      }
      
      // Cast ray from mouse position into scene
      raycaster.setFromCamera(mouse, camera);
      
      // Create dispenser if cmd key (macOS) or ctrl key (Windows/Linux) is pressed
      if (event.metaKey || event.ctrlKey) {
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(drawingPlane, intersection);
        createDispenser(intersection);
        return;
      }
      
      // If shift is held, start drawing a wall
      if (event.shiftKey) {
        isDrawingInternal = true;
        setIsDrawing(true); // Update state for NoteDisplay
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(drawingPlane, intersection);
        wallStart = intersection.clone();
        wallEnd = intersection.clone();
        updateTempWall();
      } else {
        // Otherwise, drop a ball
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(drawingPlane, intersection);
        const ball = createBall(intersection);
        balls.push(ball);
      }
    }
    
    function onMouseMove(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      if (isDrawingInternal) {
        raycaster.setFromCamera(mouse, camera);
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(drawingPlane, intersection);
        wallEnd = intersection;
        updateTempWall();
      }
    }
    
    function onMouseUp(event) {
      if (isDrawingInternal) {
        isDrawingInternal = false;
        setIsDrawing(false); // Update state for NoteDisplay
        // Only create a wall if it has some length
        if (wallStart.distanceTo(wallEnd) > 0.2) {
          createWall(wallStart, wallEnd);
          
          // Remove temporary wall
          if (currentWallMesh) {
            scene.remove(currentWallMesh);
            currentWallMesh = null;
          }
        }
      }
    }
    
    // Handle window resize
    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Allow dropping a ball with a touch on mobile
    function onTouchStart(event) {
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
      const ball = createBall(intersection);
      balls.push(ball);
    }
    
    // Toggle sound
    function toggleSound() {
      soundEnabled = !soundEnabled;
      const soundToggle = document.getElementById('sound-toggle');
      if (soundToggle) {
        soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
        soundToggle.setAttribute('aria-label', soundEnabled ? 'Sound On' : 'Sound Off');
      }
      
      // Initialize audio if not already done
      if (soundEnabled && !audioContext) {
        initAudio();
      }
    }
    
    // Handle ball material change
    function handleMaterialChange(event) {
      const materialType = event.target.value;
      
      // Update ball material properties based on selection
      switch (materialType) {
        case 'golf':
          ballMaterial.friction = 0.2;
          ballMaterial.restitution = 0.8;
          break;
        case 'rubber':
          ballMaterial.friction = 0.7;
          ballMaterial.restitution = 0.9;
          break;
        case 'steel':
          ballMaterial.friction = 0.1;
          ballMaterial.restitution = 0.6;
          break;
        case 'wood':
          ballMaterial.friction = 0.5;
          ballMaterial.restitution = 0.4;
          break;
        default:
          ballMaterial.friction = 0.2;
          ballMaterial.restitution = 0.8;
      }
      
      // Update contact material
      if (contactMaterialRef.current) {
        contactMaterialRef.current.restitution = ballMaterial.restitution;
      }
      
      // No sound feedback when material changes
    }
    
    // Toggle settings menu
    window.toggleSettings = () => {
      const settingsMenu = document.getElementById('settings-menu');
      if (settingsMenu) {
        const isVisible = settingsMenu.style.display === 'block';
        settingsMenu.style.display = isVisible ? 'none' : 'block';
        
        // Update accessibility attribute
        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) {
          settingsButton.setAttribute('aria-expanded', !isVisible);
        }
      }
    };
    
    // Animation loop
    const timeStep = 1 / 60; // 60 frames per second
    let lastCallTime; // For tracking accumulated time between frames

    function animate() {
      requestAnimationFrame(animate);
      
      // Calculate actual time elapsed since last frame for smoother physics
      const time = performance.now() / 1000; // Convert to seconds
      
      if (!lastCallTime) {
        // First frame, just initialize and return
        lastCallTime = time;
        return;
      }
      
      // Calculate time since last frame
      let dt = time - lastCallTime;
      lastCallTime = time;
      
      // Cap max dt to prevent "tunneling" through objects when frame rate drops
      if (dt > 0.1) dt = 0.1; 
      
      // Step the physics simulation with fixed time step
      // This ensures physics simulation quality is consistent regardless of frame rate
      world.step(timeStep, dt);
      
      // Update visual objects to match physics
      for (let i = 0; i < balls.length; i++) {
        if (balls[i] && balls[i].body && balls[i].mesh) {
          balls[i].mesh.position.copy(balls[i].body.position);
          balls[i].mesh.quaternion.copy(balls[i].body.quaternion);
          
          // Remove balls that hit the ground or fall too far
          if ((balls[i].body.userData && 
               (balls[i].body.userData.shouldRemove || 
                (balls[i].body.userData.removeAfter && Date.now() > balls[i].body.userData.removeAfter))) || 
              balls[i].body.position.y < -10) {
            scene.remove(balls[i].mesh);
            world.removeBody(balls[i].body);
            balls.splice(i, 1);
            i--;
            
            // Update ball count
            setBallCount(balls.length);
          }
          
          // If the ball has come nearly to rest, gradually apply more damping to settle it faster
          // This prevents balls from jittering forever at rest
          else if (balls[i].body.velocity.lengthSquared() < 0.05) {
            balls[i].body.linearDamping = Math.min(balls[i].body.linearDamping * 1.01, 0.95);
          }
        }
      }
      
      renderer.render(scene, camera);
    }
    
    // Setup the scene
    initScene();
    initPhysics();
    
    // Add event listeners
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('touchstart', onTouchStart);
    
    // Setup sound toggle
    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      soundToggle.addEventListener('click', toggleSound);
    }
    
    // Setup material picker
    const materialSelect = document.getElementById('ball-material');
    if (materialSelect) {
      materialSelect.addEventListener('change', handleMaterialChange);
    }
    
    // Setup settings toggle
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      settingsButton.addEventListener('click', window.toggleSettings);
    }
    
    // Start animation loop
    animate();
    
    // Cleanup function
    return () => {
      // Clean up all event listeners
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('touchstart', onTouchStart);
      
      // Remove sound toggle listener
      const soundToggle = document.getElementById('sound-toggle');
      if (soundToggle) {
        soundToggle.removeEventListener('click', toggleSound);
      }
      
      // Remove material picker listener
      const materialSelect = document.getElementById('ball-material');
      if (materialSelect) {
        materialSelect.removeEventListener('change', handleMaterialChange);
      }
      
      // Remove settings toggle listener
      const settingsButton = document.getElementById('settings-button');
      if (settingsButton) {
        settingsButton.removeEventListener('click', window.toggleSettings);
      }
      
      // Cleanup Tone.js resources
      if (Tone.Transport) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }
      
      // Clean up physics body references
      dispensers.forEach(dispenser => {
        if (dispenser.sequencerId !== null) {
          Tone.Transport.clear(dispenser.sequencerId);
        }
      });
      
      // Stop animation frame
      cancelAnimationFrame(animate);
      
      // Clean up Three.js resources
      if (renderer) {
        renderer.dispose();
        mountRef.current?.removeChild(renderer.domElement);
      }
    };
  }, []);
  
  // Function to update platform bounciness
  const handleBouncinessChange = (event) => {
    const newRestitution = parseFloat(event.target.value);
    
    // Update both the contact material and platform material restitution
    if (contactMaterialRef.current) {
      contactMaterialRef.current.restitution = newRestitution;
    }
    
    // Update the platform material's restitution for new contacts
    if (platformMaterialRef.current) {
      platformMaterialRef.current.restitution = newRestitution;
    }
    
    // Update display value
    const display = document.getElementById('bounciness-value');
    if (display) {
      display.textContent = newRestitution.toFixed(2);
    }
    
    // Play a subtle feedback tone when value changes
    if (soundEnabled) {
      // Play a C major scale note based on the restitution value
      const noteIndex = Math.floor(newRestitution * 1.5) % 7; // Map 0-10 range to 0-6 index
      const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']; 
      const note = notes[noteIndex];
      playNote(note, '8n', undefined, 0.3);
    };
  };
  
  // Function to update tempo (BPM)
  const handleTempoChange = (event) => {
    const newTempo = parseInt(event.target.value, 10);
    setTempo(newTempo);
    
    // Update the Transport BPM
    if (Tone.Transport) {
      Tone.Transport.bpm.value = newTempo;
    }
    
    // Store in localStorage
    localStorage.setItem('preferredTempo', newTempo.toString());
    
    // Play a subtle feedback tone when value changes
    if (typeof playNote === 'function') {
      // Map tempo to a note in the C major scale
      const noteIndex = Math.floor((newTempo - 60) / 20) % 7; 
      const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']; 
      const note = notes[noteIndex];
      playNote(note, '16n', undefined, 0.3);
    }
  };
  
  // Toggle settings menu
  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  // Function to handle instrument selection
  const handleInstrumentChange = (instrument) => {
    setCurrentInstrument(instrument);
    setInstrumentType(instrument);

    // Play a test note with the new instrument
    playNote('C4', '8n', undefined, 0.5);
  };

  // Function to play a test melody
  const playTestMelody = () => {
    const notes = ['C4', 'E4', 'G4', 'C5'];
    const now = Tone.now();
    
    notes.forEach((note, index) => {
      playNote(note, '8n', now + index * 0.25, 0.5);
    });
  };

  return (
    <div className="scene-container" ref={mountRef} style={{ width: '100%', height: '100vh' }}>
      <div id="instructions">
        <h2>Musical Bounce Controls</h2>
        <p>Click to drop balls</p>
        <p>Shift + Click + Drag to create walls</p>
        <p><span role="img" aria-label="Command key">⌘</span>/<span role="img" aria-label="Control key">Ctrl</span> + Click: Place a rhythm dispenser</p>
        <p>Wall length determines pitch (2 octaves of C major)</p>
      </div>
      <button id="sound-toggle" aria-label="Toggle sound">🔊</button>
      
      {/* Ball counter */}
      <div className="ball-counter" aria-live="polite">
        <span role="status">Balls: {ballCount}</span>
      </div>
      
      {/* Dispenser counter */}
      <div className="dispenser-counter" aria-live="polite">
        <span role="status">Dispensers: {dispenserCount}</span>
      </div>
      
      {/* Visual metronome indicator */}
      <div 
        className={`metronome-indicator ${metroPulse ? 'pulse' : ''}`} 
        aria-label="Tempo indicator" 
        role="status"
      >
        <span className="metronome-dot"></span>
      </div>
      
      {/* Settings button (hamburger with circle) */}
      <button 
        id="settings-button" 
        className={`settings-button ${isSettingsOpen ? 'active' : ''}`}
        onClick={toggleSettings}
        aria-label="Settings"
        aria-expanded={isSettingsOpen}
      >
        <div className="hamburger">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      
      {/* Settings panel */}
      <div className={`settings-panel ${isSettingsOpen ? 'open' : ''}`} aria-hidden={!isSettingsOpen}>
        <h3>Bounce Settings</h3>
        <div className="setting">
          <label htmlFor="bounciness">Bounciness</label>
          <input 
            type="range" 
            id="bounciness" 
            min="0.1" 
            max="0.99" 
            step="0.01" 
            defaultValue="0.97"
            onChange={handleBouncinessChange}
            aria-label="Adjust bounciness from 0.1 to 0.99"
          />
          <div className="value" id="bounciness-value">0.97</div>
        </div>
        
        <div className="setting">
          <label htmlFor="tempo">Tempo (BPM)</label>
          <input 
            type="range" 
            id="tempo" 
            min="60" 
            max="180" 
            step="1" 
            value={tempo}
            onChange={handleTempoChange}
            aria-label="Adjust tempo from 60 to 180 BPM"
          />
          <div className="value" id="tempo-value">{tempo}</div>
        </div>
        
        <h3>Sound Settings</h3>
        <div className="setting instrument-settings">
          <label>Instrument Type</label>
          <div className="instrument-buttons">
            {Object.keys(INSTRUMENT_PREFABS).map(instrument => (
              <button 
                key={instrument}
                className={`instrument-button ${currentInstrument === instrument ? 'active' : ''}`}
                onClick={() => handleInstrumentChange(instrument)}
                aria-pressed={currentInstrument === instrument}
              >
                {instrument.charAt(0).toUpperCase() + instrument.slice(1)}
              </button>
            ))}
          </div>
        </div>
        
        <div className="setting">
          <label>Test Sound</label>
          <button 
            onClick={() => playNote('C4', '8n')}
            className="test-button"
            aria-label="Play test note"
          >
            Play Note
          </button>
          <button 
            onClick={playTestMelody}
            className="test-button"
            aria-label="Play test melody"
          >
            Play Melody
          </button>
        </div>
      </div>
      
      <NoteDisplay isDrawing={isDrawing} wallLength={wallLength} />
    </div>
  );
}

// Add some basic styling for the slider
// Ideally, this would go in a separate CSS file
const styles = `
.slider-container {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

#bounciness-slider {
  width: 150px;
}

#bounciness-value {
  min-width: 30px; /* Prevent layout shift */
  text-align: right;
}

/* Instructions panel */
#instructions {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  z-index: 10;
}

/* Sound toggle button */
#sound-toggle {
  position: absolute;
  top: 10px;
  right: 70px; /* Moved to make room for settings button */
  font-size: 1.5em;
  background: none;
  border: none;
  cursor: pointer;
  z-index: 10;
}

/* Settings toggle button */
.settings-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
}

/* Hamburger icon */
.hamburger-icon {
  width: 20px;
  height: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hamburger-icon span {
  display: block;
  height: 2px;
  width: 100%;
  background: white;
  border-radius: 1px;
}

/* Settings panel */
.settings-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 5px;
  z-index: 15;
  min-width: 250px;
  display: none;
}

.settings-panel.open {
  display: block;
}

.settings-panel h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
}

/* Material picker */
.material-picker {
  margin-top: 15px;
}

.material-picker label {
  display: block;
  margin-bottom: 5px;
}

.material-picker select {
  width: 100%;
  padding: 5px;
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 3px;
}

/* Add styles for the ball counter */
.ball-counter {
  position: absolute;
  top: 10px;
  right: 120px; /* Position to the left of sound toggle */
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.9em;
  z-index: 10;
}

/* Instrument selector in settings panel */
.instrument-settings {
  margin-top: 15px;
}

.instrument-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.instrument-button {
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid #555;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 12px;
  padding: 8px 12px;
  transition: all 0.2s ease;
  flex: 1 0 calc(33% - 8px);
  min-width: 80px;
}

.instrument-button:hover {
  background: rgba(80, 80, 80, 0.8);
}

.instrument-button.active {
  background: rgba(0, 150, 100, 0.8);
  border-color: #4dffa7;
}

.test-button {
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid #555;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  margin-top: 8px;
  margin-right: 8px;
  padding: 8px 12px;
  transition: all 0.2s ease;
}

.test-button:hover {
  background: rgba(80, 80, 80, 0.8);
}
`;

// Inject styles into the head - simple way for this example
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
} 
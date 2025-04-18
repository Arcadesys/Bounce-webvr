import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { mapLengthToNote, getNoteColor, playNoteForLength } from '../utils/midiSequencer';
import { playBounceSound, playNote, ensureToneInitialized, stopAllSounds } from '../utils/synthManager';
import NoteDisplay from './NoteDisplay';
import SelectionManager from '../utils/SelectionManager';
import SettingsMenu from './SettingsMenu';

export default function BounceScene() {
  const mountRef = useRef(null);
  const cameraRef = useRef(null);
  const dispensersRef = useRef([]);
  const contactMaterialRef = useRef(null);
  const platformMaterialRef = useRef(null);
  const collisionGroupsRef = useRef({ BALL: 1, ENVIRONMENT: 2 });
  
  // State for UI indicators
  const [isLoading, setIsLoading] = useState(true);
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
  // State for selection
  const [selectedObject, setSelectedObject] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  
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
    
    // Initialize Tone.js as early as possible
    ensureToneInitialized().catch(err => {
      console.warn("Failed to initialize Tone.js:", err);
    });
    
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
    
    // Create a selection manager for handling object selection
    const selectionManager = new SelectionManager();
    selectionManager.setSelectionChangeCallback((object, type) => {
      setSelectedObject(object);
      setSelectedType(type);
    });
    
    // Define event handlers for custom events
    const handleDeleteObject = (event) => {
      const { object, type } = event.detail;
      
      // Handle deletion based on object type
      if (type === 'beam' && object.userData && object.userData.isBeam) {
        // Remove the beam mesh from the scene
        scene.remove(object);
        
        // Remove the beam body from the physics world
        if (object.userData.body) {
          world.removeBody(object.userData.body);
        }
        
        // Remove the beam from the walls array
        const wallIndex = walls.indexOf(object);
        if (wallIndex !== -1) {
          walls.splice(wallIndex, 1);
        }
        
        // Remove the beam body from the wallBodies array if it exists
        if (object.userData.body) {
          const bodyIndex = wallBodies.indexOf(object.userData.body);
          if (bodyIndex !== -1) {
            wallBodies.splice(bodyIndex, 1);
          }
        }
        
        // Play deletion sound
        playNote('A2', '8n');
      } 
      else if (type === 'dispenser' && object.userData && object.userData.isDispenser) {
        // Clear the sequencer if it exists
        if (object.userData.sequencerId !== null) {
          Tone.Transport.clear(object.userData.sequencerId);
        }
        
        // Remove the dispenser mesh from the scene
        scene.remove(object);
        
        // Remove from the dispensers array
        const dispenserIndex = dispensers.indexOf(object);
        if (dispenserIndex !== -1) {
          dispensers.splice(dispenserIndex, 1);
          setDispenserCount(prevCount => prevCount - 1);
        }
        
        // Play deletion sound
        playNote('A2', '8n');
      }
    };
    
    const handleCreateBall = (event) => {
      const { position } = event.detail;
      const ball = createBall(position);
      balls.push(ball);
      setBallCount(prevCount => prevCount + 1);
    };
    
    // Add event listeners for custom events
    window.addEventListener('deleteObject', handleDeleteObject);
    window.addEventListener('createBall', handleCreateBall);
    
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
      ensureToneInitialized().then(() => {
        // Expose functions to the window for access in other parts of the component
        window.playBounceSound = playBounceSound;
        window.playNote = playNote;
      }).catch(err => {
        console.warn("Failed to initialize audio:", err);
      });
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

      // Define collision groups - new addition for collision filtering
      const COLLISION_GROUP_BALL = 1;
      const COLLISION_GROUP_ENVIRONMENT = 2;
      
      // Store collision groups in ref for access in createBall and other functions
      // Balls will only collide with environment objects, not with other balls
      // This provides more predictable physics for user-designed contraptions
      collisionGroupsRef.current = {
        BALL: COLLISION_GROUP_BALL,
        ENVIRONMENT: COLLISION_GROUP_ENVIRONMENT
      };

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
        material: platformMaterial, // Assign platform material
        collisionFilterGroup: collisionGroupsRef.current.ENVIRONMENT // Set environment collision group
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
      // Get collision groups from ref
      const { ENVIRONMENT } = collisionGroupsRef.current || { ENVIRONMENT: 2 };
      
      // Create invisible physics boundary
      const boundaryShape = new CANNON.Box(new CANNON.Vec3(length/2, width/2, 1));
      const boundaryBody = new CANNON.Body({
        mass: 0, // Static body
        position: new CANNON.Vec3(x, y, -10), // Position far behind in z to allow free movement
        shape: boundaryShape,
        material: platformMaterial,
        collisionFilterGroup: ENVIRONMENT // Set the collision group for environment objects
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
    
    // Create a dispenser with 16-step sequencer
    function createDispenser(position) {
      // Create visual indicator for dispenser
      // Use a box shape for dispenser with opening at bottom
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0x0055aa,
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0x003366,
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
      
      // Default sequencer pattern - activate every 4th step (1, 5, 9, 13)
      const defaultSequencerSteps = Array(16).fill(false).map((_, i) => i % 4 === 0);
      
      // Function to schedule ball drops based on sequencer pattern
      const startSequence = () => {
        // Remove previous sequencer if it exists
        if (sequencerId !== null) {
          Tone.Transport.clear(sequencerId);
        }
        
        // Create loop that checks against the sequencer pattern
        let step = 0;
        sequencerId = Tone.Transport.scheduleRepeat((time) => {
          // Check if current step is active in the sequencer pattern
          if (dispenserMesh.userData.sequencerSteps[step]) {
            // Create ball position at the BOTTOM of the dispenser with slight randomness
            const ballPosition = new THREE.Vector3(
              dispenserMesh.position.x + (Math.random() * 0.1 - 0.05), // Small X randomness
              dispenserMesh.position.y - 0.35, // Bottom of dispenser (not top)
              dispenserMesh.position.z + (Math.random() * 0.1 - 0.05)  // Small Z randomness
            );
            
            // Create the ball
            const ball = createBall(ballPosition);
            balls.push(ball);
            setBallCount(prevCount => prevCount + 1);
            
            // Play a tick sound when ball is dropped
            playNote('G4', '32n', time, 0.4);
          }
          
          // Increment step and wrap around to 0 after 15
          step = (step + 1) % 16;
        }, '16n'); // Schedule on 16th notes for finer control
        
        // Make sure transport is using current tempo
        Tone.Transport.bpm.value = tempo;
        
        // Start the transport if it's not already running
        if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
        }
      };
      
      // Store dispenser data and sequencer pattern in userData for access in settings
      dispenserMesh.userData = {
        position: position.clone(),
        sequencerId: sequencerId,
        isActive: true,
        sequencerSteps: [...defaultSequencerSteps],
        isDispenser: true
      };
      
      // Add to dispensers array
      dispensers.push(dispenserMesh);
      setDispenserCount(prevCount => prevCount + 1);
      
      // Start the sequence
      startSequence();
      
      return dispenserMesh;
    }
    
    // Create a ball at the specified position
    function createBall(position) {
      // Ball config - smaller golf ball
      const radius = 0.1; // Smaller radius for golf ball
      const mass = 0.05; // Much lighter for golf ball
      
      // Get collision groups from ref
      const { BALL, ENVIRONMENT } = collisionGroupsRef.current;
      
      // Physics body
      const sphereShape = new CANNON.Sphere(radius);
      const sphereBody = new CANNON.Body({
        mass: mass,
        shape: sphereShape,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        material: ballMaterial,
        linearDamping: 0.01, // Small damping for realistic physics
        angularDamping: 0.01, // Small angular damping too
        collisionFilterGroup: BALL, // Set the collision group this body belongs to
        collisionFilterMask: ENVIRONMENT // Set which groups this body can collide with (only environment, not other balls)
      });
      
      // Add initial velocity with slight randomness for more natural motion
      sphereBody.velocity.set(
        (Math.random() - 0.5) * 0.1,  // Small random X velocity
        -0.2 - Math.random() * 0.1,   // Downward Y velocity with randomness
        0                             // No Z velocity for more consistent physics in VR
      );
      
      // Add a small random rotation too
      sphereBody.angularVelocity.set(
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 1
      );
      
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
      
      // Get collision groups from ref
      const { ENVIRONMENT } = collisionGroupsRef.current || { ENVIRONMENT: 2 };
      
      // Create physical wall - trampoline properties
      const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.1, 0.5));
      const wallBody = new CANNON.Body({
        mass: 0, // Static body
        position: new CANNON.Vec3(center.x, center.y, center.z),
        shape: wallShape,
        material: platformMaterial, // Assign platform material
        collisionFilterGroup: ENVIRONMENT, // Set the collision group for environment objects
        // Add custom properties for trampoline-like behavior
        fixedRotation: true // Prevent rotation for stability
      });
      
      // Store note information with the wall body for collision handling
      wallBody.userData = {
        note: note,
        length: length,
        isWall: true, // Identify as a wall for collision handling
        restitution: 0.95, // High restitution for trampoline effect without adding energy
        pitch: 0.5 // Default pitch modifier
      };
      
      // Rotate physics body to match visual representation
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
      world.addBody(wallBody);
      wallBodies.push(wallBody);
      
      // Create visual wall
      const wallGeometry = new THREE.BoxGeometry(length, 0.2, 0.5);
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
      
      // Store reference to physics body and additional properties for settings
      wallMesh.userData = {
        body: wallBody,
        note: note,
        length: length,
        isBeam: true, // Identify as a beam for selection
        pitch: 0.5, // Default pitch modifier
        restitution: 0.95 // Default elasticity
      };
      
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
      
      const wallGeometry = new THREE.BoxGeometry(length, 0.2, 0.5);
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
      
      // Initialize audio on first interaction - must happen in response to user gesture
      if (!audioContext) {
        initAudio();
        // Defer actions until audio is initialized
        setTimeout(() => handleMouseClick(event), 100);
        return;
      }
      
      // If audio is already initialized, proceed with normal click handling
      handleMouseClick(event);
    }
    
    // Separate function to handle mouse click after audio is initialized
    function handleMouseClick(event) {
      // Cast ray from mouse position into scene
      raycaster.setFromCamera(mouse, camera);
      
      // Check for intersections with objects in the scene
      const intersects = raycaster.intersectObjects(scene.children);
      
      // If we hit an object, handle selection
      if (intersects.length > 0) {
        const intersected = intersects[0].object;
        
        // Check if the intersected object is a beam
        if (intersected.userData && intersected.userData.isBeam) {
          selectionManager.select(intersected, 'beam');
          return;
        }
        
        // Check if the intersected object is a dispenser
        if (intersected.userData && intersected.userData.isDispenser) {
          selectionManager.select(intersected, 'dispenser');
          return;
        }
      } else {
        // If we didn't hit anything, deselect
        selectionManager.deselect();
      }
      
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
        // Add randomness to z-position to prevent balls from sticking to z=0 plane
        intersection.z += (Math.random() - 0.5) * 1.0; // Add random value between -0.5 and 0.5
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
    
    // Setup event listeners
    function setupEventListeners() {
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('resize', onWindowResize);
      window.addEventListener('touchstart', onTouchStart);
      
      // Add keyboard event handler for Escape key to stop sounds
      window.addEventListener('keydown', onKeyDown);
    }
    
    // Handle keyboard events
    function onKeyDown(event) {
      // Stop all sounds when Escape key is pressed
      if (event.key === 'Escape') {
        stopAllSounds();
        console.log("Stopped all sounds with Escape key");
      }
    }
    
    // Initialize scene
    initScene();
    initPhysics();
    setupEventListeners();
    animate();
    
    // Create initial boundary walls to contain the balls - moved far out in z-space
    createBoundary(-5, 0, 10, 0.2, 0, 0); // Left boundary
    createBoundary(5, 0, 10, 0.2, 0, 0);  // Right boundary
    
    // Cleanup on component unmount
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('keydown', onKeyDown);
      
      // Remove custom event listeners
      window.removeEventListener('deleteObject', handleDeleteObject);
      window.removeEventListener('createBall', handleCreateBall);
      
      // Clean up Three.js scene and any other resources
      if (renderer) {
        renderer.dispose();
        // Remove canvas from DOM
        const canvas = mountRef.current.querySelector('canvas');
        if (canvas) {
          mountRef.current.removeChild(canvas);
        }
      }
    };
  }, []);

  // Function to handle beam updates from the settings menu
  const handleBeamUpdate = (beamMesh, settings) => {
    if (!beamMesh || !beamMesh.userData) return;
    
    // Update the beam's properties
    if (settings.pitch !== undefined) {
      beamMesh.userData.pitch = settings.pitch;
      
      // Also update the physics body if it exists
      if (beamMesh.userData.body) {
        beamMesh.userData.body.userData.pitch = settings.pitch;
      }
    }
    
    if (settings.restitution !== undefined) {
      beamMesh.userData.restitution = settings.restitution;
      
      // Also update the physics body if it exists
      if (beamMesh.userData.body) {
        beamMesh.userData.body.userData.restitution = settings.restitution;
      }
    }
    
    // Play a confirmation sound
    playNote('E5', '32n');
  };
  
  // Function to handle dispenser updates from the settings menu
  const handleDispenserUpdate = (dispenserMesh, settings) => {
    if (!dispenserMesh || !dispenserMesh.userData) return;
    
    // Update the dispenser's properties
    if (settings.sequencerSteps !== undefined) {
      // Stop any stuck notes before updating
      stopAllSounds();
      
      dispenserMesh.userData.sequencerSteps = [...settings.sequencerSteps];
      
      // Restart the sequence to apply the new pattern
      // This is handled by the startSequence function defined in createDispenser
      if (dispenserMesh.userData.sequencerId !== null) {
        Tone.Transport.clear(dispenserMesh.userData.sequencerId);
        
        // Create a function to restart the sequence
        let step = 0;
        dispenserMesh.userData.sequencerId = Tone.Transport.scheduleRepeat((time) => {
          // Check if current step is active in the sequencer pattern
          if (dispenserMesh.userData.sequencerSteps[step]) {
            // Create ball position at the BOTTOM of the dispenser with slight randomness
            const ballPosition = new THREE.Vector3(
              dispenserMesh.position.x + (Math.random() * 0.1 - 0.05), // Small X randomness
              dispenserMesh.position.y - 0.35, // Bottom of dispenser (not top)
              dispenserMesh.position.z + (Math.random() * 0.1 - 0.05)  // Small Z randomness
            );
            
            // Create a ball - note that we can't directly use the createBall function here
            // so we create a simpler version and rely on the animation loop to update it
            const radius = 0.1;
            const sphereGeometry = new THREE.SphereGeometry(radius, 32, 32);
            const sphereMaterial = new THREE.MeshStandardMaterial({
              color: 0xFFFFFF,
              roughness: 0.2,
              metalness: 0.1
            });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.copy(ballPosition);
            sphere.castShadow = true;
            sphere.receiveShadow = true;
            
            // Create a custom event to have the main scene handle the ball creation
            const event = new CustomEvent('createBall', { 
              detail: { position: ballPosition } 
            });
            window.dispatchEvent(event);
            
            // Play a tick sound when ball is dropped
            playNote('G4', '32n', time, 0.4);
          }
          
          // Increment step and wrap around to 0 after 15
          step = (step + 1) % 16;
        }, '16n');
      }
    }
    
    // Play a confirmation sound
    playNote('A4', '32n');
  };
  
  // Function to handle deletion of objects
  const handleDelete = (object, type) => {
    if (!object) return;
    
    // Create a custom event to have the main scene handle the deletion
    const event = new CustomEvent('deleteObject', { 
      detail: { object, type } 
    });
    window.dispatchEvent(event);
    
    // Play a delete sound
    playNote('A2', '8n');
    
    // Clear the selection
    setSelectedObject(null);
    setSelectedType(null);
  };

  // Function to handle bouncing/elasticity changes
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
  
  // Function to handle tempo changes
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
  
  // Function to toggle settings menu
  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  return (
    <div className="bounce-scene-container">
      <div ref={mountRef} className="scene-container" />
      
      {isDrawing && <NoteDisplay length={wallLength} />}
      
      <div className="ui-overlay">
        <div className="stats">
          <div>Balls: {ballCount}</div>
          <div>Dispensers: {dispenserCount}</div>
          <div className={`metronome ${metroPulse ? 'pulse' : ''}`}>♩ {tempo} BPM</div>
        </div>
        
        <div className="controls">
          <button 
            id="settings-button" 
            className="control-button settings-button" 
            onClick={toggleSettings}
            aria-expanded={isSettingsOpen}
            aria-label="Settings menu"
          >
            ⚙️
          </button>
          
          <button 
            id="sound-toggle" 
            className="control-button sound-button" 
            onClick={() => window.toggleSound && window.toggleSound()}
            aria-label="Toggle sound"
          >
            🔊
          </button>
          
          <button 
            id="mute-button" 
            className="control-button mute-button" 
            onClick={() => stopAllSounds()}
            aria-label="Stop all sounds"
          >
            🔇
          </button>
        </div>
        
        <div id="settings-menu" className="scene-settings" style={{ display: isSettingsOpen ? 'block' : 'none' }}>
          <h3>Bounce Scene Settings</h3>
          
          <div className="setting">
            <label htmlFor="bounciness">Bounciness</label>
            <input 
              type="range" 
              id="bounciness" 
              min="0.1" 
              max="0.99" 
              step="0.01" 
              defaultValue="0.95" 
              onChange={handleBouncinessChange} 
            />
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
            />
            <span>{tempo} BPM</span>
          </div>
          
          <div className="setting">
            <label htmlFor="material">Ball Material</label>
            <select id="material" onChange={(e) => window.handleMaterialChange && window.handleMaterialChange(e)}>
              <option value="golf">Golf Ball</option>
              <option value="rubber">Rubber Ball</option>
              <option value="steel">Steel Ball</option>
              <option value="wood">Wooden Ball</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="instructions">
        <p>Click to drop a ball | Hold Shift & drag to draw a beam | Cmd/Ctrl+click to add a dispenser | Click objects to select</p>
      </div>
      
      {/* Settings Menu for selected objects */}
      <SettingsMenu
        selectedObject={selectedObject}
        selectedType={selectedType}
        onClose={() => {
          setSelectedObject(null);
          setSelectedType(null);
        }}
        onDelete={handleDelete}
        onUpdateBeam={handleBeamUpdate}
        onUpdateDispenser={handleDispenserUpdate}
      />
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
`;

// Inject styles into the head - simple way for this example
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
} 
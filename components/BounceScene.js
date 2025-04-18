import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
// Import the MIDI sequencer utilities
import { mapLengthToNote, getNoteColor, playNoteForLength } from '../utils/midiSequencer';
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
    
    // Initialize Three.js scene
    function initScene() {
      // Scene setup
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000); // Black background
      
      // Camera setup
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 5;
      
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
        gravity: new CANNON.Vec3(0, -9.82, 0)
      });
      
      // Add contact material between balls and platforms
      ballPlatformContactMaterial = new CANNON.ContactMaterial(
        ballMaterial,
        platformMaterial,
        {
          friction: 0.0, // Low friction between ball and platform
          restitution: platformMaterial.restitution, // Use the platform's restitution
        }
      );
      // Store in ref for access outside useEffect
      contactMaterialRef.current = ballPlatformContactMaterial;
      world.addContactMaterial(ballPlatformContactMaterial);
      
      // Ground plane - invisible physics plane
      const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        material: platformMaterial // Assign platform material
      });
      groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
      groundBody.position.y = -2;
      groundBody.userData = { isGround: true }; // Add userData for identification
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
      ground.userData = { isGround: true }; // Add userData for identification
      scene.add(ground);
    }
    
    // Create a ball at the specified position
    function createBall(position) {
      const radius = 0.2;
      
      // Physical body
      const ballBody = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Sphere(radius),
        position: new CANNON.Vec3(position.x, position.y, position.z),
        linearDamping: 0.1,
        material: ballMaterial // Assign ball material
      });
      
      world.addBody(ballBody);
      
      // Listen for collision events to play sounds
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
      const visualBallMaterial = new THREE.MeshStandardMaterial({ 
        color: Math.random() * 0xffffff,
        roughness: 0.4,
        metalness: 0.3
      });
      const ballMesh = new THREE.Mesh(ballGeometry, visualBallMaterial);
      ballMesh.castShadow = true;
      ballMesh.receiveShadow = true;
      scene.add(ballMesh);
      
      return { body: ballBody, mesh: ballMesh };
    }
    
    // Create a wall between two points
    function createWall(start, end) {
      // Calculate wall properties
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      
      // Update state for NoteDisplay component
      setWallLength(length);
      
      // Calculate rotation to align with direction
      const wallDirection = direction.clone().normalize();
      const angle = Math.atan2(direction.y, direction.x);
      
      // Get note based on current length
      const note = mapLengthToNote(length);
      const noteColor = getNoteColor(note);
      
      // Add visible spheres at the endpoints for debugging
      const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const startSphere = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial({ color: 0xff0000 }));
      const endSphere = new THREE.Mesh(sphereGeometry, new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
      
      startSphere.position.copy(start);
      endSphere.position.copy(end);
      scene.add(startSphere);
      scene.add(endSphere);
      
      console.log("Creating beam from:", start, "to:", end);
      console.log("Angle:", angle * (180/Math.PI), "degrees");
      
      // Create physical wall
      const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.5, 0.1));
      const wallBody = new CANNON.Body({
        mass: 0, // Static body
        position: new CANNON.Vec3(center.x, center.y, center.z),
        shape: wallShape,
        material: platformMaterial // Assign platform material
      });
      
      // Store note information with the wall body for collision handling
      wallBody.userData = {
        note: note,
        length: length
      };
      
      // Rotate to match visual representation
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
      wallMesh.rotation.z = angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      scene.add(wallMesh);
      
      // Store all visual elements
      walls.push(wallMesh, startSphere, endSphere);
      
      // Play the note when the wall is created
      if (audioContext && soundEnabled) {
        playNoteForLength(audioContext, length, 0.5, 0.3);
      }
      
      return { body: wallBody, mesh: wallMesh, note: note };
    }
    
    // Update temporary wall while drawing
    function updateTempWall() {
      if (currentWallMesh) {
        scene.remove(currentWallMesh);
        currentWallMesh = null;
      }
      
      const direction = new THREE.Vector3().subVectors(wallEnd, wallStart);
      const length = direction.length();
      const center = new THREE.Vector3().addVectors(wallStart, wallEnd).multiplyScalar(0.5);
      
      // Update state for NoteDisplay component
      setWallLength(length);
      
      // If points are too close, don't draw anything
      if (length < 0.1) return;
      
      const wallDirection = direction.clone().normalize();
      const angle = Math.atan2(direction.y, direction.x);
      
      // Get note based on current length
      const note = mapLengthToNote(length);
      const noteColor = getNoteColor(note);
      
      // Create wall preview
      const wallGeometry = new THREE.BoxGeometry(length, 0.2, 0.2);
      const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: noteColor, // Use note-based color
        transparent: true,
        opacity: 0.7,
        roughness: 0.8
      });
      
      currentWallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      currentWallMesh.position.copy(center);
      currentWallMesh.rotation.z = angle;
      scene.add(currentWallMesh);
    }
    
    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const drawingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    
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
      
      // If shift is held, start drawing a wall
      if (event.shiftKey) {
        isDrawingInternal = true;
        setIsDrawing(true); // Update state for NoteDisplay
     
        // Create debug sphere at click point
        const markerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(drawingPlane, intersection);
        
        marker.position.copy(intersection);
        scene.add(marker);
        setTimeout(() => scene.remove(marker), 2000); // Remove after 2 seconds
        
        console.log("Mouse DOWN at:", intersection.x, intersection.y, intersection.z);
        
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
        
        // Get final mouse position
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        
        // Create debug sphere at release point
        const markerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(drawingPlane, intersection);
        
        marker.position.copy(intersection);
        scene.add(marker);
        setTimeout(() => scene.remove(marker), 2000); // Remove after 2 seconds
        
        console.log("Mouse UP at:", intersection.x, intersection.y, intersection.z);
        
        // Only create a wall if it has some length
        if (wallStart.distanceTo(wallEnd) > 0.2) {
          console.log("Creating wall from", wallStart, "to", wallEnd);
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
    
    // Start animation loop
    animate();
    
    // Cleanup function
    return () => {
      // Remove event listeners
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
      
      // Stop animation frame
      cancelAnimationFrame(animate);
      
      // Dispose renderer
      if (renderer) {
        renderer.dispose();
      }
      
      // Remove canvas from DOM
      if (mountRef.current && renderer && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
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
    if (window.playBounceSound) {
      window.playBounceSound(newRestitution * 0.3);
    }
  };

  return (
    <div className="scene-container" ref={mountRef} style={{ width: '100%', height: '100vh' }}>
      <div id="instructions">
        <h2>Musical Bounce Controls</h2>
        <p>Click to drop balls</p>
        <p>Shift + Click + Drag to create walls</p>
        <p>Wall length determines pitch (2 octaves of C major)</p>
        <div className="slider-container">
          <label htmlFor="bounciness-slider">Platform Bounciness:</label>
          <input 
            type="range" 
            id="bounciness-slider" 
            name="bounciness" 
            min="0.1" 
            max="10.0" 
            step="0.2" 
            defaultValue="0.5" 
            onChange={handleBouncinessChange} 
            aria-label="Adjust Platform Bounciness"
          />
          <span id="bounciness-value">0.50</span>
        </div>
      </div>
      <button id="sound-toggle" aria-label="Toggle sound">🔊</button>
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

/* You might need styles for #instructions, #sound-toggle etc. */
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

#sound-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 1.5em;
  background: none;
  border: none;
  cursor: pointer;
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
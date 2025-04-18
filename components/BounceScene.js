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
        gravity: new CANNON.Vec3(0, -9.82, 0) // Earth gravity
      });
      
      // Improve solver to handle physics more accurately
      world.solver.iterations = 10; // Default is 10, increase for more accuracy
      world.solver.tolerance = 0.001; // Default is 0.001, lower for better accuracy

      // Define default collision behavior
      world.defaultContactMaterial.contactEquationStiffness = 1e7; // Stiffer contacts for trampoline effect
      world.defaultContactMaterial.contactEquationRelaxation = 4; // More relaxation for stability
      
      // Create special materials for trampoline-like behavior
      ballMaterial.friction = 0.2; // Low friction for bowling ball
      ballMaterial.restitution = 0.5; // Medium restitution for ball itself
      
      platformMaterial.friction = 0.4; // Medium friction for platforms
      platformMaterial.restitution = 0.8; // High restitution for trampoline effect

      // Create contact material for ball-wall interactions
      ballPlatformContactMaterial = new CANNON.ContactMaterial(
        ballMaterial,
        platformMaterial,
        {
          friction: 0.2, // Low friction for clean bounces
          restitution: 0.95, // Very bouncy for trampoline effect
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
            ball.body.velocity.scale(0.998, ball.body.velocity);
          }
        }
      });
      
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
      
      // Physical body with bowling ball properties
      const ballBody = new CANNON.Body({
        mass: 5, // Heavier mass like a bowling ball
        shape: new CANNON.Sphere(radius),
        position: new CANNON.Vec3(position.x, position.y, position.z),
        linearDamping: 0.05, // Low air resistance for a heavy ball
        angularDamping: 0.2, // Some rotational damping
        material: ballMaterial // Assign ball material
      });
      
      // Initial downward velocity to simulate dropping
      ballBody.velocity.set(
        0,     // No initial x velocity
        -0.5,  // Small downward velocity
        0      // No initial z velocity
      );
      
      world.addBody(ballBody);
      
      // Listen for collision events to play sounds and handle physics
      ballBody.addEventListener('collide', (event) => {
        const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
        
        // Get the other colliding body
        const otherBody = event.body === ballBody ? event.target : event.body;
        
        // Handle collision based on what was hit
        if (otherBody.userData && otherBody.userData.isWall) {
          // For wall (trampoline) collisions, use custom restitution
          // This ensures momentum is conserved (with small loss) without adding energy
          // Use the wall's restitution value
          const wallRestitution = otherBody.userData.restitution || 0.95;
          
          // Get the contact normal
          const contactNormal = event.contact.ni;
          
          // Apply a properly scaled impulse along the normal
          // This simulates an elastic collision with the trampoline
          const impulseMagnitude = Math.abs(relativeVelocity) * ballBody.mass * wallRestitution;
          const impulse = new CANNON.Vec3(
            contactNormal.x * impulseMagnitude,
            contactNormal.y * impulseMagnitude,
            contactNormal.z * impulseMagnitude
          );
          
          // Apply small energy loss on the walls (trampolines absorb a tiny bit of energy)
          impulse.scale(0.98, impulse);
          
          // Play the note associated with the wall
          if (audioContext && soundEnabled && Math.abs(relativeVelocity) > 0.5) {
            // Velocity affects volume
            const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
            playNoteForLength(audioContext, otherBody.userData.length, 0.5, intensity * 0.5);
          }
        } 
        // For ground collisions
        else if (otherBody.userData && otherBody.userData.isGround) {
          ballBody.userData = ballBody.userData || {};
          ballBody.userData.shouldRemove = true;
          
          // Play bounce sound
          if (audioContext && soundEnabled && Math.abs(relativeVelocity) > 0.5) {
            const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
            window.playBounceSound(intensity);
          }
        }
        // Other collisions (if any)
        else if (Math.abs(relativeVelocity) > 0.5) {
          // Apply a default energy loss
          const energyLoss = 0.96; // Lose 4% energy per collision
          ballBody.velocity.scale(energyLoss, ballBody.velocity);
          
          // Play a bounce sound for any other collision
          if (audioContext && soundEnabled) {
            const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
            window.playBounceSound(intensity);
          }
        }
      });
      
      // Visual ball - heavier appearance
      const ballGeometry = new THREE.SphereGeometry(radius, 32, 32);
      const visualBallMaterial = new THREE.MeshStandardMaterial({ 
        color: Math.random() * 0xffffff,
        roughness: 0.3,
        metalness: 0.5 // More metallic appearance for a bowling ball look
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
      if (audioContext && soundEnabled) {
        playNoteForLength(audioContext, length, 0.5, 0.3);
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
          if ((balls[i].body.userData && balls[i].body.userData.shouldRemove) || 
              balls[i].body.position.y < -10) {
            scene.remove(balls[i].mesh);
            world.removeBody(balls[i].body);
            balls.splice(i, 1);
            i--;
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
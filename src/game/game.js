import * as THREE from 'three';
import { PhysicsWorld } from '../core/physics/world.js';
import { Ball } from './ball.js';
import { Wall } from './wall.js';
import { Dispenser } from './dispenser.js';
import { AudioManager } from '../core/audio/audio-manager.js';
import { SelectionManager } from '../../utils/SelectionManager.js';
import { ContextualMenu } from '../ui/contextual-menu.js';
import { EndpointControls } from '../ui/endpoint-controls.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { DispenserSequencer } from '../core/sequencer/DispenserSequencer.js';
import { PatternEditor } from '../ui/PatternEditor.js';
import { VisualConfig } from '../core/config/visualConfig.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.balls = [];
    this.walls = [];
    this.dispensers = [];
    this.isDrawing = false;
    this.wallStart = new THREE.Vector3();
    this.wallEnd = new THREE.Vector3();
    this.currentWallMesh = null;
    this.hoveredWall = null;
    
    // Initialize systems
    this.initScene();
    this.initPhysics();
    this.initAudio();
    this.initUI();
    this.initInput();
    this.initSequencer();
    
    // Start game loop
    this.lastTime = performance.now();
    this.animate();
  }
  
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    
    // Create mirror-like background plane
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x000000,      // Pure black base
      metalness: 1.0,       // Full metal
      roughness: 0.0,       // Perfect mirror
      envMapIntensity: 2.0, // Strong environment reflections
      clearcoat: 0.0,       // No clearcoat (interferes with perfect reflection)
      reflectivity: 1.0     // Maximum reflectivity
    });
    const backgroundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    backgroundPlane.position.z = -3;        // Push back slightly
    backgroundPlane.position.y = -0.5;      // Lower slightly below play area
    backgroundPlane.rotation.x = -Math.PI * 0.1; // Slight upward tilt to catch reflections
    this.scene.add(backgroundPlane);
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 2.5, 12);    // Adjusted camera height
    this.camera.lookAt(0, -0.5, 0);          // Look slightly down
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Post-processing setup
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      VisualConfig.bloom.strength,
      VisualConfig.bloom.radius,
      VisualConfig.bloom.threshold
    );
    this.composer.addPass(bloomPass);
    
    // Minimal ambient light
    const ambientLight = new THREE.AmbientLight(
      0xffffff, 
      VisualConfig.lighting.ambient.intensity
    );
    this.scene.add(ambientLight);
    
    // Add point light that follows the camera
    this.cameraLight = new THREE.PointLight(
      0xffffff, 
      VisualConfig.lighting.camera.intensity,
      VisualConfig.lighting.camera.distance
    );
    this.camera.add(this.cameraLight);
    this.scene.add(this.camera);
    
    // Try to load environment map after a short delay to ensure everything is initialized
    setTimeout(() => {
      try {
        const cubeTextureLoader = new THREE.CubeTextureLoader();
        const environmentMap = cubeTextureLoader.load([
          'textures/environmentMap/px.jpg',
          'textures/environmentMap/nx.jpg',
          'textures/environmentMap/py.jpg',
          'textures/environmentMap/ny.jpg',
          'textures/environmentMap/pz.jpg',
          'textures/environmentMap/nz.jpg'
        ]);
        this.scene.environment = environmentMap;
        console.log("Environment map loaded successfully");
      } catch (error) {
        console.error("Failed to load environment map:", error);
      }
    }, 1000);
  }
  
  initPhysics() {
    this.physics = new PhysicsWorld();
  }
  
  initAudio() {
    this.audio = new AudioManager();
    
    // We'll initialize audio on first user interaction
    this.audioInitialized = false;
    
    // Listen for ball collisions
    window.addEventListener('ballCollision', (event) => {
      const { velocity } = event.detail;
      this.audio.playCollisionSound(velocity);
    });
  }
  
  initUI() {
    // Make game instance available globally for UI components
    window.game = this;
    
    // Initialize selection manager
    this.selectionManager = new SelectionManager();
    this.selectionManager.setSelectionChangeCallback((object, type) => {
      if (object && type === 'wall') {
        this.endpointControls.show(object);
        this.contextualMenu.show(object.mesh.position, object.mesh);
      } else {
        this.endpointControls.hide();
        this.contextualMenu.hide();
      }
    });
    
    // Initialize contextual menu
    this.contextualMenu = new ContextualMenu();
    this.contextualMenu.setCallbacks({
      onDelete: () => {
        const selection = this.selectionManager.getSelection();
        if (selection.object && selection.type === 'wall') {
          this.deleteWall(selection.object);
        }
      },
      onChangeMaterial: () => {
        // TODO: Implement material change
      }
    });
    
    // Initialize endpoint controls
    this.endpointControls = new EndpointControls();
    this.endpointControls.setCallbacks({
      onEndpointsChanged: (wall) => {
        // Wall geometry is updated automatically
      }
    });
    
    // Add endpoint controls to scene
    this.scene.add(this.endpointControls.startControl);
    this.scene.add(this.endpointControls.endControl);
    
    // Add dispenser context menu
    this.contextualMenu.addMenuItem('Delete', () => {
      const selected = this.selectionManager.getSelected();
      if (selected && selected.type === 'dispenser') {
        const dispenser = selected.object;
        const index = this.dispensers.indexOf(dispenser);
        if (index > -1) {
          dispenser.dispose(this.scene);
          this.dispensers.splice(index, 1);
        }
      }
    });
  }
  
  initInput() {
    // Mouse/touch input handling
    this.canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    
    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    
    // Initialize audio on first user interaction
    const initAudioOnInteraction = async () => {
      if (!this.audioInitialized) {
        await this.audio.start();
        this.audioInitialized = true;
        
        // Remove the event listeners after initialization
        this.canvas.removeEventListener('mousedown', initAudioOnInteraction);
        this.canvas.removeEventListener('touchstart', initAudioOnInteraction);
      }
    };
    
    this.canvas.addEventListener('mousedown', initAudioOnInteraction);
    this.canvas.addEventListener('touchstart', initAudioOnInteraction);
    
    // Window resize handling
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }
  
  initSequencer() {
    this.sequencer = new DispenserSequencer();
    this.patternEditor = new PatternEditor(this.sequencer);
    
    // Add sequencer controls to UI
    const controls = document.createElement('div');
    controls.className = 'sequencer-controls';
    controls.innerHTML = `
      <button id="play-pause">Play</button>
      <input type="range" id="tempo" min="60" max="200" value="120">
      <span id="tempo-display">120 BPM</span>
    `;
    document.body.appendChild(controls);
    
    // Set up control handlers
    const playPauseBtn = document.getElementById('play-pause');
    const tempoSlider = document.getElementById('tempo');
    const tempoDisplay = document.getElementById('tempo-display');
    
    playPauseBtn.addEventListener('click', () => {
      if (this.sequencer.isPlaying) {
        this.sequencer.stop();
        playPauseBtn.textContent = 'Play';
      } else {
        this.sequencer.start();
        playPauseBtn.textContent = 'Stop';
      }
    });
    
    tempoSlider.addEventListener('input', (e) => {
      const bpm = parseInt(e.target.value);
      this.sequencer.setTempo(bpm);
      tempoDisplay.textContent = `${bpm} BPM`;
    });
  }
  
  onPointerDown(event) {
    const intersection = this.getIntersectionPoint(event);
    if (!intersection) return;
    
    // Check for endpoint control interaction first
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    ), this.camera);
    
    if (this.endpointControls.onPointerDown(event, this.camera, raycaster)) {
      return;
    }
    
    // Check for wall or dispenser selection
    const wallIntersects = raycaster.intersectObjects(
      this.walls.map(wall => wall.mesh)
    );
    const dispenserIntersects = raycaster.intersectObjects(
      this.dispensers.map(dispenser => dispenser.mesh)
    );
    
    if (wallIntersects.length > 0) {
      const wall = this.walls.find(w => w.mesh === wallIntersects[0].object);
      if (wall) {
        if (this.selectionManager.isSelected(wall)) {
          this.selectionManager.deselect();
        } else {
          this.selectionManager.select(wall, 'wall');
        }
        return;
      }
    } else if (dispenserIntersects.length > 0) {
      const dispenser = this.dispensers.find(d => d.mesh === dispenserIntersects[0].object);
      if (dispenser) {
        if (this.selectionManager.isSelected(dispenser)) {
          this.selectionManager.deselect();
          this.patternEditor.hide();
        } else {
          this.selectionManager.select(dispenser, 'dispenser');
          // Add dispenser to sequencer when selected
          this.sequencer.addDispenser(dispenser.id);
          dispenser.setSequenced(true);
          this.patternEditor.show(dispenser);
        }
        return;
      }
    } else {
      this.selectionManager.deselect();
      this.patternEditor.hide();
    }
    
    // If no wall selected and shift is pressed, start drawing
    if (event.shiftKey) {
      this.isDrawing = true;
      this.wallStart.copy(intersection);
      this.wallEnd.copy(intersection);
    } else if (event.button === 2) { // Right click
      // Create dispenser
      const dispenser = new Dispenser(intersection, this.physics);
      this.dispensers.push(dispenser);
      this.scene.add(dispenser.mesh);
    } else {
      // Drop ball on regular click
      this.createBall(intersection);
    }
  }
  
  onPointerMove(event) {
    // Handle endpoint control movement
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    ), this.camera);
    
    if (this.endpointControls.onPointerMove(event, this.camera, raycaster)) {
      return;
    }
    
    // Check for wall hover
    if (!this.isDrawing) {
      const wallIntersects = raycaster.intersectObjects(
        this.walls.map(wall => wall.mesh)
      );
      
      // Handle hover highlighting
      if (wallIntersects.length > 0) {
        const wall = this.walls.find(w => w.mesh === wallIntersects[0].object);
        if (wall && wall !== this.hoveredWall) {
          // Unhighlight previous wall
          if (this.hoveredWall) {
            this.hoveredWall.highlight(false);
          }
          
          // Highlight new wall
          wall.highlight(true);
          this.hoveredWall = wall;
          
          // Play hover sound
          if (window.playNote) {
            window.playNote('A4', '64n', null, 0.1);
          }
        }
      } else if (this.hoveredWall) {
        // Unhighlight when not hovering any wall
        this.hoveredWall.highlight(false);
        this.hoveredWall = null;
      }
    }
    
    if (!this.isDrawing || !event.shiftKey) {
      if (this.isDrawing) {
        // Cancel beam creation if shift is released
        this.isDrawing = false;
        if (this.currentWallMesh) {
          this.scene.remove(this.currentWallMesh);
          this.currentWallMesh = null;
        }
      }
      return;
    }
    
    const intersection = this.getIntersectionPoint(event);
    if (intersection) {
      this.wallEnd.copy(intersection);
      this.updateWallPreview();
    }
  }
  
  onPointerUp(event) {
    // Handle endpoint control release
    this.endpointControls.onPointerUp();
    
    if (this.isDrawing) {
      this.isDrawing = false;
      if (this.wallStart.distanceTo(this.wallEnd) > 0.2) {
        this.createWall(this.wallStart, this.wallEnd);
      }
      if (this.currentWallMesh) {
        this.scene.remove(this.currentWallMesh);
        this.currentWallMesh = null;
      }
    }
  }
  
  onTouchStart(event) {
    event.preventDefault();
    const intersection = this.getIntersectionPoint(event.touches[0]);
    if (intersection) {
      this.createBall(intersection);
    }
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  getIntersectionPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    
    raycaster.ray.intersectPlane(plane, intersection);
    return intersection;
  }
  
  createBall(position) {
    const ball = new Ball(position, 0.1, this.physics);
    this.balls.push(ball);
    this.scene.add(ball.mesh);
    
    // Add any existing flash effects to the scene
    ball.flashEffects.forEach(effect => {
      this.scene.add(effect.mesh);
    });
  }
  
  createWall(start, end) {
    const wall = new Wall(start, end, this.physics);
    this.walls.push(wall);
    this.scene.add(wall.mesh);
  }
  
  deleteWall(wall) {
    const index = this.walls.indexOf(wall);
    if (index !== -1) {
      wall.dispose(this.scene, this.physics);
      this.walls.splice(index, 1);
      this.selectionManager.deselect();
    }
  }
  
  updateWallPreview() {
    if (this.currentWallMesh) {
      this.scene.remove(this.currentWallMesh);
    }
    
    const direction = new THREE.Vector3().subVectors(this.wallEnd, this.wallStart);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(this.wallStart, this.wallEnd).multiplyScalar(0.5);
    
    const geometry = new THREE.BoxGeometry(length, 0.2, 0.2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.5,
      metalness: 0.5,
      emissive: 0x808080,
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.7,
      envMapIntensity: 0.5
    });
    
    this.currentWallMesh = new THREE.Mesh(geometry, material);
    this.currentWallMesh.position.copy(center);
    this.currentWallMesh.rotation.z = Math.atan2(direction.y, direction.x);
    
    this.scene.add(this.currentWallMesh);
  }
  
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Update physics
    this.physics.step(deltaTime);
    
    // Update balls and remove any that are out of bounds
    this.balls = this.balls.filter(ball => {
      const shouldRemove = ball.update();
      if (shouldRemove) {
        ball.dispose(this.scene, this.physics);
        return false;
      }
      return true;
    });
    
    // Update dispensers
    this.dispensers.forEach(dispenser => {
      const ball = dispenser.update(currentTime);
      if (ball) {
        this.balls.push(ball);
        this.scene.add(ball.mesh);
      }
    });
    
    // Update wall preview if drawing
    if (this.isDrawing) {
      this.updateWallPreview();
    }
    
    // Render scene with post-processing
    this.composer.render();
  }
} 
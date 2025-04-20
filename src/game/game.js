import * as THREE from 'three';
import { PhysicsWorld } from '../core/physics/world.js';
import { Ball } from './ball.js';
import { Wall } from './wall.js';
import { AudioManager } from '../core/audio/audio-manager.js';
import { SelectionManager } from '../../utils/SelectionManager.js';
import { ContextualMenu } from '../ui/contextual-menu.js';
import { EndpointControls } from '../ui/endpoint-controls.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.balls = [];
    this.walls = [];
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
    
    // Start game loop
    this.lastTime = performance.now();
    this.animate();
  }
  
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.5, 12);
    this.camera.lookAt(0, 0, 0);
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }
  
  initPhysics() {
    this.physics = new PhysicsWorld();
  }
  
  initAudio() {
    this.audio = new AudioManager();
    this.audio.start();
    
    // Listen for ball collisions
    window.addEventListener('ballCollision', (event) => {
      const { velocity, wallLength, position } = event.detail;
      this.audio.playCollisionSound(velocity, wallLength, position);
    });
  }
  
  initUI() {
    // Make game instance available globally for UI components
    window.game = this;
    
    // Initialize selection manager
    this.selectionManager = new SelectionManager();
    this.selectionManager.setSelectionChangeCallback((selectedObjects) => {
      if (selectedObjects.length > 0) {
        // For now, we'll just handle the first selected object
        const selectedObject = selectedObjects[0];
        if (selectedObject instanceof Wall) {
          this.endpointControls.show(selectedObject);
          this.contextualMenu.show(selectedObject.mesh.position, selectedObject.mesh);
        }
      } else {
        this.endpointControls.hide();
        this.contextualMenu.hide();
      }
    });
    
    // Initialize contextual menu
    this.contextualMenu = new ContextualMenu();
    this.contextualMenu.setCallbacks({
      onDelete: () => {
        const selectedObjects = this.selectionManager.getSelection();
        if (selectedObjects.length > 0) {
          const selectedObject = selectedObjects[0];
          if (selectedObject instanceof Wall) {
            this.deleteWall(selectedObject);
          }
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
  }
  
  initInput() {
    // Mouse/touch input handling
    this.canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    
    // Window resize handling
    window.addEventListener('resize', this.onWindowResize.bind(this));
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
    
    // Check for wall selection
    const wallIntersects = raycaster.intersectObjects(
      this.walls.map(wall => wall.mesh)
    );
    
    if (wallIntersects.length > 0) {
      const wall = this.walls.find(w => w.mesh === wallIntersects[0].object);
      if (wall) {
        // Prevent event from bubbling up to avoid immediate menu close
        event.stopPropagation();
        
        // If clicking the same wall, deselect it
        if (this.selectionManager.isSelected(wall)) {
          this.selectionManager.deselect();
          
          // Play deselection sound
          if (window.playNote) {
            window.playNote('D4', '32n', null, 0.1);
          }
          
          // Announce deselection for screen readers
          const announcer = document.getElementById('announcer');
          if (announcer) {
            announcer.textContent = 'Beam deselected';
          }
        } else {
          // Select the new wall
          this.selectionManager.select(wall);
          
          // Play selection sound
          if (window.playNote) {
            window.playNote('E5', '32n', null, 0.2);
          }
          
          // Announce selection for screen readers
          const announcer = document.getElementById('announcer');
          if (announcer) {
            announcer.textContent = 'Beam selected';
          }
        }
        return;
      }
    } else {
      // Deselect if clicking empty space
      if (this.selectionManager.getSelection().length > 0) {
        this.selectionManager.deselect();
        
        // Play deselection sound
        if (window.playNote) {
          window.playNote('D4', '32n', null, 0.1);
        }
        
        // Announce deselection for screen readers
        const announcer = document.getElementById('announcer');
        if (announcer) {
          announcer.textContent = 'Beam deselected';
        }
      }
    }
    
    // If no wall selected and shift is pressed, start drawing
    if (event.shiftKey) {
      this.isDrawing = true;
      this.wallStart.copy(intersection);
      this.wallEnd.copy(intersection);
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
    const ball = new Ball(this.physics, position);
    this.balls.push(ball);
    this.scene.add(ball.mesh);
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
      transparent: true,
      opacity: 0.5
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
    this.balls = this.balls.filter(ball => !ball.update());
    
    // Update wall preview if drawing
    if (this.isDrawing) {
      this.updateWallPreview();
    }
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
} 
import * as THREE from 'three';
import { PhysicsWorld } from '../core/physics/world.js';
import { Ball } from './ball.js';
import { Wall } from './wall.js';
import { AudioManager } from '../core/audio/audio-manager.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.balls = [];
    this.walls = [];
    this.isDrawing = false;
    this.wallStart = new THREE.Vector3();
    this.wallEnd = new THREE.Vector3();
    this.currentWallMesh = null;
    
    // Initialize systems
    this.initScene();
    this.initPhysics();
    this.initAudio();
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
    this.camera.position.set(1, 1.5, 12);
    this.camera.lookAt(1, 0, 0);
    
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
    
    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(4, 4);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x228B22,
      roughness: 0.7,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }
  
  initPhysics() {
    this.physics = new PhysicsWorld();
    
    // Create boundary walls
    this.physics.createBoundary(-1, -1, 4, 0.5, 0, Math.PI / 2); // Left
    this.physics.createBoundary(1, -1, 4, 0.5, 0, Math.PI / 2);  // Right
    this.physics.createBoundary(0, 1, 4, 0.5, Math.PI / 2, 0);   // Top
  }
  
  initAudio() {
    this.audio = new AudioManager();
    
    // Listen for ball collisions
    window.addEventListener('ballCollision', (event) => {
      const { velocity, wallLength, position } = event.detail;
      this.audio.playCollisionSound(velocity, wallLength, position);
    });
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

    if (event.shiftKey) {
      // Start drawing beam when shift is pressed
      this.isDrawing = true;
      this.wallStart.copy(intersection);
      this.wallEnd.copy(intersection);
    } else {
      // Drop ball on regular click
      this.createBall(intersection);
    }
  }
  
  onPointerMove(event) {
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
  }
  
  createWall(start, end) {
    const wall = new Wall(start, end, this.physics);
    this.walls.push(wall);
    this.scene.add(wall.mesh);
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
  
  update(dt) {
    // Update physics
    this.physics.step(dt);
    
    // Update balls
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      ball.update();
      
      if (ball.shouldRemove()) {
        ball.dispose(this.scene, this.physics);
        this.balls.splice(i, 1);
      }
    }
  }
  
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    const time = performance.now();
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
} 
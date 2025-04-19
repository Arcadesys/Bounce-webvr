import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.balls = [];
    this.walls = [];
    this.isInitialized = false;
    this.isDrawing = false;
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.drawingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    // Initialize everything synchronously to avoid race conditions
    this.initScene();
    this.initPhysics();
    this.addVisualHelpers();
    this.setupEventListeners();
    
    // Start animation loop
    this.animate();
  }

  initScene() {
    // Scene setup
    this.scene.background = new THREE.Color(0x000011);
    
    // Camera setup - adjusted for better viewing angle
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    // Position camera for better view of the scene
    this.camera.position.set(5, 15, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    this.scene.add(directionalLight);
  }

  initPhysics() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    
    // Create ground plane
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: groundShape,
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.5
      })
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);

    // Create ground visual
    const groundGeometry = new THREE.PlaneGeometry(30, 30);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
  }

  addVisualHelpers() {
    // Add grid helper
    const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
    this.scene.add(gridHelper);

    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    this.scene.add(axesHelper);
  }

  setupEventListeners() {
    window.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  onMouseDown = async (event) => {
    // Audio should already be initialized through the modal
    this.updateMousePosition(event);

    if (event.shiftKey) {
      this.isDrawing = true;
      this.wallStart = this.getIntersectionPoint();
      console.log('Started drawing wall at:', this.wallStart);
    } else if (event.metaKey || event.ctrlKey) {
      const position = this.getIntersectionPoint();
      this.createDispenser(position);
      console.log('Created dispenser at:', position);
    } else {
      const position = this.getIntersectionPoint();
      this.createBall(position);
      console.log('Created ball at:', position);
    }
  }

  onMouseMove = (event) => {
    this.updateMousePosition(event);
    if (this.isDrawing) {
      // Update temporary wall visualization
      const currentPoint = this.getIntersectionPoint();
      // TODO: Add temporary wall visualization
    }
  }

  onMouseUp = () => {
    if (this.isDrawing) {
      const endPoint = this.getIntersectionPoint();
      this.createWall(this.wallStart, endPoint);
      this.isDrawing = false;
    }
  }

  onWindowResize = () => {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 20;
    
    this.camera.left = -frustumSize * aspect / 2;
    this.camera.right = frustumSize * aspect / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / -2;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateMousePosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getIntersectionPoint() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.drawingPlane, intersection);
    return intersection;
  }

  createBall(position) {
    // Create physics body
    const radius = 0.3; // Smaller radius
    const sphereShape = new CANNON.Sphere(radius);
    const sphereBody = new CANNON.Body({
      mass: 1,
      shape: sphereShape,
      position: new CANNON.Vec3(position.x, position.y + 5, position.z), // Start higher up
      material: new CANNON.Material({
        friction: 0.3,
        restitution: 0.7
      })
    });
    this.world.addBody(sphereBody);

    // Create visual sphere
    const geometry = new THREE.SphereGeometry(radius);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x00ff00,
      roughness: 0.4,
      metalness: 0.6
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.balls.push({ body: sphereBody, mesh });
    console.log('Ball created:', { position: sphereBody.position });
  }

  createWall(start, end) {
    // TODO: Implement wall creation
    console.log('Creating wall from', start, 'to', end);
  }

  createDispenser(position) {
    // TODO: Implement dispenser creation
    console.log('Creating dispenser at', position);
  }

  animate = () => {
    requestAnimationFrame(this.animate);

    // Step physics world
    this.world.step(1/60);

    // Update ball positions and remove out-of-bounds balls
    this.balls = this.balls.filter(ball => {
      ball.mesh.position.copy(ball.body.position);
      ball.mesh.quaternion.copy(ball.body.quaternion);

      // Remove balls that fall too far
      if (ball.body.position.y < -20) {
        this.scene.remove(ball.mesh);
        this.world.removeBody(ball.body);
        return false;
      }
      return true;
    });

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    // Remove event listeners
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('resize', this.onWindowResize);

    // Clean up Three.js resources
    this.renderer.dispose();
    
    // Clean up physics world
    this.world.bodies.forEach(body => {
      this.world.removeBody(body);
    });
    
    // Stop animation
    cancelAnimationFrame(this.animate);
  }
} 
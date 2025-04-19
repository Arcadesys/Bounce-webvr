import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { registerBeam, unregisterBeam } from '../src/physics';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

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
    this.wallCounter = 0; // Counter for generating unique wall IDs
    this.onWallsUpdate = null;
    
    // Initialize everything synchronously to avoid race conditions
    this.initScene();
    this.initPhysics();
    this.addVisualHelpers();
    this.setupEventListeners();
    this.setupPostProcessing();
    
    // Start animation loop
    this.animate();
  }

  initScene() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // Load environment map
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    
    new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/royal_esplanade_1k.hdr', (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      this.scene.environment = envMap;
      texture.dispose();
      pmremGenerator.dispose();
    });

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(ambientLight);

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
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
    const groundMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.9,
      thickness: 0.5,
      envMapIntensity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
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

  createWall(startPoint, endPoint) {
    const wallId = `wall-${this.wallCounter++}`;
    const wall = {
      id: wallId,
      mesh: null,
      body: null,
      voice: this.wallCounter % 2 === 0 ? 'A' : 'B' // Alternate between voices
    };

    // Calculate wall dimensions and position
    const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
    const length = direction.length();
    const center = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);

    // Create mesh
    const geometry = new THREE.BoxGeometry(length, 0.2, 0.2);
    const material = new THREE.MeshPhongMaterial({ color: 0x808080 });
    wall.mesh = new THREE.Mesh(geometry, material);
    wall.mesh.position.copy(center);
    wall.mesh.lookAt(endPoint);
    this.scene.add(wall.mesh);

    // Create physics body
    wall.body = createWallBody(length, center, direction);
    this.world.addBody(wall.body);

    // Register with physics system
    registerBeam(wallId, wall.body, wall.voice);

    // Add to walls array and notify
    this.walls.push(wall);
    if (this.onWallsUpdate) {
      this.onWallsUpdate([...this.walls]);
    }

    return wall;
  }

  updateWallVoice(wallId, voice) {
    const wall = this.walls.find(w => w.id === wallId);
    if (wall) {
      wall.voice = voice;
      registerBeam(wallId, wall.body, voice);
      if (this.onWallsUpdate) {
        this.onWallsUpdate([...this.walls]);
      }
    }
  }

  createDispenser(position) {
    // TODO: Implement dispenser creation
    console.log('Creating dispenser at', position);
  }

  setupPostProcessing() {
    this.composer = new THREE.EffectComposer(this.renderer);
    
    // Add render pass
    const renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    // Add bloom pass for glow effect
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,  // strength
      0.4,  // radius
      0.85  // threshold
    );
    this.composer.addPass(bloomPass);
    
    // Add chromatic aberration for glass-like effect
    const chromaticAberrationPass = new THREE.ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.003 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        varying vec2 vUv;
        void main() {
          vec2 offset = amount * vec2(cos(vUv.y * 3.14159), sin(vUv.x * 3.14159));
          vec4 cr = texture2D(tDiffuse, vUv + offset);
          vec4 cg = texture2D(tDiffuse, vUv);
          vec4 cb = texture2D(tDiffuse, vUv - offset);
          gl_FragColor = vec4(cr.r, cg.g, cb.b, cg.a);
        }
      `
    });
    this.composer.addPass(chromaticAberrationPass);
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

    // Use composer instead of renderer
    this.composer.render();
  }

  dispose() {
    // Remove event listeners
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('resize', this.onWindowResize);

    // Clean up Three.js resources
    this.renderer.dispose();
    
    // Unregister all walls
    this.walls.forEach(wall => {
      this.scene.remove(wall.mesh);
      this.world.removeBody(wall.body);
      unregisterBeam(wall.id);
    });
    this.walls = [];
    
    // Clean up physics world
    this.world.bodies.forEach(body => {
      this.world.removeBody(body);
    });
    
    // Stop animation
    cancelAnimationFrame(this.animate);
  }
} 
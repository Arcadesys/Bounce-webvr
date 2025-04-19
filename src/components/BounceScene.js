import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { mapLengthToNote } from '../utils.js';

export class BounceScene {
    constructor(container, logger) {
        this.logger = logger || console;
        this.logger.log('BounceScene: Constructor started');
        
        if (!container) {
            throw new Error('Container element is required');
        }
        
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.world = new CANNON.World();
        this.bodies = [];
        this.walls = [];
        this.balls = [];
        this.isDrawing = false;
        this.wallLength = 0;
        this.settings = {
            bounciness: 0.7,
            tempo: 120,
            instrument: 'marimba'
        };
        this.audioReady = false;
        this.currentNote = null;
        
        this.logger.log('BounceScene: Constructor completed');
    }

    async init() {
        try {
            this.logger.log('BounceScene: Starting initialization');
            
            this.logger.log('BounceScene: Initializing scene...');
            await this.initScene();
            this.logger.log('BounceScene: Scene initialized');
            
            this.logger.log('BounceScene: Initializing physics...');
            await this.initPhysics();
            this.logger.log('BounceScene: Physics initialized');
            
            this.logger.log('BounceScene: Initializing audio...');
            await this.initAudio();
            this.logger.log('BounceScene: Audio initialized');
            
            this.logger.log('BounceScene: Setting up event listeners...');
            this.initEventListeners();
            this.logger.log('BounceScene: Event listeners initialized');
            
            return true;
        } catch (error) {
            this.logger.log('BounceScene: Initialization failed: ' + error.message, 'error');
            throw error;
        }
    }

    async initScene() {
        try {
            this.logger.log('BounceScene: Setting up renderer');
            // Set up renderer
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setClearColor(0x000011);
            this.container.appendChild(this.renderer.domElement);

            this.logger.log('BounceScene: Setting up camera');
            // Set up camera
            this.camera.position.z = 5;
            this.camera.position.y = 2;
            this.camera.lookAt(0, 0, 0);

            this.logger.log('BounceScene: Setting up lights');
            // Add lights
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(0, 1, 1);
            this.scene.add(directionalLight);

            this.logger.log('BounceScene: Setting up controls');
            // Set up controls
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            
            this.logger.log('BounceScene: Scene setup complete');
        } catch (error) {
            this.logger.log('BounceScene: Scene initialization failed: ' + error.message, 'error');
            throw error;
        }
    }

    async initPhysics() {
        try {
            this.logger.log('BounceScene: Setting up physics world');
            this.world.gravity.set(0, -9.82, 0);
            this.world.broadphase = new CANNON.NaiveBroadphase();
            this.world.solver.iterations = 10;

            this.logger.log('BounceScene: Creating ground plane physics');
            // Create ground plane
            const groundShape = new CANNON.Plane();
            const groundBody = new CANNON.Body({ mass: 0 });
            groundBody.addShape(groundShape);
            groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
            this.world.addBody(groundBody);
            this.bodies.push(groundBody);

            this.logger.log('BounceScene: Creating ground plane visualization');
            // Add ground plane visualization
            const groundGeometry = new THREE.PlaneGeometry(100, 100);
            const groundMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x333333,
                roughness: 0.8,
                metalness: 0.2
            });
            const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
            groundMesh.rotation.x = -Math.PI / 2;
            groundMesh.receiveShadow = true;
            this.scene.add(groundMesh);
            
            this.logger.log('BounceScene: Physics setup complete');
        } catch (error) {
            this.logger.log('BounceScene: Physics initialization failed: ' + error.message, 'error');
            throw error;
        }
    }

    async initAudio() {
        try {
            this.logger.log('BounceScene: Starting audio initialization');
            this.logger.log('BounceScene: Attempting to start Tone.js...');
            await Tone.start();
            this.logger.log('BounceScene: Tone.js started successfully');
            
            this.logger.log('BounceScene: Creating synth...');
            this.synth = new Tone.Synth({
                oscillator: {
                    type: 'triangle'
                },
                envelope: {
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 1
                }
            }).toDestination();
            
            this.audioReady = true;
            this.logger.log('BounceScene: Audio setup complete');
        } catch (error) {
            this.logger.log('BounceScene: Audio initialization failed: ' + error.message, 'warn');
            // Continue without audio rather than failing completely
            this.audioReady = false;
        }
    }

    initEventListeners() {
        window.addEventListener('resize', () => this.handleResize(window.innerWidth, window.innerHeight));
        this.logger.log('BounceScene: Event listeners setup complete');
    }

    handleResize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    createWall(x, y) {
        if (!this.audioReady) {
            this.logger.log('BounceScene: Skipping wall creation - audio not ready', 'warn');
            return;
        }

        const wallGeometry = new THREE.BoxGeometry(0.1, 1, 1);
        const wallMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5
        });

        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        wallMesh.position.set(x * 5, 0.5, y * 5);
        this.scene.add(wallMesh);
        this.walls.push(wallMesh);

        const wallShape = new CANNON.Box(new CANNON.Vec3(0.05, 0.5, 0.5));
        const wallBody = new CANNON.Body({ mass: 0 });
        wallBody.addShape(wallShape);
        wallBody.position.copy(wallMesh.position);
        this.world.addBody(wallBody);
        this.bodies.push(wallBody);

        if (this.audioReady) {
            this.synth.triggerAttackRelease('C4', '8n');
        }
    }

    update() {
        this.world.step(1 / 60);

        this.walls.forEach((wall, index) => {
            wall.position.copy(this.bodies[index].position);
            wall.quaternion.copy(this.bodies[index].quaternion);
        });

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
} 
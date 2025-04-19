import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { mapLengthToNote } from '../utils.js';

export class BounceScene {
    constructor() {
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

        this.init();
    }

    async init() {
        await this.initScene();
        await this.initPhysics();
        await this.initAudio();
        this.initEventListeners();
    }

    async initScene() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        document.body.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;
        this.camera.position.y = 2;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 1);
        this.scene.add(directionalLight);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    async initPhysics() {
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 10;

        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        this.world.addBody(groundBody);
        this.bodies.push(groundBody);
    }

    async initAudio() {
        await Tone.start();
        this.synth = new Tone.Marimba().toDestination();
        this.audioReady = true;
    }

    initEventListeners() {
        window.addEventListener('resize', () => this.handleResize(window.innerWidth, window.innerHeight));
    }

    handleResize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    createWall(x, y) {
        if (!this.audioReady) return;

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

        this.synth.triggerAttackRelease('C4', '8n');
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
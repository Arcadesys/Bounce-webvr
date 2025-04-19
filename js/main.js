import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { mapLengthToNote } from './utils.js';
import { BounceScene } from './components/BounceScene.js';
import './style.css';

document.addEventListener('DOMContentLoaded', () => {
    // Create scene container
    const container = document.createElement('div');
    container.id = 'scene-container';
    document.body.appendChild(container);

    // Initialize scene
    const scene = new BounceScene(container);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        scene.handleResize();
    });

    // Handle click/tap to create walls
    window.addEventListener('click', (event) => {
        const x = (event.clientX / window.innerWidth) * 2 - 1;
        const y = -(event.clientY / window.innerHeight) * 2 + 1;
        scene.createWall(x, y);
    });

    // Handle touch events for mobile
    window.addEventListener('touchstart', (event) => {
        event.preventDefault();
        const touch = event.touches[0];
        const x = (touch.clientX / window.innerWidth) * 2 - 1;
        const y = -(touch.clientY / window.innerHeight) * 2 + 1;
        scene.createWall(x, y);
    }, { passive: false });

    // Start animation loop
    function animate() {
        requestAnimationFrame(animate);
        scene.update();
    }
    animate();

    console.log('Bounce-webvr initialized');
}); 
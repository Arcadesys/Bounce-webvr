import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { mapLengthToNote } from './utils.js';
import { BounceScene } from './components/BounceScene.js';
import './style.css';

// Create a logger that writes to both console and DOM
class Logger {
    constructor() {
        this.logs = [];
        this.logsElement = null;
    }

    createLogsElement() {
        this.logsElement = document.createElement('div');
        this.logsElement.className = 'loading-logs';
        return this.logsElement;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        
        // Log to console
        if (type === 'error') {
            console.error(logEntry);
        } else if (type === 'warn') {
            console.warn(logEntry);
        } else {
            console.log(logEntry);
        }

        // Add to logs array
        this.logs.push({ message: logEntry, type });

        // Update DOM if logs element exists
        if (this.logsElement) {
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = logEntry;
            this.logsElement.appendChild(entry);
            this.logsElement.scrollTop = this.logsElement.scrollHeight;
        }
    }
}

// Create logger instance
const logger = new Logger();

// Wait for DOM to be ready before doing anything
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Create and append loading screen
        const loadingScreen = document.createElement('div');
        loadingScreen.className = 'loading-screen';
        loadingScreen.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Loading Bounce WebVR...</p>
        `;
        
        // Add logs element to loading screen
        loadingScreen.appendChild(logger.createLogsElement());
        document.body.appendChild(loadingScreen);

        logger.log('Starting initialization...');
        
        // Create scene container
        logger.log('Creating scene container...');
        const container = document.createElement('div');
        container.id = 'scene-container';
        document.body.appendChild(container);

        // Initialize scene
        logger.log('Creating BounceScene...');
        const scene = new BounceScene(container, logger);
        
        // Wait for scene to fully initialize
        logger.log('Waiting for scene initialization...');
        await scene.init();
        logger.log('Scene initialized successfully');
        
        // Remove loading screen with fade
        logger.log('Setup complete, removing loading screen...');
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.remove();
        }, 500); // Fade out animation duration

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

        logger.log('Bounce-webvr initialized successfully');
    } catch (error) {
        logger.log(`Failed to initialize Bounce-webvr: ${error.message}`, 'error');
        const loadingScreen = document.querySelector('.loading-screen');
        if (loadingScreen) {
            const logsElement = loadingScreen.querySelector('.loading-logs');
            loadingScreen.innerHTML = `
                <p style="color: #ff4444;">Failed to load Bounce WebVR</p>
                <p style="font-size: 0.9em;">${error.message}</p>
                <button onclick="location.reload()">Retry</button>
            `;
            if (logsElement) {
                loadingScreen.appendChild(logsElement);
            }
        }
    }
}); 
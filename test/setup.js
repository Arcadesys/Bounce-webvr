import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure React Testing Library
configure({ testIdAttribute: 'data-testid' });

// Mock window properties
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn(callback => setTimeout(callback, 0));
global.cancelAnimationFrame = vi.fn(id => clearTimeout(id));

// Mock performance.now()
global.performance.now = vi.fn(() => Date.now());

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { setValueAtTime: vi.fn() }
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn() }
  })),
  currentTime: 0
}));

// Mock WebGL context
const mockWebGLContext = {
  canvas: null,
  drawingBufferWidth: 800,
  drawingBufferHeight: 600,
  getExtension: vi.fn(),
  getParameter: vi.fn(),
  getShaderPrecisionFormat: vi.fn(() => ({
    precision: 1,
    rangeMin: 1,
    rangeMax: 1
  })),
  getContextAttributes: vi.fn(() => ({
    alpha: true,
    antialias: true,
    depth: true,
    failIfMajorPerformanceCaveat: false,
    powerPreference: 'default',
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: true,
    desynchronized: false
  }))
};

// Mock canvas and WebGL context
HTMLCanvasElement.prototype.getContext = vi.fn((contextType) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return mockWebGLContext;
  }
  return null;
});

// Create Vec3 mock first since it's used in other mocks
const Vec3 = vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ x, y, z }));

// Mock Three.js
vi.mock('three', () => {
  return {
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      children: []
    })),
    PerspectiveCamera: vi.fn(),
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      render: vi.fn(),
      domElement: document.createElement('canvas')
    })),
    BoxGeometry: vi.fn().mockImplementation((width = 1, height = 1, depth = 1) => ({
      parameters: {
        width,
        height,
        depth
      },
      dispose: vi.fn()
    })),
    MeshStandardMaterial: vi.fn().mockImplementation((props) => ({
      ...props,
      dispose: vi.fn()
    })),
    Mesh: vi.fn().mockImplementation(() => {
      const geometry = { parameters: { width: 1, height: 40, depth: 20 }, dispose: vi.fn() };
      return {
        position: { set: vi.fn(), copy: vi.fn() },
        rotation: { z: 0 },
        quaternion: { copy: vi.fn() },
        geometry,
        material: { dispose: vi.fn() }
      };
    }),
    Vector3: Vec3,
    DoubleSide: 2
  };
});

// Create a collision event mock
const createCollisionEvent = (bodyA, bodyB, velocity = 5.0) => ({
  body: bodyB,
  contact: {
    getImpactVelocityAlongNormal: () => velocity
  }
});

// Mock Cannon.js
const CANNON = {
  World: vi.fn().mockImplementation(() => {
    const bodies = [];
    const world = {
      addBody: vi.fn((body) => {
        bodies.push(body);
        // Set up collision detection
        body.addEventListener = vi.fn((event, callback) => {
          if (event === 'collide') {
            // Only trigger collisions between balls and walls
            const isBall = body.shape?.type === 'Sphere';
            const isWall = body.shape?.type === 'Box';
            
            // Store the callback for later use
            body._collideCallback = callback;
          }
        });
      }),
      removeBody: vi.fn((body) => {
        const index = bodies.indexOf(body);
        if (index > -1) {
          bodies.splice(index, 1);
        }
      }),
      step: vi.fn((dt) => {
        // Simulate physics step
        bodies.forEach(body => {
          if (body.velocity) {
            // Apply gravity
            body.velocity.y -= 9.82 * dt;
            // Update position
            body.position.y += body.velocity.y * dt;
            body.position.x += body.velocity.x * dt;
            body.position.z += body.velocity.z * dt;
          }
          
          // Check for collisions
          if (body._collideCallback) {
            const isBall = body.shape?.type === 'Sphere';
            bodies.forEach(otherBody => {
              if (otherBody !== body) {
                const otherIsWall = otherBody.shape?.type === 'Box';
                // Only trigger ball-wall collisions
                if (isBall && otherIsWall) {
                  // Simple collision detection - if ball is close to wall
                  const dx = body.position.x - otherBody.position.x;
                  const dy = body.position.y - otherBody.position.y;
                  const dz = body.position.z - otherBody.position.z;
                  const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                  
                  if (distance < (body.shape.radius + 0.1)) { // 0.1 is wall thickness
                    body._collideCallback(createCollisionEvent(body, otherBody));
                    // Bounce the ball
                    if (Math.abs(dy) < 0.1) { // Horizontal collision
                      body.velocity.x *= -0.8;
                    } else { // Vertical collision
                      body.velocity.y *= -0.8;
                    }
                  }
                }
              }
            });
          }
        });
      }),
      solver: {
        iterations: 10,
        tolerance: 0.001
      },
      defaultContactMaterial: {
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 4
      },
      addContactMaterial: vi.fn(),
      gravity: new Vec3(0, -9.82, 0)
    };
    return world;
  }),
  Body: vi.fn().mockImplementation((options = {}) => ({
    position: { 
      x: options.position?.x || 0, 
      y: options.position?.y || 0, 
      z: options.position?.z || 0,
      copy: vi.fn(),
      distanceTo: vi.fn((other) => {
        const dx = this.position.x - other.x;
        const dy = this.position.y - other.y;
        const dz = this.position.z - other.z;
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
      })
    },
    velocity: { 
      x: options.velocity?.x || 0, 
      y: options.velocity?.y || 0, 
      z: options.velocity?.z || 0,
      set: vi.fn((x, y, z) => {
        this.velocity.x = x;
        this.velocity.y = y;
        this.velocity.z = z;
      })
    },
    quaternion: { 
      copy: vi.fn(),
      setFromAxisAngle: vi.fn(),
      setFromEuler: vi.fn()
    },
    addEventListener: vi.fn(),
    addShape: vi.fn(),
    mass: options.mass || 0,
    shape: options.shape || null,
    userData: options.userData || {}
  })),
  Material: vi.fn().mockImplementation((props = {}) => ({
    friction: props.friction || 0,
    restitution: props.restitution || 0,
    ...props
  })),
  ContactMaterial: vi.fn().mockImplementation((mat1, mat2, props = {}) => ({
    friction: props.friction || 0.3,
    restitution: props.restitution || 0.3,
    materials: [mat1, mat2]
  })),
  Vec3,
  Box: vi.fn().mockImplementation((halfExtents) => ({
    halfExtents: { x: halfExtents.x, y: halfExtents.y, z: halfExtents.z },
    type: 'Box'
  })),
  Sphere: vi.fn().mockImplementation((radius) => ({
    radius,
    type: 'Sphere'
  }))
};

vi.mock('cannon-es', () => CANNON);

// Mock Tone.js
vi.mock('tone', () => {
  return {
    start: vi.fn(),
    context: {
      resume: vi.fn(),
      state: 'running'
    },
    Transport: {
      start: vi.fn(),
      stop: vi.fn(),
      clear: vi.fn(),
      scheduleRepeat: vi.fn(),
      bpm: { value: 120 }
    },
    now: vi.fn(() => 0)
  };
}); 
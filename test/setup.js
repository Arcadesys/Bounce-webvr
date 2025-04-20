import { vi } from 'vitest';

/**
 * Common test utilities and mocks
 * This file sets up the testing environment and provides shared mock implementations
 */

// Mock THREE.js
vi.mock('three', () => {
  const createVector = (x = 0, y = 0, z = 0) => ({
    x, y, z,
    set: vi.fn(),
    copy: vi.fn(),
    add: vi.fn(),
    sub: vi.fn(),
    multiplyScalar: vi.fn(),
    normalize: vi.fn(),
    length: vi.fn(),
    distanceTo: vi.fn()
  });

  const createQuaternion = (x = 0, y = 0, z = 0, w = 1) => ({
    x, y, z, w,
    set: vi.fn(),
    copy: vi.fn()
  });

  return {
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn()
    })),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      position: createVector(),
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn()
    })),
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      render: vi.fn(),
      setAnimationLoop: vi.fn()
    })),
    SphereGeometry: vi.fn(),
    MeshBasicMaterial: vi.fn().mockImplementation(() => ({
      color: { setHex: vi.fn() }
    })),
    Mesh: vi.fn().mockImplementation(() => ({
      position: createVector(),
      rotation: createVector(),
      scale: createVector(),
      geometry: {},
      material: {}
    })),
    Vector3: vi.fn().mockImplementation(createVector),
    Quaternion: vi.fn().mockImplementation(createQuaternion),
    BoxGeometry: vi.fn(),
    PlaneGeometry: vi.fn(),
    Color: vi.fn().mockImplementation(() => ({
      setHex: vi.fn()
    })),
    AmbientLight: vi.fn(),
    DirectionalLight: vi.fn().mockImplementation(() => ({
      position: createVector()
    })),
    Matrix4: vi.fn().mockImplementation(() => ({
      multiplyMatrices: vi.fn()
    })),
    Frustum: vi.fn().mockImplementation(() => ({
      setFromProjectionMatrix: vi.fn(),
      containsPoint: vi.fn().mockReturnValue(true)
    })),
    MeshStandardMaterial: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    }))
  };
});

// Mock CANNON.js
vi.mock('cannon-es', () => {
  // Track bodies added to the world for testing
  let worldBodies = [];

  const createVector = (x = 0, y = 0, z = 0) => ({
    x, y, z,
    set: vi.fn((newX, newY, newZ) => {
      x = newX;
      y = newY;
      z = newZ;
    }),
    copy: vi.fn(),
    lengthSquared: vi.fn().mockReturnValue(0),
    distanceTo: vi.fn().mockReturnValue(0)
  });

  const createQuaternion = () => ({
    setFromAxisAngle: vi.fn(),
    multiply: vi.fn(),
    copy: vi.fn(),
    set: vi.fn()
  });

  return {
    World: vi.fn().mockImplementation(() => ({
      gravity: createVector(0, -9.82, 0),
      bodies: worldBodies,
      solver: {
        iterations: 0,
        tolerance: 0
      },
      addBody: vi.fn((body) => {
        worldBodies.push(body);
      }),
      removeBody: vi.fn((body) => {
        const index = worldBodies.indexOf(body);
        if (index > -1) {
          worldBodies.splice(index, 1);
        }
      }),
      step: vi.fn(),
      addContactMaterial: vi.fn()
    })),
    Body: vi.fn().mockImplementation((options = {}) => ({
      position: createVector(),
      velocity: createVector(),
      angularVelocity: createVector(),
      quaternion: createQuaternion(),
      addEventListener: vi.fn(),
      mass: options.mass || 0,
      userData: {},
      type: options.type || 'dynamic',
      shapes: [],
      removeShape: vi.fn(),
      addShape: vi.fn(),
      applyImpulse: vi.fn()
    })),
    Vec3: vi.fn().mockImplementation((x, y, z) => createVector(x, y, z)),
    Plane: vi.fn(),
    Box: vi.fn().mockImplementation((halfExtents) => ({ halfExtents })),
    Sphere: vi.fn().mockImplementation((radius) => ({ radius, type: 'sphere' })),
    Material: vi.fn(),
    ContactMaterial: vi.fn()
  };
}); 
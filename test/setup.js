import { vi } from 'vitest';

// Mock THREE.js
vi.mock('three', () => {
  return {
    Scene: vi.fn(),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn() },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
      projectionMatrix: {},
      matrixWorldInverse: {}
    })),
    Vector3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => ({ 
      x, y, z,
      copy: vi.fn(),
      set: vi.fn()
    })),
    Quaternion: vi.fn().mockImplementation(() => ({
      setFromAxisAngle: vi.fn(),
      multiply: vi.fn(),
      copy: vi.fn()
    })),
    Matrix4: vi.fn().mockImplementation(() => ({
      multiplyMatrices: vi.fn()
    })),
    Frustum: vi.fn().mockImplementation(() => ({
      setFromProjectionMatrix: vi.fn(),
      containsPoint: vi.fn().mockReturnValue(true)
    })),
    Mesh: vi.fn().mockImplementation(() => ({
      position: { copy: vi.fn() },
      quaternion: { copy: vi.fn() },
      geometry: { dispose: vi.fn() },
      material: { dispose: vi.fn() }
    })),
    BoxGeometry: vi.fn(),
    SphereGeometry: vi.fn(),
    MeshStandardMaterial: vi.fn().mockImplementation(() => ({
      dispose: vi.fn()
    })),
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      render: vi.fn()
    })),
    Color: vi.fn(),
    AmbientLight: vi.fn(),
    DirectionalLight: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn() }
    }))
  };
});

// Mock CANNON.js
vi.mock('cannon-es', () => {
  // Track bodies added to the world
  let worldBodies = [];

  // Helper to create a vector with set method
  const createVector = (x = 0, y = 0, z = 0) => ({
    x, y, z,
    set: vi.fn((newX, newY, newZ) => {
      x = newX;
      y = newY;
      z = newZ;
    }),
    copy: vi.fn(),
    lengthSquared: vi.fn().mockReturnValue(0)
  });

  return {
    World: vi.fn().mockImplementation(() => {
      const world = {
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
      };
      return world;
    }),
    Body: vi.fn().mockImplementation((options = {}) => ({
      position: createVector(),
      velocity: createVector(),
      quaternion: {
        setFromAxisAngle: vi.fn(),
        multiply: vi.fn(),
        copy: vi.fn()
      },
      addEventListener: vi.fn(),
      mass: options.mass || 0,
      userData: {},
      type: options.type || 'dynamic'
    })),
    Vec3: vi.fn().mockImplementation((x = 0, y = 0, z = 0) => createVector(x, y, z)),
    Plane: vi.fn(),
    Box: vi.fn().mockImplementation((halfExtents) => ({ halfExtents })),
    Sphere: vi.fn().mockImplementation((radius) => ({ radius, type: 'sphere' })),
    Material: vi.fn(),
    ContactMaterial: vi.fn()
  };
}); 
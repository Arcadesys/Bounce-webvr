import { vi } from 'vitest';

// Mock Three.js classes and methods
vi.mock('three', () => {
  const THREE = {
    Scene: vi.fn(() => ({
      add: vi.fn(),
      clear: vi.fn(),
    })),
    BoxGeometry: vi.fn((width, height, depth) => ({
      parameters: { width, height, depth }
    })),
    MeshStandardMaterial: vi.fn((params) => ({
      ...params,
      dispose: vi.fn()
    })),
    Mesh: vi.fn((geometry, material) => ({
      geometry,
      material,
      position: {
        x: 0,
        y: 0,
        z: 0,
        set: function(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        },
        copy: function(v) {
          this.x = v.x;
          this.y = v.y;
          this.z = v.z;
        }
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
        copy: function(r) {
          this.x = r.x;
          this.y = r.y;
          this.z = r.z;
        }
      },
      quaternion: {
        setFromAxisAngle: vi.fn(),
        copy: vi.fn()
      }
    })),
    Vector3: vi.fn(function(x = 0, y = 0, z = 0) {
      return {
        x, y, z,
        copy: function(v) {
          this.x = v.x;
          this.y = v.y;
          this.z = v.z;
          return this;
        },
        length: function() {
          return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        }
      };
    }),
    Euler: vi.fn(function(x = 0, y = 0, z = 0) {
      return { x, y, z };
    }),
    DoubleSide: 'DoubleSide',
  };
  return THREE;
});

// Mock CANNON.js classes and methods
vi.mock('cannon-es', () => {
  const CANNON = {
    World: vi.fn(() => ({
      addBody: vi.fn((body) => {
        CANNON.World.bodies.push(body);
      }),
      removeBody: vi.fn((body) => {
        const index = CANNON.World.bodies.indexOf(body);
        if (index > -1) {
          CANNON.World.bodies.splice(index, 1);
        }
      }),
      step: vi.fn((dt) => {
        // Simple physics simulation for testing
        CANNON.World.bodies.forEach(body => {
          if (body.mass === 0) return; // Skip static bodies

          if (body.velocity && body.position) {
            // Update position
            body.position.x += body.velocity.x * dt;
            body.position.y += body.velocity.y * dt;
            body.position.z += body.velocity.z * dt;

            // Apply gravity
            body.velocity.y -= 9.82 * dt;

            // Check collisions with static bodies
            CANNON.World.bodies.forEach(otherBody => {
              if (otherBody.mass !== 0) return; // Only check against static bodies

              // Simple sphere vs box collision
              if (body.shape.radius && otherBody.shape.halfExtents) {
                const dx = Math.abs(body.position.x - otherBody.position.x);
                const dy = Math.abs(body.position.y - otherBody.position.y);
                const dz = Math.abs(body.position.z - otherBody.position.z);

                if (dx < (body.shape.radius + otherBody.shape.halfExtents.x) &&
                    dy < (body.shape.radius + otherBody.shape.halfExtents.y) &&
                    dz < (body.shape.radius + otherBody.shape.halfExtents.z)) {
                  // Collision! Reflect velocity with some energy loss
                  if (dy < dx && dy < dz) {
                    body.velocity.y = -body.velocity.y * 0.8;
                  } else if (dx < dy && dx < dz) {
                    body.velocity.x = -body.velocity.x * 0.8;
                  } else {
                    body.velocity.z = -body.velocity.z * 0.8;
                  }
                }
              }
            });
          }
        });
      }),
      bodies: CANNON.World.bodies,
    })),
    Body: vi.fn((params = {}) => {
      const body = {
        ...params,
        position: new CANNON.Vec3(),
        velocity: new CANNON.Vec3(),
        quaternion: {
          setFromAxisAngle: vi.fn(),
          setFromEuler: vi.fn(),
          copy: vi.fn()
        },
        addEventListener: vi.fn(),
      };
      CANNON.World.bodies.push(body);
      return body;
    }),
    Box: vi.fn((halfExtents) => ({
      halfExtents
    })),
    Sphere: vi.fn((radius) => ({
      radius
    })),
    Vec3: vi.fn(function(x = 0, y = 0, z = 0) {
      return {
        x, y, z,
        copy: function(v) {
          this.x = v.x;
          this.y = v.y;
          this.z = v.z;
          return this;
        },
        length: function() {
          return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        }
      };
    }),
    Quaternion: vi.fn(() => ({
      setFromAxisAngle: vi.fn(),
      setFromEuler: vi.fn(),
      mult: vi.fn(),
      copy: vi.fn()
    })),
    Material: vi.fn(),
  };
  
  // Add static array to track bodies for testing
  CANNON.World.bodies = [];
  
  return CANNON;
}); 
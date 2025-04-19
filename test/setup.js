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

// Mock Three.js
vi.mock('three', () => ({
  Scene: vi.fn(),
  PerspectiveCamera: vi.fn(),
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    render: vi.fn(),
    domElement: document.createElement('canvas')
  })),
  BoxGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  Mesh: vi.fn(),
  Vector3: vi.fn(),
  Color: vi.fn(),
}));

// Create Vec3 class for physics calculations
class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    const length = this.length();
    if (length > 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    return new Vec3(x, y, z);
  }

  scale(scalar) {
    this.x *= scalar;
    this.y *= scalar;
    this.z *= scalar;
    return this;
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  clone() {
    return new Vec3(this.x, this.y, this.z);
  }
}

// Create Quaternion class for rotations
class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    this.x = axis.x * s;
    this.y = axis.y * s;
    this.z = axis.z * s;
    this.w = Math.cos(halfAngle);
    return this;
  }

  multiply(q) {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;

    this.x = ax * bw + aw * bx + ay * bz - az * by;
    this.y = ay * bw + aw * by + az * bx - ax * bz;
    this.z = az * bw + aw * bz + ax * by - ay * bx;
    this.w = aw * bw - ax * bx - ay * by - az * bz;

    return this;
  }

  transformVector(v) {
    const x = v.x, y = v.y, z = v.z;
    const qx = this.x, qy = this.y, qz = this.z, qw = this.w;

    // Calculate quat * vector
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;

    // Calculate result * inverse quat
    return new Vec3(
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx
    );
  }

  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }
}

// Create Contact class for collision events
class Contact {
  constructor(bodyA, bodyB, normal, velocity = 5.0) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.ni = normal;
    this.velocity = velocity;
  }

  getImpactVelocityAlongNormal() {
    const relativeVel = this.bodyA.velocity.clone().sub(this.bodyB.velocity || new Vec3());
    return Math.abs(this.ni.dot(relativeVel));
  }
}

// Helper function to calculate kinetic energy
const getKineticEnergy = (body) => {
  const v = body.velocity;
  return 0.5 * body.mass * (v.x * v.x + v.y * v.y + v.z * v.z);
};

// Helper function to handle ball-to-ball collision
const handleBallCollision = (body1, body2, normal, restitution) => {
  const relativeVel = body1.velocity.clone().sub(body2.velocity || new Vec3());
  const normalVel = normal.dot(relativeVel);
  
  if (normalVel < 0) {
    const totalMass = body1.mass + body2.mass;
    const reducedMass = (body1.mass * body2.mass) / totalMass;
    const j = -(1 + restitution) * normalVel * reducedMass;
    const impulse = normal.clone().scale(j);
    
    // Apply impulses
    const scale1 = 1 / body1.mass;
    const scale2 = body2.mass === 0 ? 0 : 1 / body2.mass;
    
    body1.velocity.add(impulse.clone().scale(scale1));
    if (body2.mass > 0) {
      body2.velocity.sub(impulse.clone().scale(scale2));
    }
    
    // Apply angular impulse
    if (body1.angularVelocity && body2.angularVelocity) {
      const r1 = normal.clone().scale(body1.shape.radius);
      const r2 = normal.clone().scale(-body2.shape.radius);
      
      const angularImpulse1 = r1.cross(impulse).scale(1 / (body1.mass * body1.shape.radius * body1.shape.radius));
      const angularImpulse2 = r2.cross(impulse).scale(1 / (body2.mass * body2.shape.radius * body2.shape.radius));
      
      body1.angularVelocity.add(angularImpulse1);
      if (body2.mass > 0) {
        body2.angularVelocity.add(angularImpulse2);
      }
    }
  }
};

// Helper function to find the earliest collision along a ray
const findEarliestCollision = (body, sweep, other, dt) => {
  if (!sweep) return null;
  
  const { start, end, ray, rayLength } = sweep;
  let tMin = rayLength;
  let hitNormal = null;
  
  if (other.shape.type === 'Box') {
    // Transform ray to box space
    const localStart = start.clone();
    const localRay = ray.clone();
    if (other.quaternion) {
      const invQuaternion = new Quaternion(-other.quaternion.x, -other.quaternion.y, -other.quaternion.z, other.quaternion.w);
      localStart.copy(invQuaternion.transformVector(localStart.clone().sub(other.position)));
      localRay.copy(invQuaternion.transformVector(ray));
    }
    
    // Box intersection
    const halfExtents = other.shape.halfExtents;
    const bounds = {
      min: new Vec3(-halfExtents.x, -halfExtents.y, -halfExtents.z),
      max: new Vec3(halfExtents.x, halfExtents.y, halfExtents.z)
    };
    
    // Ray-AABB intersection
    const t1 = (bounds.min.x - localStart.x) / (localRay.x || 1e-10);
    const t2 = (bounds.max.x - localStart.x) / (localRay.x || 1e-10);
    const t3 = (bounds.min.y - localStart.y) / (localRay.y || 1e-10);
    const t4 = (bounds.max.y - localStart.y) / (localRay.y || 1e-10);
    const t5 = (bounds.min.z - localStart.z) / (localRay.z || 1e-10);
    const t6 = (bounds.max.z - localStart.z) / (localRay.z || 1e-10);
    
    const tNear = Math.max(
      Math.min(t1, t2),
      Math.min(t3, t4),
      Math.min(t5, t6)
    );
    const tFar = Math.min(
      Math.max(t1, t2),
      Math.max(t3, t4),
      Math.max(t5, t6)
    );
    
    if (tNear <= tFar && tNear >= 0 && tNear < tMin) {
      tMin = tNear;
      // Determine hit normal in local space
      const hitPoint = localStart.clone().add(localRay.clone().scale(tNear));
      const normals = [
        new Vec3(1, 0, 0),
        new Vec3(-1, 0, 0),
        new Vec3(0, 1, 0),
        new Vec3(0, -1, 0),
        new Vec3(0, 0, 1),
        new Vec3(0, 0, -1)
      ];
      let bestNormal = normals[0];
      let minDist = Math.abs(hitPoint.x - halfExtents.x);
      
      const distances = [
        Math.abs(hitPoint.x - halfExtents.x),
        Math.abs(hitPoint.x + halfExtents.x),
        Math.abs(hitPoint.y - halfExtents.y),
        Math.abs(hitPoint.y + halfExtents.y),
        Math.abs(hitPoint.z - halfExtents.z),
        Math.abs(hitPoint.z + halfExtents.z)
      ];
      
      for (let i = 1; i < distances.length; i++) {
        if (distances[i] < minDist) {
          minDist = distances[i];
          bestNormal = normals[i];
        }
      }
      
      // Transform normal back to world space
      hitNormal = other.quaternion ? other.quaternion.transformVector(bestNormal) : bestNormal;
    }
  } else if (other.shape.type === 'Sphere') {
    // Sphere intersection
    const radius = body.shape.radius + other.shape.radius;
    const toSphere = other.position.clone().sub(start);
    const a = ray.dot(ray);
    const b = 2 * ray.dot(toSphere);
    const c = toSphere.dot(toSphere) - radius * radius;
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant >= 0) {
      const t = (-b - Math.sqrt(discriminant)) / (2 * a);
      if (t >= 0 && t < tMin) {
        tMin = t;
        const hitPoint = start.clone().add(ray.clone().scale(t));
        hitNormal = hitPoint.clone().sub(other.position).normalize();
      }
    }
  } else if (other.shape.type === 'Plane') {
    // Plane intersection (assuming Y-up plane)
    const t = (other.position.y - start.y) / (ray.y || 1e-10);
    if (t >= 0 && t < tMin) {
      tMin = t;
      hitNormal = new Vec3(0, Math.sign(ray.y), 0);
    }
  }
  
  return hitNormal ? { t: tMin, normal: hitNormal } : null;
};

// Helper function to get contact material properties
const getContactMaterial = (world, materialA, materialB) => {
  if (!world._contactMaterials) return null;
  return world._contactMaterials.find(cm => 
    (cm.materials[0] === materialA && cm.materials[1] === materialB) ||
    (cm.materials[0] === materialB && cm.materials[1] === materialA)
  );
};

// Helper function to get collision properties
const getCollisionProperties = (world, bodyA, bodyB) => {
  const contactMaterial = getContactMaterial(world, bodyA.material, bodyB.material);
  if (contactMaterial) {
    return {
      friction: contactMaterial.friction,
      restitution: contactMaterial.restitution
    };
  }
  
  // Use material properties if no contact material
  const restitution = Math.min(
    bodyA.material?.restitution ?? 0.3,
    bodyB.material?.restitution ?? 0.3
  );
  const friction = Math.min(
    bodyA.material?.friction ?? 0.3,
    bodyB.material?.friction ?? 0.3
  );
  
  return { friction, restitution };
};

// Mock Cannon.js with better physics simulation
vi.mock('cannon-es', () => {
  const bodies = new Set();
  
  return {
    Vec3,
    Quaternion,
    World: vi.fn(() => {
      const world = {
        gravity: new Vec3(0, -9.82, 0),
        bodies: bodies,
        _contactMaterials: [],
        addBody: vi.fn((body) => {
          bodies.add(body);
          // Initialize collision handlers array
          body._collideHandlers = [];
          body.addEventListener = (event, handler) => {
            if (event === 'collide') {
              body._collideHandlers.push(handler);
            }
          };
        }),
        removeBody: vi.fn((body) => {
          bodies.delete(body);
        }),
        addContactMaterial: vi.fn((contactMaterial) => {
          world._contactMaterials.push(contactMaterial);
        }),
        step: vi.fn((dt) => {
          // Simple physics simulation
          bodies.forEach(body => {
            if (body.mass > 0) { // Only move dynamic bodies
              const initialEnergy = getKineticEnergy(body);
              
              // Apply gravity
              body.velocity.y += dt * world.gravity.y;
              
              // Apply angular velocity
              if (body.angularVelocity && body.angularVelocity.length() > 0) {
                const angle = body.angularVelocity.length() * dt;
                const axis = body.angularVelocity.clone().normalize();
                const rotation = new Quaternion().setFromAxisAngle(axis, angle);
                body.quaternion.multiply(rotation);
              }
              
              // Continuous collision detection
              const sweep = sweepTest(body, dt);
              let earliestCollision = null;
              let collidingBody = null;
              
              // Find earliest collision
              bodies.forEach(other => {
                if (other !== body) {
                  const collision = findEarliestCollision(body, sweep, other, dt);
                  if (collision && (!earliestCollision || collision.t < earliestCollision.t)) {
                    earliestCollision = collision;
                    collidingBody = other;
                  }
                }
              });
              
              if (earliestCollision) {
                // Move to collision point
                const t = earliestCollision.t;
                body.position.x += body.velocity.x * t;
                body.position.y += body.velocity.y * t;
                body.position.z += body.velocity.z * t;
                
                // Handle collision response
                const normal = earliestCollision.normal;
                const { restitution, friction } = getCollisionProperties(world, body, collidingBody);
                
                // Create collision event
                const relativeVel = body.velocity.clone().sub(collidingBody.velocity || new Vec3());
                const normalVel = Math.abs(normal.dot(relativeVel));
                const contact = new Contact(body, collidingBody, normal.clone(), normalVel);
                const event = { body: collidingBody, contact };
                
                // Trigger collision handlers
                if (body._collideHandlers) {
                  body._collideHandlers.forEach(handler => handler(event));
                }
                if (collidingBody._collideHandlers) {
                  const reverseContact = new Contact(collidingBody, body, normal.clone().scale(-1), normalVel);
                  collidingBody._collideHandlers.forEach(handler => handler({ body, contact: reverseContact }));
                }
                
                // Handle collision response based on body types
                if (body.shape.type === 'Sphere' && collidingBody.shape.type === 'Sphere') {
                  handleBallCollision(body, collidingBody, normal, restitution);
                } else {
                  // Handle other collision types
                  if (collidingBody.mass === 0) {
                    // Collision with static body
                    const normalVel = normal.dot(relativeVel);
                    const j = -(1 + restitution) * normalVel;
                    
                    // Apply normal impulse
                    const impulse = normal.clone().scale(j);
                    body.velocity.add(impulse);
                    
                    // Apply friction
                    if (friction > 0) {
                      // Calculate tangential velocity
                      const tangent = relativeVel.clone().sub(normal.clone().scale(normalVel));
                      const tangentMag = tangent.length();
                      
                      if (tangentMag > 0) {
                        tangent.scale(1/tangentMag); // Normalize
                        const jt = -tangentMag * friction;
                        body.velocity.add(tangent.scale(jt));
                      }
                    }
                  } else {
                    // Elastic collision between dynamic bodies
                    const totalMass = body.mass + collidingBody.mass;
                    const normalVel = normal.dot(relativeVel);
                    const j = -(1 + restitution) * normalVel / totalMass;
                    
                    // Apply normal impulse
                    const impulse = normal.clone().scale(j);
                    body.velocity.add(impulse.clone().scale(collidingBody.mass));
                    collidingBody.velocity.sub(impulse.clone().scale(body.mass));
                    
                    // Apply friction
                    if (friction > 0) {
                      // Calculate tangential velocity
                      const tangent = relativeVel.clone().sub(normal.clone().scale(normalVel));
                      const tangentMag = tangent.length();
                      
                      if (tangentMag > 0) {
                        tangent.scale(1/tangentMag); // Normalize
                        const jt = -tangentMag * friction / totalMass;
                        const frictionImpulse = tangent.scale(jt);
                        
                        body.velocity.add(frictionImpulse.clone().scale(collidingBody.mass));
                        collidingBody.velocity.sub(frictionImpulse.clone().scale(body.mass));
                      }
                    }
                  }
                }
                
                // Move remaining time
                const remainingTime = dt - t;
                if (remainingTime > 0) {
                  body.position.x += body.velocity.x * remainingTime;
                  body.position.y += body.velocity.y * remainingTime;
                  body.position.z += body.velocity.z * remainingTime;
                }
              } else {
                // No collision, move full step
                body.position.x += body.velocity.x * dt;
                body.position.y += body.velocity.y * dt;
                body.position.z += body.velocity.z * dt;
              }

              // Apply damping
              const damping = Math.pow(1 - body.linearDamping, dt);
              body.velocity.x *= damping;
              body.velocity.y *= damping;
              body.velocity.z *= damping;

              if (body.angularVelocity) {
                const angularDamping = Math.pow(1 - body.angularDamping, dt);
                body.angularVelocity.x *= angularDamping;
                body.angularVelocity.y *= angularDamping;
                body.angularVelocity.z *= angularDamping;
              }
              
              // Check energy conservation
              const finalEnergy = getKineticEnergy(body);
              const energyDiff = Math.abs(finalEnergy - initialEnergy);
              const maxEnergyChange = Math.abs(initialEnergy * 0.1); // Allow 10% energy change
              
              if (energyDiff > maxEnergyChange && !earliestCollision) {
                // Energy changed too much without collision, restore velocity
                const scale = Math.sqrt(initialEnergy / (finalEnergy || 1e-10));
                body.velocity.scale(scale);
              }
            }
          });
        }),
      };
      return world;
    }),
    Body: vi.fn((options = {}) => ({
      position: new Vec3(
        options.position?.x || 0,
        options.position?.y || 0,
        options.position?.z || 0
      ),
      velocity: new Vec3(
        options.velocity?.x || 0,
        options.velocity?.y || 0,
        options.velocity?.z || 0
      ),
      angularVelocity: new Vec3(0, 0, 0),
      quaternion: new Quaternion(),
      mass: options.mass || 0,
      shape: options.shape,
      material: options.material,
      linearDamping: options.linearDamping || 0.01,
      angularDamping: options.angularDamping || 0.01,
      _collideHandlers: [],
    })),
    Material: vi.fn((name) => ({
      name,
      friction: 0.3,
      restitution: 0.3
    })),
    ContactMaterial: vi.fn((materialA, materialB, options = {}) => ({
      materials: [materialA, materialB],
      friction: options.friction || 0.3,
      restitution: options.restitution || 0.3,
      contactEquationStiffness: options.contactEquationStiffness || 1e7,
      contactEquationRelaxation: options.contactEquationRelaxation || 3,
      frictionEquationStiffness: options.frictionEquationStiffness || 1e7
    })),
    Sphere: vi.fn((radius) => ({
      radius,
      type: 'Sphere'
    })),
    Box: vi.fn((halfExtents) => ({
      halfExtents,
      type: 'Box'
    })),
    Plane: vi.fn(() => ({
      type: 'Plane'
    })),
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Tone.js
vi.mock('tone', () => ({
  default: {
    start: vi.fn(),
    context: {
      state: 'suspended',
      resume: vi.fn(),
    },
    Transport: {
      bpm: { value: 120 }
    }
  }
})); 
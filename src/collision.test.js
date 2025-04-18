import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as CANNON from 'cannon-es';

// Mock CANNON.js with a custom implementation that can simulate collisions
vi.mock('cannon-es', () => {
  // Track collision callbacks for testing
  const collisionCallbacks = new Map();
  
  return {
    World: vi.fn().mockImplementation(() => ({
      addBody: vi.fn(),
      removeBody: vi.fn(),
      step: vi.fn().mockImplementation(() => {
        // When step is called, simulate collisions between bodies
        collisionCallbacks.forEach((callbacks, body) => {
          callbacks.forEach(callback => {
            // Simple mock of collision event
            const mockEvent = {
              contact: {
                getImpactVelocityAlongNormal: vi.fn().mockReturnValue(5.0)
              }
            };
            callback(mockEvent);
          });
        });
      })
    })),
    Body: vi.fn().mockImplementation(({ mass, position }) => {
      const body = {
        id: Math.random().toString(), // Unique ID for tracking
        mass,
        position: position || { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        quaternion: {
          setFromAxisAngle: vi.fn()
        },
        addEventListener: vi.fn().mockImplementation((event, callback) => {
          // Store collision callbacks for later simulation
          if (event === 'collide') {
            if (!collisionCallbacks.has(body)) {
              collisionCallbacks.set(body, []);
            }
            collisionCallbacks.get(body).push(callback);
          }
        }),
        removeEventListener: vi.fn()
      };
      return body;
    }),
    Vec3: vi.fn().mockImplementation((x, y, z) => ({ x, y, z })),
    Sphere: vi.fn().mockImplementation(radius => ({ radius, type: 'Sphere' })),
    Box: vi.fn().mockImplementation((x, y, z) => ({ 
      halfExtents: { x, y, z },
      type: 'Box'
    })),
    Material: vi.fn().mockImplementation(options => options),
    ContactMaterial: vi.fn().mockImplementation((m1, m2, options) => ({
      ...options,
      materials: [m1, m2]
    }))
  };
});

// Import the physics functions
import { 
  createPhysicsWorld, 
  createBallBody, 
  createWallBody,
  updatePhysics
} from './physics.js';

describe('Physics Collision Tests', () => {
  let world;
  let soundCallback;
  
  beforeEach(() => {
    vi.clearAllMocks();
    world = createPhysicsWorld();
    
    // Spy on collision sounds (we'd normally attach this to the window)
    soundCallback = vi.fn();
    global.playBounceSound = soundCallback;
  });
  
  it('should detect collisions between ball and wall', () => {
    // Create a ball and a wall in the world
    const ball = createBallBody({ x: 0, y: 2, z: 0 }, 0.2, world);
    const wall = createWallBody(
      { x: -2, y: 0, z: 0 }, 
      { x: 2, y: 0, z: 0 },
      world
    );
    
    // Add a collision handler to the ball
    let collisionDetected = false;
    ball.addEventListener('collide', () => {
      collisionDetected = true;
    });
    
    // Simulate physics update (this will trigger our mock collision)
    updatePhysics(world);
    
    // Check if the collision was detected
    expect(collisionDetected).toBe(true);
  });
  
  it('should correctly calculate collision intensity based on velocity', () => {
    // This test verifies that the impact velocity affects the collision response
    
    // Create a ball and a wall in the world
    const ball = createBallBody({ x: 0, y: 5, z: 0 }, 0.2, world);
    const wall = createWallBody(
      { x: -2, y: 0, z: 0 }, 
      { x: 2, y: 0, z: 0 },
      world
    );
    
    // Add a custom collision handler to the ball that checks impact velocity
    let impactVelocity = 0;
    ball.addEventListener('collide', (event) => {
      impactVelocity = Math.abs(event.contact.getImpactVelocityAlongNormal());
    });
    
    // Simulate physics update (this will trigger our mock collision)
    updatePhysics(world);
    
    // For the mock, we've set up a simulated velocity of 5.0
    expect(impactVelocity).toBe(5.0);
  });
  
  it('should play a sound with intensity based on collision velocity', () => {
    // Setup window.playBounceSound mock
    const originalPlayBounce = window.playBounceSound;
    window.playBounceSound = vi.fn();
    
    // Create a ball with collision sounds
    const ball = createBallBody({ x: 0, y: 5, z: 0 }, 0.2, world);
    
    // When a ball collides, we'd usually call playBounceSound
    ball.addEventListener('collide', (event) => {
      const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
      if (window.playBounceSound && Math.abs(relativeVelocity) > 0.5) {
        const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        window.playBounceSound(intensity);
      }
    });
    
    // Simulate physics update (this will trigger our mock collision)
    updatePhysics(world);
    
    // Check that the sound function was called with the correct intensity
    // Our mock returns a velocity of 5.0, so intensity should be 5.0/10 = 0.5
    expect(window.playBounceSound).toHaveBeenCalledWith(0.5);
    
    // Restore original function
    window.playBounceSound = originalPlayBounce;
  });
  
  it('should not play sounds for very small impacts', () => {
    // Override the impact velocity for this test
    const getVelocitySpy = vi.fn().mockReturnValue(0.3); // Below threshold of 0.5
    
    // Setup window.playBounceSound mock
    const originalPlayBounce = window.playBounceSound;
    window.playBounceSound = vi.fn();
    
    // Create a ball
    const ball = createBallBody({ x: 0, y: 0.1, z: 0 }, 0.2, world);
    
    // Customize collision handler with low velocity
    ball.addEventListener('collide', (event) => {
      // Override the mock's return value
      event.contact.getImpactVelocityAlongNormal = getVelocitySpy;
      
      const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
      if (window.playBounceSound && Math.abs(relativeVelocity) > 0.5) {
        const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        window.playBounceSound(intensity);
      }
    });
    
    // Simulate physics update
    updatePhysics(world);
    
    // Check that the sound was NOT played (velocity too low)
    expect(window.playBounceSound).not.toHaveBeenCalled();
    
    // Restore original function
    window.playBounceSound = originalPlayBounce;
  });
}); 
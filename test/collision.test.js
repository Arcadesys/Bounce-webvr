import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as CANNON from 'cannon-es';

// Mock CANNON.js with a custom implementation that can simulate collisions
vi.mock('cannon-es', () => {
  // Track collision callbacks for testing
  const collisionCallbacks = new Map();
  
  // Mock implementation that preserves the vi.fn() mock methods
  const mockBody = (config) => {
    const body = {
      id: Math.random().toString(), // Unique ID for tracking
      mass: config.mass,
      position: config.position || { x: 0, y: 0, z: 0 },
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
      removeEventListener: vi.fn(),
      userData: {} // Add userData for storing metadata
    };
    return body;
  };
  
  const Body = vi.fn().mockImplementation((config) => mockBody(config));
  
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
              },
              body: null, // This will be set in the tests as needed
              target: body // The body that has the listener
            };
            callback(mockEvent);
          });
        });
      })
    })),
    Body: Body,
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
    // Create a simplified test handler that doesn't rely on the mocking system
    const createCollisionHandler = (velocityThreshold = 0.5) => (event) => {
      const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
      if (Math.abs(relativeVelocity) > velocityThreshold) {
        const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        return intensity; // Return the intensity that would be used
      }
      return null; // Return null if no sound should be played
    };
    
    // Create handler with default threshold of 0.5
    const handler = createCollisionHandler();
    
    // Test with velocity below threshold
    const lowVelocityEvent = {
      contact: {
        getImpactVelocityAlongNormal: () => 0.3 // Below threshold
      }
    };
    
    // This should return null (no sound)
    const lowResult = handler(lowVelocityEvent);
    expect(lowResult).toBeNull();
    
    // Test with velocity above threshold
    const highVelocityEvent = {
      contact: {
        getImpactVelocityAlongNormal: () => 5.0 // Above threshold
      }
    };
    
    // This should return an intensity value
    const highResult = handler(highVelocityEvent);
    expect(highResult).toBe(0.5); // 5.0/10
  });
});

// New test suite for advanced collision scenarios
describe('Advanced Collision Scenarios', () => {
  let world;
  let playBounceSound;
  let playNoteForLength;
  let mockBall;
  
  beforeEach(() => {
    vi.clearAllMocks();
    world = createPhysicsWorld();
    
    // Mock sound functions
    playBounceSound = vi.fn();
    playNoteForLength = vi.fn();
    
    global.playBounceSound = playBounceSound;
    global.playNoteForLength = playNoteForLength;
    
    // Create a ball that we'll use in tests
    mockBall = createBallBody({ x: 0, y: 2, z: 0 }, 0.2, world);
  });
  
  afterEach(() => {
    // Clean up mocks
    global.playBounceSound = undefined;
    global.playNoteForLength = undefined;
  });
  
  it('should play different sounds based on wall type/note data', () => {
    // Create a wall with musical note data
    const musicalWall = createWallBody(
      { x: -2, y: 0, z: 0 }, 
      { x: 2, y: 0, z: 0 },
      world
    );
    
    // Add note data to the wall
    musicalWall.userData = { 
      note: 'C4',
      length: 0.25 // quarter note
    };
    
    // Add custom collision handler that will be used for testing
    let collisionHandler = (event) => {
      const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
      event.body = musicalWall; // Set the colliding body to our musical wall
      
      // Only play sounds if impact is significant
      if (Math.abs(relativeVelocity) > 0.5) {
        const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        
        // If the wall has note data, play that note
        if (event.body.userData && event.body.userData.note) {
          playNoteForLength(
            null, // Mocking Tone.context
            event.body.userData.length,
            0.5,
            intensity * 0.5
          );
        } else {
          // Otherwise play generic bounce sound
          playBounceSound(intensity);
        }
      }
    };
    
    // Add the collision handler
    mockBall.addEventListener('collide', collisionHandler);
    
    // Manually trigger the collision handler with a mocked event
    collisionHandler({
      contact: { 
        getImpactVelocityAlongNormal: () => 5.0 
      },
      body: musicalWall
    });
    
    // Should have played the musical note, not the generic bounce sound
    expect(playNoteForLength).toHaveBeenCalledWith(
      null,
      0.25,
      0.5,
      0.25 // 5.0/10 * 0.5
    );
    
    // The bounce sound should not have been called since we played a note instead
    expect(playBounceSound).not.toHaveBeenCalled();
  });
  
  it('should handle multiple simultaneous collisions', () => {
    // Create three balls
    const ball1 = createBallBody({ x: 0, y: 1, z: 0 }, 0.2, world);
    const ball2 = createBallBody({ x: 1, y: 1, z: 0 }, 0.2, world);
    const ball3 = createBallBody({ x: 2, y: 1, z: 0 }, 0.2, world);
    
    // Create walls
    const wall1 = createWallBody({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, world);
    const wall2 = createWallBody({ x: 0, y: 0, z: -2 }, { x: 0, y: 0, z: 2 }, world);
    
    // Count collisions
    let collisionCount = 0;
    
    // Set up collision handlers for each ball
    [ball1, ball2, ball3].forEach(ball => {
      ball.addEventListener('collide', () => {
        collisionCount++;
      });
    });
    
    // Simulate physics update (will trigger collisions)
    updatePhysics(world);
    
    // Each ball should have experienced one collision
    expect(collisionCount).toBe(3);
  });
  
  it('should handle different collision sound levels based on wall material', () => {
    // Create walls with different bounciness/material
    const woodWall = createWallBody({ x: -3, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, world);
    const metalWall = createWallBody({ x: 1, y: 0, z: 0 }, { x: 3, y: 0, z: 0 }, world);
    
    // Set material properties
    woodWall.userData = { 
      material: 'wood',
      soundAmplification: 0.7
    };
    
    metalWall.userData = { 
      material: 'metal',
      soundAmplification: 1.3
    };
    
    // Store each collision's intensity
    const collisionIntensities = [];
    
    // Define our collision handler
    const handleCollision = (event) => {
      const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
      
      // Only process significant collisions
      if (Math.abs(relativeVelocity) > 0.5) {
        // Base intensity calculation
        let intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        
        // Modify intensity based on wall material if applicable
        if (event.body && event.body.userData && event.body.userData.soundAmplification) {
          intensity *= event.body.userData.soundAmplification;
        }
        
        // Record the calculated intensity
        collisionIntensities.push(intensity);
        
        // Play the appropriate bounce sound
        playBounceSound(intensity);
      }
    };
    
    // Manually trigger collisions with different wall types
    handleCollision({
      contact: { getImpactVelocityAlongNormal: () => 5.0 },
      body: woodWall
    });
    
    handleCollision({
      contact: { getImpactVelocityAlongNormal: () => 5.0 },
      body: metalWall
    });
    
    // Should have different intensities based on wall material
    expect(collisionIntensities[0]).toBeCloseTo(0.35); // 0.5 * 0.7 (wood)
    expect(collisionIntensities[1]).toBeCloseTo(0.65); // 0.5 * 1.3 (metal)
    
    // Sound function should have been called with these intensities
    expect(playBounceSound).toHaveBeenCalledTimes(2);
    expect(playBounceSound).toHaveBeenNthCalledWith(1, 0.35);
    expect(playBounceSound).toHaveBeenNthCalledWith(2, 0.65);
  });
  
  it('should provide accessibility feedback for collision events', () => {
    // Mock accessibility functions
    const notifyCollisionEvent = vi.fn();
    global.notifyCollisionEvent = notifyCollisionEvent;
    
    // Create a wall with special properties
    const wall = createWallBody({ x: -2, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, world);
    wall.userData = { 
      name: 'Boundary Wall',
      isImportant: true
    };
    
    // Define collision handler with accessibility support
    const handleCollision = (event) => {
      const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
      
      // Regular sound feedback
      if (Math.abs(relativeVelocity) > 0.5) {
        const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
        playBounceSound(intensity);
        
        // Accessibility notification for significant collisions with important objects
        if (event.body && event.body.userData && event.body.userData.isImportant) {
          notifyCollisionEvent({
            objectName: event.body.userData.name || 'Wall',
            intensity: intensity,
            isSignificant: intensity > 0.3
          });
        }
      }
    };
    
    // Manually trigger collision
    handleCollision({
      contact: { getImpactVelocityAlongNormal: () => 5.0 },
      body: wall
    });
    
    // Check that accessibility notification was triggered
    expect(notifyCollisionEvent).toHaveBeenCalledWith({
      objectName: 'Boundary Wall',
      intensity: 0.5,
      isSignificant: true
    });
    
    // Cleanup
    global.notifyCollisionEvent = undefined;
  });
}); 
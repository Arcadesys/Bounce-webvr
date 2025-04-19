import * as CANNON from 'cannon-es';
import * as Tone from 'tone';
import { initVoicePool, playNoteForBeam, assignBeamToVoice } from '../utils/voiceManager';

// Event emitter for collision events
const collisionEvents = {
  listeners: new Set(),
  emit(collisionData) {
    this.listeners.forEach(listener => listener(collisionData));
  },
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
};

// Map to store beam IDs
const beamIds = new Map();

// Track last collision time for each body
const lastCollisionTimes = new Map();

/**
 * Creates a physics world with default gravity
 * @returns {Object} The physics world
 */
export function createPhysicsWorld() {
  console.log('Physics: Starting world creation');
  const world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver = new CANNON.GSSolver();
  world.solver.iterations = 10;
  world.defaultContactMaterial.friction = 0.1;
  world.defaultContactMaterial.restitution = 0.9;
  console.log('Physics: World configuration complete');

  // Initialize voice pool for collision sounds
  console.log('Physics: Initializing voice pool');
  initVoicePool().catch(error => {
    console.error('Physics: Error initializing voice pool:', error);
  });

  // Add collision event listener
  console.log('Physics: Setting up collision listener');
  world.addEventListener('collide', (event) => {
    // Get the beam ID from the collision
    const beamId = getBeamIdFromCollision(event);
    
    if (!beamId) {
      // If no beam ID, use a default voice
      handleDefaultCollision(event);
      return;
    }
    
    // Calculate collision intensity based on relative velocity
    const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
    const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
    
    // Check if enough time has passed since last collision
    const now = Tone.now();
    const lastCollision = lastCollisionTimes.get(beamId) || 0;
    const minTimeBetweenCollisions = Tone.Time('32n').toSeconds();
    
    if (now - lastCollision >= minTimeBetweenCollisions) {
      // Simple pentatonic scale for pleasant sounds
      const pentatonicScale = ['C4', 'E4', 'G4', 'A4', 'C5'];
      const noteIndex = Math.floor(intensity * (pentatonicScale.length - 1));
      const note = pentatonicScale[noteIndex];
      
      // Play the collision sound for this specific beam
      playNoteForBeam(beamId, note, '16n', intensity);
      
      // Update last collision time
      lastCollisionTimes.set(beamId, now);
      
      // Emit collision event with data
      collisionEvents.emit({
        bodyA: event.body,
        bodyB: event.contact.bi === event.body ? event.contact.bj : event.contact.bi,
        beamId,
        intensity,
        note
      });
    }
  });

  console.log('Physics: Creating walls');
  // Create walls
  const wallMaterial = new CANNON.Material({
    friction: 0.1,
    restitution: 0.9
  });

  // Floor
  console.log('Physics: Creating floor');
  const floor = createWallBody(
    { x: 0, y: -5, z: 0 },
    { x: 10, y: 0.5, z: 10 }
  );
  world.addBody(floor.body);
  world.addContactMaterial(floor.contactMaterial);

  // Ceiling
  console.log('Physics: Creating ceiling');
  const ceiling = createWallBody(
    { x: 0, y: 5, z: 0 },
    { x: 10, y: 0.5, z: 10 }
  );
  world.addBody(ceiling.body);
  world.addContactMaterial(ceiling.contactMaterial);

  // Left wall
  console.log('Physics: Creating left wall');
  const leftWall = createWallBody(
    { x: -5, y: 0, z: 0 },
    { x: 0.5, y: 10, z: 10 }
  );
  world.addBody(leftWall.body);
  world.addContactMaterial(leftWall.contactMaterial);

  // Right wall
  console.log('Physics: Creating right wall');
  const rightWall = createWallBody(
    { x: 5, y: 0, z: 0 },
    { x: 0.5, y: 10, z: 10 }
  );
  world.addBody(rightWall.body);
  world.addContactMaterial(rightWall.contactMaterial);

  // Front wall
  console.log('Physics: Creating front wall');
  const frontWall = createWallBody(
    { x: 0, y: 0, z: -5 },
    { x: 10, y: 10, z: 0.5 }
  );
  world.addBody(frontWall.body);
  world.addContactMaterial(frontWall.contactMaterial);

  // Back wall
  console.log('Physics: Creating back wall');
  const backWall = createWallBody(
    { x: 0, y: 0, z: 5 },
    { x: 10, y: 10, z: 0.5 }
  );
  world.addBody(backWall.body);
  world.addContactMaterial(backWall.contactMaterial);

  console.log('Physics: World creation complete');
  return world;
}

/**
 * Creates a ball physics body
 * @param {Object} position - The position {x, y, z}
 * @param {Number} radius - The radius of the ball
 * @param {CANNON.World} world - The physics world to add the ball to
 * @returns {CANNON.Body} The ball physics body
 */
export function createBallBody(position, radius = 0.2, world = null) {
  const ballMaterial = new CANNON.Material({
    friction: 0.1,
    restitution: 0.9
  });

  const ballBody = new CANNON.Body({
    mass: 0.05,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: 0.1,
    material: ballMaterial
  });
  
  if (world) {
    // Add contact material for ball-to-ball collisions
    const ballContactMaterial = new CANNON.ContactMaterial(
      ballMaterial,
      ballMaterial,
      {
        friction: 0.1,
        restitution: 0.9,
        contactEquationRelaxation: 3,
        contactEquationStiffness: 1e8
      }
    );
    world.addContactMaterial(ballContactMaterial);
    world.addBody(ballBody);
  }
  
  return ballBody;
}

/**
 * Creates a wall physics body
 * @param {Object} position - The position {x, y, z}
 * @param {Object} dimensions - The dimensions {x, y, z}
 * @returns {Object} The wall physics body and its contact material
 */
export function createWallBody(position, dimensions) {
  const wallMaterial = new CANNON.Material({
    friction: 0.1,
    restitution: 0.9
  });

  const wallBody = new CANNON.Body({
    mass: 0, // Static body
    shape: new CANNON.Box(new CANNON.Vec3(dimensions.x / 2, dimensions.y / 2, dimensions.z / 2)),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    material: wallMaterial
  });

  // Add contact material for ball-wall collisions
  const wallContactMaterial = new CANNON.ContactMaterial(
    wallMaterial,
    wallMaterial,
    {
      friction: 0.1,
      restitution: 0.9,
      contactEquationRelaxation: 3,
      contactEquationStiffness: 1e8
    }
  );

  return { body: wallBody, material: wallMaterial, contactMaterial: wallContactMaterial };
}

/**
 * Updates the physics world by one step
 * @param {CANNON.World} world - The physics world to update
 * @param {Number} timeStep - The time step
 */
export function updatePhysics(world, timeStep = 1/60) {
  world.step(timeStep);
}

/**
 * Checks if a ball has fallen out of bounds
 * @param {CANNON.Body} ballBody - The ball physics body
 * @param {Number} lowerBound - The lower bound for y position
 * @returns {Boolean} True if the ball is out of bounds
 */
export function isBallOutOfBounds(ballBody, lowerBound = -10) {
  return ballBody.position.y < lowerBound;
}

/**
 * Removes balls that have fallen out of bounds
 * @param {Array} balls - Array of ball objects with mesh and body properties
 * @param {THREE.Scene} scene - The three.js scene
 * @param {CANNON.World} world - The physics world
 * @param {Number} lowerBound - The lower bound for y position
 * @returns {Number} The number of balls removed
 */
export function cleanupBalls(balls, scene, world, lowerBound = -10) {
  let removed = 0;
  for (let i = 0; i < balls.length; i++) {
    if (balls[i].body.position.y < lowerBound) {
      scene.remove(balls[i].mesh);
      world.removeBody(balls[i].body);
      balls.splice(i, 1);
      i--;
      removed++;
    }
  }
  return removed;
}

/**
 * Subscribe to collision events
 * @param {Function} listener - Callback function to execute on collision
 * @returns {Function} Unsubscribe function
 */
export function onCollision(listener) {
  return collisionEvents.subscribe(listener);
}

/**
 * Handle collisions that don't involve a beam
 */
function handleDefaultCollision(event) {
  // Calculate collision intensity
  const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
  const intensity = Math.min(Math.abs(relativeVelocity) / 10, 1);
  
  // Check if enough time has passed since last collision
  const now = Tone.now();
  const lastCollision = lastCollisionTimes.get('default') || 0;
  const minTimeBetweenCollisions = Tone.Time('32n').toSeconds();
  
  if (now - lastCollision >= minTimeBetweenCollisions) {
    // Use a default note for non-beam collisions
    const note = 'C4';
    
    // Play a simple bounce sound
    playNoteForBeam('default', note, '16n', intensity * 0.5);
    
    // Update last collision time
    lastCollisionTimes.set('default', now);
    
    // Emit collision event
    collisionEvents.emit({
      bodyA: event.body,
      bodyB: event.contact.bi === event.body ? event.contact.bj : event.contact.bi,
      intensity,
      note
    });
  }
}

/**
 * Get the beam ID from a collision event
 */
function getBeamIdFromCollision(event) {
  // Check if either body in the collision is a beam
  const bodyA = event.body;
  const bodyB = event.contact.bi === bodyA ? event.contact.bj : event.contact.bi;
  
  // Look up beam IDs
  for (const [id, body] of beamIds.entries()) {
    if (body === bodyA || body === bodyB) {
      return id;
    }
  }
  
  return null;
}

/**
 * Register a beam with the physics system
 * @param {string} beamId - Unique identifier for the beam
 * @param {CANNON.Body} body - The physics body for the beam
 * @param {string} voice - Voice to assign ('A' or 'B')
 */
export function registerBeam(beamId, body, voice = 'A') {
  beamIds.set(beamId, body);
  assignBeamToVoice(beamId, voice);
}

/**
 * Unregister a beam from the physics system
 * @param {string} beamId - The beam ID to unregister
 */
export function unregisterBeam(beamId) {
  beamIds.delete(beamId);
} 
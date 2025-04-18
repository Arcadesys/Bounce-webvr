import * as CANNON from 'cannon-es';

/**
 * Creates a physics world with default gravity
 * @returns {Object} The physics world
 */
export function createPhysicsWorld() {
  return new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
  });
}

/**
 * Creates a ball physics body
 * @param {Object} position - The position {x, y, z}
 * @param {Number} radius - The radius of the ball
 * @param {CANNON.World} world - The physics world to add the ball to
 * @returns {CANNON.Body} The ball physics body
 */
export function createBallBody(position, radius = 0.2, world = null) {
  const ballBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(position.x, position.y, position.z),
    linearDamping: 0.1,
    material: new CANNON.Material({
      friction: 0.3,
      restitution: 0.7, // Bounciness
    })
  });
  
  if (world) {
    world.addBody(ballBody);
  }
  
  return ballBody;
}

/**
 * Creates a wall physics body
 * @param {Object} start - The start position {x, y, z}
 * @param {Object} end - The end position {x, y, z}
 * @param {CANNON.World} world - The physics world to add the wall to
 * @returns {CANNON.Body} The wall physics body
 */
export function createWallBody(start, end, world = null) {
  // Calculate wall properties
  const direction = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  };
  
  // Calculate length using distance formula
  const length = Math.sqrt(
    Math.pow(direction.x, 2) + 
    Math.pow(direction.y, 2) + 
    Math.pow(direction.z, 2)
  );
  
  // Calculate center position
  const center = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    z: (start.z + end.z) / 2
  };
  
  // Calculate rotation
  const angle = Math.atan2(direction.x, direction.y);
  
  // Create physical wall
  const wallShape = new CANNON.Box(new CANNON.Vec3(length/2, 0.5, 0.1));
  const wallBody = new CANNON.Body({
    mass: 0, // Static body
    position: new CANNON.Vec3(center.x, center.y, center.z),
    shape: wallShape,
  });
  
  // Rotate to match direction
  wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -angle);
  
  if (world) {
    world.addBody(wallBody);
  }
  
  return wallBody;
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
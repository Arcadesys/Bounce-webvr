import { onCollision } from '../physics';

export function Game() {
  useEffect(() => {
    // Set up collision audio feedback
    const unsubscribe = onCollision((collisionData) => {
      // The voice manager is now handling the sound directly
      // We can use the collision data for visual feedback or other effects
      console.log('Collision:', collisionData);
    });

    return () => unsubscribe();
  }, []);

  // ... existing code ...
} 
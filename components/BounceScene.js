import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from '../utils/sceneManager';
import AudioPermissionModal from './AudioPermissionModal';
import LoadingScreen from './LoadingScreen';
import VoiceAssignmentPanel from './VoiceAssignmentPanel';
import { playCollisionSound } from '../utils/audio';
import { createPhysicsWorld, createBallBody, createWallBody, updatePhysics, isBallOutOfBounds, cleanupBalls } from '../physics';

export default function BounceScene() {
  const canvasRef = useRef(null);
  const sceneManagerRef = useRef(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingState, setLoadingState] = useState('Initializing...');
  const [loadingError, setLoadingError] = useState(null);
  const [walls, setWalls] = useState([]);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const worldRef = useRef(null);
  const ballsRef = useRef([]);

  useEffect(() => {
    console.log('BounceScene: Starting initialization');
    let timeoutId;

    const initScene = async () => {
      try {
        // Set a timeout to detect hangs
        timeoutId = setTimeout(() => {
          console.warn('BounceScene: Initialization taking longer than expected');
          setLoadingError('Loading is taking longer than expected. You may need to refresh.');
        }, 5000);

        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error('Canvas not found');
        }
        console.log('BounceScene: Canvas element found');
        
        setLoadingState('Creating physics world...');
        console.log('BounceScene: Creating physics world');
        const world = createPhysicsWorld();
        worldRef.current = world;
        console.log('BounceScene: Physics world created');

        // Set up collision event listener
        setLoadingState('Setting up collision detection...');
        console.log('BounceScene: Setting up collision listener');
        world.addEventListener('collide', (event) => {
          playCollisionSound();
        });

        // Create initial walls
        setLoadingState('Creating walls...');
        console.log('BounceScene: Creating initial walls');
        const walls = [
          { id: 1, position: [0, 0, -10], size: [20, 10, 1], voice: 'A' },
          { id: 2, position: [-10, 0, 0], size: [1, 10, 20], voice: 'B' },
          { id: 3, position: [10, 0, 0], size: [1, 10, 20], voice: 'A' },
          { id: 4, position: [0, 0, 10], size: [20, 10, 1], voice: 'B' }
        ];

        walls.forEach(wall => {
          console.log(`BounceScene: Creating wall ${wall.id}`);
          createWallBody(world, wall.position, wall.size);
        });

        setWalls(walls);
        console.log('BounceScene: All walls created');

        // Clear timeout since we've finished initialization
        clearTimeout(timeoutId);
        setLoadingState('Ready!');
        setIsLoading(false);
        console.log('BounceScene: Initialization complete');

        // Start physics loop
        const animate = () => {
          updatePhysics(world);
          requestAnimationFrame(animate);
        };
        animate();
        console.log('BounceScene: Animation loop started');

      } catch (error) {
        console.error('BounceScene: Initialization error:', error);
        setLoadingError(`Error loading scene: ${error.message}`);
        clearTimeout(timeoutId);
      }
    };

    initScene();

    return () => {
      console.log('BounceScene: Cleaning up');
      clearTimeout(timeoutId);
      if (worldRef.current) {
        worldRef.current.remove();
      }
    };
  }, []);

  const handleAudioPermission = () => {
    console.log('BounceScene: Audio permission granted');
    setShowAudioModal(false);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.isInitialized = true;
    }
  };

  const handleVoiceChange = (wallId, voice) => {
    console.log(`BounceScene: Changing voice for wall ${wallId} to ${voice}`);
    setWalls(walls.map(wall => 
      wall.id === wallId ? { ...wall, voice } : wall
    ));
  };

  const toggleVoicePanel = () => {
    setShowVoicePanel(!showVoicePanel);
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>{loadingState}</p>
        {loadingError && (
          <div className="error-message">
            {loadingError}
            <button onClick={() => window.location.reload()}>
              Refresh Page
            </button>
          </div>
        )}
        <style jsx>{`
          .loading {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #f5f5f5;
            color: #333;
          }
          .spinner {
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #2196f3;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          p {
            font-size: 18px;
            margin: 10px 0;
          }
          .error-message {
            color: #d32f2f;
            text-align: center;
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #d32f2f;
            border-radius: 4px;
            background: #ffebee;
          }
          button {
            margin-top: 10px;
            padding: 8px 16px;
            background: #2196f3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          button:hover {
            background: #1976d2;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="scene-container">
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100vw', 
          height: '100vh',
          display: 'block',
          touchAction: 'none', // Prevent default touch actions
          outline: 'none', // Remove focus outline
          visibility: isLoading ? 'hidden' : 'visible' // Hide canvas while loading
        }}
        tabIndex={0} // Make canvas focusable
        aria-label="Interactive 3D physics playground. Click to create balls, shift-click and drag to create walls."
      />
      
      {showAudioModal && !isLoading && <AudioPermissionModal onPermissionGranted={handleAudioPermission} />}
      
      <div className="controls-overlay">
        <button 
          onClick={toggleVoicePanel}
          className="voice-panel-toggle"
          aria-label="Toggle voice assignment panel"
        >
          {showVoicePanel ? 'Hide Voice Panel' : 'Show Voice Panel'}
        </button>
      </div>

      {showVoicePanel && (
        <VoiceAssignmentPanel
          walls={walls}
          onVoiceChange={handleVoiceChange}
        />
      )}
      
      <style jsx>{`
        .scene-container {
          position: relative;
          width: 100%;
          height: 100vh;
          background: #f0f0f0;
        }

        canvas {
          width: 100%;
          height: 100%;
        }

        .controls-overlay {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 5;
        }

        .voice-panel-toggle {
          padding: 8px 16px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .voice-panel-toggle:hover {
          background: #1976d2;
        }
      `}</style>
    </div>
  );
}

// Add some basic styling for the slider
// Ideally, this would go in a separate CSS file
const styles = `
.slider-container {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

#bounciness-slider {
  width: 150px;
}

#bounciness-value {
  min-width: 30px; /* Prevent layout shift */
  text-align: right;
}

/* Instructions panel */
#instructions {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  z-index: 10;
}

/* Sound toggle button */
#sound-toggle {
  position: absolute;
  top: 10px;
  right: 70px; /* Moved to make room for settings button */
  font-size: 1.5em;
  background: none;
  border: none;
  cursor: pointer;
  z-index: 10;
}

/* Settings toggle button */
.settings-toggle {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
}

/* Hamburger icon */
.hamburger-icon {
  width: 20px;
  height: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.hamburger-icon span {
  display: block;
  height: 2px;
  width: 100%;
  background: white;
  border-radius: 1px;
}

/* Settings panel */
.settings-panel {
  position: absolute;
  top: 60px;
  right: 10px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 5px;
  z-index: 15;
  min-width: 250px;
  display: none;
}

.settings-panel.open {
  display: block;
}

.settings-panel h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
}

/* Material picker */
.material-picker {
  margin-top: 15px;
}

.material-picker label {
  display: block;
  margin-bottom: 5px;
}

.material-picker select {
  width: 100%;
  padding: 5px;
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 3px;
}

/* Add styles for the ball counter */
.ball-counter {
  position: absolute;
  top: 10px;
  right: 120px; /* Position to the left of sound toggle */
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 0.9em;
  z-index: 10;
}

/* Instrument selector in settings panel */
.instrument-settings {
  margin-top: 15px;
}

.instrument-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.instrument-button {
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid #555;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 12px;
  padding: 8px 12px;
  transition: all 0.2s ease;
  flex: 1 0 calc(33% - 8px);
  min-width: 80px;
}

.instrument-button:hover {
  background: rgba(80, 80, 80, 0.8);
}

.instrument-button.active {
  background: rgba(0, 150, 100, 0.8);
  border-color: #4dffa7;
}

.test-button {
  background: rgba(60, 60, 60, 0.8);
  border: 1px solid #555;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  margin-top: 8px;
  margin-right: 8px;
  padding: 8px 12px;
  transition: all 0.2s ease;
}

.test-button:hover {
  background: rgba(80, 80, 80, 0.8);
}
`;

// Inject styles into the head - simple way for this example
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
} 
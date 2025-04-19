import React, { useEffect, useRef, useState } from 'react';
import { SceneManager } from '../utils/sceneManager';
import AudioPermissionModal from './AudioPermissionModal';
import LoadingScreen from './LoadingScreen';

export default function BounceScene() {
  const canvasRef = useRef(null);
  const sceneManagerRef = useRef(null);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!canvasRef.current) return;

    const initScene = async () => {
      try {
        // Create scene manager
        const sceneManager = new SceneManager(canvasRef.current);
        sceneManagerRef.current = sceneManager;
        
        // Handle window resize
        const handleResize = () => {
          if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
          }
        };
        
        // Initial resize
        handleResize();
        window.addEventListener('resize', handleResize);
        
        // Scene is ready, show audio modal
        setIsLoading(false);
        setShowAudioModal(true);
      } catch (error) {
        console.error('Error initializing scene:', error);
        // You might want to show an error state here
      }
    };

    initScene();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneManagerRef.current) {
        sceneManagerRef.current.dispose();
      }
    };
  }, []);

  const handleAudioPermission = () => {
    setShowAudioModal(false);
    if (sceneManagerRef.current) {
      sceneManagerRef.current.isInitialized = true;
    }
  };

  return (
    <>
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
      {isLoading && <LoadingScreen />}
      {showAudioModal && !isLoading && <AudioPermissionModal onPermissionGranted={handleAudioPermission} />}
    </>
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
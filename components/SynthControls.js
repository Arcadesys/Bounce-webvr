import { useState, useEffect } from 'react';
import SynthCustomizer from './SynthCustomizer';
import { initSynth } from '../utils/synthManager';

/**
 * SynthControls Component
 * Provides a button to open/close the synth customizer
 */
export default function SynthControls() {
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  
  // Initialize synth on mount
  useEffect(() => {
    // Initialize synth with stored settings (if any)
    initSynth();
  }, []);
  
  // Toggle customizer visibility
  const toggleCustomizer = () => {
    setIsCustomizerOpen(prev => !prev);
  };
  
  // Handle customizer close
  const handleCustomizerClose = (settings) => {
    // If settings provided, initialize synth with them
    if (settings) {
      initSynth(settings);
    }
    
    // Close the customizer
    setIsCustomizerOpen(false);
  };

  return (
    <div className="synth-controls">
      <button 
        className="synth-toggle-button"
        onClick={toggleCustomizer}
        aria-expanded={isCustomizerOpen}
        aria-label="Toggle synth customizer"
      >
        <span className="icon">🎹</span>
        <span className="text">Sound Settings</span>
      </button>
      
      {isCustomizerOpen && (
        <div className="synth-customizer-overlay">
          <SynthCustomizer onClose={handleCustomizerClose} />
        </div>
      )}
    </div>
  );
} 
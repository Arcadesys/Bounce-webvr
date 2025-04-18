import { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';

/**
 * SynthCustomizer Component
 * Allows users to customize a synthesizer instrument
 * with accessibility features for low vision users
 */
export default function SynthCustomizer({ onClose }) {
  const [synthParams, setSynthParams] = useState({
    oscillator: {
      type: 'sine', // sine, square, triangle, sawtooth
    },
    envelope: {
      attack: 0.1,
      decay: 0.2,
      sustain: 0.5,
      release: 0.8,
    },
    volume: -10,
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef(null);
  
  // Initialize synth
  useEffect(() => {
    // Create synth instance
    synthRef.current = new Tone.Synth(synthParams).toDestination();
    
    // Clean up synth on unmount
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
    };
  }, []);
  
  // Update synth when parameters change
  useEffect(() => {
    if (synthRef.current) {
      // Update oscillator type
      synthRef.current.oscillator.type = synthParams.oscillator.type;
      
      // Update envelope parameters
      synthRef.current.envelope.attack = synthParams.envelope.attack;
      synthRef.current.envelope.decay = synthParams.envelope.decay;
      synthRef.current.envelope.sustain = synthParams.envelope.sustain;
      synthRef.current.envelope.release = synthParams.envelope.release;
      
      // Update volume
      synthRef.current.volume.value = synthParams.volume;
    }
  }, [synthParams]);
  
  // Handle parameter changes
  const handleParamChange = (category, param, value) => {
    setSynthParams(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [param]: value
      }
    }));
    
    // Play a test note when changing parameters
    playTestNote();
    
    // Play a guide tone for accessibility
    playGuideTone(value);
  };
  
  // Handle volume change
  const handleVolumeChange = (value) => {
    setSynthParams(prev => ({
      ...prev,
      volume: value
    }));
    
    // Play guide tone
    playGuideTone(value);
  };
  
  // Play a test note
  const playTestNote = () => {
    if (synthRef.current) {
      // Start the audio context if it's not started
      if (Tone.context.state !== 'running') {
        Tone.start();
      }
      
      // Play a C4 note for 0.5 seconds
      synthRef.current.triggerAttackRelease('C4', '8n');
    }
  };
  
  // Play a continuous C major scale while testing
  const togglePlayTest = () => {
    if (isPlaying) {
      // Stop playing
      Tone.Transport.stop();
      Tone.Transport.cancel();
      setIsPlaying(false);
    } else {
      // Start the audio context if it's not started
      if (Tone.context.state !== 'running') {
        Tone.start();
      }
      
      // Set up a sequence to play C major scale
      const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
      const seq = new Tone.Sequence((time, note) => {
        synthRef.current.triggerAttackRelease(note, '8n', time);
      }, notes, '8n');
      
      // Start the sequence
      seq.start(0);
      Tone.Transport.start();
      setIsPlaying(true);
    }
  };
  
  // Play guide tones for accessibility (different sounds for different values)
  const playGuideTone = (value) => {
    // Normalize value to 0-1 range for determining the guide tone
    const normalizedValue = Math.min(Math.max(parseFloat(value), 0), 1);
    
    // Create a temporary synth for the guide tone
    const guideSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 }
    }).toDestination();
    
    // Calculate note based on value (higher value = higher note)
    // Map 0-1 to C4-C5 range
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const noteIndex = Math.floor(normalizedValue * notes.length);
    const note = notes[Math.min(noteIndex, notes.length - 1)];
    
    // Play the guide tone
    guideSynth.volume.value = -20; // Quiet enough to not be annoying
    guideSynth.triggerAttackRelease(note, 0.1);
    
    // Dispose of the synth after playing
    setTimeout(() => {
      guideSynth.dispose();
    }, 200);
  };
  
  // Apply synth settings to the app
  const applySettings = () => {
    // Save synth settings to localStorage
    localStorage.setItem('customSynthSettings', JSON.stringify(synthParams));
    
    // Play a success sound
    playSuccessSound();
    
    // Notify parent component
    if (onClose) onClose(synthParams);
  };
  
  // Play a success sound when settings are applied
  const playSuccessSound = () => {
    const successSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5 }
    }).toDestination();
    
    // Play a short ascending melody
    successSynth.triggerAttackRelease('C4', '16n');
    setTimeout(() => successSynth.triggerAttackRelease('E4', '16n'), 150);
    setTimeout(() => successSynth.triggerAttackRelease('G4', '16n'), 300);
    setTimeout(() => successSynth.triggerAttackRelease('C5', '8n'), 450);
    
    // Dispose of the synth after playing
    setTimeout(() => {
      successSynth.dispose();
    }, 1000);
  };

  return (
    <div className="synth-customizer">
      <h2>Paddle Sound Customizer</h2>
      
      <div className="control-group">
        <h3>Oscillator Type</h3>
        <div className="control-row">
          {['sine', 'square', 'triangle', 'sawtooth'].map(type => (
            <button 
              key={type}
              className={synthParams.oscillator.type === type ? 'active' : ''}
              onClick={() => handleParamChange('oscillator', 'type', type)}
              aria-pressed={synthParams.oscillator.type === type}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      <div className="control-group">
        <h3>Envelope</h3>
        <div className="control-row">
          <label>
            Attack
            <input 
              type="range" 
              min="0.01" 
              max="2" 
              step="0.01" 
              value={synthParams.envelope.attack} 
              onChange={(e) => handleParamChange('envelope', 'attack', parseFloat(e.target.value))}
              aria-label="Attack time in seconds"
            />
            <span>{synthParams.envelope.attack.toFixed(2)}s</span>
          </label>
        </div>
        
        <div className="control-row">
          <label>
            Decay
            <input 
              type="range" 
              min="0.01" 
              max="2" 
              step="0.01" 
              value={synthParams.envelope.decay} 
              onChange={(e) => handleParamChange('envelope', 'decay', parseFloat(e.target.value))}
              aria-label="Decay time in seconds"
            />
            <span>{synthParams.envelope.decay.toFixed(2)}s</span>
          </label>
        </div>
        
        <div className="control-row">
          <label>
            Sustain
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={synthParams.envelope.sustain} 
              onChange={(e) => handleParamChange('envelope', 'sustain', parseFloat(e.target.value))}
              aria-label="Sustain level"
            />
            <span>{synthParams.envelope.sustain.toFixed(2)}</span>
          </label>
        </div>
        
        <div className="control-row">
          <label>
            Release
            <input 
              type="range" 
              min="0.01" 
              max="4" 
              step="0.01" 
              value={synthParams.envelope.release} 
              onChange={(e) => handleParamChange('envelope', 'release', parseFloat(e.target.value))}
              aria-label="Release time in seconds"
            />
            <span>{synthParams.envelope.release.toFixed(2)}s</span>
          </label>
        </div>
      </div>
      
      <div className="control-group">
        <h3>Volume</h3>
        <div className="control-row">
          <label>
            <input 
              type="range" 
              min="-40" 
              max="0" 
              step="1" 
              value={synthParams.volume} 
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              aria-label="Volume in decibels"
            />
            <span>{synthParams.volume} dB</span>
          </label>
        </div>
      </div>
      
      <div className="control-group">
        <h3>Test Sound</h3>
        <div className="control-row">
          <button 
            onClick={playTestNote}
            className="test-button"
            aria-label="Play test note"
          >
            Play Note
          </button>
          <button 
            onClick={togglePlayTest}
            className={`test-button ${isPlaying ? 'active' : ''}`}
            aria-pressed={isPlaying}
            aria-label={isPlaying ? "Stop test melody" : "Play test melody"}
          >
            {isPlaying ? 'Stop Melody' : 'Play Melody'}
          </button>
        </div>
      </div>
      
      <div className="control-group button-row">
        <button onClick={applySettings} className="apply-button">
          Apply Settings
        </button>
        {onClose && (
          <button onClick={() => onClose(null)} className="cancel-button">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
} 
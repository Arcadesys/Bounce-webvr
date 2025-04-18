import * as Tone from 'tone';
import { mapLengthToNote } from './midiSequencer';

// Instrument prefabs
const INSTRUMENT_PREFABS = {
  marimba: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.3 },
    volume: -8
  },
  epiano: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.03, decay: 0.5, sustain: 0.4, release: 0.7 },
    volume: -10
  },
  glockenspiel: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0.05, release: 0.2 },
    volume: -12
  },
  vibraphone: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 1.0 },
    volume: -9
  },
  kalimba: {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.3 },
    volume: -11
  },
  xylophone: {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0.01, release: 0.1 },
    volume: -10
  }
};

// Default synth settings
const DEFAULT_SYNTH_SETTINGS = INSTRUMENT_PREFABS.marimba;

// Singleton instance of the synth
let synthInstance = null;
// Dedicated synth for bounce sounds
let bounceSynthInstance = null;

// Current instrument type (can be changed without changing all settings)
let currentInstrumentType = localStorage.getItem('currentInstrument') || 'marimba';

/**
 * Initialize the synth with settings
 * @param {Object} settings - Synth settings (optional)
 * @returns {Object} The synth instance
 */
export function initSynth(settings = null) {
  // Dispose of existing synth if any
  if (synthInstance) {
    synthInstance.dispose();
  }
  
  // Use provided settings or load from localStorage or use defaults
  let synthSettings = settings;
  
  if (!synthSettings) {
    // Try to load saved settings
    const savedSettings = localStorage.getItem('customSynthSettings');
    
    if (savedSettings) {
      synthSettings = JSON.parse(savedSettings);
    } else {
      // Try to load current instrument
      const currentInstrument = localStorage.getItem('currentInstrument');
      
      if (currentInstrument && INSTRUMENT_PREFABS[currentInstrument]) {
        synthSettings = INSTRUMENT_PREFABS[currentInstrument];
      } else {
        synthSettings = DEFAULT_SYNTH_SETTINGS;
      }
    }
  }
  
  // Create new synth instance
  synthInstance = new Tone.Synth(synthSettings).toDestination();
  
  // Initialize bounce synth if it doesn't exist
  if (!bounceSynthInstance) {
    initBounceSynth();
  }
  
  return synthInstance;
}

/**
 * Initialize a dedicated synth for bounce sounds
 */
function initBounceSynth() {
  // Dispose of existing bounce synth if any
  if (bounceSynthInstance) {
    bounceSynthInstance.dispose();
  }
  
  // Create a simpler synth for bounce sounds
  bounceSynthInstance = new Tone.Synth({
    oscillator: {
      type: 'sine'
    },
    envelope: {
      attack: 0.001,  // Almost instant attack
      decay: 0.05,    // Very short decay
      sustain: 0.01,  // Basically no sustain
      release: 0.05   // Quick release
    },
    volume: -20 // Much quieter than the musical synth
  }).toDestination();
}

/**
 * Get the current synth instance, initializing if needed
 * @returns {Object} The synth instance
 */
export function getSynth() {
  if (!synthInstance) {
    return initSynth();
  }
  return synthInstance;
}

/**
 * Play a note with the synth
 * @param {string|number} note - The note to play (e.g., 'C4' or frequency in Hz)
 * @param {number} duration - Duration in seconds or as a note value ('8n', '4n', etc.)
 * @param {number} time - When to play the note (optional, defaults to now)
 * @param {number} velocity - Volume of the note (0-1)
 * @returns {Object} The synth instance for chaining
 */
export function playNote(note, duration = '8n', time = undefined, velocity = 0.7, pitchFactor = 1.0) {
  // Make sure Tone.js context is ready
  if (Tone.context.state !== 'running') {
    // This is a safety check but we should initiate this earlier when user interacts
    try {
      Tone.start();
      // Give a moment for context to start
      Tone.context.resume();
    } catch (e) {
      console.warn("Could not start Tone.js context:", e);
      return null;
    }
  }
  
  try {
    // Get the synth instance or initialize if needed
    const synth = getSynth();
    
    if (!synth) {
      console.warn("Synth initialization failed");
      return null;
    }
    
    // Apply pitch factor if provided - useful for beam pitch adjustments
    let noteToPlay = note;
    if (pitchFactor !== 1.0 && typeof note === 'string') {
      // Get frequency, adjust it, and convert back to note
      const freq = Tone.Frequency(note).toFrequency() * pitchFactor;
      noteToPlay = freq; // Using frequency directly is more accurate than converting back to note
    }
    
    // Play the note
    synth.triggerAttackRelease(noteToPlay, duration, time, velocity);
    
    return synth;
  } catch (e) {
    console.error("Error playing note:", e);
    return null;
  }
}

/**
 * Play a note based on a paddle/wall length (compatible with existing code)
 * @param {AudioContext} unusedAudioContext - Ignored (for compatibility)
 * @param {number} length - The length of the wall/paddle
 * @param {number} duration - Duration in seconds (ignored - we use fixed short duration)
 * @param {number} volume - Volume of the note (0-1)
 * @param {string} unusedWaveform - Ignored (for compatibility)
 * @returns {Object} Information about the played note
 */
export function playNoteForLength(unusedAudioContext, length, duration = 0.5, volume = 0.5, pitchFactor = 1.0) {
  try {
    // Get the note from midiSequencer's mapping function
    const note = mapLengthToNote(length);
    
    // Play the note using our synth with a fixed short duration for percussion
    const PERCUSSIVE_DURATION = '16n'; // Fixed short duration for all hits
    playNote(note, PERCUSSIVE_DURATION, undefined, volume, pitchFactor);
    
    // Return object similar to the original function for compatibility
    return { 
      note, 
      frequency: Tone.Frequency(note).toFrequency() * (pitchFactor || 1.0)
    };
  } catch (e) {
    console.error("Error playing note for length:", e);
    return { note: 'C4', frequency: 261.63 }; // Return default value on error
  }
}

/**
 * Play a bounce sound with the synth
 * @param {number} intensity - Intensity of the bounce (0-1)
 */
export function playBounceSound(intensity = 1.0) {
  try {
    // Create bounce synth if it doesn't exist
    if (!bounceSynthInstance) {
      initBounceSynth();
    }
    
    // Ensure we have a valid synth
    if (!bounceSynthInstance) {
      console.warn("Bounce synth initialization failed");
      return;
    }
    
    // Ensure audio context is running
    if (Tone.context.state !== 'running') {
      try {
        Tone.start();
        Tone.context.resume();
      } catch (e) {
        console.warn("Could not start Tone.js context:", e);
        return;
      }
    }
    
    // Create a quick bounce sound
    const now = Tone.now();
    
    // Set up frequency sweep - using the dedicated bounce synth
    bounceSynthInstance.frequency.setValueAtTime(300 + intensity * 200, now);
    bounceSynthInstance.frequency.exponentialRampToValueAtTime(200, now + 0.05); // Faster sweep
    
    // Adjust volume based on intensity but keep it quieter
    const volume = -30 + intensity * 10; // Keeps volume between -30 and -20 dB
    bounceSynthInstance.volume.value = volume;
    
    // Trigger the note with shorter duration
    bounceSynthInstance.triggerAttack(now);
    bounceSynthInstance.triggerRelease(now + 0.1); // Shorter release
  } catch (e) {
    console.error("Error playing bounce sound:", e);
  }
}

/**
 * Play a success sound
 */
export function playSuccessSound() {
  const synth = getSynth();
  
  // Ensure audio context is running
  if (Tone.context.state !== 'running') {
    Tone.start();
  }
  
  // Play a short ascending melody
  const now = Tone.now();
  synth.triggerAttackRelease('C4', '16n', now);
  synth.triggerAttackRelease('E4', '16n', now + 0.15);
  synth.triggerAttackRelease('G4', '16n', now + 0.3);
  synth.triggerAttackRelease('C5', '8n', now + 0.45);
}

/**
 * Play a mode change sound
 * @param {boolean} drawMode - Whether draw mode is active
 */
export function playModeChangeSound(drawMode) {
  const synth = getSynth();
  
  // Ensure audio context is running
  if (Tone.context.state !== 'running') {
    Tone.start();
  }
  
  // Temporarily change synth settings
  const originalType = synth.oscillator.type;
  const originalVolume = synth.volume.value;
  
  // Set temp settings
  synth.oscillator.type = drawMode ? 'sine' : 'triangle';
  synth.volume.value = -20; // Quieter for notification sound
  
  // Play the note
  synth.triggerAttackRelease(drawMode ? 440 : 330, 0.3);
  
  // Reset to original settings after playing
  setTimeout(() => {
    synth.oscillator.type = originalType;
    synth.volume.value = originalVolume;
  }, 300);
}

/**
 * Set the current instrument type
 * @param {string} instrumentType - The instrument type ('marimba', 'epiano', etc.)
 */
export function setInstrumentType(instrumentType) {
  if (INSTRUMENT_PREFABS[instrumentType]) {
    currentInstrumentType = instrumentType;
    
    // Save to localStorage
    localStorage.setItem('currentInstrument', instrumentType);
    
    // If synth exists, update its settings
    if (synthInstance) {
      const currentSettings = {
        oscillator: {
          type: INSTRUMENT_PREFABS[instrumentType].oscillator.type
        },
        envelope: {
          attack: INSTRUMENT_PREFABS[instrumentType].envelope.attack,
          decay: INSTRUMENT_PREFABS[instrumentType].envelope.decay,
          sustain: INSTRUMENT_PREFABS[instrumentType].envelope.sustain,
          release: INSTRUMENT_PREFABS[instrumentType].envelope.release
        },
        volume: INSTRUMENT_PREFABS[instrumentType].volume
      };
      
      // Update the synth settings
      synthInstance.oscillator.type = currentSettings.oscillator.type;
      synthInstance.envelope.attack = currentSettings.envelope.attack;
      synthInstance.envelope.decay = currentSettings.envelope.decay;
      synthInstance.envelope.sustain = currentSettings.envelope.sustain;
      synthInstance.envelope.release = currentSettings.envelope.release;
      synthInstance.volume.value = currentSettings.volume;
      
      // Save current settings
      localStorage.setItem('customSynthSettings', JSON.stringify(currentSettings));
    }
    
    return true;
  }
  return false;
}

/**
 * Get the current instrument type
 * @returns {string} The current instrument type
 */
export function getCurrentInstrumentType() {
  return currentInstrumentType;
}

/**
 * Ensure Tone.js is initialized - call this early when component mounts
 * or at first user interaction
 * @returns {Promise} A promise that resolves when Tone.js is ready
 */
export function ensureToneInitialized() {
  return new Promise((resolve, reject) => {
    try {
      if (Tone.context.state !== 'running') {
        // First try to resume the context
        Tone.context.resume().then(() => {
          console.log("Tone.js context resumed");
          
          // Now try to start Tone.js
          Tone.start().then(() => {
            console.log("Tone.js started");
            
            // Initialize synth if needed
            if (!synthInstance) {
              initSynth();
            }
            
            resolve(true);
          }).catch(err => {
            console.warn("Error starting Tone.js:", err);
            reject(err);
          });
        }).catch(err => {
          console.warn("Error resuming Tone.js context:", err);
          reject(err);
        });
      } else {
        // Context already running, make sure synth is initialized
        if (!synthInstance) {
          initSynth();
        }
        resolve(true);
      }
    } catch (e) {
      console.error("Error initializing Tone.js:", e);
      reject(e);
    }
  });
}

/**
 * Stop all sounds immediately
 * Use this to handle stuck notes or when changing scenes
 */
export function stopAllSounds() {
  try {
    // Stop any playing notes on the main synth
    if (synthInstance) {
      synthInstance.triggerRelease();
    }
    
    // Stop any playing notes on the bounce synth
    if (bounceSynthInstance) {
      bounceSynthInstance.triggerRelease();
    }
    
    // Dispose and recreate synths if there's a persistent ringing
    if (synthInstance) {
      const currentSettings = synthInstance.get();
      synthInstance.dispose();
      synthInstance = new Tone.Synth(currentSettings).toDestination();
    }
    
    if (bounceSynthInstance) {
      const bounceSettings = bounceSynthInstance.get();
      bounceSynthInstance.dispose();
      bounceSynthInstance = new Tone.Synth(bounceSettings).toDestination();
    }
    
    console.log("All sounds stopped");
  } catch (e) {
    console.error("Error stopping sounds:", e);
  }
}

// Export default settings and instrument prefabs for reference
export { DEFAULT_SYNTH_SETTINGS, INSTRUMENT_PREFABS }; 
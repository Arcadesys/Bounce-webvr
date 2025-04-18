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
export function playNote(note, duration = '8n', time = undefined, velocity = 0.7) {
  const synth = getSynth();
  
  // Ensure audio context is running
  if (Tone.context.state !== 'running') {
    Tone.start();
  }
  
  // Play the note
  synth.triggerAttackRelease(note, duration, time, velocity);
  
  return synth;
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
export function playNoteForLength(unusedAudioContext, length, duration = 0.5, volume = 0.5, unusedWaveform = 'sine') {
  // Get the note from midiSequencer's mapping function
  const note = mapLengthToNote(length);
  
  // Play the note using our synth with a fixed short duration for percussion
  const PERCUSSIVE_DURATION = '16n'; // Fixed short duration for all hits
  playNote(note, PERCUSSIVE_DURATION, undefined, volume);
  
  // Return object similar to the original function for compatibility
  return { 
    note, 
    frequency: Tone.Frequency(note).toFrequency() 
  };
}

/**
 * Play a bounce sound with the synth
 * @param {number} intensity - Intensity of the bounce (0-1)
 */
export function playBounceSound(intensity = 1.0) {
  // Create bounce synth if it doesn't exist
  if (!bounceSynthInstance) {
    initBounceSynth();
  }
  
  // Ensure audio context is running
  if (Tone.context.state !== 'running') {
    Tone.start();
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

// Export default settings and instrument prefabs for reference
export { DEFAULT_SYNTH_SETTINGS, INSTRUMENT_PREFABS }; 
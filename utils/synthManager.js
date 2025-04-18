import * as Tone from 'tone';

// Default synth settings
const DEFAULT_SYNTH_SETTINGS = {
  oscillator: {
    type: 'sine',
  },
  envelope: {
    attack: 0.01,   // Much faster attack
    decay: 0.1,     // Shorter decay
    sustain: 0.1,   // Very little sustain
    release: 0.1,   // Quick release
  },
  volume: -10,
};

// Singleton instance of the synth
let synthInstance = null;
// Dedicated synth for bounce sounds
let bounceSynthInstance = null;

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
  const synthSettings = settings || 
    JSON.parse(localStorage.getItem('customSynthSettings')) || 
    DEFAULT_SYNTH_SETTINGS;
  
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
  // Calculate note from length as in the original code
  // This is a simplified version of the mapping function
  const notes = [
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'
  ];
  
  // Normalize length to 0-1 range (assuming length is between 0.2 and 3.0)
  const normalizedLength = Math.min(Math.max((length - 0.2) / (3.0 - 0.2), 0), 1);
  
  // Map to a note
  const noteIndex = Math.floor(normalizedLength * notes.length);
  const note = notes[Math.min(noteIndex, notes.length - 1)];
  
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

// Export default settings for reference
export { DEFAULT_SYNTH_SETTINGS }; 
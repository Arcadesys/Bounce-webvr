/**
 * MIDI Sequencer Utility
 * Handles converting bar lengths to MIDI notes and playing them
 */
import * as Tone from 'tone';
// Import the playNoteForLength function from synthManager
import { playNoteForLength as playSynthNote } from './synthManager';

// C major scale notes for two octaves (C4 to C6)
const MAJOR_SCALE_FREQUENCIES = {
  // First octave (C4 - B4)
  'C4': 261.63,
  'D4': 293.66,
  'E4': 329.63,
  'F4': 349.23,
  'G4': 392.00,
  'A4': 440.00,
  'B4': 493.88,
  
  // Second octave (C5 - B5)
  'C5': 523.25,
  'D5': 587.33,
  'E5': 659.26,
  'F5': 698.46,
  'G5': 783.99,
  'A5': 880.00,
  'B5': 987.77,
  
  // C6 for completion
  'C6': 1046.50
};

// Array for easier access - C major scale (C, D, E, F, G, A, B)
const MAJOR_SCALE_NOTES = [
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4',
  'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'
];

/**
 * Maps a wall length to a note in the C major scale
 * @param {number} length - The length of the wall
 * @param {number} minLength - Minimum wall length that maps to the lowest note
 * @param {number} maxLength - Maximum wall length that maps to the highest note
 * @returns {string} The note name (e.g., 'C4', 'D4', etc.)
 */
export function mapLengthToNote(length, minLength = 0.2, maxLength = 3.0) {
  // Clamp length to min/max range
  const clampedLength = Math.max(minLength, Math.min(length, maxLength));
  
  // Calculate normalized position in the range [0, 1]
  const normalizedPos = (clampedLength - minLength) / (maxLength - minLength);
  
  // Map to an index in the scale
  const noteIndex = Math.floor(normalizedPos * MAJOR_SCALE_NOTES.length);
  
  // Return the corresponding note
  return MAJOR_SCALE_NOTES[Math.min(noteIndex, MAJOR_SCALE_NOTES.length - 1)];
}

/**
 * Maps a wall length to a frequency
 * @param {number} length - The length of the wall
 * @param {number} minLength - Minimum wall length that maps to the lowest note
 * @param {number} maxLength - Maximum wall length that maps to the highest note
 * @returns {number} The frequency in Hz
 */
export function mapLengthToFrequency(length, minLength = 0.2, maxLength = 3.0) {
  const note = mapLengthToNote(length, minLength, maxLength);
  return MAJOR_SCALE_FREQUENCIES[note];
}

/**
 * Plays a note based on the wall length using Tone.js
 * @param {AudioContext} audioContext - The audio context to use (passed from Tone.js)
 * @param {number} length - The length of the wall
 * @param {number} duration - The duration of the note in seconds
 * @param {number} volume - The volume of the note (0-1)
 * @param {string} waveform - The oscillator waveform type ('sine', 'square', 'sawtooth', 'triangle')
 * @returns {Object} The oscillator and gain nodes
 */
export function playNoteForLength(audioContext, length, duration = 0.5, volume = 0.5, waveform = 'sine') {
  // First, try using the synthManager version which uses instrument presets
  try {
    return playSynthNote(audioContext, length, duration, volume, waveform);
  } catch (e) {
    console.warn("Error using synthManager playNoteForLength, falling back to local implementation", e);
    
    // Fallback to the original implementation if there's an error
    if (!audioContext) return null;
  
    const frequency = mapLengthToFrequency(length);
    const note = mapLengthToNote(length);
    
    // Use Tone.js to play the sound
    if (typeof Tone !== 'undefined') {
      // Create a temporary synth
      const synth = new Tone.Synth({
        oscillator: {
          type: waveform
        },
        envelope: {
          attack: 0.001,
          decay: 0.1,
          sustain: 0.1,
          release: 0.1
        },
        volume: (volume * 20) - 20 // Convert 0-1 range to -20 to 0 dB
      }).toDestination();
      
      // Play the note
      synth.triggerAttackRelease(frequency, duration);
      
      // Dispose of the synth after it's done playing
      setTimeout(() => {
        synth.dispose();
      }, duration * 1000 + 100);
      
      return { frequency, note };
    }
    
    // Fallback to Web Audio API if Tone.js is not available
    else if (audioContext.createOscillator) {
      // Create oscillator and gain nodes
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Configure oscillator
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      
      // Configure gain (volume with fade out)
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Start and stop the oscillator
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
      
      return { oscillator, gainNode, frequency, note };
    }
    
    // Return basic info if neither method is available
    return { frequency, note };
  }
}

/**
 * Gets the color for a specific note
 * @param {string} note - The note name
 * @returns {number} The color as a hexadecimal number
 */
export function getNoteColor(note) {
  // Simple color map based on note position in the scale
  const noteIndex = MAJOR_SCALE_NOTES.indexOf(note);
  
  // Create a hue value based on the note position (rainbow effect)
  const hue = (noteIndex / MAJOR_SCALE_NOTES.length) * 360;
  
  // Convert HSL to RGB (simple conversion for demonstration)
  const h = hue / 60;
  const s = 0.8; // saturation
  const l = 0.5; // lightness
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(h % 2 - 1));
  const m = l - c / 2;
  
  let r, g, b;
  
  if (h >= 0 && h < 1) { r = c; g = x; b = 0; }
  else if (h >= 1 && h < 2) { r = x; g = c; b = 0; }
  else if (h >= 2 && h < 3) { r = 0; g = c; b = x; }
  else if (h >= 3 && h < 4) { r = 0; g = x; b = c; }
  else if (h >= 4 && h < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);
  
  // Convert RGB to hex
  return (r << 16) | (g << 8) | b;
}

/**
 * Structure for future quantization settings
 * This allows for modular implementation of quantization later
 */
export const QuantizationSettings = {
  NONE: { id: 'none', name: 'None', value: 0 },
  EIGHTH: { id: 'eighth', name: 'Eighth Notes', value: 8 },
  QUARTER: { id: 'quarter', name: 'Quarter Notes', value: 4 },
  HALF: { id: 'half', name: 'Half Notes', value: 2 },
  WHOLE: { id: 'whole', name: 'Whole Notes', value: 1 }
};

/**
 * Placeholder for future quantization function
 * @param {number} length - The raw length value
 * @param {Object} quantSettings - The quantization settings
 * @returns {number} The quantized length
 */
export function quantizeLength(length, quantSettings = QuantizationSettings.NONE) {
  if (quantSettings.id === 'none') {
    return length; // No quantization
  }
  
  // This is where custom quantization logic will go in the future
  // For now, we're just returning the original length
  return length;
} 
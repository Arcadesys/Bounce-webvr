/**
 * Maps a wall length to a musical note
 * @param {number} length - Length of the wall
 * @returns {string} Musical note (e.g., 'C4', 'D4', etc.)
 */
export function mapLengthToNote(length) {
  // Map lengths to notes in the C major scale
  const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
  const minLength = 0.2;
  const maxLength = 10;
  
  // Clamp length between min and max
  const clampedLength = Math.max(minLength, Math.min(length, maxLength));
  
  // Map to note index (0-7)
  const noteIndex = Math.floor((clampedLength - minLength) / (maxLength - minLength) * (notes.length - 1));
  
  return notes[noteIndex];
}

/**
 * Gets the color associated with a musical note
 * @param {string} note - Musical note (e.g., 'C4', 'D4', etc.)
 * @returns {number} Hex color code
 */
export function getNoteColor(note) {
  const noteColors = {
    'C4': 0xFF0000, // Red
    'D4': 0xFF7F00, // Orange
    'E4': 0xFFFF00, // Yellow
    'F4': 0x00FF00, // Green
    'G4': 0x0000FF, // Blue
    'A4': 0x4B0082, // Indigo
    'B4': 0x9400D3, // Violet
    'C5': 0xFF0000  // Red (octave up)
  };
  
  return noteColors[note] || 0xFFFFFF; // Default to white if note not found
}

/**
 * Gets the frequency for a musical note
 * @param {string} note - Musical note (e.g., 'C4', 'D4', etc.)
 * @returns {number} Frequency in Hz
 */
export function getNoteFrequency(note) {
  const noteFrequencies = {
    'C4': 261.63,
    'D4': 293.66,
    'E4': 329.63,
    'F4': 349.23,
    'G4': 392.00,
    'A4': 440.00,
    'B4': 493.88,
    'C5': 523.25
  };
  
  return noteFrequencies[note] || 440; // Default to A4 if note not found
}

/**
 * Creates a guide tone for an action
 * @param {AudioContext} audioContext - Audio context to use
 * @param {string} action - Action type ('success', 'error', 'warning')
 * @param {number} duration - Duration in seconds
 */
export function playGuideTone(audioContext, action, duration = 0.3) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Set frequency based on action type
  switch (action) {
    case 'success':
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      break;
    case 'error':
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
      break;
    case 'warning':
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
      break;
    default:
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
  }
  
  // Quick fade in/out
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
} 
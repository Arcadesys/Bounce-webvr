import * as Tone from 'tone';

// Two voice channels for our simple system
let voiceA = null;
let voiceB = null;

// Beam to voice assignments
const beamVoiceAssignments = new Map();

// Duplicate removal tolerance (in milliseconds)
const DUPLICATE_TOLERANCE = 100;

// Last played notes for each voice (for duplicate removal)
const lastPlayedNotes = {
  A: { note: null, time: 0 },
  B: { note: null, time: 0 }
};

/**
 * Initialize the two-voice system
 */
export async function initVoicePool() {
  console.log('VoiceManager: Starting voice pool initialization');
  
  // Ensure audio context is running
  console.log('VoiceManager: Current Tone.js context state:', Tone.context.state);
  if (Tone.context.state !== 'running') {
    try {
      console.log('VoiceManager: Attempting to start Tone.js');
      await Tone.start();
      console.log('VoiceManager: Tone.js started successfully');
    } catch (error) {
      console.error('VoiceManager: Error starting Tone.js:', error);
      throw error; // Re-throw to handle in physics initialization
    }
  }

  console.log('VoiceManager: Creating voice A');
  // Create two distinct voices with pleasant timbres
  voiceA = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: 0.1,
      sustain: 0.1,
      release: 0.2
    },
    volume: -10
  }).toDestination();

  console.log('VoiceManager: Creating voice B');
  voiceB = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: 0.001,
      decay: 0.15,
      sustain: 0.1,
      release: 0.25
    },
    volume: -12
  }).toDestination();

  console.log('VoiceManager: Voice pool initialization complete');
}

/**
 * Assign a beam to a voice
 * @param {string} beamId - Unique identifier for the beam
 * @param {string} voice - Voice to assign ('A' or 'B')
 */
export function assignBeamToVoice(beamId, voice) {
  if (voice !== 'A' && voice !== 'B') {
    console.warn(`Invalid voice: ${voice}. Must be 'A' or 'B'`);
    return;
  }
  
  beamVoiceAssignments.set(beamId, voice);
  console.log(`Assigned beam ${beamId} to voice ${voice}`);
}

/**
 * Play a note for a specific beam
 * @param {string} beamId - The beam ID
 * @param {string|number} note - The note to play (e.g., 'C4' or frequency in Hz)
 * @param {string|number} duration - Duration in seconds or as a note value ('8n', '4n', etc.)
 * @param {number} velocity - Volume of the note (0-1)
 */
export function playNoteForBeam(beamId, note, duration = '8n', velocity = 0.7) {
  // Get the voice assigned to this beam
  const voice = beamVoiceAssignments.get(beamId);
  
  if (!voice) {
    console.warn(`No voice assigned to beam ${beamId}`);
    return;
  }
  
  // Check for duplicates within tolerance
  const now = Date.now();
  const lastPlayed = lastPlayedNotes[voice];
  
  if (lastPlayed.note === note && (now - lastPlayed.time) < DUPLICATE_TOLERANCE) {
    // Skip duplicate note
    return;
  }
  
  // Update last played note
  lastPlayedNotes[voice] = { note, time: now };
  
  // Play the note on the assigned voice
  const synth = voice === 'A' ? voiceA : voiceB;
  synth.triggerAttackRelease(note, duration, Tone.now(), velocity);
}

/**
 * Play a note using the specified voice
 * @param {string|number} note - The note to play (e.g., 'C4' or frequency in Hz)
 * @param {string} voice - Voice to use ('A' or 'B')
 * @param {string|number} duration - Duration in seconds or as a note value ('8n', '4n', etc.)
 * @param {number} velocity - Volume of the note (0-1)
 */
export function playNote(note, voice = 'A', duration = '8n', velocity = 0.7) {
  if (voice !== 'A' && voice !== 'B') {
    console.warn(`Invalid voice: ${voice}. Must be 'A' or 'B'`);
    return;
  }
  
  const synth = voice === 'A' ? voiceA : voiceB;
  synth.triggerAttackRelease(note, duration, Tone.now(), velocity);
}

/**
 * Clean up voices
 */
export function cleanupVoices() {
  if (voiceA) voiceA.dispose();
  if (voiceB) voiceB.dispose();
  voiceA = null;
  voiceB = null;
  beamVoiceAssignments.clear();
} 
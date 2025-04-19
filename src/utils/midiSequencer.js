// MIDI note mapping utilities
const NOTE_MAP = {
    'C4': 261.63,
    'D4': 293.66,
    'E4': 329.63,
    'F4': 349.23,
    'G4': 392.00,
    'A4': 440.00,
    'B4': 493.88,
    'C5': 523.25
};

// Map length to musical note
export function mapLengthToNote(length) {
    const notes = Object.keys(NOTE_MAP);
    const index = Math.floor(length * 10) % notes.length;
    return notes[index];
}

// Get color based on note
export function getNoteColor(note) {
    const colors = {
        'C4': 0xff0000, // Red
        'D4': 0xff7f00, // Orange
        'E4': 0xffff00, // Yellow
        'F4': 0x00ff00, // Green
        'G4': 0x0000ff, // Blue
        'A4': 0x4b0082, // Indigo
        'B4': 0x9400d3, // Violet
        'C5': 0xff1493  // Pink
    };
    return colors[note] || 0xffffff;
}

// Play note for given length
export function playNoteForLength(context, length, duration = 0.5, volume = 0.5) {
    const note = mapLengthToNote(length);
    const frequency = NOTE_MAP[note];
    
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    gainNode.gain.value = volume;
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);
    oscillator.stop(context.currentTime + duration);
} 
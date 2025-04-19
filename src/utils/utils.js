export function mapLengthToNote(length) {
    // Map length (1-6) to musical notes (C4-B4)
    const notes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const index = Math.floor((length / 10) * (notes.length - 1));
    return notes[Math.min(Math.max(0, index), notes.length - 1)];
} 
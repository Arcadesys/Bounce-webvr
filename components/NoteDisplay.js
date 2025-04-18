import { useEffect, useState } from 'react';
import { mapLengthToNote } from '../utils/midiSequencer';

/**
 * Component to display the current note when drawing walls
 */
export default function NoteDisplay({ isDrawing, wallLength }) {
  const [note, setNote] = useState('');
  
  // Update note when wall length changes
  useEffect(() => {
    if (isDrawing && wallLength > 0) {
      setNote(mapLengthToNote(wallLength));
    } else {
      setNote('');
    }
  }, [isDrawing, wallLength]);
  
  // Don't render anything if not drawing
  if (!isDrawing || !note) {
    return null;
  }
  
  return (
    <div className="note-display" aria-live="polite">
      <div className="note-display-content">
        <span>Current Note: </span>
        <strong>{note}</strong>
      </div>
    </div>
  );
} 
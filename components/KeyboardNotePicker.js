import React from 'react';
import * as Tone from 'tone';
import { playNote } from '../utils/synthManager';
import { MAJOR_SCALE_NOTES, getNoteColor } from '../utils/midiSequencer';

/**
 * A keyboard-style note picker component for selecting pitch
 */
export default function KeyboardNotePicker({ currentNote, onChange }) {
  // Map pitch value (0.1-2.0) to a note from the C major scale
  const getPitchFromNote = (note) => {
    // Get index in the scale
    const index = MAJOR_SCALE_NOTES.indexOf(note);
    // Map to our pitch range (0.1-2.0)
    // Using this formula to map 15 notes to 0.1-2.0 range
    return 0.1 + (index / (MAJOR_SCALE_NOTES.length - 1)) * 1.9;
  };

  // Get note from pitch value
  const getNoteFromPitch = (pitch) => {
    // Normalize the pitch from 0.1-2.0 to 0-1
    const normalizedPitch = (pitch - 0.1) / 1.9;
    // Map to a note index
    const noteIndex = Math.floor(normalizedPitch * MAJOR_SCALE_NOTES.length);
    // Get the note
    return MAJOR_SCALE_NOTES[Math.min(noteIndex, MAJOR_SCALE_NOTES.length - 1)];
  };

  // Current note based on pitch value
  const activeNote = getNoteFromPitch(currentNote);

  // Handle key click - play note and set new pitch
  const handleKeyClick = (note) => {
    // Play the note
    playNote(note, '16n', null, 0.3);
    // Calculate pitch value and trigger onChange
    const newPitch = getPitchFromNote(note);
    onChange(newPitch);
  };

  // Convert a hex color to a CSS color string
  const hexToRgb = (hex) => {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Render a single piano key
  const renderKey = (note) => {
    const isActive = note === activeNote;
    const keyClass = `piano-key ${isActive ? 'active' : ''}`;
    
    // Get note color from midiSequencer
    const noteColor = getNoteColor(note);
    const rgbColor = hexToRgb(noteColor);
    
    // Calculate styles for the key
    const keyStyle = {
      borderColor: rgbColor,
      backgroundColor: isActive ? rgbColor : `rgba(${rgbColor.match(/\d+/g).join(', ')}, 0.2)`,
      color: isActive ? '#fff' : '#333',
    };
    
    return (
      <button
        key={note}
        className={keyClass}
        style={keyStyle}
        onClick={() => handleKeyClick(note)}
        aria-label={`Note ${note}`}
        aria-pressed={isActive}
      >
        <span className="key-label">{note}</span>
      </button>
    );
  };

  // Group keys by octave for visual organization
  const renderKeyboard = () => {
    // Return the piano keyboard with all keys
    return (
      <div className="piano-keyboard">
        {MAJOR_SCALE_NOTES.map(renderKey)}
      </div>
    );
  };

  return (
    <div className="keyboard-note-picker">
      <div className="current-note">
        Current Note: <strong>{activeNote}</strong> (Pitch: {(currentNote * 2).toFixed(2)})
      </div>
      {renderKeyboard()}
      <style jsx>{`
        .keyboard-note-picker {
          width: 100%;
          margin: 10px 0;
        }
        .current-note {
          text-align: center;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }
        .piano-keyboard {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2px;
          margin: 0 auto;
          max-width: 100%;
        }
        .piano-key {
          flex: 1;
          min-width: 30px;
          height: 40px;
          border: 1px solid #ccc;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          transition: all 0.1s;
        }
        .piano-key:hover {
          filter: brightness(1.1);
        }
        .piano-key.active {
          transform: scale(0.97);
          box-shadow: 0 0 5px rgba(0,0,0,0.2);
        }
        .key-label {
          font-size: 0.7rem;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
} 
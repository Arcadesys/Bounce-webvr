import React, { useState, useEffect } from 'react';
import { assignBeamToVoice } from '../utils/voiceManager';

/**
 * VoiceAssignmentPanel component
 * Allows users to assign walls to different voices
 */
export default function VoiceAssignmentPanel({ walls, onVoiceChange }) {
  const [selectedWall, setSelectedWall] = useState(null);
  const [voiceAssignments, setVoiceAssignments] = useState({});

  // Initialize voice assignments from walls
  useEffect(() => {
    if (walls && walls.length > 0) {
      const assignments = {};
      walls.forEach(wall => {
        if (wall.id && wall.voice) {
          assignments[wall.id] = wall.voice;
        }
      });
      setVoiceAssignments(assignments);
    }
  }, [walls]);

  // Handle voice change for a wall
  const handleVoiceChange = (wallId, voice) => {
    // Update local state
    setVoiceAssignments(prev => ({
      ...prev,
      [wallId]: voice
    }));

    // Update the voice assignment in the voice manager
    assignBeamToVoice(wallId, voice);

    // Notify parent component
    if (onVoiceChange) {
      onVoiceChange(wallId, voice);
    }

    // Play a guide tone for accessibility
    playGuideTone(voice);
  };

  // Play a guide tone based on voice
  const playGuideTone = (voice) => {
    // Create a temporary synth for the guide tone
    const synth = new window.Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 }
    }).toDestination();
    
    // Play different notes for different voices
    const note = voice === 'A' ? 'C4' : 'E4';
    
    // Play the guide tone
    synth.volume.value = -20; // Quiet enough to not be annoying
    synth.triggerAttackRelease(note, 0.1);
    
    // Dispose of the synth after playing
    setTimeout(() => {
      synth.dispose();
    }, 200);
  };

  const handleVoiceSelect = (wallId, voice) => {
    onVoiceChange(wallId, voice);
    setSelectedWall(null);
  };

  return (
    <div className="voice-panel">
      <h2>Wall Voice Assignment</h2>
      <div className="wall-list">
        {walls.map((wall) => (
          <div 
            key={wall.id}
            className={`wall-item ${selectedWall === wall.id ? 'selected' : ''}`}
            onClick={() => setSelectedWall(wall.id)}
            role="button"
            tabIndex={0}
            aria-label={`Wall ${wall.id} - Current voice: ${wall.voice}`}
          >
            <span>Wall {wall.id}</span>
            <span className="current-voice">Voice: {wall.voice}</span>
          </div>
        ))}
      </div>

      {selectedWall && (
        <div className="voice-selector">
          <h3>Select Voice for Wall {selectedWall}</h3>
          <div className="voice-options">
            {['A', 'B'].map((voice) => (
              <button
                key={voice}
                onClick={() => handleVoiceSelect(selectedWall, voice)}
                className="voice-option"
                aria-label={`Set voice ${voice}`}
              >
                Voice {voice}
              </button>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .voice-panel {
          position: absolute;
          top: 80px;
          right: 20px;
          background: rgba(255, 255, 255, 0.95);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          max-width: 300px;
          z-index: 10;
        }

        h2 {
          margin: 0 0 15px 0;
          font-size: 18px;
          color: #333;
        }

        h3 {
          margin: 15px 0;
          font-size: 16px;
          color: #444;
        }

        .wall-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .wall-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .wall-item:hover {
          background: #e0e0e0;
        }

        .wall-item.selected {
          background: #e3f2fd;
          border: 2px solid #2196f3;
        }

        .current-voice {
          font-weight: bold;
          color: #2196f3;
        }

        .voice-selector {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }

        .voice-options {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }

        .voice-option {
          flex: 1;
          padding: 8px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .voice-option:hover {
          background: #1976d2;
        }
      `}</style>
    </div>
  );
} 
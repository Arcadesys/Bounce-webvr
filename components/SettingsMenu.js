import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';
import { playNote } from '../utils/synthManager';
import KeyboardNotePicker from './KeyboardNotePicker';

// Sequencer step component for dispenser settings
const SequencerStep = ({ active, onClick, stepNumber }) => {
  return (
    <button
      className={`sequencer-step ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-label={`Sequencer step ${stepNumber + 1} ${active ? 'active' : 'inactive'}`}
      aria-pressed={active}
    />
  );
};

export default function SettingsMenu({ 
  selectedObject, 
  selectedType, 
  onClose, 
  onDelete, 
  onUpdateBeam, 
  onUpdateDispenser 
}) {
  // Default states for beam settings
  const [pitch, setPitch] = useState(0.5);
  const [elasticity, setElasticity] = useState(0.95);
  
  // State for dispenser sequencer grid (4x4 = 16 steps)
  const [sequencerSteps, setSequencerSteps] = useState(Array(16).fill(false));
  
  // Load settings from the selected object when selection changes
  useEffect(() => {
    if (selectedObject && selectedType === 'beam') {
      // For beams, set the pitch and elasticity from the object
      if (selectedObject.userData && selectedObject.userData.pitch !== undefined) {
        setPitch(selectedObject.userData.pitch);
      } else {
        setPitch(0.5); // Default pitch
      }
      
      if (selectedObject.userData && selectedObject.userData.restitution !== undefined) {
        setElasticity(selectedObject.userData.restitution);
      } else {
        setElasticity(0.95); // Default elasticity
      }
    } else if (selectedObject && selectedType === 'dispenser') {
      // For dispensers, load the sequencer pattern
      if (selectedObject.userData && selectedObject.userData.sequencerSteps) {
        setSequencerSteps([...selectedObject.userData.sequencerSteps]);
      } else {
        // Default pattern: every 4th step (downbeats)
        setSequencerSteps(Array(16).fill(false).map((_, i) => i % 4 === 0));
      }
    }
  }, [selectedObject, selectedType]);

  // Handle beam parameter changes
  const handlePitchChange = (newPitch) => {
    setPitch(newPitch);
    if (onUpdateBeam) {
      onUpdateBeam(selectedObject, { pitch: newPitch });
    }
    // Note: No need to play a preview note here as KeyboardNotePicker already does that
  };

  const handleElasticityChange = (e) => {
    const newElasticity = parseFloat(e.target.value);
    setElasticity(newElasticity);
    if (onUpdateBeam) {
      onUpdateBeam(selectedObject, { restitution: newElasticity });
    }
    // Play a sound to indicate change
    playNote('E4', '32n', null, 0.1);
  };

  // Handle sequencer step toggle
  const toggleSequencerStep = (index) => {
    const newSteps = [...sequencerSteps];
    newSteps[index] = !newSteps[index];
    setSequencerSteps(newSteps);
    
    if (onUpdateDispenser) {
      onUpdateDispenser(selectedObject, { sequencerSteps: newSteps });
    }
    
    // Play a sound when toggling steps
    const note = newSteps[index] ? 'G4' : 'G3';
    playNote(note, '32n', null, 0.2);
  };

  // Handle delete button click
  const handleDelete = () => {
    // Play a "delete" sound
    playNote('A2', '8n', null, 0.3);
    
    if (onDelete) {
      onDelete(selectedObject, selectedType);
    }
    
    if (onClose) {
      onClose();
    }
  };

  // Handle close button click
  const handleClose = () => {
    // Play a "close" sound
    playNote('C4', '32n', null, 0.1);
    
    if (onClose) {
      onClose();
    }
  };

  // If no object is selected, don't render anything
  if (!selectedObject || !selectedType) {
    return null;
  }

  return (
    <div className="settings-menu">
      <div className="settings-header">
        <h2>{selectedType === 'beam' ? 'Beam Settings' : 'Dispenser Settings'}</h2>
        <button 
          className="close-button" 
          onClick={handleClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </div>
      
      <div className="settings-content">
        {selectedType === 'beam' && (
          <div className="beam-settings">
            <div className="setting-group">
              <label>Pitch</label>
              <KeyboardNotePicker 
                currentNote={pitch} 
                onChange={handlePitchChange}
              />
            </div>
            
            <div className="setting-group">
              <label htmlFor="elasticity-slider">
                Elasticity: {elasticity.toFixed(2)}
              </label>
              <input
                id="elasticity-slider"
                type="range"
                min="0.1"
                max="0.99"
                step="0.01"
                value={elasticity}
                onChange={handleElasticityChange}
                aria-label="Adjust beam elasticity"
              />
            </div>
          </div>
        )}
        
        {selectedType === 'dispenser' && (
          <div className="dispenser-settings">
            <h3>Sequencer Pattern</h3>
            <div className="sequencer-grid">
              {Array.from({ length: 4 }).map((_, row) => (
                <div key={`row-${row}`} className="sequencer-row">
                  {Array.from({ length: 4 }).map((_, col) => {
                    const index = row * 4 + col;
                    return (
                      <SequencerStep
                        key={`step-${index}`}
                        active={sequencerSteps[index]}
                        onClick={() => toggleSequencerStep(index)}
                        stepNumber={index}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="sequencer-help">
              Click steps to activate/deactivate ball drops
            </p>
          </div>
        )}
        
        <div className="settings-footer">
          <button 
            className="delete-button" 
            onClick={handleDelete}
            aria-label={`Delete this ${selectedType}`}
          >
            <span className="trash-icon">🗑️</span> Delete
          </button>
        </div>
      </div>
    </div>
  );
} 
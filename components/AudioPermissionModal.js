import React from 'react';
import * as Tone from 'tone';

export default function AudioPermissionModal({ onPermissionGranted }) {
  const handlePermissionClick = async () => {
    try {
      await Tone.start();
      // Play a gentle success tone
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.1, release: 0.4 },
        volume: -20
      }).toDestination();
      
      // Play ascending notes for success
      const now = Tone.now();
      synth.triggerAttackRelease('C4', '16n', now);
      synth.triggerAttackRelease('E4', '16n', now + 0.1);
      synth.triggerAttackRelease('G4', '16n', now + 0.2);
      
      // Clean up synth after playing
      setTimeout(() => synth.dispose(), 1000);
      
      onPermissionGranted();
    } catch (error) {
      console.warn('Error initializing audio:', error);
    }
  };

  return (
    <div 
      role="dialog"
      aria-labelledby="audio-permission-title"
      aria-describedby="audio-permission-desc"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.9)',
        padding: '2rem',
        borderRadius: '8px',
        color: 'white',
        textAlign: 'center',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 1000
      }}
    >
      <h2 id="audio-permission-title" style={{ marginTop: 0 }}>
        Enable Sound Effects?
      </h2>
      <p id="audio-permission-desc">
        This interactive physics playground uses sound to enhance the experience.
        Click below to enable audio feedback for bounces and interactions.
      </p>
      <button
        onClick={handlePermissionClick}
        style={{
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          padding: '0.8rem 1.5rem',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: 'pointer',
          transition: 'background 0.2s',
          marginTop: '1rem'
        }}
        onMouseOver={(e) => e.target.style.background = '#45a049'}
        onMouseOut={(e) => e.target.style.background = '#4CAF50'}
      >
        Enable Audio
      </button>
    </div>
  );
} 
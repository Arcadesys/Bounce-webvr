import React from 'react';

export default function LoadingScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#000011',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        zIndex: 2000
      }}
    >
      <div
        style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTop: '3px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }}
      />
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div 
        role="status"
        aria-live="polite"
        style={{
          fontSize: '1.2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        Loading Bounce WebVR...
      </div>
    </div>
  );
} 
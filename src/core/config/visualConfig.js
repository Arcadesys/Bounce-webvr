import * as THREE from 'three';

export const VisualConfig = {
  // Global lighting
  lighting: {
    ambient: {
      intensity: 0.025
    },
    camera: {
      intensity: 0.25,
      distance: 20
    }
  },

  // Post-processing
  bloom: {
    strength: 2.5,
    radius: 0.5,
    threshold: 0.15
  },

  // Ball settings
  ball: {
    base: {
      color: 0xFFFFFF,
      roughness: 0.3,
      metalness: 0.7,
      emissiveColor: 0x00FFFF,  // Changed to cyan for neon effect
      emissiveIntensity: 0.5,   // Increased base glow
      envMapIntensity: 1.25
    },
    collision: {
      flashDuration: 300,      // milliseconds
      maxFlashIntensity: 1.5,  // increased for more dramatic effect
      oscillations: 4,         // number of sparkle oscillations during fade
      oscillationIntensity: 0.6, // increased for more dramatic sparkle
      velocityScale: 3         // how much velocity affects flash intensity
    },
    pulse: {
      enabled: true,
      duration: 2000,          // 2 seconds per pulse
      minIntensity: 0.3,       // minimum glow intensity
      maxIntensity: 0.8,       // maximum glow intensity
      color: 0x00FFFF         // cyan for neon effect
    }
  },

  // Wall settings
  wall: {
    base: {
      color: 0xFFFFFF,
      roughness: 0.8,    // Increased for more diffusion
      metalness: 0.2,    // Reduced for less reflection
      emissiveIntensity: 0.15,  // Reduced for softer glow
      envMapIntensity: 0.5     // Reduced for less reflection
    },
    highlight: {
      color: 0xFFFF00,   // Changed to yellow to match dispenser
      intensity: 0.5     // Increased to match dispenser
    }
  }
};

// Helper function to get scaled velocity factor
export function getVelocityFactor(velocity, scale = VisualConfig.ball.collision.velocityScale) {
  return Math.min(Math.abs(velocity) / scale, 1);
}

// Helper function to get oscillating intensity
export function getOscillatingIntensity(t, baseIntensity, config = VisualConfig.ball.collision) {
  const sparkle = Math.sin(t * Math.PI * (config.oscillations * 2)) * 0.5 + 0.5;
  return baseIntensity * (1 + sparkle * config.oscillationIntensity);
}

// Helper function to get pulsing intensity
export function getPulseIntensity(t, config = VisualConfig.ball.pulse) {
  if (!config.enabled) return config.minIntensity;
  const pulse = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
  return config.minIntensity + (config.maxIntensity - config.minIntensity) * pulse;
} 
import * as Tone from 'tone';

export class DispenserSequencer {
  constructor() {
    this.steps = 16;
    this.currentStep = 0;
    this.bpm = 120;
    this.isPlaying = false;
    this.dispenserPatterns = new Map(); // Map of dispenser ID to pattern array
    
    // Initialize Tone.js transport
    Tone.Transport.bpm.value = this.bpm;
    
    // Schedule the sequencer loop
    this.loop = new Tone.Loop((time) => {
      this.tick(time);
    }, "16n").start(0); // 16th notes
  }
  
  // Add a dispenser to the sequencer
  addDispenser(dispenserId) {
    if (!this.dispenserPatterns.has(dispenserId)) {
      // Initialize with all steps off
      this.dispenserPatterns.set(dispenserId, new Array(this.steps).fill(false));
    }
  }
  
  // Remove a dispenser from the sequencer
  removeDispenser(dispenserId) {
    this.dispenserPatterns.delete(dispenserId);
  }
  
  // Toggle a step for a dispenser
  toggleStep(dispenserId, step) {
    if (this.dispenserPatterns.has(dispenserId)) {
      const pattern = this.dispenserPatterns.get(dispenserId);
      pattern[step] = !pattern[step];
    }
  }
  
  // Check if a step is active for a dispenser
  isStepActive(dispenserId, step) {
    return this.dispenserPatterns.get(dispenserId)?.[step] || false;
  }
  
  // Start the sequencer
  start() {
    if (!this.isPlaying) {
      this.isPlaying = true;
      Tone.Transport.start();
    }
  }
  
  // Stop the sequencer
  stop() {
    if (this.isPlaying) {
      this.isPlaying = false;
      Tone.Transport.stop();
      this.currentStep = 0;
    }
  }
  
  // Set the tempo in BPM
  setTempo(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.value = bpm;
  }
  
  // Internal tick function called by Tone.js
  tick(time) {
    // Emit step change event
    const event = new CustomEvent('sequencer-step', {
      detail: {
        step: this.currentStep,
        time
      }
    });
    window.dispatchEvent(event);
    
    // Get all dispensers that should trigger on this step
    this.dispenserPatterns.forEach((pattern, dispenserId) => {
      if (pattern[this.currentStep]) {
        // Emit event for dispenser to handle
        const event = new CustomEvent('dispenser-trigger', {
          detail: {
            dispenserId,
            time,
            step: this.currentStep
          }
        });
        window.dispatchEvent(event);
      }
    });
    
    // Advance to next step
    this.currentStep = (this.currentStep + 1) % this.steps;
  }
  
  // Clean up resources
  dispose() {
    this.stop();
    this.loop.dispose();
  }
} 
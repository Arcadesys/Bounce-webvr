export class AudioManager {
  constructor() {
    this.context = null;
    this.sounds = {};
    this.isMuted = false;
    this.isInitialized = false;
  }
  
  async start() {
    // Only create the context if it doesn't exist yet
    if (!this.context) {
      try {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn("AudioContext creation failed:", e);
        return;
      }
    }
    
    // Resume the context if it's suspended
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
        this.isInitialized = true;
      } catch (e) {
        console.warn("AudioContext resume failed:", e);
      }
    } else {
      this.isInitialized = true;
    }
  }
  
  playCollisionSound(velocity) {
    if (this.isMuted || !this.isInitialized) return;
    
    try {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);
      
      // Map velocity to frequency (higher velocity = higher pitch)
      const frequency = 200 + (Math.abs(velocity) * 100);
      oscillator.frequency.setValueAtTime(frequency, this.context.currentTime);
      
      // Map velocity to volume
      const volume = Math.min(0.5, Math.abs(velocity) / 10);
      gainNode.gain.setValueAtTime(volume, this.context.currentTime);
      
      // Quick decay
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.context.currentTime + 0.1);
      
      // Announce collision for screen readers
      this.announceCollision(velocity);
    } catch (e) {
      console.warn("Error playing collision sound:", e);
    }
  }
  
  announceCollision(velocity) {
    let announcer = document.getElementById('announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'announcer';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    
    const intensity = velocity > 5 ? 'strong' : velocity > 2 ? 'medium' : 'soft';
    announcer.textContent = `${intensity} collision`;
  }
  
  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
  
  dispose() {
    if (this.context) {
      this.context.close();
      this.context = null;
      this.isInitialized = false;
    }
  }
} 
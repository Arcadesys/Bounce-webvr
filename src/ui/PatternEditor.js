export class PatternEditor {
  constructor(sequencer) {
    this.sequencer = sequencer;
    this.container = document.createElement('div');
    this.container.className = 'pattern-editor';
    this.container.style.display = 'none';
    document.body.appendChild(this.container);
    
    // Create step buttons
    this.stepButtons = [];
    for (let i = 0; i < 16; i++) {
      const button = document.createElement('button');
      button.className = 'step-button';
      button.setAttribute('aria-label', `Step ${i + 1}`);
      this.stepButtons.push(button);
      this.container.appendChild(button);
    }
    
    // Create current step indicator
    this.currentStepIndicator = document.createElement('div');
    this.currentStepIndicator.className = 'current-step';
    this.container.appendChild(this.currentStepIndicator);
    
    // Listen for sequencer step changes
    window.addEventListener('sequencer-step', (event) => {
      this.updateCurrentStep(event.detail.step);
    });
  }
  
  show(dispenser) {
    if (!dispenser) return;
    
    this.currentDispenser = dispenser;
    this.container.style.display = 'grid';
    
    // Position editor below the dispenser in screen space
    const vector = new THREE.Vector3();
    vector.setFromMatrixPosition(dispenser.mesh.matrixWorld);
    vector.project(window.game.camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight + 50; // Offset below dispenser
    
    this.container.style.left = `${x - this.container.offsetWidth / 2}px`;
    this.container.style.top = `${y}px`;
    
    // Update button states
    this.updateButtons();
    
    // Set up click handlers
    this.stepButtons.forEach((button, step) => {
      button.onclick = () => {
        this.sequencer.toggleStep(dispenser.id, step);
        this.updateButtons();
      };
    });
  }
  
  hide() {
    this.container.style.display = 'none';
    this.currentDispenser = null;
  }
  
  updateButtons() {
    if (!this.currentDispenser) return;
    
    this.stepButtons.forEach((button, step) => {
      button.classList.toggle('active', 
        this.sequencer.isStepActive(this.currentDispenser.id, step));
    });
  }
  
  updateCurrentStep(step) {
    // Move the current step indicator
    const buttonWidth = this.stepButtons[0].offsetWidth;
    const buttonSpacing = parseInt(getComputedStyle(this.container).gap);
    this.currentStepIndicator.style.left = 
      `${step * (buttonWidth + buttonSpacing)}px`;
  }
} 
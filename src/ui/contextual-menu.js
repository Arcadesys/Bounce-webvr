import * as THREE from 'three';

export class ContextualMenu {
  constructor() {
    this.menu = document.createElement('div');
    this.menu.className = 'contextual-menu';
    this.menu.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 8px;
      padding: 10px;
      color: white;
      z-index: 1000;
      display: none;
      min-width: 150px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    `;
    
    this.menu.setAttribute('role', 'menu');
    document.body.appendChild(this.menu);
    
    // Add menu items
    this.addMenuItem('Delete', () => {
      if (this.onDelete) this.onDelete();
      this.hide();
    });
    
    this.addMenuItem('Change Material', () => {
      if (this.onChangeMaterial) this.onChangeMaterial();
      this.hide();
    });
    
    // Add keyboard navigation
    this.menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      }
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this.menu.style.display === 'block' && !this.menu.contains(e.target)) {
        this.hide();
      }
    });
  }
  
  addMenuItem(text, onClick) {
    const item = document.createElement('button');
    item.textContent = text;
    item.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 12px;
      margin: 4px 0;
      background: transparent;
      border: none;
      color: white;
      text-align: left;
      cursor: pointer;
      border-radius: 4px;
      font-size: 14px;
    `;
    
    item.setAttribute('role', 'menuitem');
    item.setAttribute('tabindex', '0');
    
    item.addEventListener('mouseover', () => {
      item.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    
    item.addEventListener('mouseout', () => {
      item.style.background = 'transparent';
    });
    
    item.addEventListener('click', onClick);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    });
    
    this.menu.appendChild(item);
  }
  
  show(position, object) {
    // Convert 3D position to screen coordinates
    const vector = new THREE.Vector3();
    vector.setFromMatrixPosition(object.matrixWorld);
    vector.project(window.game.camera);
    
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = -(vector.y * 0.5 - 0.5) * window.innerHeight;
    
    // Position menu to the right of the object
    this.menu.style.left = `${x + 20}px`;
    this.menu.style.top = `${y}px`;
    this.menu.style.display = 'block';
    
    // Focus first menu item for keyboard navigation
    const firstItem = this.menu.querySelector('button');
    if (firstItem) {
      firstItem.focus();
    }
    
    // Announce menu for screen readers
    const announcer = document.getElementById('announcer');
    if (announcer) {
      announcer.textContent = 'Contextual menu opened';
    }
    
    // Play menu open sound
    if (window.playNote) {
      window.playNote('C5', '32n', null, 0.2);
    }
  }
  
  hide() {
    this.menu.style.display = 'none';
    
    // Play menu close sound
    if (window.playNote) {
      window.playNote('G4', '32n', null, 0.1);
    }
  }
  
  setCallbacks({ onDelete, onChangeMaterial }) {
    this.onDelete = onDelete;
    this.onChangeMaterial = onChangeMaterial;
  }
} 
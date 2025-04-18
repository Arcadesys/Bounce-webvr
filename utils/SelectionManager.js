import * as THREE from 'three';

// SelectionManager handles object selection and settings display
export class SelectionManager {
  constructor() {
    this.selectedObject = null;
    this.selectedType = null; // 'beam' or 'dispenser'
    this.originalColor = null;
    this.highlightColor = new THREE.Color(0xffff00); // Yellow highlight
    this.onSelectionChange = null; // Callback when selection changes
  }

  // Select an object and highlight it
  select(object, type) {
    // Deselect previous object if any
    this.deselect();
    
    // Set new selection
    this.selectedObject = object;
    this.selectedType = type;
    
    // Highlight the selected object
    if (object && object.material) {
      this.originalColor = object.material.color.clone();
      object.material.emissive = this.highlightColor;
      object.material.emissiveIntensity = 0.5;
      
      // Call the selection change callback if defined
      if (this.onSelectionChange) {
        this.onSelectionChange(object, type);
      }
      
      // Play selection sound (success tone)
      if (window.playNote) {
        window.playNote('E5', '32n', null, 0.2);
      }
      
      return true;
    }
    
    return false;
  }
  
  // Deselect the currently selected object
  deselect() {
    if (this.selectedObject && this.originalColor) {
      // Restore original color
      this.selectedObject.material.emissive = new THREE.Color(0x000000);
      this.selectedObject.material.emissiveIntensity = 0;
      
      // Play deselection sound (lower tone)
      if (window.playNote) {
        window.playNote('C4', '32n', null, 0.1);
      }
      
      // Reset selection state
      this.selectedObject = null;
      this.selectedType = null;
      this.originalColor = null;
      
      // Call the selection change callback if defined
      if (this.onSelectionChange) {
        this.onSelectionChange(null, null);
      }
      
      return true;
    }
    
    return false;
  }
  
  // Check if an object is currently selected
  isSelected(object) {
    return this.selectedObject === object;
  }
  
  // Get the current selection
  getSelection() {
    return {
      object: this.selectedObject,
      type: this.selectedType
    };
  }
  
  // Set a callback function to be called when selection changes
  setSelectionChangeCallback(callback) {
    this.onSelectionChange = callback;
  }
}

export default SelectionManager; 
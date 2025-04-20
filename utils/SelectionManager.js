import * as THREE from 'three';

// SelectionManager handles object selection and settings display
export class SelectionManager {
  constructor() {
    this.selectedObject = null;
    this.onSelectionChange = null;
  }

  // Select an object and highlight it
  select(object) {
    // Deselect current object if exists
    if (this.selectedObject) {
      this.deselect();
    }
    
    this.selectedObject = object;
    if (object.highlight) {
      object.highlight(true);
    }
    if (this.onSelectionChange) {
      this.onSelectionChange([object]);
    }
  }
  
  // Deselect the currently selected object
  deselect() {
    if (this.selectedObject) {
      if (this.selectedObject.highlight) {
        this.selectedObject.highlight(false);
      }
      this.selectedObject = null;
      if (this.onSelectionChange) {
        this.onSelectionChange([]);
      }
    }
  }
  
  // Check if an object is currently selected
  isSelected(object) {
    return this.selectedObject === object;
  }
  
  // Get the current selection
  getSelection() {
    return this.selectedObject ? [this.selectedObject] : [];
  }
  
  // Set a callback function to be called when selection changes
  setSelectionChangeCallback(callback) {
    this.onSelectionChange = callback;
  }
}

export default SelectionManager; 
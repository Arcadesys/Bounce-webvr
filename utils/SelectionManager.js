import * as THREE from 'three';

// SelectionManager handles object selection and settings display
export class SelectionManager {
  constructor() {
    this.selectedObjects = new Set();
    this.onSelectionChange = null;
  }

  // Select an object and highlight it
  select(object) {
    if (!this.selectedObjects.has(object)) {
      this.selectedObjects.add(object);
      if (object.highlight) {
        object.highlight(true);
      }
      if (this.onSelectionChange) {
        this.onSelectionChange(Array.from(this.selectedObjects));
      }
    }
  }
  
  // Deselect the currently selected object
  deselect(object) {
    if (this.selectedObjects.has(object)) {
      this.selectedObjects.delete(object);
      if (object.highlight) {
        object.highlight(false);
      }
      if (this.onSelectionChange) {
        this.onSelectionChange(Array.from(this.selectedObjects));
      }
    }
  }
  
  // Check if an object is currently selected
  isSelected(object) {
    return this.selectedObjects.has(object);
  }
  
  // Get the current selection
  getSelection() {
    return Array.from(this.selectedObjects);
  }
  
  // Set a callback function to be called when selection changes
  setSelectionChangeCallback(callback) {
    this.onSelectionChange = callback;
  }
}

export default SelectionManager; 
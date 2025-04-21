import * as THREE from 'three';

// SelectionManager handles object selection and settings display
export class SelectionManager {
  constructor() {
    this.selectedObject = null;
    this.selectedType = null;
    this.onSelectionChange = null;
  }

  // Select an object and highlight it
  select(object, type) {
    // Deselect previous object if any
    if (this.selectedObject && this.selectedObject !== object) {
      if (this.selectedObject.highlight) {
        this.selectedObject.highlight(false);
      }
    }

    this.selectedObject = object;
    this.selectedType = type;
    
    if (object && object.highlight) {
      object.highlight(true);
    }
    
    if (this.onSelectionChange) {
      this.onSelectionChange(object, type);
    }
  }
  
  // Deselect the currently selected object
  deselect() {
    if (this.selectedObject && this.selectedObject.highlight) {
      this.selectedObject.highlight(false);
    }
    
    this.selectedObject = null;
    this.selectedType = null;
    
    if (this.onSelectionChange) {
      this.onSelectionChange(null, null);
    }
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
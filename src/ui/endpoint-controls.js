import * as THREE from 'three';

export class EndpointControls {
  constructor() {
    this.startControl = this.createControl();
    this.endControl = this.createControl();
    this.isDragging = false;
    this.activeControl = null;
    this.onEndpointsChanged = null;
  }
  
  createControl() {
    const geometry = new THREE.SphereGeometry(0.15, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4CAF50,
      emissive: 0x2E7D32,
      emissiveIntensity: 0.5
    });
    
    const control = new THREE.Mesh(geometry, material);
    control.userData.isControl = true;
    control.visible = false;
    
    return control;
  }
  
  show(wall) {
    // Get wall endpoints from the wall's start and end properties
    const start = wall.start.clone();
    const end = wall.end.clone();
    
    // Position controls
    this.startControl.position.copy(start);
    this.endControl.position.copy(end);
    
    // Show controls
    this.startControl.visible = true;
    this.endControl.visible = true;
    
    // Store reference to wall
    this.currentWall = wall;
    
    // Announce for screen readers
    const announcer = document.getElementById('announcer');
    if (announcer) {
      announcer.textContent = 'Endpoint controls visible';
    }
    
    // Play selection sound
    if (window.playNote) {
      window.playNote('E5', '32n', null, 0.2);
    }
  }
  
  hide() {
    this.startControl.visible = false;
    this.endControl.visible = false;
    this.currentWall = null;
  }
  
  onPointerDown(event, camera, raycaster) {
    const intersects = raycaster.intersectObjects([this.startControl, this.endControl]);
    if (intersects.length > 0) {
      this.isDragging = true;
      this.activeControl = intersects[0].object;
      
      // Play selection sound
      if (window.playNote) {
        window.playNote('E5', '32n', null, 0.2);
      }
      
      return true;
    }
    return false;
  }
  
  onPointerMove(event, camera, raycaster) {
    if (!this.isDragging || !this.activeControl || !this.currentWall) return;
    
    // Get intersection with ground plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);
    
    if (intersection) {
      // Update control position
      this.activeControl.position.copy(intersection);
      
      // Update wall
      if (this.activeControl === this.startControl) {
        this.currentWall.updateStart(intersection);
      } else {
        this.currentWall.updateEnd(intersection);
      }
      
      // Notify change
      if (this.onEndpointsChanged) {
        this.onEndpointsChanged(this.currentWall);
      }
      
      // Play movement sound
      if (window.playNote) {
        window.playNote('C5', '64n', null, 0.1);
      }
    }
  }
  
  onPointerUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.activeControl = null;
      
      // Play release sound
      if (window.playNote) {
        window.playNote('G4', '32n', null, 0.1);
      }
    }
  }
  
  setCallbacks({ onEndpointsChanged }) {
    this.onEndpointsChanged = onEndpointsChanged;
  }
} 
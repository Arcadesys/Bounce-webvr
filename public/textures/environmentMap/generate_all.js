import fs from 'fs';
import { createCanvas } from 'canvas';

function generateEnvMapSide(size, type) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Create gradient
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, '#4444ff');
    gradient.addColorStop(1, '#000000');
    
    // Fill canvas
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Save to file
    const buffer = canvas.toBuffer('image/jpeg');
    fs.writeFileSync(`${type}.jpg`, buffer);
}

// Generate all six sides
const size = 512;
generateEnvMapSide(size, 'px');
generateEnvMapSide(size, 'nx');
generateEnvMapSide(size, 'py');
generateEnvMapSide(size, 'ny');
generateEnvMapSide(size, 'pz');
generateEnvMapSide(size, 'nz'); 
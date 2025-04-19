import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import '@testing-library/jest-dom';

describe('UI Visibility Tests', () => {
  it('canvas should be visible and loading screen should not block view', async () => {
    // Create a new JSDOM instance
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;

    // Create and append canvas
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    // Set canvas dimensions
    canvas.width = 800;
    canvas.height = 600;

    // Test canvas visibility
    expect(canvas).toBeVisible();
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);

    // Check that no loading screen elements exist
    const loadingScreens = document.querySelectorAll('.loading-screen');
    expect(loadingScreens.length).toBe(0);

    // Check for ARIA attributes and roles
    expect(canvas).toHaveAttribute('role', 'img');
    expect(canvas).toHaveAttribute('aria-label', '3D Bounce WebVR Scene');

    // Check that canvas is not covered by other elements
    const canvasStyle = window.getComputedStyle(canvas);
    expect(parseInt(canvasStyle.zIndex)).toBeGreaterThanOrEqual(0);
  });
}); 
import { describe, it, expect } from 'vitest';
import {
  OneEuroFilter,
  calculateJointAngle,
  classifyHandGesture,
  GestureStabilizer
} from '../src/input/gestureClassifier.js';

// Helper to generate a realistic neutral hand landmark set
function generateHand({
  thumb = 'extended',
  index = 'extended',
  middle = 'extended',
  ring = 'extended',
  pinky = 'extended',
  pinch = false,
  rotation = 0,
  isLeft = false
} = {}) {
  // 21 points
  const lm = [];
  const wrist = { x: 0.5, y: 0.8, z: 0 };
  lm[0] = wrist;

  // Base directions for fingers (x spread, y pointing up)
  const fingerXSpreads = [
    { base: 0.44, step: -0.02 }, // Thumb
    { base: 0.47, step: -0.01 }, // Index
    { base: 0.50, step: 0.00 },  // Middle
    { base: 0.53, step: 0.01 },  // Ring
    { base: 0.56, step: 0.02 }   // Pinky
  ];

  // Helper to add finger points
  function addFinger(startIndex, extState, xSpread, isThumb = false) {
    const isExt = extState === 'extended';
    const mcpY = 0.58;
    const len = isThumb ? 0.05 : 0.06;

    const mcp = { x: xSpread.base, y: mcpY, z: 0 };
    lm[startIndex] = mcp;

    if (isThumb) {
      // Thumb has CMC(1), MCP(2), IP(3), TIP(4)
      lm[1] = { x: 0.46, y: 0.72, z: 0 };
      lm[2] = { x: 0.43, y: 0.65, z: 0 };
      if (isExt) {
        lm[3] = { x: 0.40, y: 0.58, z: 0 };
        lm[4] = { x: 0.37, y: 0.51, z: 0 };
      } else {
        // Curled thumb
        lm[3] = { x: 0.46, y: 0.60, z: 0.02 };
        lm[4] = { x: 0.48, y: 0.61, z: 0.03 };
      }
      return;
    }

    if (isExt) {
      lm[startIndex + 1] = { x: xSpread.base + xSpread.step, y: mcpY - len, z: 0 };
      lm[startIndex + 2] = { x: xSpread.base + xSpread.step * 2, y: mcpY - len * 2, z: 0 };
      lm[startIndex + 3] = { x: xSpread.base + xSpread.step * 3, y: mcpY - len * 3, z: 0 };
    } else {
      // Curled finger (PIP angles sharply down into palm)
      lm[startIndex + 1] = { x: xSpread.base, y: mcpY - len * 0.8, z: -0.02 };
      lm[startIndex + 2] = { x: xSpread.base, y: mcpY - len * 0.4, z: 0.03 };
      lm[startIndex + 3] = { x: xSpread.base, y: mcpY - len * 0.1, z: 0.04 };
    }
  }

  addFinger(1, thumb, fingerXSpreads[0], true);
  addFinger(5, index, fingerXSpreads[1], false);
  addFinger(9, middle, fingerXSpreads[2], false);
  addFinger(13, ring, fingerXSpreads[3], false);
  addFinger(17, pinky, fingerXSpreads[4], false);

  if (pinch) {
    // Force thumb tip and index tip to touch
    lm[4] = { x: 0.47, y: 0.44, z: 0.01 };
    lm[8] = { x: 0.475, y: 0.44, z: 0.01 };
  }

  // Mirror for left hand if needed
  if (isLeft) {
    for (let i = 0; i < lm.length; i++) {
      lm[i].x = 1.0 - lm[i].x;
    }
  }

  // Rotate around center if rotation specified
  if (rotation !== 0) {
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const cx = 0.5, cy = 0.6;
    for (let i = 0; i < lm.length; i++) {
      const dx = lm[i].x - cx;
      const dy = lm[i].y - cy;
      lm[i].x = cx + dx * cosR - dy * sinR;
      lm[i].y = cy + dx * sinR + dy * cosR;
    }
  }

  return lm;
}

describe('AI Hand Gesture Classifier & Signal Stabilization (Part C)', () => {
  it('calculateJointAngle calculates exact 3D angle between joints', () => {
    const a = { x: 0, y: 1, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 1, y: 0, z: 0 };
    const angle = calculateJointAngle(a, b, c);
    expect(angle).toBeCloseTo(Math.PI / 2, 4);
  });

  it('correctly classifies an open palm gesture', () => {
    const hand = generateHand();
    const result = classifyHandGesture(hand, 'Right');
    expect(result.gesture).toBe('palm');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('correctly classifies a fist gesture when all fingers are curled', () => {
    const hand = generateHand({
      thumb: 'curled',
      index: 'curled',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled'
    });
    const result = classifyHandGesture(hand, 'Right');
    expect(result.gesture).toBe('fist');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('correctly classifies an index pointing gesture', () => {
    const hand = generateHand({
      thumb: 'curled',
      index: 'extended',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled'
    });
    const result = classifyHandGesture(hand, 'Right');
    expect(result.gesture).toBe('pointing');
    expect(result.reticle).toBeDefined();
  });

  it('correctly classifies a pinch gesture (thumb + index touching)', () => {
    const hand = generateHand({
      thumb: 'extended',
      index: 'extended',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled',
      pinch: true
    });
    const result = classifyHandGesture(hand, 'Right');
    expect(result.gesture).toBe('pinch');
    expect(result.normPinch).toBeLessThan(0.38);
  });

  it('correctly classifies victory/peace sign (index + middle in V)', () => {
    const hand = generateHand({
      thumb: 'curled',
      index: 'extended',
      middle: 'extended',
      ring: 'curled',
      pinky: 'curled'
    });
    // Spread index and middle slightly for V
    hand[8].x -= 0.03;
    hand[12].x += 0.03;
    const result = classifyHandGesture(hand, 'Right');
    expect(result.gesture).toBe('victory');
  });

  it('maintains classification accuracy under hand rotation (rotation invariance)', () => {
    // Test pointing rotated by 45 degrees
    const handRot45 = generateHand({
      thumb: 'curled',
      index: 'extended',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled',
      rotation: Math.PI / 4
    });
    const resultRot45 = classifyHandGesture(handRot45, 'Right');
    expect(resultRot45.gesture).toBe('pointing');

    // Test fist rotated by 90 degrees
    const fistRot90 = generateHand({
      thumb: 'curled',
      index: 'curled',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled',
      rotation: Math.PI / 2
    });
    const resultFist90 = classifyHandGesture(fistRot90, 'Right');
    expect(resultFist90.gesture).toBe('fist');
  });

  it('supports left hand correctly', () => {
    const leftPointing = generateHand({
      thumb: 'curled',
      index: 'extended',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled',
      isLeft: true
    });
    const result = classifyHandGesture(leftPointing, 'Left');
    expect(result.gesture).toBe('pointing');
    expect(result.handedness).toBe('Left');
  });

  it('OneEuroFilter smooths signal and reduces jitter', () => {
    const filter = new OneEuroFilter(30, 1.0, 0.007, 1.0);
    const now = 1000;
    const v1 = filter.filter(10.0, now);
    expect(v1).toBe(10.0);

    // Sudden micro-jitter
    const v2 = filter.filter(10.5, now + 33);
    expect(v2).toBeLessThan(10.5);
    expect(v2).toBeGreaterThan(10.0);
  });

  it('GestureStabilizer enforces 5-frame majority vote to prevent flickering', () => {
    const stabilizer = new GestureStabilizer(5);
    expect(stabilizer.update('pointing')).toBe('none'); // Frame 1
    expect(stabilizer.update('pointing')).toBe('none'); // Frame 2
    expect(stabilizer.update('pointing')).toBe('pointing'); // Frame 3 (majority 3/5 achieved!)

    // Transient single-frame glitch
    expect(stabilizer.update('fist')).toBe('pointing'); // Maintained through hysteresis!
  });
});

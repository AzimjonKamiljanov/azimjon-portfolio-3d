// One-Euro Filter for Real-Time Landmark Smoothing (Casiez et al.)
export class OneEuroFilter {
  constructor(freq = 30, mincutoff = 1.0, beta = 0.007, dcutoff = 1.0) {
    this.freq = freq;
    this.mincutoff = mincutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(x, timestamp = performance.now()) {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = timestamp;
      return x;
    }
    const dt = Math.max(0.001, (timestamp - this.tPrev) / 1000);
    this.tPrev = timestamp;
    const rate = 1.0 / dt;

    // Filter derivative
    const dx = (x - this.xPrev) * rate;
    const alphaD = this.alpha(rate, this.dcutoff);
    const dxHat = alphaD * dx + (1 - alphaD) * this.dxPrev;
    this.dxPrev = dxHat;

    // Filter signal
    const cutoff = this.mincutoff + this.beta * Math.abs(dxHat);
    const alpha = this.alpha(rate, cutoff);
    const xHat = alpha * x + (1 - alpha) * this.xPrev;
    this.xPrev = xHat;
    return xHat;
  }

  alpha(rate, cutoff) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

// 3D Joint angle calculator (Rotation-Invariant)
export function calculateJointAngle(a, b, c) {
  if (!a || !b || !c) return Math.PI;
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z || 0) - (b.z || 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z || 0) - (b.z || 0) };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.hypot(v1.x, v1.y, v1.z);
  const mag2 = Math.hypot(v2.x, v2.y, v2.z);
  if (mag1 === 0 || mag2 === 0) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
}

// Determines if a finger is extended using joint angle and wrist distance ratio
export function isFingerExtended(mcp, pip, dip, tip, wrist) {
  const anglePip = calculateJointAngle(mcp, pip, dip);
  const angleDip = calculateJointAngle(pip, dip, tip);

  const distTip = Math.hypot(
    tip.x - wrist.x,
    tip.y - wrist.y,
    (tip.z || 0) - (wrist.z || 0),
  );
  const distPip = Math.hypot(
    pip.x - wrist.x,
    pip.y - wrist.y,
    (pip.z || 0) - (wrist.z || 0),
  );

  // Finger is extended if joints are fairly straight (> 140 deg = 2.44 rad) and tip extends past pip
  return anglePip > 2.44 && angleDip > 2.3 && distTip > distPip * 1.15;
}

// Determines if thumb is extended
export function isThumbExtended(wrist, cmc, mcp, ip, tip) {
  const angleMcp = calculateJointAngle(cmc, mcp, ip);
  const angleIp = calculateJointAngle(mcp, ip, tip);
  const distTip = Math.hypot(
    tip.x - wrist.x,
    tip.y - wrist.y,
    (tip.z || 0) - (wrist.z || 0),
  );
  const distMcp = Math.hypot(
    mcp.x - wrist.x,
    mcp.y - wrist.y,
    (mcp.z || 0) - (wrist.z || 0),
  );
  return angleMcp > 2.3 && angleIp > 2.2 && distTip > distMcp * 1.25;
}

// Classifies hand gesture from raw MediaPipe 21 landmarks
export function classifyHandGesture(landmarks, handedness = "Right") {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: "none", confidence: 0 };
  }

  const wrist = landmarks[0];
  const thumbCmc = landmarks[1];
  const thumbMcp = landmarks[2];
  const thumbIp = landmarks[3];
  const thumbTip = landmarks[4];

  const indexMcp = landmarks[5];
  const indexPip = landmarks[6];
  const indexDip = landmarks[7];
  const indexTip = landmarks[8];

  const middleMcp = landmarks[9];
  const middlePip = landmarks[10];
  const middleDip = landmarks[11];
  const middleTip = landmarks[12];

  const ringMcp = landmarks[13];
  const ringPip = landmarks[14];
  const ringDip = landmarks[15];
  const ringTip = landmarks[16];

  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyDip = landmarks[19];
  const pinkyTip = landmarks[20];

  // Hand scale (wrist to middle MCP)
  const handScale =
    Math.hypot(
      middleMcp.x - wrist.x,
      middleMcp.y - wrist.y,
      (middleMcp.z || 0) - (wrist.z || 0),
    ) || 0.1;

  // Finger extension states
  const thumbExt = isThumbExtended(
    wrist,
    thumbCmc,
    thumbMcp,
    thumbIp,
    thumbTip,
  );
  const indexExt = isFingerExtended(
    indexMcp,
    indexPip,
    indexDip,
    indexTip,
    wrist,
  );
  const middleExt = isFingerExtended(
    middleMcp,
    middlePip,
    middleDip,
    middleTip,
    wrist,
  );
  const ringExt = isFingerExtended(ringMcp, ringPip, ringDip, ringTip, wrist);
  const pinkyExt = isFingerExtended(
    pinkyMcp,
    pinkyPip,
    pinkyDip,
    pinkyTip,
    wrist,
  );

  // Pinch distance (thumb tip to index tip) normalized
  const pinchDist = Math.hypot(
    thumbTip.x - indexTip.x,
    thumbTip.y - indexTip.y,
    (thumbTip.z || 0) - (indexTip.z || 0),
  );
  const normPinch = pinchDist / handScale;
  const isPinch = normPinch < 0.38 || pinchDist < 0.065;

  const extendedCount =
    (indexExt ? 1 : 0) +
    (middleExt ? 1 : 0) +
    (ringExt ? 1 : 0) +
    (pinkyExt ? 1 : 0);

  const indexDistFromWrist = Math.hypot(
    indexTip.x - wrist.x,
    indexTip.y - wrist.y,
    (indexTip.z || 0) - (wrist.z || 0),
  );
  const indexMcpDistFromWrist = Math.hypot(
    indexMcp.x - wrist.x,
    indexMcp.y - wrist.y,
    (indexMcp.z || 0) - (wrist.z || 0),
  );
  const isIndexReaching = indexDistFromWrist > indexMcpDistFromWrist * 1.2;

  // 1. PINCH (Thumb tip + Index tip meeting while reaching out)
  if (isPinch && isIndexReaching) {
    return {
      gesture: "pinch",
      confidence: 0.95,
      pinchDist,
      normPinch,
      reticle: {
        x: (thumbTip.x + indexTip.x) / 2,
        y: (thumbTip.y + indexTip.y) / 2,
      },
      handedness,
    };
  }

  // 2. FIST (All 4 fingers curled into palm)
  if (extendedCount === 0) {
    return {
      gesture: "fist",
      confidence: 0.95,
      handedness,
    };
  }

  // 2. POINTING (Index finger extended only)
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return {
      gesture: "pointing",
      confidence: 0.96,
      reticle: { x: indexTip.x, y: indexTip.y },
      indexTip,
      handedness,
    };
  }

  // 3. VICTORY / PEACE (Index & Middle extended, Ring & Pinky curled)
  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    const tipSpread =
      Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y) /
      handScale;
    if (tipSpread > 0.22) {
      return {
        gesture: "victory",
        confidence: 0.94,
        tipSpread,
        handedness,
      };
    }
  }

  // 4. FIST (All 4 fingers curled)
  if (extendedCount === 0) {
    return {
      gesture: "fist",
      confidence: 0.95,
      handedness,
    };
  }

  // 5. OPEN PALM (At least 3-4 fingers extended)
  if (extendedCount >= 3) {
    return {
      gesture: "palm",
      confidence: 0.92,
      palmCenter: {
        x: (wrist.x + middleMcp.x) / 2,
        y: (wrist.y + middleMcp.y) / 2,
      },
      thumbExt,
      handedness,
    };
  }

  return { gesture: "none", confidence: 0.1, handedness };
}

// 5-Frame Majority Vote Filter with Hysteresis
export class GestureStabilizer {
  constructor(windowSize = 5) {
    this.windowSize = windowSize;
    this.history = [];
    this.currentStableGesture = "none";
  }

  update(detectedGesture) {
    this.history.push(detectedGesture);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    const counts = {};
    for (const g of this.history) {
      counts[g] = (counts[g] || 0) + 1;
    }

    // Require majority (e.g. 3 out of 5 frames) to change stable state
    let topGesture = this.currentStableGesture;
    let topCount = counts[topGesture] || 0;

    for (const [g, count] of Object.entries(counts)) {
      if (count > topCount && count >= Math.ceil(this.windowSize / 2)) {
        topGesture = g;
        topCount = count;
      }
    }

    this.currentStableGesture = topGesture;
    return this.currentStableGesture;
  }

  reset() {
    this.history = [];
    this.currentStableGesture = "none";
  }
}

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

// 3D Joint angle calculator with Z-damping (prevents monocular depth estimation noise)
export function calculateJointAngle(a, b, c) {
  if (!a || !b || !c) return Math.PI;
  const zScale = 0.35;
  const v1 = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: ((a.z || 0) - (b.z || 0)) * zScale,
  };
  const v2 = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: ((c.z || 0) - (b.z || 0)) * zScale,
  };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.hypot(v1.x, v1.y, v1.z);
  const mag2 = Math.hypot(v2.x, v2.y, v2.z);
  if (mag1 === 0 || mag2 === 0) return Math.PI;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
}

// Determines if a finger is extended using robust distance ratios and 2D/3D angles
export function isFingerExtended(mcp, pip, dip, tip, wrist) {
  if (!mcp || !pip || !dip || !tip || !wrist) return false;

  const distTipWrist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const distPipWrist = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);

  const distTipMcp = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
  const distPipMcp = Math.hypot(pip.x - mcp.x, pip.y - mcp.y);

  const anglePip = calculateJointAngle(mcp, pip, dip);

  const isDistExt =
    distTipWrist > distPipWrist * 1.05 && distTipMcp > distPipMcp * 1.05;
  const isAngleOpen = anglePip > 2.05;

  return isDistExt && isAngleOpen;
}

// Determines if thumb is extended away from palm
export function isThumbExtended(wrist, cmc, mcp, ip, tip, indexMcp) {
  if (!wrist || !mcp || !tip) return false;

  const distTipWrist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  const distMcpWrist = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);

  let isSeparated = true;
  if (indexMcp) {
    const distTipIndex = Math.hypot(tip.x - indexMcp.x, tip.y - indexMcp.y);
    const distMcpIndex = Math.hypot(mcp.x - indexMcp.x, mcp.y - indexMcp.y);
    isSeparated = distTipIndex > distMcpIndex * 0.85;
  }

  const angleIp = ip ? calculateJointAngle(mcp, ip, tip) : Math.PI;

  return distTipWrist > distMcpWrist * 1.08 && isSeparated && angleIp > 1.95;
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

  // Hand scale (wrist to middle knuckle)
  const handScale =
    Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y) || 0.15;

  // Finger extension states (forgiving, natural, jitter-resistant)
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
  const thumbExt = isThumbExtended(
    wrist,
    thumbCmc,
    thumbMcp,
    thumbIp,
    thumbTip,
    indexMcp,
  );

  const extendedCount =
    (indexExt ? 1 : 0) +
    (middleExt ? 1 : 0) +
    (ringExt ? 1 : 0) +
    (pinkyExt ? 1 : 0);

  // Distance from index tip to index MCP (knuckle)
  const distIndexTipMcp = Math.hypot(
    indexTip.x - indexMcp.x,
    indexTip.y - indexMcp.y,
  );
  const isIndexReaching = distIndexTipMcp > handScale * 0.35 || indexExt;

  // Pinch distance (thumb tip to index tip)
  const pinchDist = Math.hypot(
    thumbTip.x - indexTip.x,
    thumbTip.y - indexTip.y,
  );
  const normPinch = pinchDist / handScale;
  const isPinchContact = normPinch < 0.28 || pinchDist < 0.052;
  const isPinch = isPinchContact && isIndexReaching;

  const otherFingersExtendedCount =
    (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);

  // 1. OK SIGN (Thumb + Index pinch while middle and at least one other finger is extended)
  if (isPinch && middleExt && otherFingersExtendedCount >= 2) {
    return {
      gesture: "ok",
      confidence: 0.96,
      reticle: {
        x: (thumbTip.x + indexTip.x) / 2,
        y: (thumbTip.y + indexTip.y) / 2,
      },
      handedness,
    };
  }

  // 2. PINCH (Thumb tip + Index tip meeting while index reaches out)
  if (isPinch && otherFingersExtendedCount <= 1) {
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

  // 3. FIST vs THUMBS UP (All 4 main fingers curled)
  if (extendedCount === 0) {
    // In camera coordinates, y=0 is top. Thumb pointing up has thumbTip.y significantly above wrist.y and MCP
    const isThumbPointingUp =
      thumbTip.y < wrist.y - handScale * 0.35 && thumbTip.y < thumbMcp.y;

    if (thumbExt && isThumbPointingUp) {
      return {
        gesture: "thumbs_up",
        confidence: 0.95,
        handedness,
      };
    }

    return {
      gesture: "fist",
      confidence: 0.95,
      handedness,
    };
  }

  // 4. SHAKA / CALL ME (Thumb and Pinky extended, middle 3 curled)
  const shakaSpread =
    Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y) / handScale;
  if (
    thumbExt &&
    pinkyExt &&
    !indexExt &&
    !middleExt &&
    !ringExt &&
    shakaSpread > 0.7
  ) {
    return {
      gesture: "shaka",
      confidence: 0.95,
      shakaSpread,
      handedness,
    };
  }

  // 5. ROCK / HORNS (Index & Pinky extended, Middle & Ring curled)
  const rockSpread =
    Math.hypot(indexTip.x - pinkyTip.x, indexTip.y - pinkyTip.y) / handScale;
  if (indexExt && pinkyExt && !middleExt && !ringExt && rockSpread > 0.42) {
    return {
      gesture: "rock",
      confidence: 0.94,
      rockSpread,
      handedness,
    };
  }

  // 6. VICTORY / PEACE (Index & Middle extended, Ring & Pinky curled)
  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    const tipSpread =
      Math.hypot(indexTip.x - middleTip.x, indexTip.y - middleTip.y) /
      handScale;
    if (tipSpread > 0.18) {
      return {
        gesture: "victory",
        confidence: 0.94,
        tipSpread,
        handedness,
      };
    }
  }

  // 7. POINTING (Index finger extended only)
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return {
      gesture: "pointing",
      confidence: 0.96,
      reticle: { x: indexTip.x, y: indexTip.y },
      indexTip,
      handedness,
    };
  }

  // 8. OPEN PALM (At least 3 fingers extended)
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

// Majority Vote Filter with Blink Absorption
export class GestureStabilizer {
  constructor(windowSize = 4) {
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

    // Require majority (e.g. 2 out of 4) to establish a stable gesture
    let topGesture = this.currentStableGesture;
    let topCount = counts[topGesture] || 0;

    for (const [g, count] of Object.entries(counts)) {
      if (
        g !== "none" &&
        count > topCount &&
        count >= Math.ceil(this.windowSize / 2)
      ) {
        topGesture = g;
        topCount = count;
      }
    }

    // Only switch to 'none' if all recent frames are 'none' (absorbs blinks)
    if (counts["none"] === this.history.length) {
      topGesture = "none";
    }

    this.currentStableGesture = topGesture;
    return this.currentStableGesture;
  }

  reset() {
    this.history = [];
    this.currentStableGesture = "none";
  }
}

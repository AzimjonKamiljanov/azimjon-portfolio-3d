import {
  classifyHandGesture,
  GestureStabilizer,
  OneEuroFilter,
} from "./gestureClassifier.js";
import { getTranslations } from "../i18n/i18n.js";
import { playUiOpen, playUiClose } from "../audio/soundscape.js";

let isGestureActive = false;
let gestureStream = null;
let landmarkerInstance = null;
let animFrameId = null;
let isProcessingFrame = false;

let callbacks = {
  onOrbit: null,
  onZoom: null,
  onSelect: null,
  onFreezeToggle: null,
  onTourToggle: null,
  onSwipe: null,
  onOverview: null,
  getReticleTarget: null,
};

const stabilizer = new GestureStabilizer(5);
const palmFilterX = new OneEuroFilter(30, 1.0, 0.01);
const palmFilterY = new OneEuroFilter(30, 1.0, 0.01);
const reticleFilterX = new OneEuroFilter(30, 1.2, 0.015);
const reticleFilterY = new OneEuroFilter(30, 1.2, 0.015);

let prevPalmPos = null;
let prevPinchY = null;
let prevTwoHandDist = null;

let dwellTarget = null;
let dwellStartTime = 0;
let lastPinchTriggerTime = 0;

let fistHoldStart = 0;
let fistTriggered = false;

let victoryHoldStart = 0;
let victoryTriggered = false;

let palmStillStart = 0;
let lastSwipeTime = 0;

let lastFpsTime = performance.now();
let frameCounter = 0;
let currentFps = 0;
let currentGestureState = "none";
let currentHoveredTarget = null;

const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

function drawGestureCanvas(landmarks, gestureName) {
  const canvas = document.getElementById("gesture-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const video = document.getElementById("gesture-video");
  if (video && video.readyState >= 2) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = "rgba(4, 8, 18, 0.58)";
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#05070e";
    ctx.fillRect(0, 0, w, h);
  }

  if (!landmarks || landmarks.length === 0) return;

  for (const lm of landmarks) {
    // Draw connections
    ctx.strokeStyle =
      gestureName === "pinch"
        ? "rgba(52, 211, 153, 0.65)"
        : "rgba(56, 189, 248, 0.5)";
    ctx.lineWidth = 1.5;
    for (const [i, j] of HAND_CONNECTIONS) {
      if (lm[i] && lm[j]) {
        const x1 = (1.0 - lm[i].x) * w;
        const y1 = lm[i].y * h;
        const x2 = (1.0 - lm[j].x) * w;
        const y2 = lm[j].y * h;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Draw joints
    for (let i = 0; i < lm.length; i++) {
      const x = (1.0 - lm[i].x) * w;
      const y = lm[i].y * h;
      const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;

      ctx.fillStyle = isTip
        ? gestureName === "pinch"
          ? "#34d399"
          : "#ffffff"
        : "#38bdf8";
      ctx.beginPath();
      ctx.arc(x, y, isTip ? 3.0 : 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function updateHudUI(gesture, text, icon, isError = false) {
  const dot = document.getElementById("gesture-status-dot");
  const stateIcon = document.getElementById("gesture-indicator-icon");
  const stateText = document.getElementById("gesture-state-text");
  const fpsEl = document.getElementById("gesture-fps");

  if (dot) {
    dot.className =
      "gesture-live-dot " + (isError ? "status-error" : "status-active");
  }
  if (stateIcon && icon) stateIcon.innerText = icon;
  if (stateText && text) stateText.innerText = text;
  if (fpsEl && !isError) {
    fpsEl.innerText = `${currentFps} FPS`;
  }
}

function processLandmarks(
  landmarksList,
  handednesses = [],
  timestamp = performance.now(),
) {
  const trans = getTranslations().ui.gestures;
  const reticleEl = document.getElementById("gesture-reticle");
  const reticleLabel = document.getElementById("reticle-target-label");

  // Track FPS
  frameCounter++;
  if (timestamp - lastFpsTime >= 1000) {
    currentFps = Math.round((frameCounter * 1000) / (timestamp - lastFpsTime));
    lastFpsTime = timestamp;
    frameCounter = 0;
  }

  if (!landmarksList || landmarksList.length === 0) {
    currentGestureState = "none";
    currentHoveredTarget = null;
    drawGestureCanvas(null, "none");
    updateHudUI("none", trans.calibration, "🖐");
    if (reticleEl) reticleEl.classList.add("hidden");

    prevPalmPos = null;
    prevPinchY = null;
    prevTwoHandDist = null;
    dwellTarget = null;
    dwellStartTime = 0;
    fistHoldStart = 0;
    fistTriggered = false;
    victoryHoldStart = 0;
    victoryTriggered = false;
    palmStillStart = 0;
    return;
  }

  // 1. Two-Hand Zoom interaction
  if (landmarksList.length >= 2) {
    const hand1 = landmarksList[0];
    const hand2 = landmarksList[1];
    drawGestureCanvas([hand1, hand2], "zoom");

    const p1 = hand1[0];
    const p2 = hand2[0];
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

    if (prevTwoHandDist !== null) {
      const delta = dist - prevTwoHandDist;
      if (Math.abs(delta) > 0.008 && callbacks.onZoom) {
        callbacks.onZoom(delta * 25.0);
      }
    }
    prevTwoHandDist = dist;
    currentGestureState = "zoom";
    updateHudUI("zoom", trans.zoom, "👐");
    if (reticleEl) reticleEl.classList.add("hidden");
    return;
  }

  prevTwoHandDist = null;

  // 2. Single hand classification
  const lm = landmarksList[0];
  const handednessName = handednesses[0]?.categoryName || "Right";
  const raw = classifyHandGesture(lm, handednessName);
  const stableGesture = stabilizer.update(raw.gesture);
  currentGestureState = stableGesture;
  if (typeof window !== "undefined" && window.__onGestureRecognized) {
    window.__onGestureRecognized(stableGesture);
  }

  drawGestureCanvas([lm], stableGesture);

  // Process Gestures
  if (stableGesture === "palm") {
    if (reticleEl) reticleEl.classList.add("hidden");
    dwellTarget = null;
    dwellStartTime = 0;
    prevPinchY = null;

    const rawX = raw.palmCenter ? raw.palmCenter.x : lm[9].x;
    const rawY = raw.palmCenter ? raw.palmCenter.y : lm[9].y;
    const smoothX = palmFilterX.filter(rawX, timestamp);
    const smoothY = palmFilterY.filter(rawY, timestamp);

    if (prevPalmPos) {
      const dx = smoothX - prevPalmPos.x;
      const dy = smoothY - prevPalmPos.y;
      const dt = Math.max(0.001, (timestamp - prevPalmPos.t) / 1000);
      const vx = dx / dt;

      // Fast Swipe detection (Horizontal velocity check)
      if (
        Math.abs(vx) > 1.2 &&
        Math.abs(dx) > 0.1 &&
        Date.now() - lastSwipeTime > 750
      ) {
        lastSwipeTime = Date.now();
        // Camera is mirrored: moving right in front of webcam produces negative dx
        if (vx < 0) {
          if (callbacks.onSwipe) callbacks.onSwipe("right");
          updateHudUI("swipeRight", trans.swipeRight, "👉");
        } else {
          if (callbacks.onSwipe) callbacks.onSwipe("left");
          updateHudUI("swipeLeft", trans.swipeLeft, "👈");
        }
      } else {
        // Still palm detection for Solar Overview reset
        const moveDist = Math.hypot(dx, dy);
        if (moveDist < 0.005) {
          if (!palmStillStart) {
            palmStillStart = timestamp;
          } else if (timestamp - palmStillStart >= 1500) {
            if (callbacks.onOverview) callbacks.onOverview();
            updateHudUI("overview", trans.overview, "🌌");
            palmStillStart = 0;
          } else {
            updateHudUI("palm", trans.palm, "🖐");
          }
        } else {
          palmStillStart = 0;
          // Regular Orbit with deadzone
          if (moveDist > 0.003 && callbacks.onOrbit) {
            callbacks.onOrbit(dx * 4.5, dy * 4.5);
          }
          updateHudUI("palm", trans.palm, "🖐");
        }
      }
    } else {
      updateHudUI("palm", trans.palm, "🖐");
    }

    prevPalmPos = { x: smoothX, y: smoothY, t: timestamp };
  } else if (stableGesture === "pointing") {
    prevPalmPos = null;
    prevPinchY = null;
    palmStillStart = 0;

    const tip = raw.indexTip || lm[8];
    const rawX = tip.x;
    const rawY = tip.y;
    const smoothX = reticleFilterX.filter(rawX, timestamp);
    const smoothY = reticleFilterY.filter(rawY, timestamp);

    // Mirrored display for reticle
    const screenX = (1.0 - smoothX) * window.innerWidth;
    const screenY = smoothY * window.innerHeight;

    if (reticleEl) {
      reticleEl.classList.remove("hidden");
      reticleEl.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
    }

    let target = null;
    if (callbacks.getReticleTarget) {
      // Three.js NDC coordinates corresponding exactly to visual reticle position:
      // X in [-1, +1] (left to right), Y in [-1, +1] (bottom to top)
      const ndcX = (screenX / window.innerWidth) * 2 - 1;
      const ndcY = -(screenY / window.innerHeight) * 2 + 1;
      target = callbacks.getReticleTarget(ndcX, ndcY);
    }
    currentHoveredTarget = target;

    if (target && target.userData && target.userData.title) {
      if (reticleLabel) reticleLabel.innerText = target.userData.title;
      if (reticleEl) reticleEl.classList.add("reticle-locked");

      // Dwell selection (0.9s hover)
      if (dwellTarget === target) {
        if (timestamp - dwellStartTime >= 900) {
          if (callbacks.onSelect) callbacks.onSelect(target);
          updateHudUI(
            "selected",
            `${trans.selected}: ${target.userData.title}`,
            "🎯",
          );
          dwellTarget = null;
          dwellStartTime = 0;
        } else {
          updateHudUI("pointing", `${target.userData.title}...`, "👆");
        }
      } else {
        dwellTarget = target;
        dwellStartTime = timestamp;
        updateHudUI("pointing", target.userData.title, "👆");
      }
    } else {
      dwellTarget = null;
      dwellStartTime = 0;
      if (reticleLabel) reticleLabel.innerText = "";
      if (reticleEl) reticleEl.classList.remove("reticle-locked");
      updateHudUI("pointing", trans.pointing, "👆");
    }
  } else if (stableGesture === "pinch") {
    prevPalmPos = null;
    palmStillStart = 0;
    dwellTarget = null;
    dwellStartTime = 0;

    const pinchY = raw.reticle ? raw.reticle.y : lm[8].y;
    const pinchX = raw.reticle ? raw.reticle.x : lm[8].x;

    if (prevPinchY === null) {
      prevPinchY = pinchY;
      // Quick pinch selection
      if (Date.now() - lastPinchTriggerTime > 550) {
        lastPinchTriggerTime = Date.now();
        let target = currentHoveredTarget;
        if (!target && callbacks.getReticleTarget) {
          const pinchScreenX = (1.0 - pinchX) * window.innerWidth;
          const pinchScreenY = pinchY * window.innerHeight;
          const ndcX = (pinchScreenX / window.innerWidth) * 2 - 1;
          const ndcY = -(pinchScreenY / window.innerHeight) * 2 + 1;
          target = callbacks.getReticleTarget(ndcX, ndcY);
        }
        if (target && callbacks.onSelect) {
          callbacks.onSelect(target);
          updateHudUI(
            "selected",
            `${trans.selected}: ${target.userData?.title || ""}`,
            "🤏",
          );
        }
      }
    } else {
      // Pinch & hold + move Y for Zoom
      const dy = pinchY - prevPinchY;
      if (Math.abs(dy) > 0.004 && callbacks.onZoom) {
        callbacks.onZoom(dy * 18.0);
        prevPinchY = pinchY;
        updateHudUI("pinch", trans.pinch, "🤏");
      }
    }

    if (reticleEl) reticleEl.classList.add("hidden");
  } else if (stableGesture === "fist") {
    if (reticleEl) reticleEl.classList.add("hidden");
    prevPalmPos = null;
    prevPinchY = null;
    palmStillStart = 0;
    dwellTarget = null;
    dwellStartTime = 0;

    if (!fistHoldStart) {
      fistHoldStart = timestamp;
    } else if (timestamp - fistHoldStart >= 500 && !fistTriggered) {
      if (callbacks.onFreezeToggle) callbacks.onFreezeToggle();
      fistTriggered = true;
      updateHudUI("fist", trans.fist, "✊");
    } else {
      updateHudUI("fist", trans.fist, "✊");
    }
  } else if (stableGesture === "victory") {
    if (reticleEl) reticleEl.classList.add("hidden");
    prevPalmPos = null;
    prevPinchY = null;
    palmStillStart = 0;
    dwellTarget = null;
    dwellStartTime = 0;

    if (!victoryHoldStart) {
      victoryHoldStart = timestamp;
    } else if (timestamp - victoryHoldStart >= 700 && !victoryTriggered) {
      if (callbacks.onTourToggle) callbacks.onTourToggle();
      victoryTriggered = true;
      updateHudUI("victory", trans.victory, "✌️");
    } else {
      updateHudUI("victory", trans.victory, "✌️");
    }
  }

  // Release flags when gesture changes
  if (stableGesture !== "fist") {
    fistHoldStart = 0;
    fistTriggered = false;
  }
  if (stableGesture !== "victory") {
    victoryHoldStart = 0;
    victoryTriggered = false;
  }
}

async function loadVisionTasks() {
  if (landmarkerInstance) return landmarkerInstance;

  const vision = await import("@mediapipe/tasks-vision");
  const filesetResolver =
    await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");

  try {
    landmarkerInstance = await vision.HandLandmarker.createFromOptions(
      filesetResolver,
      {
        baseOptions: {
          modelAssetPath: "/mediapipe/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      },
    );
  } catch (gpuErr) {
    console.warn("GPU delegate failed, falling back to CPU:", gpuErr);
    landmarkerInstance = await vision.HandLandmarker.createFromOptions(
      filesetResolver,
      {
        baseOptions: {
          modelAssetPath: "/mediapipe/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      },
    );
  }

  return landmarkerInstance;
}

export async function startGestureControl() {
  const hud = document.getElementById("gesture-hud");
  const video = document.getElementById("gesture-video");
  const toggleBtn = document.getElementById("gesture-toggle-btn");
  const trans = getTranslations().ui.gestures;

  try {
    if (
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      updateHudUI("error", trans.errorInsecure, "⚠️", true);
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateHudUI("error", trans.errorNoCamera, "⚠️", true);
      return false;
    }

    if (hud) {
      hud.classList.remove("hidden");
      hud.style.display = "block";
    }

    updateHudUI("searching", trans.searching, "🔍");

    try {
      await loadVisionTasks();
    } catch (modelErr) {
      console.error("Failed to load vision model:", modelErr);
      updateHudUI("error", trans.errorWasm, "⚠️", true);
      return false;
    }

    gestureStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        facingMode: "user",
      },
      audio: false,
    });

    if (video) {
      video.srcObject = gestureStream;
      await video.play();
    }

    isGestureActive = true;
    if (toggleBtn) toggleBtn.classList.add("active");
    playUiOpen();

    let lastVideoTime = -1;

    function frameLoop(now, metadata) {
      if (!isGestureActive) return;

      const currentTime = metadata ? metadata.mediaTime : video.currentTime;
      if (
        video &&
        video.readyState >= 2 &&
        currentTime !== lastVideoTime &&
        !isProcessingFrame
      ) {
        lastVideoTime = currentTime;
        isProcessingFrame = true;
        try {
          const results = landmarkerInstance.detectForVideo(video, now);
          processLandmarks(results.landmarks, results.handednesses, now);
        } catch (inferenceErr) {
          console.warn("Landmarker inference error:", inferenceErr);
        } finally {
          isProcessingFrame = false;
        }
      }

      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback((n, m) => frameLoop(n, m));
      } else {
        animFrameId = requestAnimationFrame((n) => frameLoop(n, null));
      }
    }

    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback((n, m) => frameLoop(n, m));
    } else {
      animFrameId = requestAnimationFrame((n) => frameLoop(n, null));
    }

    return true;
  } catch (err) {
    console.error("Camera access error:", err);
    const isDenied =
      err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
    const isNotFound =
      err.name === "NotFoundError" || err.name === "DevicesNotFoundError";

    if (isDenied) {
      updateHudUI("error", trans.errorPermission, "🚫", true);
    } else if (isNotFound) {
      updateHudUI("error", trans.errorNoCamera, "⚠️", true);
    } else {
      updateHudUI("error", trans.camError, "⚠️", true);
    }

    if (toggleBtn) toggleBtn.classList.remove("active");
    return false;
  }
}

export function stopGestureControl() {
  isGestureActive = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (gestureStream) {
    gestureStream.getTracks().forEach((t) => t.stop());
    gestureStream = null;
  }

  const hud = document.getElementById("gesture-hud");
  if (hud) {
    hud.classList.add("hidden");
    hud.style.display = "none";
  }

  const reticleEl = document.getElementById("gesture-reticle");
  if (reticleEl) {
    reticleEl.classList.add("hidden");
  }

  const toggleBtn = document.getElementById("gesture-toggle-btn");
  if (toggleBtn) toggleBtn.classList.remove("active");

  prevPalmPos = null;
  prevPinchY = null;
  prevTwoHandDist = null;
  dwellTarget = null;
  dwellStartTime = 0;
  currentHoveredTarget = null;
  currentGestureState = "none";

  stabilizer.reset();
  palmFilterX.reset();
  palmFilterY.reset();
  reticleFilterX.reset();
  reticleFilterY.reset();

  playUiClose();
}

export function toggleGestureControl() {
  if (isGestureActive) {
    stopGestureControl();
    return false;
  }

  // Check consent modal
  const consentModal = document.getElementById("gesture-consent-modal");
  let hasConsented = false;
  try {
    hasConsented =
      window.sessionStorage.getItem("gesture_consent_granted") === "true";
  } catch {
    hasConsented = false;
  }

  if (!hasConsented && consentModal) {
    consentModal.classList.remove("hidden");
    return false;
  }

  return startGestureControl();
}

export function initGestureControl(handlers = {}) {
  callbacks = { ...callbacks, ...handlers };

  const gestureToggleBtn = document.getElementById("gesture-toggle-btn");
  const gestureCloseBtn = document.getElementById("gesture-close-btn");
  const consentModal = document.getElementById("gesture-consent-modal");
  const consentAllowBtn = document.getElementById("gesture-consent-allow");
  const consentDenyBtn = document.getElementById("gesture-consent-deny");

  if (consentAllowBtn && consentModal) {
    consentAllowBtn.addEventListener("click", () => {
      try {
        window.sessionStorage.setItem("gesture_consent_granted", "true");
      } catch {
        // ignore
      }
      consentModal.classList.add("hidden");
      startGestureControl();
    });
  }

  if (consentDenyBtn && consentModal) {
    consentDenyBtn.addEventListener("click", () => {
      consentModal.classList.add("hidden");
      if (gestureToggleBtn) gestureToggleBtn.classList.remove("active");
    });
  }

  if (gestureToggleBtn) {
    gestureToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleGestureControl();
    });
  }

  if (gestureCloseBtn) {
    gestureCloseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      stopGestureControl();
    });
  }

  // Test injection hook for E2E and visual tests
  window.__gestureTest = {
    inject: (landmarks, handedness = "Right") => {
      processLandmarks(
        [landmarks],
        [{ categoryName: handedness }],
        performance.now(),
      );
    },
    injectTwoHands: (hand1, hand2) => {
      processLandmarks(
        [hand1, hand2],
        [{ categoryName: "Right" }, { categoryName: "Left" }],
        performance.now(),
      );
    },
    getState: () => ({
      isActive: isGestureActive,
      currentGesture: currentGestureState,
      hoveredTarget: currentHoveredTarget,
      fps: currentFps,
    }),
  };

  return {
    start: startGestureControl,
    stop: stopGestureControl,
    toggle: toggleGestureControl,
    isActive: () => isGestureActive,
  };
}

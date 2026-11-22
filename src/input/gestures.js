/**
 * Webcam hand control for the 3D portfolio.
 *
 * Structure, and why it looks like this:
 *
 * - Static poses (fist, victory, OK, thumbs up/down, shaka, rock) all behave
 *   identically: hold the pose for N ms, fire once, re-arm when the pose is
 *   released. That used to be six near-identical 25-line blocks plus six sets
 *   of module-level timers, which is how their hold thresholds drifted apart.
 *   They are now rows in HOLD_ACTIONS driven by one state machine.
 *
 * - Every continuous control (palm orbit, pinch, two-hand zoom and roll,
 *   two-finger scroll) goes through a One-Euro filter and a settings-driven
 *   deadzone, so output is proportional to deliberate movement and nothing
 *   else. Filter frequency tracks the measured frame rate instead of a fixed
 *   30 Hz guess, which is what made smoothing feel different on slow laptops.
 *
 * - Anything the visitor can open by hand, they can also close by hand
 *   (thumbs down) and scroll by hand (two fingers), so the webcam is a
 *   complete input device rather than a demo of a few poses.
 *
 * - Progress is always visible: the reticle carries a dwell ring and the HUD
 *   carries a hold bar, because an invisible timer is indistinguishable from
 *   a control that does not work.
 */

import {
  classifyHandGesture,
  GestureStabilizer,
  OneEuroFilter,
} from "./gestureClassifier.js";
import {
  getGestureSettings,
  onGestureSettingsChange,
} from "./gestureSettings.js";
import { getTranslations } from "../i18n/i18n.js";
import {
  playUiOpen,
  playUiClose,
  playUiClick,
  playUiSuccess,
  playUiHover,
} from "../audio/soundscape.js";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let isGestureActive = false;
let gestureStream = null;
let landmarkerInstance = null;
let animFrameId = null;
let isProcessingFrame = false;
let settings = getGestureSettings();

onGestureSettingsChange((next) => {
  settings = next;
});

let callbacks = {
  onOrbit: null,
  onZoom: null,
  onSelect: null,
  onFreezeToggle: null,
  onTourToggle: null,
  onSwipe: null,
  onVerticalSwipe: null,
  onOverview: null,
  onSpeedBoostToggle: null,
  onCatalogToggle: null,
  onContactToggle: null,
  onScaleToggle: null,
  onBack: null,
  onScroll: null,
  onRoll: null,
  getReticleTarget: null,
};

const stabilizer = new GestureStabilizer(5);

// One filter per signal. Palm and reticle are tuned differently on purpose:
// the palm drives the camera and wants smoothness, the reticle drives aiming
// and wants responsiveness.
const palmFilterX = new OneEuroFilter(30, 1.2, 0.02);
const palmFilterY = new OneEuroFilter(30, 1.2, 0.02);
const reticleFilterX = new OneEuroFilter(30, 1.5, 0.03);
const reticleFilterY = new OneEuroFilter(30, 1.5, 0.03);
const pinchFilterX = new OneEuroFilter(30, 1.4, 0.025);
const pinchFilterY = new OneEuroFilter(30, 1.4, 0.025);
const spanFilter = new OneEuroFilter(30, 1.0, 0.015);
const rollFilter = new OneEuroFilter(30, 1.0, 0.015);
const scrollFilter = new OneEuroFilter(30, 1.3, 0.025);

const ALL_FILTERS = [
  palmFilterX,
  palmFilterY,
  reticleFilterX,
  reticleFilterY,
  pinchFilterX,
  pinchFilterY,
  spanFilter,
  rollFilter,
  scrollFilter,
];

let prevPalmPos = null;
let prevPinch = null;
let prevTwoHandSpan = null;
let prevTwoHandRoll = null;
let prevScrollY = null;

let dwellTarget = null;
let dwellStartTime = 0;
let lastPinchTriggerTime = 0;

let palmStillStart = 0;
let lastSwipeTime = 0;

let lastFpsTime = performance.now();
let frameCounter = 0;
let currentFps = 0;
let measuredFps = 30;
let currentGestureState = "none";
let currentHoveredTarget = null;

// Cached viewport. Reading innerWidth/innerHeight inside the frame loop forces
// a layout flush on every webcam frame; a resize listener costs nothing.
let viewportW = typeof window === "undefined" ? 1920 : window.innerWidth;
let viewportH = typeof window === "undefined" ? 1080 : window.innerHeight;

function refreshViewport() {
  viewportW = window.visualViewport?.width || window.innerWidth;
  viewportH = window.visualViewport?.height || window.innerHeight;
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", refreshViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", refreshViewport, {
    passive: true,
  });
}

// ---------------------------------------------------------------------------
// Hold-action registry
// ---------------------------------------------------------------------------

/**
 * A pose that fires once after being held. `holdScale` lets a pose that is
 * easy to strike accidentally demand a little longer than one that is clearly
 * deliberate, while still scaling with the user's configured holdMs.
 */
const HOLD_ACTIONS = [
  {
    gesture: "fist",
    callback: "onFreezeToggle",
    icon: "✊",
    holdScale: 0.95,
    sound: playUiClick,
    labelKey: "fist",
    fallbackLabel: "✊ • Vaqtni to'xtatish",
  },
  {
    gesture: "victory",
    callback: "onTourToggle",
    icon: "✌️",
    holdScale: 1.15,
    sound: playUiOpen,
    labelKey: "victory",
    fallbackLabel: "✌️ • Avto-sayohat",
  },
  {
    gesture: "ok",
    callback: "onCatalogToggle",
    icon: "👌",
    holdScale: 0.95,
    sound: playUiOpen,
    labelKey: "ok",
    fallbackLabel: "👌 • Loyihalar katalogi",
  },
  {
    gesture: "thumbs_up",
    callback: "onSpeedBoostToggle",
    icon: "👍",
    holdScale: 0.95,
    sound: playUiClick,
    labelKey: "thumbsUp",
    fallbackLabel: "👍 • Giper-tezlik (3x/1x)",
  },
  {
    gesture: "thumbs_down",
    callback: "onBack",
    icon: "👎",
    holdScale: 0.8,
    sound: playUiClose,
    labelKey: "thumbsDown",
    fallbackLabel: "👎 • Yopish / Orqaga",
  },
  {
    gesture: "shaka",
    callback: "onContactToggle",
    icon: "🤙",
    holdScale: 1,
    sound: playUiOpen,
    labelKey: "shaka",
    fallbackLabel: "🤙 • Aloqa terminali",
  },
  {
    gesture: "rock",
    callback: "onScaleToggle",
    icon: "🤘",
    holdScale: 1,
    sound: playUiSuccess,
    labelKey: "rock",
    fallbackLabel: "🤘 • Astronomik masshtab",
  },
];

const HOLD_BY_GESTURE = new Map(HOLD_ACTIONS.map((a) => [a.gesture, a]));

// Grace period so a single dropped frame does not re-arm a pose mid-hold.
const HOLD_GRACE_MS = 250;

/** Per-gesture hold state, replacing six hand-maintained variable triplets. */
const holdState = new Map(
  HOLD_ACTIONS.map((a) => [a.gesture, { start: 0, fired: false, lastSeen: 0 }]),
);

function resetHoldState() {
  for (const state of holdState.values()) {
    state.start = 0;
    state.fired = false;
    state.lastSeen = 0;
  }
}

// ---------------------------------------------------------------------------
// Canvas overlay
// ---------------------------------------------------------------------------

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

const GESTURE_COLORS = {
  pinch: { stroke: "rgba(52, 211, 153, 0.75)", tip: "#34d399" },
  ok: { stroke: "rgba(245, 158, 11, 0.75)", tip: "#fbbf24" },
  thumbs_up: { stroke: "rgba(6, 182, 212, 0.85)", tip: "#22d3ee" },
  thumbs_down: { stroke: "rgba(148, 163, 184, 0.85)", tip: "#cbd5e1" },
  shaka: { stroke: "rgba(236, 72, 153, 0.85)", tip: "#f472b6" },
  rock: { stroke: "rgba(249, 115, 22, 0.85)", tip: "#fb923c" },
  fist: { stroke: "rgba(244, 63, 94, 0.8)", tip: "#fb7185" },
  victory: { stroke: "rgba(96, 165, 250, 0.85)", tip: "#60a5fa" },
  scroll: { stroke: "rgba(167, 139, 250, 0.85)", tip: "#a78bfa" },
  zoom: { stroke: "rgba(56, 189, 248, 0.8)", tip: "#7dd3fc" },
};

const DEFAULT_COLORS = { stroke: "rgba(56, 189, 248, 0.5)", tip: "#ffffff" };
const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);

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
    if (settings.mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = "rgba(4, 8, 18, 0.58)";
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = "#05070e";
    ctx.fillRect(0, 0, w, h);
  }

  if (!landmarks || landmarks.length === 0 || !settings.showSkeleton) return;

  const { stroke, tip } = GESTURE_COLORS[gestureName] || DEFAULT_COLORS;
  const projectX = (x) => (settings.mirrored ? 1 - x : x) * w;

  for (const lm of landmarks) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    for (const [i, j] of HAND_CONNECTIONS) {
      if (!lm[i] || !lm[j]) continue;
      ctx.beginPath();
      ctx.moveTo(projectX(lm[i].x), lm[i].y * h);
      ctx.lineTo(projectX(lm[j].x), lm[j].y * h);
      ctx.stroke();
    }

    for (let i = 0; i < lm.length; i++) {
      const isTip = FINGERTIP_INDICES.has(i);
      ctx.fillStyle = isTip ? tip : "#38bdf8";
      ctx.beginPath();
      ctx.arc(projectX(lm[i].x), lm[i].y * h, isTip ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function updateHudUI(_gesture, text, icon, isError = false) {
  const dot = document.getElementById("gesture-status-dot");
  const stateIcon = document.getElementById("gesture-indicator-icon");
  const stateText = document.getElementById("gesture-state-text");
  const fpsEl = document.getElementById("gesture-fps");

  if (dot) {
    dot.className = `gesture-live-dot ${isError ? "status-error" : "status-active"}`;
  }
  if (stateIcon && icon) stateIcon.textContent = icon;
  if (stateText && text) stateText.textContent = text;
  if (fpsEl && !isError) fpsEl.textContent = `${currentFps} FPS`;
}

/** Hold progress, 0..1, shown as a bar under the HUD state row. */
function setHoldProgress(ratio) {
  const bar = document.getElementById("gesture-hold-progress");
  if (!bar) return;
  const clamped = Math.max(0, Math.min(1, ratio));
  bar.style.transform = `scaleX(${clamped})`;
  bar.parentElement?.classList.toggle("is-active", clamped > 0.01);
}

/** Dwell progress, 0..1, shown as a ring sweeping around the reticle. */
function setDwellProgress(ratio) {
  const ring = document.getElementById("reticle-progress-ring");
  if (!ring) return;
  const clamped = Math.max(0, Math.min(1, ratio));
  // The ring is a conic-gradient; one CSS variable drives the sweep so no
  // per-frame SVG path maths is needed.
  ring.style.setProperty("--dwell", String(clamped));
  ring.classList.toggle("is-filling", clamped > 0.01);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Keeps every filter's assumed sample rate aligned with the real frame rate. */
function syncFilterFrequency(fps) {
  const freq = Math.max(10, Math.min(60, fps));
  for (const f of ALL_FILTERS) f.freq = freq;
}

/** Normalised camera X to screen X, honouring the mirroring preference. */
function toScreenX(normX) {
  return (settings.mirrored ? 1 - normX : normX) * viewportW;
}

function resetContinuousState() {
  prevPalmPos = null;
  prevPinch = null;
  prevTwoHandSpan = null;
  prevTwoHandRoll = null;
  prevScrollY = null;
  palmStillStart = 0;
}

function clearDwell() {
  dwellTarget = null;
  dwellStartTime = 0;
  setDwellProgress(0);
}

function hideReticle() {
  const reticleEl = document.getElementById("gesture-reticle");
  if (reticleEl) {
    reticleEl.classList.add("hidden");
    reticleEl.classList.remove("reticle-locked");
  }
  setDwellProgress(0);
}

function labelFor(action, trans) {
  return trans?.[action.labelKey] || action.fallbackLabel;
}

/**
 * Runs the hold state machine for the active pose and re-arms the rest.
 * Returns true when the frame was consumed by a hold action.
 */
function runHoldActions(stableGesture, timestamp, trans) {
  const action = HOLD_BY_GESTURE.get(stableGesture);

  if (action) {
    const state = holdState.get(action.gesture);
    const threshold = Math.max(120, settings.holdMs * action.holdScale);
    state.lastSeen = timestamp;

    if (!state.start) state.start = timestamp;

    const elapsed = timestamp - state.start;
    if (elapsed >= threshold && !state.fired) {
      state.fired = true;
      setHoldProgress(1);
      const fn = callbacks[action.callback];
      if (typeof fn === "function") fn();
      action.sound?.();
    } else if (!state.fired) {
      setHoldProgress(elapsed / threshold);
    }

    updateHudUI(action.gesture, labelFor(action, trans), action.icon);
  }

  // Re-arm every pose that is no longer held, once its grace window passes.
  // Without the grace period one misclassified frame would let a still-held
  // pose fire a second time.
  for (const [gesture, state] of holdState) {
    if (gesture === stableGesture) continue;
    if (timestamp - state.lastSeen > HOLD_GRACE_MS) {
      state.start = 0;
      state.fired = false;
    }
  }

  if (!action) setHoldProgress(0);
  return Boolean(action);
}

// ---------------------------------------------------------------------------
// Continuous controls
// ---------------------------------------------------------------------------

const SWIPE_VELOCITY = 0.85;
const SWIPE_DISTANCE = 0.04;
const SWIPE_COOLDOWN_MS = 600;
const PALM_STILL_MS = 1200;
const PALM_ORBIT_GAIN = 4.8;
const PINCH_ORBIT_GAIN = 3.2;
const PINCH_ZOOM_GAIN = 18;
const TWO_HAND_ZOOM_GAIN = 25;
const TWO_HAND_ROLL_GAIN = 2.4;
const SCROLL_GAIN = 1400;

function handlePalm(raw, lm, timestamp, trans) {
  hideReticle();
  clearDwell();
  prevPinch = null;

  const rawX = raw.palmCenter ? raw.palmCenter.x : lm[9].x;
  const rawY = raw.palmCenter ? raw.palmCenter.y : lm[9].y;
  const smoothX = palmFilterX.filter(rawX, timestamp);
  const smoothY = palmFilterY.filter(rawY, timestamp);

  if (!prevPalmPos) {
    updateHudUI("palm", trans.palm, "🖐");
    prevPalmPos = { x: smoothX, y: smoothY, t: timestamp };
    return;
  }

  const dx = smoothX - prevPalmPos.x;
  const dy = smoothY - prevPalmPos.y;
  const dt = Math.max(0.001, (timestamp - prevPalmPos.t) / 1000);
  const vx = dx / dt;
  const vy = dy / dt;
  const now = Date.now();
  const canSwipe = now - lastSwipeTime > SWIPE_COOLDOWN_MS;

  const horizontalSwipe =
    Math.abs(vx) > SWIPE_VELOCITY &&
    Math.abs(dx) > SWIPE_DISTANCE &&
    Math.abs(vx) > Math.abs(vy) * 1.2;
  const verticalSwipe =
    Math.abs(vy) > SWIPE_VELOCITY &&
    Math.abs(dy) > SWIPE_DISTANCE &&
    Math.abs(vy) > Math.abs(vx) * 1.2;

  if (canSwipe && horizontalSwipe) {
    lastSwipeTime = now;
    // A mirrored view inverts the horizontal sense of the movement.
    const movedRight = settings.mirrored ? vx < 0 : vx > 0;
    callbacks.onSwipe?.(movedRight ? "right" : "left");
    updateHudUI(
      movedRight ? "swipeRight" : "swipeLeft",
      movedRight ? trans.swipeRight : trans.swipeLeft,
      movedRight ? "👉" : "👈",
    );
  } else if (canSwipe && verticalSwipe) {
    lastSwipeTime = now;
    const up = vy < 0;
    callbacks.onVerticalSwipe?.(up ? "up" : "down");
    updateHudUI(
      up ? "swipeUp" : "swipeDown",
      up
        ? trans.swipeUp || "Yuqoriga siltash • Yaqinlashish"
        : trans.swipeDown || "Pastga siltash • Umumiy ko'rinish",
      up ? "🔼" : "🔽",
    );
  } else {
    const moveDist = Math.hypot(dx, dy);

    if (moveDist < settings.deadzone) {
      // A deliberately still palm resets the view. "Still" is the same
      // threshold that suppresses tremor, so both features agree on it.
      if (!palmStillStart) {
        palmStillStart = timestamp;
        setHoldProgress(0);
      } else {
        const heldFor = timestamp - palmStillStart;
        if (heldFor >= PALM_STILL_MS) {
          callbacks.onOverview?.();
          updateHudUI("overview", trans.overview, "🌌");
          palmStillStart = 0;
          setHoldProgress(0);
        } else {
          setHoldProgress(heldFor / PALM_STILL_MS);
          updateHudUI("palm", trans.palm, "🖐");
        }
      }
    } else {
      palmStillStart = 0;
      setHoldProgress(0);
      const gain = PALM_ORBIT_GAIN * settings.sensitivity;
      const orbitX = settings.mirrored ? dx : -dx;
      callbacks.onOrbit?.(orbitX * gain, dy * gain);
      updateHudUI("palm", trans.palm, "🖐");
    }
  }

  prevPalmPos = { x: smoothX, y: smoothY, t: timestamp };
}

function handlePointing(raw, lm, timestamp, trans) {
  prevPalmPos = null;
  prevPinch = null;
  palmStillStart = 0;
  setHoldProgress(0);

  const reticleEl = document.getElementById("gesture-reticle");
  const reticleLabel = document.getElementById("reticle-target-label");
  const tip = raw.indexTip || lm[8];
  const smoothX = reticleFilterX.filter(tip.x, timestamp);
  const smoothY = reticleFilterY.filter(tip.y, timestamp);

  const screenX = toScreenX(smoothX);
  const screenY = smoothY * viewportH;

  if (reticleEl) {
    reticleEl.classList.remove("hidden");
    reticleEl.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
  }

  let target = null;
  if (callbacks.getReticleTarget) {
    // NDC matching the reticle exactly: X left-to-right, Y bottom-to-top.
    const ndcX = (screenX / viewportW) * 2 - 1;
    const ndcY = -(screenY / viewportH) * 2 + 1;
    target = callbacks.getReticleTarget(ndcX, ndcY);
  }
  currentHoveredTarget = target;

  const title = target?.userData?.title;
  if (!title) {
    clearDwell();
    if (reticleLabel) reticleLabel.textContent = "";
    reticleEl?.classList.remove("reticle-locked");
    updateHudUI("pointing", trans.pointing, "👆");
    return;
  }

  if (reticleLabel) reticleLabel.textContent = title;
  reticleEl?.classList.add("reticle-locked");

  if (dwellTarget !== target) {
    dwellTarget = target;
    dwellStartTime = timestamp;
    setDwellProgress(0);
    playUiHover();
    updateHudUI("pointing", title, "👆");
    return;
  }

  const elapsed = timestamp - dwellStartTime;
  if (elapsed >= settings.dwellMs) {
    callbacks.onSelect?.(target);
    updateHudUI("selected", `${trans.selected}: ${title}`, "🎯");
    clearDwell();
  } else {
    setDwellProgress(elapsed / settings.dwellMs);
    updateHudUI("pointing", `${title}...`, "👆");
  }
}

/**
 * Pinch is the precision controller: horizontal drag orbits, vertical drag
 * zooms, and a quick pinch without travel selects. It used to zoom only, which
 * left no fine-grained way to aim the camera by hand.
 */
function handlePinch(raw, lm, timestamp, trans) {
  prevPalmPos = null;
  palmStillStart = 0;
  clearDwell();
  hideReticle();
  setHoldProgress(0);

  const point = raw.reticle || { x: lm[8].x, y: lm[8].y };
  const smoothX = pinchFilterX.filter(point.x, timestamp);
  const smoothY = pinchFilterY.filter(point.y, timestamp);

  if (prevPinch === null) {
    prevPinch = { x: smoothX, y: smoothY };

    // A fresh pinch is a tap: select whatever sits under it.
    if (Date.now() - lastPinchTriggerTime > 400) {
      lastPinchTriggerTime = Date.now();
      let target = currentHoveredTarget;
      if (!target && callbacks.getReticleTarget) {
        const screenX = toScreenX(smoothX);
        const screenY = smoothY * viewportH;
        target = callbacks.getReticleTarget(
          (screenX / viewportW) * 2 - 1,
          -(screenY / viewportH) * 2 + 1,
        );
      }
      if (target) {
        callbacks.onSelect?.(target);
        updateHudUI(
          "selected",
          `${trans.selected}: ${target.userData?.title || ""}`,
          "🤏",
        );
        return;
      }
    }
    updateHudUI("pinch", trans.pinch, "🤏");
    return;
  }

  const dx = smoothX - prevPinch.x;
  const dy = smoothY - prevPinch.y;
  let acted = false;

  if (Math.abs(dy) > settings.deadzone) {
    callbacks.onZoom?.(dy * PINCH_ZOOM_GAIN * settings.sensitivity);
    prevPinch.y = smoothY;
    acted = true;
  }

  if (Math.abs(dx) > settings.deadzone) {
    const orbitX = settings.mirrored ? dx : -dx;
    callbacks.onOrbit?.(orbitX * PINCH_ORBIT_GAIN * settings.sensitivity, 0);
    prevPinch.x = smoothX;
    acted = true;
  }

  if (acted) updateHudUI("pinch", trans.pinch, "🤏");
}

/**
 * Two hands give two independent axes at once: the distance between the palms
 * zooms, and the angle of the line joining them rolls the camera.
 */
function handleTwoHands(hand1, hand2, timestamp, trans) {
  drawGestureCanvas([hand1, hand2], "zoom");
  hideReticle();
  clearDwell();
  setHoldProgress(0);
  prevPalmPos = null;
  prevPinch = null;

  // Palm centres are far steadier than wrists, which swing as the hand turns.
  const c1 = {
    x: (hand1[0].x + hand1[9].x) / 2,
    y: (hand1[0].y + hand1[9].y) / 2,
  };
  const c2 = {
    x: (hand2[0].x + hand2[9].x) / 2,
    y: (hand2[0].y + hand2[9].y) / 2,
  };

  const rawSpan = Math.hypot(c1.x - c2.x, c1.y - c2.y);
  const rawRoll = Math.atan2(c2.y - c1.y, c2.x - c1.x);
  const span = spanFilter.filter(rawSpan, timestamp);
  const roll = rollFilter.filter(rawRoll, timestamp);

  if (prevTwoHandSpan !== null) {
    const delta = span - prevTwoHandSpan;
    if (Math.abs(delta) > 0.008) {
      callbacks.onZoom?.(delta * TWO_HAND_ZOOM_GAIN * settings.sensitivity);
    }
  }

  if (prevTwoHandRoll !== null && callbacks.onRoll) {
    let dRoll = roll - prevTwoHandRoll;
    // Unwrap across the ±π seam so a hand crossing vertical does not spin the
    // camera a full turn.
    if (dRoll > Math.PI) dRoll -= 2 * Math.PI;
    if (dRoll < -Math.PI) dRoll += 2 * Math.PI;
    if (Math.abs(dRoll) > 0.01) {
      callbacks.onRoll(dRoll * TWO_HAND_ROLL_GAIN * settings.sensitivity);
    }
  }

  prevTwoHandSpan = span;
  prevTwoHandRoll = roll;
  currentGestureState = "zoom";
  updateHudUI("zoom", trans.zoom, "👐");
}

/**
 * Two fingers scroll whichever panel is open, so a visitor who opened the
 * catalog by hand can also read all of it by hand. Held still, the same pose
 * still toggles the tour — the two are told apart by movement, which is what
 * the user is doing anyway.
 */
function handleScroll(lm, timestamp, trans) {
  const midY = (lm[8].y + lm[12].y) / 2;
  const smoothY = scrollFilter.filter(midY, timestamp);

  if (prevScrollY === null) {
    prevScrollY = smoothY;
    return false;
  }

  const dy = smoothY - prevScrollY;
  if (Math.abs(dy) < settings.deadzone * 1.5) return false;

  prevScrollY = smoothY;
  callbacks.onScroll?.(dy * SCROLL_GAIN * settings.sensitivity);
  drawGestureCanvas([lm], "scroll");
  updateHudUI("scroll", trans.scroll || "✌️ • Ro'yxatni aylantirish", "📜");
  return true;
}

// ---------------------------------------------------------------------------
// Frame processing
// ---------------------------------------------------------------------------

function processLandmarks(
  landmarksList,
  handednesses = [],
  timestamp = performance.now(),
) {
  const trans = getTranslations().ui.gestures;

  frameCounter++;
  if (timestamp - lastFpsTime >= 1000) {
    currentFps = Math.round((frameCounter * 1000) / (timestamp - lastFpsTime));
    measuredFps = currentFps || measuredFps;
    syncFilterFrequency(measuredFps);
    lastFpsTime = timestamp;
    frameCounter = 0;
  }

  if (!landmarksList || landmarksList.length === 0) {
    currentGestureState = "none";
    currentHoveredTarget = null;
    drawGestureCanvas(null, "none");
    updateHudUI("none", trans.calibration, "🖐");
    hideReticle();
    resetContinuousState();
    clearDwell();
    resetHoldState();
    setHoldProgress(0);
    return;
  }

  if (landmarksList.length >= 2) {
    handleTwoHands(landmarksList[0], landmarksList[1], timestamp, trans);
    return;
  }

  prevTwoHandSpan = null;
  prevTwoHandRoll = null;

  const lm = landmarksList[0];
  const handednessName = handednesses[0]?.categoryName || "Right";
  const raw = classifyHandGesture(lm, handednessName);
  const stableGesture = stabilizer.update(raw.gesture);
  currentGestureState = stableGesture;
  window.__onGestureRecognized?.(stableGesture);

  if (stableGesture !== "victory") prevScrollY = null;

  // Victory is overloaded: moving vertically scrolls an open panel, holding
  // still toggles the tour. Scrolling is checked first and claims the frame
  // only when the hand is actually travelling.
  if (stableGesture === "victory" && typeof callbacks.onScroll === "function") {
    if (handleScroll(lm, timestamp, trans)) {
      // Treat scrolling as "pose released" so it never accumulates into a
      // tour toggle the visitor did not ask for.
      const state = holdState.get("victory");
      state.start = 0;
      state.fired = false;
      state.lastSeen = timestamp;
      return;
    }
  }

  drawGestureCanvas([lm], stableGesture);

  if (runHoldActions(stableGesture, timestamp, trans)) {
    hideReticle();
    resetContinuousState();
    clearDwell();
    return;
  }

  if (stableGesture === "palm") {
    handlePalm(raw, lm, timestamp, trans);
  } else if (stableGesture === "pointing") {
    handlePointing(raw, lm, timestamp, trans);
  } else if (stableGesture === "pinch") {
    handlePinch(raw, lm, timestamp, trans);
  } else {
    hideReticle();
    resetContinuousState();
    clearDwell();
  }
}

// ---------------------------------------------------------------------------
// MediaPipe lifecycle
// ---------------------------------------------------------------------------

const LANDMARKER_OPTIONS = {
  runningMode: "VIDEO",
  numHands: 2,
  // Raised from 0.5: a higher bar costs a little reach but removes the
  // phantom hands that fired actions when nothing was in frame.
  minHandDetectionConfidence: 0.6,
  minHandPresenceConfidence: 0.6,
  minTrackingConfidence: 0.55,
};

async function loadVisionTasks() {
  if (landmarkerInstance) return landmarkerInstance;

  const vision = await import("@mediapipe/tasks-vision");
  const filesetResolver =
    await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");

  const create = (delegate) =>
    vision.HandLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: "/mediapipe/hand_landmarker.task",
        delegate,
      },
      ...LANDMARKER_OPTIONS,
    });

  try {
    landmarkerInstance = await create("GPU");
  } catch (gpuErr) {
    console.warn("GPU delegate failed, falling back to CPU:", gpuErr);
    landmarkerInstance = await create("CPU");
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
    refreshViewport();

    try {
      await loadVisionTasks();
    } catch (modelErr) {
      console.error("Failed to load vision model:", modelErr);
      updateHudUI("error", trans.errorWasm, "⚠️", true);
      return false;
    }

    // 640x480 rather than the previous 320x240. Landmark accuracy scales with
    // the pixels the model actually sees, and fingertip error at QVGA was the
    // dominant source of pinch and pointing drift. These are hints, so a
    // webcam that cannot deliver them returns its closest mode instead.
    gestureStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640, min: 320 },
        height: { ideal: 480, min: 240 },
        frameRate: { ideal: 30, max: 60 },
        facingMode: "user",
      },
      audio: false,
    });

    if (video) {
      video.srcObject = gestureStream;
      await video.play();
    }

    isGestureActive = true;
    if (toggleBtn) {
      toggleBtn.classList.add("active");
      toggleBtn.setAttribute("aria-pressed", "true");
    }
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

    if (toggleBtn) {
      toggleBtn.classList.remove("active");
      toggleBtn.setAttribute("aria-pressed", "false");
    }
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

  // Detaching the stream as well as stopping the tracks is what actually
  // clears the browser's camera-in-use indicator.
  const video = document.getElementById("gesture-video");
  if (video) video.srcObject = null;

  const hud = document.getElementById("gesture-hud");
  if (hud) {
    hud.classList.add("hidden");
    hud.style.display = "none";
  }

  hideReticle();
  setHoldProgress(0);

  const toggleBtn = document.getElementById("gesture-toggle-btn");
  if (toggleBtn) {
    toggleBtn.classList.remove("active");
    toggleBtn.setAttribute("aria-pressed", "false");
  }

  resetContinuousState();
  clearDwell();
  resetHoldState();
  currentHoveredTarget = null;
  currentGestureState = "none";

  stabilizer.reset();
  for (const f of ALL_FILTERS) f.reset();

  playUiClose();
}

export function toggleGestureControl() {
  if (isGestureActive) {
    stopGestureControl();
    return false;
  }

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
        // Consent still applies to this page view, just not the next one.
      }
      consentModal.classList.add("hidden");
      startGestureControl();
    });
  }

  if (consentDenyBtn && consentModal) {
    consentDenyBtn.addEventListener("click", () => {
      consentModal.classList.add("hidden");
      gestureToggleBtn?.classList.remove("active");
    });
  }

  if (gestureToggleBtn) {
    gestureToggleBtn.setAttribute("aria-pressed", "false");
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

  // Test injection hook for E2E and visual tests.
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

/** The pose vocabulary, for the guide and the HUD cheat sheet. */
export const GESTURE_ACTIONS = HOLD_ACTIONS.map((a) => ({
  gesture: a.gesture,
  icon: a.icon,
  labelKey: a.labelKey,
  fallbackLabel: a.fallbackLabel,
}));

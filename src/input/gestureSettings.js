/**
 * Persisted, user-adjustable tuning for hand control.
 *
 * Hand control used to ship with every threshold hardcoded, which meant a
 * visitor whose webcam, lighting or reach did not match the author's had no
 * way to make it usable. These values are the few that genuinely differ
 * between people and rooms, so they are exposed in the HUD and remembered.
 */

const STORAGE_KEY = "gesture_settings_v2";

export const SETTING_LIMITS = {
  // Multiplier on every positional delta: orbit, zoom, scroll.
  sensitivity: { min: 0.3, max: 2.5, step: 0.1, default: 1 },
  // How long the reticle must rest on a target before it is selected.
  dwellMs: { min: 250, max: 1500, step: 50, default: 550 },
  // How long a static pose must be held before it fires its action.
  holdMs: { min: 200, max: 1200, step: 50, default: 400 },
  // Minimum normalised movement per frame that counts as intent, not tremor.
  deadzone: { min: 0.001, max: 0.02, step: 0.001, default: 0.0035 },
};

const DEFAULTS = Object.freeze({
  sensitivity: SETTING_LIMITS.sensitivity.default,
  dwellMs: SETTING_LIMITS.dwellMs.default,
  holdMs: SETTING_LIMITS.holdMs.default,
  deadzone: SETTING_LIMITS.deadzone.default,
  // Webcams present a mirrored view. True matches a normal selfie camera;
  // false is for the rare pass-through or external capture setup.
  mirrored: true,
  // Draw the skeleton overlay. Off saves a little per-frame canvas work.
  showSkeleton: true,
});

function clampNumber(value, limits, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, n));
}

function sanitize(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULTS };
  return {
    sensitivity: clampNumber(
      raw.sensitivity,
      SETTING_LIMITS.sensitivity,
      DEFAULTS.sensitivity,
    ),
    dwellMs: Math.round(
      clampNumber(raw.dwellMs, SETTING_LIMITS.dwellMs, DEFAULTS.dwellMs),
    ),
    holdMs: Math.round(
      clampNumber(raw.holdMs, SETTING_LIMITS.holdMs, DEFAULTS.holdMs),
    ),
    deadzone: clampNumber(
      raw.deadzone,
      SETTING_LIMITS.deadzone,
      DEFAULTS.deadzone,
    ),
    mirrored:
      typeof raw.mirrored === "boolean" ? raw.mirrored : DEFAULTS.mirrored,
    showSkeleton:
      typeof raw.showSkeleton === "boolean"
        ? raw.showSkeleton
        : DEFAULTS.showSkeleton,
  };
}

let settings = (() => {
  try {
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    // Private mode, blocked storage, or corrupt JSON: defaults are fine.
    return { ...DEFAULTS };
  }
})();

const listeners = new Set();

export function getGestureSettings() {
  return { ...settings };
}

export function onGestureSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setGestureSettings(patch) {
  settings = sanitize({ ...settings, ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not persisting is acceptable; the session still honours the change.
  }
  for (const fn of listeners) fn({ ...settings });
  return { ...settings };
}

export function resetGestureSettings() {
  return setGestureSettings({ ...DEFAULTS });
}

export { DEFAULTS as GESTURE_SETTING_DEFAULTS };

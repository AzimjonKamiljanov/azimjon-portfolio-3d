/**
 * Wires the hand-control calibration panel in the gesture HUD.
 *
 * The sliders exist because fixed thresholds cannot work for everyone: a
 * 720p webcam in a bright room and a noisy laptop camera in the evening
 * produce very different landmark jitter, and reach differs per person. Rather
 * than guess, the four values that matter are adjustable and remembered.
 */

import {
  getGestureSettings,
  setGestureSettings,
  resetGestureSettings,
  onGestureSettingsChange,
} from "../input/gestureSettings.js";
import { playUiClick } from "../audio/soundscape.js";

const CONTROLS = [
  {
    key: "sensitivity",
    input: "gs-sensitivity",
    output: "gs-sensitivity-out",
    format: (v) => Number(v).toFixed(1),
    parse: Number,
  },
  {
    key: "dwellMs",
    input: "gs-dwell",
    output: "gs-dwell-out",
    format: (v) => `${Math.round(v)} ms`,
    parse: (v) => Math.round(Number(v)),
  },
  {
    key: "holdMs",
    input: "gs-hold",
    output: "gs-hold-out",
    format: (v) => `${Math.round(v)} ms`,
    parse: (v) => Math.round(Number(v)),
  },
  {
    key: "deadzone",
    input: "gs-deadzone",
    output: "gs-deadzone-out",
    format: (v) => Number(v).toFixed(4),
    parse: Number,
  },
];

const TOGGLES = [
  { key: "mirrored", input: "gs-mirrored" },
  { key: "showSkeleton", input: "gs-skeleton" },
];

/** Pushes current settings into the widgets, without re-firing change events. */
function syncFromSettings(settings) {
  for (const control of CONTROLS) {
    const input = document.getElementById(control.input);
    const output = document.getElementById(control.output);
    const value = settings[control.key];
    if (input) input.value = String(value);
    if (output) output.textContent = control.format(value);
  }

  for (const toggle of TOGGLES) {
    const input = document.getElementById(toggle.input);
    if (input) input.checked = Boolean(settings[toggle.key]);
  }
}

export function initGestureSettingsPanel() {
  const toggleBtn = document.getElementById("gesture-settings-toggle");
  const panel = document.getElementById("gesture-settings-panel");
  const resetBtn = document.getElementById("gs-reset");

  if (!panel) return { open: () => {}, close: () => {} };

  syncFromSettings(getGestureSettings());
  // Keep the widgets honest if anything changes the settings elsewhere.
  onGestureSettingsChange(syncFromSettings);

  const setOpen = (open) => {
    panel.classList.toggle("hidden", !open);
    toggleBtn?.setAttribute("aria-expanded", String(open));
    toggleBtn?.classList.toggle("is-open", open);
  };

  toggleBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    playUiClick();
    setOpen(panel.classList.contains("hidden"));
  });

  for (const control of CONTROLS) {
    const input = document.getElementById(control.input);
    const output = document.getElementById(control.output);
    if (!input) continue;

    input.addEventListener("input", () => {
      const parsed = control.parse(input.value);
      // Update the readout from the raw input for immediate feedback, then let
      // the store clamp and broadcast the authoritative value.
      if (output) output.textContent = control.format(parsed);
      setGestureSettings({ [control.key]: parsed });
    });
  }

  for (const toggle of TOGGLES) {
    const input = document.getElementById(toggle.input);
    input?.addEventListener("change", () => {
      playUiClick();
      setGestureSettings({ [toggle.key]: input.checked });
    });
  }

  resetBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    playUiClick();
    syncFromSettings(resetGestureSettings());
  });

  // Clicking inside the panel must not reach the canvas behind it, or dragging
  // a slider would also orbit the camera.
  panel.addEventListener("pointerdown", (e) => e.stopPropagation());
  panel.addEventListener("click", (e) => e.stopPropagation());

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
  };
}

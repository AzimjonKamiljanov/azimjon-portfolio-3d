import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The calibration store is the only thing standing between a slider and the
 * gesture frame loop, so it has to clamp. A sensitivity of 50 or a negative
 * deadzone would make hand control unusable with no way back except clearing
 * site data.
 */

function freshStore() {
  // Each case needs a module instance that re-reads storage.
  vi.resetModules();
  return import("../src/input/gestureSettings.js");
}

beforeEach(() => {
  const store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  });
});

describe("gesture settings store", () => {
  it("starts from the documented defaults", async () => {
    const { getGestureSettings, GESTURE_SETTING_DEFAULTS } = await freshStore();
    expect(getGestureSettings()).toEqual(GESTURE_SETTING_DEFAULTS);
  });

  it("clamps values above the allowed range", async () => {
    const { setGestureSettings, SETTING_LIMITS } = await freshStore();
    const next = setGestureSettings({ sensitivity: 99, dwellMs: 999999 });
    expect(next.sensitivity).toBe(SETTING_LIMITS.sensitivity.max);
    expect(next.dwellMs).toBe(SETTING_LIMITS.dwellMs.max);
  });

  it("clamps values below the allowed range", async () => {
    const { setGestureSettings, SETTING_LIMITS } = await freshStore();
    const next = setGestureSettings({ sensitivity: -5, deadzone: -1 });
    expect(next.sensitivity).toBe(SETTING_LIMITS.sensitivity.min);
    expect(next.deadzone).toBe(SETTING_LIMITS.deadzone.min);
  });

  it("falls back to the default for a non-numeric value", async () => {
    const { setGestureSettings, GESTURE_SETTING_DEFAULTS } = await freshStore();
    const next = setGestureSettings({ sensitivity: "fast", holdMs: NaN });
    expect(next.sensitivity).toBe(GESTURE_SETTING_DEFAULTS.sensitivity);
    expect(next.holdMs).toBe(GESTURE_SETTING_DEFAULTS.holdMs);
  });

  it("keeps booleans boolean", async () => {
    const { setGestureSettings } = await freshStore();
    expect(setGestureSettings({ mirrored: "yes" }).mirrored).toBe(true);
    expect(setGestureSettings({ mirrored: false }).mirrored).toBe(false);
  });

  it("notifies subscribers with the clamped value, not the raw one", async () => {
    const { setGestureSettings, onGestureSettingsChange, SETTING_LIMITS } =
      await freshStore();
    const seen = [];
    onGestureSettingsChange((s) => seen.push(s.sensitivity));

    setGestureSettings({ sensitivity: 99 });

    expect(seen).toEqual([SETTING_LIMITS.sensitivity.max]);
  });

  it("persists across a reload", async () => {
    const first = await freshStore();
    first.setGestureSettings({ sensitivity: 1.8, mirrored: false });

    const second = await freshStore();
    expect(second.getGestureSettings()).toMatchObject({
      sensitivity: 1.8,
      mirrored: false,
    });
  });

  it("ignores corrupt stored JSON instead of throwing", async () => {
    localStorage.setItem("gesture_settings_v2", "{not json");
    const { getGestureSettings, GESTURE_SETTING_DEFAULTS } = await freshStore();
    expect(getGestureSettings()).toEqual(GESTURE_SETTING_DEFAULTS);
  });

  it("survives storage being unavailable", async () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    });

    const { getGestureSettings, setGestureSettings } = await freshStore();
    expect(() => setGestureSettings({ sensitivity: 2 })).not.toThrow();
    expect(getGestureSettings().sensitivity).toBe(2);
  });

  it("restores every default on reset", async () => {
    const {
      setGestureSettings,
      resetGestureSettings,
      GESTURE_SETTING_DEFAULTS,
    } = await freshStore();
    setGestureSettings({ sensitivity: 2.4, dwellMs: 1200, mirrored: false });
    expect(resetGestureSettings()).toEqual(GESTURE_SETTING_DEFAULTS);
  });
});

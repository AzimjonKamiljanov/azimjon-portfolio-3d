import { describe, it, expect } from "vitest";
import {
  choosePixelRatio,
  pickBudget,
  DEFAULT_PIXEL_BUDGET,
  MOBILE_PIXEL_BUDGET,
} from "../src/scene/pixelBudget.js";

/**
 * The renderer used to choose its pixel ratio from `innerWidth <= 768`, which
 * asks the wrong question: fill rate follows the total pixel count, not the
 * width. A 1024-wide window at DPR 2 on a tall display came to 9.1 megapixels
 * and measured 16 FPS on real hardware. These tests pin the budget that
 * replaced it.
 */

const pixels = (w, h, ratio) => w * ratio * (h * ratio);

describe("choosePixelRatio", () => {
  it("keeps a tall 1024-wide window inside the budget", () => {
    // The exact case that measured 16 FPS: DPR 2 gave 2048x4436.
    const ratio = choosePixelRatio({
      width: 1024,
      height: 2218,
      dpr: 2,
      budget: DEFAULT_PIXEL_BUDGET,
    });

    expect(ratio).toBeLessThan(2);
    expect(pixels(1024, 2218, ratio)).toBeLessThanOrEqual(
      DEFAULT_PIXEL_BUDGET * 1.01,
    );
  });

  it("never asks for more than the display actually has", () => {
    // A small window on a 1x display must not be upscaled to fill the budget.
    const ratio = choosePixelRatio({ width: 800, height: 600, dpr: 1 });
    expect(ratio).toBe(1);
  });

  it("honours a retina display when the window is small enough", () => {
    // 800x600 at DPR 2 is 1.92 MP, comfortably inside the 2.1 MP budget.
    expect(choosePixelRatio({ width: 800, height: 600, dpr: 2 })).toBe(2);
  });

  it("trims only slightly when a window is just over the budget", () => {
    // 900x600 at DPR 2 is 2.16 MP — a little past the budget, so the ratio
    // should come down a little, not collapse to a step like 1.5.
    const ratio = choosePixelRatio({ width: 900, height: 600, dpr: 2 });
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2);
  });

  it("caps at maxRatio even on a 3x display with room to spare", () => {
    const ratio = choosePixelRatio({ width: 400, height: 400, dpr: 3 });
    expect(ratio).toBe(2);
  });

  it("stops falling at minRatio rather than turning the image to mush", () => {
    const ratio = choosePixelRatio({
      width: 7680,
      height: 4320,
      dpr: 2,
      minRatio: 0.75,
    });
    expect(ratio).toBe(0.75);
  });

  it("gives a phone a usable ratio under the mobile budget", () => {
    const ratio = choosePixelRatio({
      width: 390,
      height: 844,
      dpr: 3,
      budget: MOBILE_PIXEL_BUDGET,
    });
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThanOrEqual(2);
    expect(pixels(390, 844, ratio)).toBeLessThanOrEqual(
      MOBILE_PIXEL_BUDGET * 1.01,
    );
  });

  it("treats a missing or nonsensical dpr as 1", () => {
    expect(choosePixelRatio({ width: 800, height: 600, dpr: undefined })).toBe(
      1,
    );
    expect(choosePixelRatio({ width: 800, height: 600, dpr: 0 })).toBe(1);
    expect(choosePixelRatio({ width: 800, height: 600, dpr: NaN })).toBe(1);
  });

  it("does not divide by zero on a collapsed viewport", () => {
    const ratio = choosePixelRatio({ width: 0, height: 0, dpr: 2 });
    expect(Number.isFinite(ratio)).toBe(true);
    expect(ratio).toBeGreaterThan(0);
  });
});

describe("pickBudget", () => {
  it("uses the phone budget for a narrow touch screen", () => {
    expect(pickBudget({ width: 390, coarsePointer: true })).toBe(
      MOBILE_PIXEL_BUDGET,
    );
  });

  it("gives a tablet the desktop budget", () => {
    // Tablets have the thermal headroom; the old width-only rule under-served
    // them whenever they were narrower than 768.
    expect(pickBudget({ width: 1024, coarsePointer: true })).toBe(
      DEFAULT_PIXEL_BUDGET,
    );
  });

  it("does not penalise a narrow desktop window", () => {
    // A 700px browser window on a desktop is not a phone.
    expect(pickBudget({ width: 700, coarsePointer: false })).toBe(
      DEFAULT_PIXEL_BUDGET,
    );
  });
});

import { test, expect } from "@playwright/test";
import { CANVAS_TIMEOUT } from "./helpers/timeouts.js";

/**
 * Regression test for a bug the unit tests could not catch.
 *
 * choosePixelRatio() was correct and covered, and setup.js applied it
 * correctly at startup — but onWindowResize() in main.js carried its own copy
 * of the old width-based rule and silently overrode the budget. A 1600x857
 * viewport at DPR 2 rendered 1980x1060 (2.1 MP) on load and jumped back to
 * 3200x1714 (5.5 MP) the moment the window resized.
 *
 * The defect lived in the seam between two modules, so it needs a test that
 * drives the real page through a real resize.
 */

const BUDGET_PIXELS = 2_100_000;
// The implementation stops reducing at minRatio, so a very large viewport may
// sit slightly over budget by design. A small tolerance keeps the test honest
// without re-implementing the formula.
const TOLERANCE = 1.05;

async function canvasPixels(page) {
  return page.evaluate(() => {
    const c = document.querySelector("#canvas-container canvas");
    return c ? { w: c.width, h: c.height, pixels: c.width * c.height } : null;
  });
}

test.describe("Renderer pixel budget", () => {
  test.use({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });

  test("stays within budget on load at DPR 2", async ({ page }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    const canvas = await canvasPixels(page);
    expect(canvas).not.toBeNull();
    expect(canvas.pixels).toBeLessThanOrEqual(BUDGET_PIXELS * TOLERANCE);
  });

  test("stays within budget after a resize", async ({ page }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    const before = await canvasPixels(page);

    // The exact trigger that used to reinstate the full device ratio.
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.waitForTimeout(600);
    const afterShrink = await canvasPixels(page);

    await page.setViewportSize({ width: 1800, height: 1000 });
    await page.waitForTimeout(600);
    const afterGrow = await canvasPixels(page);

    for (const [label, c] of [
      ["on load", before],
      ["after shrinking", afterShrink],
      ["after growing", afterGrow],
    ]) {
      expect(
        c.pixels,
        `${label}: ${c.w}x${c.h} = ${(c.pixels / 1e6).toFixed(2)} MP`,
      ).toBeLessThanOrEqual(BUDGET_PIXELS * TOLERANCE);
    }
  });

  test("still fills the viewport in CSS pixels", async ({ page }) => {
    // Lowering the drawing buffer must not shrink the visible canvas: the
    // scene has to keep covering the window, just at fewer samples.
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    const fit = await page.evaluate(() => {
      const c = document.querySelector("#canvas-container canvas");
      const r = c.getBoundingClientRect();
      return {
        widthGap: Math.abs(r.width - window.innerWidth),
        heightGap: Math.abs(r.height - window.innerHeight),
      };
    });

    expect(fit.widthGap).toBeLessThanOrEqual(2);
    expect(fit.heightGap).toBeLessThanOrEqual(2);
  });
});

test.describe("Renderer pixel budget at DPR 1", () => {
  test.use({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });

  test("does not downscale a viewport that already fits", async ({ page }) => {
    // The budget is a ceiling, not a target: where the old rule was already
    // fine, nothing should change.
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    const canvas = await canvasPixels(page);
    expect(canvas.w).toBe(1366);
    expect(canvas.h).toBe(768);
  });
});

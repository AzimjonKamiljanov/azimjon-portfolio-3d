import { test, expect } from "@playwright/test";
import { CANVAS_TIMEOUT } from "./helpers/timeouts.js";

test.describe("Photorealistic Deep-Space Visual Regression & Luminance Verification @visual", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => {
      localStorage.setItem("solar_guide_v2_dismissed", "true");
      localStorage.setItem("solar_guide_dismissed", "true");
      window.sessionStorage.setItem("gesture_consent_granted", "true");
    });
  });

  test("1. Deep space background sky patch sRGB is strictly < 8/255", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });
    await page.waitForTimeout(2500);

    const skyMean = await page.evaluate(() => {
      if (window.__solarEngine && window.__solarEngine.composer) {
        window.__solarEngine.composer.render();
      }
      const renderer = window.__renderer;
      if (!renderer) return 999;
      const gl = renderer.getContext();
      const w = 60,
        h = 60;
      const pixels = new Uint8Array(w * h * 4);
      // Read 60x60 pixels from top-right corner far away from center Sun
      gl.readPixels(
        gl.drawingBufferWidth - 80,
        gl.drawingBufferHeight - 80,
        w,
        h,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );

      let sum = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      }
      return sum / (w * h);
    });

    expect(skyMean).toBeLessThan(8.0);
  });

  test("2. Sun core photosphere produces high luminance (> 200/255)", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });
    await page.waitForTimeout(2500);

    // Focus on Sun
    await page.evaluate(() => {
      if (window.__solarEngine && window.__solarEngine.focusTargetById) {
        window.__solarEngine.focusTargetById("sun");
      }
    });
    await page.waitForTimeout(1500);

    const sunCoreBrightness = await page.evaluate(() => {
      if (window.__solarEngine && window.__solarEngine.composer) {
        window.__solarEngine.composer.render();
      }
      const renderer = window.__renderer;
      if (!renderer) return 0;
      const gl = renderer.getContext();
      const cx = Math.floor(gl.drawingBufferWidth / 2);
      const cy = Math.floor(gl.drawingBufferHeight / 2);
      const pixels = new Uint8Array(20 * 20 * 4);
      gl.readPixels(
        cx - 10,
        cy - 10,
        20,
        20,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );

      let maxLuma = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const luma =
          pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
        if (luma > maxLuma) maxLuma = luma;
      }
      return maxLuma;
    });

    expect(sunCoreBrightness).toBeGreaterThan(200);
  });

  test("3. Captures screenshots for visual documentation (Overview, Sun, Earth, Saturn)", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });
    await page.waitForTimeout(2500);

    // 1. Solar Overview
    await page.screenshot({
      path: "docs/screenshots/deep_space_realism_1920.png",
    });

    // 2. Earth Focus
    await page.evaluate(() => {
      if (window.__solarEngine && window.__solarEngine.focusTargetById) {
        window.__solarEngine.focusTargetById("Earth");
      }
    });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: "docs/screenshots/earth_moon_realism.png" });

    // 3. Saturn Focus
    await page.evaluate(() => {
      if (window.__solarEngine && window.__solarEngine.focusTargetById) {
        window.__solarEngine.focusTargetById("Saturn");
      }
    });
    await page.waitForTimeout(1800);
    await page.screenshot({
      path: "docs/screenshots/saturn_rings_realism.png",
    });
  });
});

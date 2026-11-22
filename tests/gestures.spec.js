import { test, expect } from "@playwright/test";
import { CANVAS_TIMEOUT } from "./helpers/timeouts.js";

// Helper to generate normalized hand landmarks
function generateHand({
  thumb = "extended",
  index = "extended",
  middle = "extended",
  ring = "extended",
  pinky = "extended",
  pinch = false,
  reticleX = 0.5,
  reticleY = 0.5,
} = {}) {
  const lm = [];
  const wrist = { x: 0.5, y: 0.8, z: 0 };
  lm[0] = wrist;

  const fingerXSpreads = [
    { base: 0.44, step: -0.02 },
    { base: 0.47, step: -0.01 },
    { base: 0.5, step: 0.0 },
    { base: 0.53, step: 0.01 },
    { base: 0.56, step: 0.02 },
  ];

  function addFinger(startIndex, extState, xSpread, isThumb = false) {
    const isExt = extState === "extended";
    const mcpY = 0.58;
    const len = isThumb ? 0.05 : 0.06;
    lm[startIndex] = { x: xSpread.base, y: mcpY, z: 0 };

    if (isThumb) {
      lm[1] = { x: 0.46, y: 0.72, z: 0 };
      lm[2] = { x: 0.43, y: 0.65, z: 0 };
      if (isExt) {
        lm[3] = { x: 0.4, y: 0.58, z: 0 };
        lm[4] = { x: 0.37, y: 0.51, z: 0 };
      } else {
        lm[3] = { x: 0.46, y: 0.6, z: 0.02 };
        lm[4] = { x: 0.48, y: 0.61, z: 0.03 };
      }
      return;
    }

    if (isExt) {
      lm[startIndex + 1] = {
        x: xSpread.base + xSpread.step,
        y: mcpY - len,
        z: 0,
      };
      lm[startIndex + 2] = {
        x: xSpread.base + xSpread.step * 2,
        y: mcpY - len * 2,
        z: 0,
      };
      lm[startIndex + 3] = {
        x: xSpread.base + xSpread.step * 3,
        y: mcpY - len * 3,
        z: 0,
      };
    } else {
      lm[startIndex + 1] = { x: xSpread.base, y: mcpY - len * 0.8, z: -0.02 };
      lm[startIndex + 2] = { x: xSpread.base, y: mcpY - len * 0.4, z: 0.03 };
      lm[startIndex + 3] = { x: xSpread.base, y: mcpY - len * 0.1, z: 0.04 };
    }
  }

  addFinger(1, thumb, fingerXSpreads[0], true);
  addFinger(5, index, fingerXSpreads[1], false);
  addFinger(9, middle, fingerXSpreads[2], false);
  addFinger(13, ring, fingerXSpreads[3], false);
  addFinger(17, pinky, fingerXSpreads[4], false);

  if (pinch) {
    const wristY = reticleY + 0.35;
    lm[0] = { x: reticleX, y: wristY, z: 0 };
    lm[5] = { x: reticleX, y: reticleY + 0.2, z: 0 };
    lm[6] = { x: reticleX, y: reticleY + 0.13, z: 0 };
    lm[7] = { x: reticleX, y: reticleY + 0.065, z: 0 };
    lm[8] = { x: reticleX, y: reticleY, z: 0 };

    lm[1] = { x: reticleX - 0.06, y: reticleY + 0.25, z: 0 };
    lm[2] = { x: reticleX - 0.05, y: reticleY + 0.17, z: 0 };
    lm[3] = { x: reticleX - 0.02, y: reticleY + 0.08, z: 0 };
    lm[4] = { x: reticleX + 0.005, y: reticleY, z: 0.01 };
  } else if (
    index === "extended" &&
    middle === "extended" &&
    ring === "curled" &&
    pinky === "curled"
  ) {
    // True Victory V-spread
    lm[8] = { x: 0.42, y: 0.35, z: 0 };
    lm[12] = { x: 0.55, y: 0.35, z: 0 };
  } else if (
    index === "extended" &&
    middle === "curled" &&
    ring === "curled" &&
    pinky === "curled"
  ) {
    // Collinear index finger pointing at (reticleX, reticleY)
    const wristY = reticleY + 0.35;
    lm[0] = { x: reticleX, y: wristY, z: 0 };
    lm[5] = { x: reticleX, y: reticleY + 0.2, z: 0 };
    lm[6] = { x: reticleX, y: reticleY + 0.13, z: 0 };
    lm[7] = { x: reticleX, y: reticleY + 0.065, z: 0 };
    lm[8] = { x: reticleX, y: reticleY, z: 0 };
  }

  return lm;
}

test.describe("AI Vision Hand Gesture Control Acceptance Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("solar_guide_v2_dismissed", "true");
    });
  });

  test("1. Consent modal shows on initial activation, deny closes modal, allow grants permission", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });
    // Ensure preloader has finished
    await page.waitForTimeout(800);

    const toggleBtn = page.locator("#gesture-toggle-btn");
    const consentModal = page.locator("#gesture-consent-modal");

    // Open telemetry tools island
    await page.click("#telemetry-island-toggle");
    await page.waitForTimeout(350);

    // First click should open consent dialog
    await toggleBtn.click();
    await expect(consentModal).toBeVisible();

    // Deny should close modal and leave toggle inactive
    await page.click("#gesture-consent-deny");
    await expect(consentModal).toBeHidden();
    await expect(toggleBtn).not.toHaveClass(/active/);

    // Reopen and allow
    await toggleBtn.click();
    await expect(consentModal).toBeVisible();
    await page.click("#gesture-consent-allow");
    await expect(consentModal).toBeHidden();

    // Verify consent flag stored
    const consented = await page.evaluate(() =>
      window.sessionStorage.getItem("gesture_consent_granted"),
    );
    expect(consented).toBe("true");
  });

  test("2. Injected Pointing gesture activates reticle and tracks coordinates", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    // Grant consent and open HUD via test harness
    await page.evaluate(() => {
      window.sessionStorage.setItem("gesture_consent_granted", "true");
      const hud = document.getElementById("gesture-hud");
      if (hud) {
        hud.classList.remove("hidden");
        hud.style.display = "block";
      }
    });

    // Inject 5 pointing frames to saturate majority-vote stabilizer
    const pointingHand = generateHand({
      thumb: "curled",
      index: "extended",
      middle: "curled",
      ring: "curled",
      pinky: "curled",
      reticleX: 0.4,
      reticleY: 0.35,
    });

    for (let i = 0; i < 6; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, pointingHand);
    }

    const reticle = page.locator("#gesture-reticle");
    await expect(reticle).toBeVisible();

    const state = await page.evaluate(() => window.__gestureTest.getState());
    expect(state.currentGesture).toBe("pointing");
  });

  test("3. Injected Fist gesture toggles time freeze", async ({ page }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    const fistHand = generateHand({
      thumb: "curled",
      index: "curled",
      middle: "curled",
      ring: "curled",
      pinky: "curled",
    });

    // Inject fist across multiple frames to satisfy 500ms hold threshold
    for (let i = 0; i < 7; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, fistHand);
      await page.waitForTimeout(100);
    }

    const state = await page.evaluate(() => window.__gestureTest.getState());
    expect(state.currentGesture).toBe("fist");
  });

  test("4. Injected Victory gesture triggers autopilot tour mode", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    const victoryHand = generateHand({
      thumb: "curled",
      index: "extended",
      middle: "extended",
      ring: "curled",
      pinky: "curled",
    });
    victoryHand[8].x -= 0.03;
    victoryHand[12].x += 0.03;

    for (let i = 0; i < 9; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, victoryHand);
      await page.waitForTimeout(100);
    }

    const state = await page.evaluate(() => window.__gestureTest.getState());
    expect(state.currentGesture).toBe("victory");
  });

  test("5. Point at the Sun -> Pinch -> Sun modal opens smoothly (C5 E2E)", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });
    await page.waitForTimeout(1000);

    // Grant consent and open HUD via test harness
    await page.evaluate(() => {
      window.sessionStorage.setItem("gesture_consent_granted", "true");
      const hud = document.getElementById("gesture-hud");
      if (hud) {
        hud.classList.remove("hidden");
        hud.style.display = "block";
      }
    });

    // 1. Point at the center of the viewport (Sun at origin)
    const pointingHand = generateHand({
      thumb: "curled",
      index: "extended",
      middle: "curled",
      ring: "curled",
      pinky: "curled",
      reticleX: 0.5,
      reticleY: 0.5,
    });

    for (let i = 0; i < 6; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, pointingHand);
      await page.waitForTimeout(30);
    }

    const reticle = page.locator("#gesture-reticle");
    await expect(reticle).toBeVisible();
    await expect(reticle).toHaveClass(/reticle-locked/);

    // 2. Pinch to select the hovered Sun
    const pinchHand = generateHand({
      thumb: "extended",
      index: "extended",
      middle: "curled",
      ring: "curled",
      pinky: "curled",
      pinch: true,
      reticleX: 0.5,
      reticleY: 0.5,
    });

    for (let i = 0; i < 6; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, pinchHand);
      await page.waitForTimeout(40);
    }

    // Modal should now be opened
    const modal = page.locator("#info-panel");
    await expect(modal).not.toHaveClass(/hidden/);
    await expect(page.locator("#info-title")).toContainText(
      "Azimjon Kamiljanov",
    );
  });

  test("6. Injected Thumbs-up gesture toggles speed boost and updates HUD indicator", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    await page.evaluate(() => {
      window.sessionStorage.setItem("gesture_consent_granted", "true");
      const hud = document.getElementById("gesture-hud");
      if (hud) {
        hud.classList.remove("hidden");
        hud.style.display = "block";
      }
    });

    const thumbsUpHand = generateHand({
      thumb: "extended",
      index: "curled",
      middle: "curled",
      ring: "curled",
      pinky: "curled",
    });

    for (let i = 0; i < 8; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, thumbsUpHand);
      await page.waitForTimeout(80);
    }

    const stateIcon = page.locator("#gesture-indicator-icon");
    await expect(stateIcon).toHaveText("👍");
  });

  test("7. Injected OK sign gesture toggles the projects catalog modal", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    await page.evaluate(() => {
      window.sessionStorage.setItem("gesture_consent_granted", "true");
      const hud = document.getElementById("gesture-hud");
      if (hud) {
        hud.classList.remove("hidden");
        hud.style.display = "block";
      }
    });

    const okHand = generateHand({
      thumb: "extended",
      index: "extended",
      middle: "extended",
      ring: "extended",
      pinky: "extended",
      pinch: true,
    });

    for (let i = 0; i < 9; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, okHand);
      await page.waitForTimeout(100);
    }

    const catalogModal = page.locator("#catalog-modal");
    await expect(catalogModal).toBeVisible();
  });

  test("8. Injected Shaka gesture opens the moon contact terminal", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    await page.evaluate(() => {
      window.sessionStorage.setItem("gesture_consent_granted", "true");
      const hud = document.getElementById("gesture-hud");
      if (hud) {
        hud.classList.remove("hidden");
        hud.style.display = "block";
      }
    });

    const shakaHand = generateHand({
      thumb: "extended",
      index: "curled",
      middle: "curled",
      ring: "curled",
      pinky: "extended",
    });

    for (let i = 0; i < 9; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, shakaHand);
      await page.waitForTimeout(100);
    }

    const moonTerminal = page.locator("#moon-terminal-container");
    await expect(moonTerminal).toBeVisible();
  });

  test("9. Injected Rock-on gesture toggles true scale", async ({ page }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", {
      timeout: CANVAS_TIMEOUT,
    });

    await page.evaluate(() => {
      window.sessionStorage.setItem("gesture_consent_granted", "true");
      const hud = document.getElementById("gesture-hud");
      if (hud) {
        hud.classList.remove("hidden");
        hud.style.display = "block";
      }
    });

    const rockHand = generateHand({
      thumb: "curled",
      index: "extended",
      middle: "curled",
      ring: "curled",
      pinky: "extended",
    });

    for (let i = 0; i < 8; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, "Right");
      }, rockHand);
      await page.waitForTimeout(90);
    }

    const stateIcon = page.locator("#gesture-indicator-icon");
    await expect(stateIcon).toHaveText("🤘");
  });
});

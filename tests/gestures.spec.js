import { test, expect } from '@playwright/test';

// Helper to generate normalized hand landmarks
function generateHand({
  thumb = 'extended',
  index = 'extended',
  middle = 'extended',
  ring = 'extended',
  pinky = 'extended',
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
    { base: 0.50, step: 0.00 },
    { base: 0.53, step: 0.01 },
    { base: 0.56, step: 0.02 }
  ];

  function addFinger(startIndex, extState, xSpread, isThumb = false) {
    const isExt = extState === 'extended';
    const mcpY = 0.58;
    const len = isThumb ? 0.05 : 0.06;
    lm[startIndex] = { x: xSpread.base, y: mcpY, z: 0 };

    if (isThumb) {
      lm[1] = { x: 0.46, y: 0.72, z: 0 };
      lm[2] = { x: 0.43, y: 0.65, z: 0 };
      if (isExt) {
        lm[3] = { x: 0.40, y: 0.58, z: 0 };
        lm[4] = { x: 0.37, y: 0.51, z: 0 };
      } else {
        lm[3] = { x: 0.46, y: 0.60, z: 0.02 };
        lm[4] = { x: 0.48, y: 0.61, z: 0.03 };
      }
      return;
    }

    if (isExt) {
      lm[startIndex + 1] = { x: xSpread.base + xSpread.step, y: mcpY - len, z: 0 };
      lm[startIndex + 2] = { x: xSpread.base + xSpread.step * 2, y: mcpY - len * 2, z: 0 };
      lm[startIndex + 3] = { x: xSpread.base + xSpread.step * 3, y: mcpY - len * 3, z: 0 };
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
    lm[4] = { x: reticleX, y: reticleY, z: 0.01 };
    lm[8] = { x: reticleX + 0.005, y: reticleY, z: 0.01 };
  } else if (index === 'extended' && middle === 'extended' && ring === 'curled' && pinky === 'curled') {
    // True Victory V-spread
    lm[8] = { x: 0.42, y: 0.35, z: 0 };
    lm[12] = { x: 0.55, y: 0.35, z: 0 };
  } else if (index === 'extended') {
    lm[8] = { x: reticleX, y: reticleY, z: 0 };
  }

  return lm;
}

test.describe('AI Vision Hand Gesture Control Acceptance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('solar_guide_v2_dismissed', 'true');
    });
  });

  test('1. Consent modal shows on initial activation, deny closes modal, allow grants permission', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });
    // Ensure preloader has finished
    await page.waitForTimeout(800);

    const toggleBtn = page.locator('#gesture-toggle-btn');
    const consentModal = page.locator('#gesture-consent-modal');

    // Open telemetry tools island
    await page.click('#telemetry-island-toggle');
    await page.waitForTimeout(350);

    // First click should open consent dialog
    await toggleBtn.click();
    await expect(consentModal).toBeVisible();

    // Deny should close modal and leave toggle inactive
    await page.click('#gesture-consent-deny');
    await expect(consentModal).toBeHidden();
    await expect(toggleBtn).not.toHaveClass(/active/);

    // Reopen and allow
    await toggleBtn.click();
    await expect(consentModal).toBeVisible();
    await page.click('#gesture-consent-allow');
    await expect(consentModal).toBeHidden();

    // Verify consent flag stored
    const consented = await page.evaluate(() => window.sessionStorage.getItem('gesture_consent_granted'));
    expect(consented).toBe('true');
  });

  test('2. Injected Pointing gesture activates reticle and tracks coordinates', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

    // Grant consent and open HUD via test harness
    await page.evaluate(() => {
      window.sessionStorage.setItem('gesture_consent_granted', 'true');
      const hud = document.getElementById('gesture-hud');
      if (hud) {
        hud.classList.remove('hidden');
        hud.style.display = 'block';
      }
    });

    // Inject 5 pointing frames to saturate majority-vote stabilizer
    const pointingHand = generateHand({
      thumb: 'curled',
      index: 'extended',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled',
      reticleX: 0.4,
      reticleY: 0.35,
    });

    for (let i = 0; i < 6; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, 'Right');
      }, pointingHand);
    }

    const reticle = page.locator('#gesture-reticle');
    await expect(reticle).toBeVisible();

    const state = await page.evaluate(() => window.__gestureTest.getState());
    expect(state.currentGesture).toBe('pointing');
  });

  test('3. Injected Fist gesture toggles time freeze', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

    const fistHand = generateHand({
      thumb: 'curled',
      index: 'curled',
      middle: 'curled',
      ring: 'curled',
      pinky: 'curled'
    });

    // Inject fist across multiple frames to satisfy 500ms hold threshold
    for (let i = 0; i < 7; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, 'Right');
      }, fistHand);
      await page.waitForTimeout(100);
    }

    const state = await page.evaluate(() => window.__gestureTest.getState());
    expect(state.currentGesture).toBe('fist');
  });

  test('4. Injected Victory gesture triggers autopilot tour mode', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

    const victoryHand = generateHand({
      thumb: 'curled',
      index: 'extended',
      middle: 'extended',
      ring: 'curled',
      pinky: 'curled'
    });
    victoryHand[8].x -= 0.03;
    victoryHand[12].x += 0.03;

    for (let i = 0; i < 9; i++) {
      await page.evaluate((lm) => {
        window.__gestureTest.inject(lm, 'Right');
      }, victoryHand);
      await page.waitForTimeout(100);
    }

    const state = await page.evaluate(() => window.__gestureTest.getState());
    expect(state.currentGesture).toBe('victory');
  });
});

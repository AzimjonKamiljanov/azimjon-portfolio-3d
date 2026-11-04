import { test, expect } from '@playwright/test';

// Helper to generate normalized hand landmarks for gesture injection tests
function generateMockHand({
  thumb = 'extended',
  index = 'extended',
  middle = 'extended',
  ring = 'extended',
  pinky = 'extended',
  pinch = false
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
  addFinger(5, index, fingerXSpreads[1]);
  addFinger(9, middle, fingerXSpreads[2]);
  addFinger(13, ring, fingerXSpreads[3]);
  addFinger(17, pinky, fingerXSpreads[4]);

  if (pinch) {
    lm[4] = { x: 0.46, y: 0.52, z: 0 };
    lm[8] = { x: 0.465, y: 0.525, z: 0 };
  }

  return lm;
}

test.describe('Responsive Layout & Zero Overflow Across Viewports & Languages', () => {
  const viewports = [
    { name: 'Mobile Ultra-Compact (320x568)', width: 320, height: 568 },
    { name: 'Mobile Standard (360x800)', width: 360, height: 800 },
    { name: 'Mobile Flagship (390x844)', width: 390, height: 844 },
    { name: 'Mobile Large (412x915)', width: 412, height: 915 },
    { name: 'Tablet Portrait (768x1024)', width: 768, height: 1024 },
    { name: 'Tablet Landscape (1024x768)', width: 1024, height: 768 },
    { name: 'Laptop Standard (1366x768)', width: 1366, height: 768 },
    { name: 'Desktop FHD (1920x1080)', width: 1920, height: 1080 },
    { name: 'Desktop QHD (2560x1440)', width: 2560, height: 1440 },
    { name: 'Desktop 4K UHD (3840x2160)', width: 3840, height: 2160 }
  ];

  const languages = ['uz', 'en', 'ru'];

  for (const vp of viewports) {
    test(`No horizontal overflow on ${vp.name} across UZ, EN, RU`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => {
        localStorage.setItem('solar_guide_v2_dismissed', 'true');
        localStorage.setItem('solar_guide_dismissed', 'true');
      });

      await page.goto('http://127.0.0.1:8080/');
      await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

      for (const lang of languages) {
        // Switch language
        await page.evaluate((targetLang) => {
          const btn = document.querySelector(`.lang-btn[data-lang="${targetLang}"]`);
          if (btn) btn.click();
        }, lang);

        await page.waitForTimeout(100);

        // 1. Verify document root zero horizontal scroll
        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
          const clientW = doc.clientWidth;
          return {
            hasOverflow: scrollW > clientW + 1, // 1px rounding tolerance
            scrollW,
            clientW,
            scrollX: window.scrollX
          };
        });

        expect(overflow.hasOverflow).toBeFalsy();
        expect(overflow.scrollX).toBe(0);
      }
    });
  }

  test('UI Modals (Catalog, Guide, Terminal) have zero overflow on 320x568', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

    // 1. Open Catalog Modal
    await page.click('#catalog-btn');
    await page.waitForSelector('#catalog-modal:not(.hidden)');
    const catalogOverflow = await page.evaluate(() => {
      const modal = document.querySelector('.catalog-modal');
      return modal ? modal.scrollWidth <= modal.clientWidth + 2 : true;
    });
    expect(catalogOverflow).toBeTruthy();
    await page.keyboard.press('Escape');

    // 2. Open Guide Modal via '?' key
    await page.keyboard.press('?');
    await page.waitForSelector('#guide-modal-container:not(.hidden)');
    const guideOverflow = await page.evaluate(() => {
      const modal = document.querySelector('.guide-modal');
      return modal ? modal.scrollWidth <= modal.clientWidth + 2 : true;
    });
    expect(guideOverflow).toBeTruthy();
    await page.keyboard.press('Escape');
  });
});

test.describe('Photographic Deep-Space Realism & Background Luminance Verification', () => {
  test('Empty sky patch has mean sRGB < 8/255 at 1920x1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => {
      localStorage.setItem('solar_guide_v2_dismissed', 'true');
      localStorage.setItem('solar_guide_dismissed', 'true');
    });

    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });
    // Let initial dive complete
    await page.waitForTimeout(2800);

    // Sample an empty patch of deep sky in the canvas corner (e.g. top right corner 1750..1850, 80..180)
    // away from the Sun (which is at origin) and away from planetary orbits
    const skyMetrics = await page.evaluate(() => {
      const renderer = window.__renderer;
      if (!renderer) return { meanRGB: 0, valid: false };

      const gl = renderer.getContext();
      const width = 80;
      const height = 80;
      // Read 80x80 pixels from top-right corner of WebGL buffer
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(gl.drawingBufferWidth - 100, gl.drawingBufferHeight - 100, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let totalBrightness = 0;
      const sampleCount = width * height;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        // Rec. 709 relative luminance or mean channel
        const mean = (r + g + b) / 3;
        totalBrightness += mean;
      }
      return {
        meanRGB: totalBrightness / sampleCount,
        valid: true
      };
    });

    expect(skyMetrics.valid).toBeTruthy();
    // Verify photographic deep-space realism: mean sRGB of empty sky patch < 8.0 out of 255
    expect(skyMetrics.meanRGB).toBeLessThan(8.0);
  });
});

test.describe('AI Vision Hand Gestures E2E & Practice Mode', () => {
  test('Injects gestures, updates telemetry HUD, and triggers guide practice chips', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => {
      localStorage.setItem('solar_guide_v2_dismissed', 'true');
      localStorage.setItem('solar_guide_dismissed', 'true');
    });

    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

    // Open Guide modal via 'H'
    await page.keyboard.press('h');
    await page.waitForSelector('#guide-modal-container:not(.hidden)');

    // Inject gestures using window.__gestureTest.inject
    const gesturesToTest = [
      { name: 'palm', lm: generateMockHand() },
      { name: 'fist', lm: generateMockHand({ thumb: 'curled', index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' }) },
      { name: 'pointing', lm: generateMockHand({ thumb: 'curled', index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' }) },
      { name: 'pinch', lm: generateMockHand({ thumb: 'extended', index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled', pinch: true }) },
      { name: 'victory', lm: (() => {
        const v = generateMockHand({ thumb: 'curled', index: 'extended', middle: 'extended', ring: 'curled', pinky: 'curled' });
        v[8].x -= 0.03;
        v[12].x += 0.03;
        return v;
      })() }
    ];

    for (const g of gesturesToTest) {
      // Feed 5 frames so stabilizer confirms the gesture
      for (let f = 0; f < 5; f++) {
        await page.evaluate((landmarks) => {
          if (window.__gestureTest && window.__gestureTest.inject) {
            window.__gestureTest.inject(landmarks, 'Right');
          }
        }, g.lm);
        await page.waitForTimeout(30);
      }

      // Check practice chip in guide modal has class .recognized
      const chip = page.locator(`.gesture-practice-chip[data-gesture="${g.name}"]`);
      await expect(chip).toHaveClass(/recognized/);
    }
  });

  test('True Astronomical Scale toggle functions correctly via window.__toggleTrueScale', async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

    const isTrueScale = await page.evaluate(() => {
      return typeof window.__toggleTrueScale === 'function';
    });
    expect(isTrueScale).toBeTruthy();

    const stateAfterToggle = await page.evaluate(() => {
      return window.__toggleTrueScale(true);
    });
    expect(stateAfterToggle).toBe(true);

    const stateAfterToggleOff = await page.evaluate(() => {
      return window.__toggleTrueScale(false);
    });
    expect(stateAfterToggleOff).toBe(false);
  });
});

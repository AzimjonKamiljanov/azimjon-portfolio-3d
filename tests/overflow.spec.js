import { test, expect } from "@playwright/test";

test.describe("Responsive Layout & Zero Overflow Across Viewports & Languages", () => {
  const viewports = [
    { name: "Mobile Ultra-Compact (320x568)", width: 320, height: 568 },
    { name: "Mobile Standard (360x800)", width: 360, height: 800 },
    { name: "Mobile Flagship (390x844)", width: 390, height: 844 },
    { name: "Mobile Large (412x915)", width: 412, height: 915 },
    { name: "Tablet Portrait (768x1024)", width: 768, height: 1024 },
    { name: "Tablet Landscape (1024x768)", width: 1024, height: 768 },
    { name: "Laptop Standard (1366x768)", width: 1366, height: 768 },
    { name: "Desktop FHD (1920x1080)", width: 1920, height: 1080 },
    { name: "Desktop QHD (2560x1440)", width: 2560, height: 1440 },
    { name: "Desktop 4K UHD (3840x2160)", width: 3840, height: 2160 },
  ];

  const languages = ["uz", "en", "ru"];

  for (const vp of viewports) {
    test(`No horizontal overflow on ${vp.name} across UZ, EN, RU`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => {
        localStorage.setItem("solar_guide_v2_dismissed", "true");
        localStorage.setItem("solar_guide_dismissed", "true");
      });

      await page.goto("http://127.0.0.1:8080/");
      await page.waitForSelector("#canvas-container canvas", {
        timeout: 10000,
      });

      for (const lang of languages) {
        // Switch language
        await page.evaluate((targetLang) => {
          const btn = document.querySelector(
            `.lang-btn[data-lang="${targetLang}"]`,
          );
          if (btn) btn.click();
        }, lang);

        await page.waitForTimeout(60);

        // 1. Verify document root zero horizontal scroll
        const rootOverflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
          const clientW = doc.clientWidth;
          return {
            hasOverflow: scrollW > clientW + 1, // 1px rounding tolerance
            scrollW,
            clientW,
            scrollX: window.scrollX,
          };
        });

        expect(
          rootOverflow.hasOverflow,
          `Root overflow on ${vp.name} in [${lang}]: scrollW=${rootOverflow.scrollW}, clientW=${rootOverflow.clientW}`,
        ).toBeFalsy();
        expect(rootOverflow.scrollX).toBe(0);

        // 2. Scan visible elements in DOM to ensure none stick outside viewport horizontally
        // Exclude elements inside intentional horizontal carousels (bottom planet dock #nav-container, telemetry ribbon)
        const offscreenElements = await page.evaluate(() => {
          const bad = [];
          const all = document.querySelectorAll(
            "body *:not(script):not(style):not(svg):not(path)",
          );
          for (const el of all) {
            if (el.closest(".sr-only") || el.classList.contains("sr-only"))
              continue;
            if (
              el.closest(
                '#nav-container, .cosmic-telemetry-island, [data-scrollable="true"]',
              )
            )
              continue;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 2 || rect.height <= 2) continue;
            const style = window.getComputedStyle(el);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              parseFloat(style.opacity) === 0
            )
              continue;

            if (rect.left < -2 || rect.right > window.innerWidth + 2) {
              bad.push({
                tag: el.tagName,
                id: el.id,
                className: el.className,
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                windowWidth: window.innerWidth,
                text: (el.textContent || "").trim().slice(0, 30),
              });
            }
          }
          return bad;
        });

        expect(
          offscreenElements,
          `Offscreen elements on ${vp.name} in [${lang}]`,
        ).toHaveLength(0);
      }
    });
  }

  test("Preloader card has fluid width and zero overflow on 320x568 and 360x800", async ({
    page,
  }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 600 });
      await page.goto("http://127.0.0.1:8080/");
      const cardMetrics = await page.evaluate(() => {
        const card = document.querySelector(".preloader-card");
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        return {
          scrollWidth: card.scrollWidth,
          clientWidth: card.clientWidth,
          rectWidth: rect.width,
          windowWidth: window.innerWidth,
        };
      });

      if (cardMetrics) {
        expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(
          cardMetrics.clientWidth + 2,
        );
        expect(cardMetrics.rectWidth).toBeLessThanOrEqual(width);
      }
    }
  });

  test("UI Modals (Catalog, Guide, Terminal, Credits, Info Panel) have zero overflow on 320x568", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript(() => {
      localStorage.setItem("solar_guide_v2_dismissed", "true");
      localStorage.setItem("solar_guide_dismissed", "true");
    });

    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", { timeout: 10000 });

    for (const lang of ["uz", "en", "ru"]) {
      await page.evaluate((targetLang) => {
        const btn = document.querySelector(
          `.lang-btn[data-lang="${targetLang}"]`,
        );
        if (btn) btn.click();
      }, lang);
      await page.waitForTimeout(60);

      // 1. Catalog Modal
      await page.click("#catalog-btn");
      await page.waitForSelector("#catalog-modal:not(.hidden)");
      const catalogResult = await page.evaluate(() => {
        const modal = document.querySelector("#catalog-modal");
        return modal
          ? { scrollW: modal.scrollWidth, clientW: modal.clientWidth }
          : null;
      });
      expect(catalogResult).not.toBeNull();
      expect(catalogResult.scrollW).toBeLessThanOrEqual(
        catalogResult.clientW + 2,
      );
      await page.click("#catalog-close");
      await page.waitForTimeout(100);

      // 2. Guide Modal
      await page.evaluate(() => {
        if (window.__showGuide) window.__showGuide();
      });
      await page.waitForSelector("#guide-modal-container:not(.hidden)");
      const guideResult = await page.evaluate(() => {
        const modal = document.querySelector(".guide-modal");
        return modal
          ? { scrollW: modal.scrollWidth, clientW: modal.clientWidth }
          : null;
      });
      expect(guideResult).not.toBeNull();
      expect(guideResult.scrollW).toBeLessThanOrEqual(guideResult.clientW + 2);
      await page.evaluate(() => {
        if (window.__hideGuide) window.__hideGuide();
      });
      await page.waitForTimeout(100);

      // 3. Credits Modal
      await page.evaluate(() => {
        if (window.__showCredits) window.__showCredits();
      });
      await page.waitForSelector("#credits-modal-container:not(.hidden)");
      const creditsResult = await page.evaluate(() => {
        const modal = document.querySelector(".credits-modal");
        return modal
          ? { scrollW: modal.scrollWidth, clientW: modal.clientWidth }
          : null;
      });
      expect(creditsResult).not.toBeNull();
      expect(creditsResult.scrollW).toBeLessThanOrEqual(
        creditsResult.clientW + 2,
      );
      await page.evaluate(() => {
        if (window.__hideCredits) window.__hideCredits();
      });
      await page.waitForTimeout(100);

      // 4. Moon Terminal (Focus on Moon mounts the terminal inside #info-panel)
      await page.evaluate(() => {
        if (window.__solarEngine && window.__solarEngine.focusTargetById) {
          window.__solarEngine.focusTargetById("moon");
        }
      });
      await page.waitForSelector(
        "#info-panel:not(.hidden) #moon-terminal-container .cyber-terminal",
        { timeout: 6000 },
      );
      const terminalResult = await page.evaluate(() => {
        const modal = document.querySelector(".cyber-terminal");
        if (!modal) return null;
        const wide = [];
        modal.querySelectorAll("*").forEach((el) => {
          if (el.scrollWidth > modal.clientWidth) {
            wide.push({
              tag: el.tagName,
              id: el.id,
              className: el.className,
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              text: (el.textContent || "").trim().slice(0, 30),
            });
          }
        });
        return { scrollW: modal.scrollWidth, clientW: modal.clientWidth };
      });
      expect(terminalResult).not.toBeNull();
      expect(terminalResult.scrollW).toBeLessThanOrEqual(
        terminalResult.clientW + 2,
      );
      await page.click("#modal-close");
      await page.waitForTimeout(150);

      // 5. Info Panel (Sun selected)
      await page.evaluate(() => {
        if (window.__solarEngine && window.__solarEngine.focusTargetById) {
          window.__solarEngine.focusTargetById("sun");
        }
      });
      await page.waitForSelector("#info-panel:not(.hidden)", { timeout: 6000 });
      const infoPanelResult = await page.evaluate(() => {
        const panel = document.querySelector("#info-panel");
        return panel
          ? { scrollW: panel.scrollWidth, clientW: panel.clientWidth }
          : null;
      });
      if (infoPanelResult) {
        expect(infoPanelResult.scrollW).toBeLessThanOrEqual(
          infoPanelResult.clientW + 2,
        );
      }
      await page.click("#modal-close");
      await page.waitForTimeout(150);
    }
  });

  test("True Astronomical Scale toggle functions correctly via window.__toggleTrueScale", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:8080/");
    await page.waitForSelector("#canvas-container canvas", { timeout: 10000 });

    const isTrueScale = await page.evaluate(() => {
      return typeof window.__toggleTrueScale === "function";
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

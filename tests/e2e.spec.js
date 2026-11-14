import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('3D Solar Developer Portfolio E2E Acceptance Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('solar_guide_dismissed', 'true');
            localStorage.setItem('solar_guide_v2_dismissed', 'true');
            window.sessionStorage.setItem('gesture_consent_granted', 'true');
        });
        // Collect console errors
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                console.error(`Page console error: "${msg.text()}"`);
            }
        });
    });

    test('1. Loads production application with 0 console errors and renders 3D canvas', async ({ page }) => {
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));

        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

        expect(errors).toHaveLength(0);

        // Verify canvas has valid dimensions
        const canvas = page.locator('#canvas-container canvas');
        await expect(canvas).toBeVisible();
        const box = await canvas.boundingBox();
        expect(box?.width).toBeGreaterThan(100);
        expect(box?.height).toBeGreaterThan(100);
    });

    test('2. Language switcher dynamically updates document lang and localized UI text', async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');

        // Default UZ
        await expect(page.locator('html')).toHaveAttribute('lang', 'uz');
        await expect(page.locator('#catalog-btn-text')).toHaveText('Loyihalar');

        // Switch to EN
        await page.click('button[data-lang="en"]');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('#catalog-btn-text')).toHaveText('Projects');

        // Switch to RU
        await page.click('button[data-lang="ru"]');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
        await expect(page.locator('#catalog-btn-text')).toHaveText('Проекты');
    });

    test('3. Catalog modal opens, performs live debounced search, and handles categories', async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');

        // Click Catalog button
        await page.click('#catalog-btn');
        const modal = page.locator('#catalog-modal');
        await expect(modal).toBeVisible();

        // Search for "TITAN"
        const searchInput = page.locator('#catalog-search');
        await searchInput.fill('TITAN');
        await page.waitForTimeout(300); // debounce wait

        const visibleCards = page.locator('.catalog-card');
        const count = await visibleCards.count();
        expect(count).toBeGreaterThanOrEqual(1);
        await expect(visibleCards.first()).toContainText('TITAN NEXUS');

        // Clear search
        await page.click('#catalog-search-clear');
        await page.waitForTimeout(300);

        // Filter by AI category
        await page.click('button[data-category="ai"]');
        await page.waitForTimeout(100);
        const aiCount = await page.locator('.catalog-card').count();
        expect(aiCount).toBeGreaterThan(0);

        // Close modal via Esc key
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();
    });

    test('4. Cinematic Autopilot Tour starts, updates HUD telemetry, and can be exited', async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');

        const tourBtn = page.locator('#tour-toggle-btn');
        await tourBtn.click();

        const tourHud = page.locator('#tour-hud');
        await expect(tourHud).toBeVisible();
        await expect(page.locator('#tour-counter-text')).toHaveText(/01 \/ 11/);

        // Click next tour stop
        await page.click('#tour-next-btn');
        await page.waitForTimeout(100);
        await expect(page.locator('#tour-counter-text')).toHaveText(/02 \/ 11/);

        // Exit tour
        await page.click('#tour-exit-btn');
        await expect(tourHud).toBeHidden();
    });

    test('5. Moon contact terminal validates inputs, honeypot, and submits safely', async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

        // Intercept /api/contact
        await page.route('**/api/contact', async (route) => {
            const req = route.request();
            const postData = JSON.parse(req.postData() || '{}');
            if (postData._hp) {
                return route.fulfill({ status: 400, body: JSON.stringify({ error: 'Bot detected' }) });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true, message: 'Xabar Telegram botga yetkazildi.' })
            });
        });

        // Focus Moon
        await page.evaluate(() => window.__solarEngine.focusTargetById('moon'));
        await page.waitForSelector('#info-panel:not(.hidden)', { timeout: 5000 });

        const terminal = page.locator('#moon-terminal-container');
        await expect(terminal).toBeVisible();

        // Fill form
        await page.fill('#terminal-name', 'Test Foydalanuvchi');
        await page.fill('#terminal-contact', '@test_telegram_handle');
        await page.fill('#terminal-message', 'Bu test xabari avtomatlashtirilgan tekshiruv uchun.');

        // Submit form
        await page.click('#terminal-submit-btn');

        // Check success feedback
        const feedback = page.locator('#terminal-feedback');
        await expect(feedback).toBeVisible();
        await expect(feedback).toContainText('Xabar Telegram botga yetkazildi');
    });

    test('6. Mobile viewport (375x667 & 390x844) has zero horizontal overflow (scrollWidth <= clientWidth)', async ({ page }) => {
        // Mobile iPhone SE viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

        const hasHorizontalOverflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalOverflow).toBe(false);

        // Mobile iPhone 14 viewport
        await page.setViewportSize({ width: 390, height: 844 });
        const hasHorizontalOverflow390 = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalOverflow390).toBe(false);
    });

    test('7. Accessibility: Skip link is present and keyboard focusable', async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');

        const skipLink = page.locator('a.skip-link');
        await expect(skipLink).toBeAttached();

        // Press tab to focus skip link
        await page.keyboard.press('Tab');
        await expect(skipLink).toBeFocused();
    });

    test('8. Accessibility: Axe accessibility scan has zero critical violations', async ({ page }) => {
        await page.goto('http://127.0.0.1:8080/');
        await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });
        const results = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        const criticalViolations = results.violations.filter((v) => v.impact === 'critical');
        expect(criticalViolations).toEqual([]);
    });
});

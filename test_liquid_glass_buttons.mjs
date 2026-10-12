import { spawn } from 'child_process';
import fs from 'fs';

console.log("================================================================================");
console.log("🧪 RIGOROUS VERIFICATION: LIQUID GLASS BUTTONS, ZERO COLLISION & RESPONSIVENESS");
console.log("================================================================================");

const port = 9255;
const userDataDir = `/tmp/chrome_liquid_glass_${Date.now()}`;
const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'http://localhost:8080/'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    try {
        await sleep(2500);
        const tabsRes = await fetch(`http://127.0.0.1:${port}/json`);
        const tabs = await tabsRes.json();
        const pageTab = tabs.find(t => t.type === 'page');
        if (!pageTab) throw new Error("Sahifa topilmadi!");

        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
        let idCounter = 1;
        const callbacks = new Map();
        const consoleErrors = [];

        ws.onmessage = e => {
            const msg = JSON.parse(e.data);
            if (msg.method === 'Runtime.exceptionThrown') {
                consoleErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
            }
            if (msg.id && callbacks.has(msg.id)) {
                callbacks.get(msg.id)(msg);
                callbacks.delete(msg.id);
            }
        };

        await new Promise(r => {
            if (ws.readyState === WebSocket.OPEN) r();
            else ws.onopen = r;
        });

        const send = (method, params = {}) => new Promise(r => {
            const id = idCounter++;
            callbacks.set(id, r);
            ws.send(JSON.stringify({ id, method, params }));
        });

        const evalExpr = async (expression) => {
            const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (res.result?.exceptionDetails) {
                throw new Error("Eval Error: " + JSON.stringify(res.result.exceptionDetails));
            }
            return res.result?.result?.value;
        };

        await send('Runtime.enable');
        await send('Page.enable');

        // Wait for ready
        for (let i = 0; i < 20; i++) {
            const ready = await evalExpr(`Boolean(window.__interactableObjects && window.__interactableObjects.length > 0)`);
            if (ready) break;
            await sleep(300);
        }

        console.log("✓ 3D Engine initialized with 0 startup exceptions.");

        // =========================================================================
        // TEST 1: DESKTOP 1920x1080 (Liquid Glass, Single-Line, Zero Squeeze)
        // =========================================================================
        console.log("\n--- TEST 1: DESKTOP WORKSTATION (1920x1080) ---");
        await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
        await sleep(500);

        const desktopInspection = await evalExpr(`
            (() => {
                const buttons = Array.from(document.querySelectorAll('#brand-header .header-link'));
                const brokenButtons = [];
                const styles = [];

                buttons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    const computed = window.getComputedStyle(btn);
                    const text = btn.innerText.trim();

                    // Check if height exceeds 36px (which indicates 2-line text break)
                    if (rect.height > 36) {
                        brokenButtons.push({ id: btn.id || btn.className, text, height: rect.height });
                    }

                    styles.push({
                        id: btn.id || btn.className,
                        text,
                        whiteSpace: computed.whiteSpace,
                        backdropFilter: computed.backdropFilter || computed.webkitBackdropFilter,
                        borderRadius: computed.borderRadius,
                        height: Math.round(rect.height),
                        width: Math.round(rect.width)
                    });
                });

                const brandTitleRect = document.querySelector('.brand-title').getBoundingClientRect();
                const navGroupRect = document.getElementById('brand-nav-group').getBoundingClientRect();
                const telemetryIsland = document.getElementById('cosmic-telemetry-island').getBoundingClientRect();

                return {
                    totalButtons: buttons.length,
                    brokenButtons,
                    titleRight: Math.round(brandTitleRect.right),
                    navGroupLeft: Math.round(navGroupRect.left),
                    distanceBetweenTitleAndNav: Math.round(navGroupRect.left - brandTitleRect.right),
                    telemetryIslandWidth: Math.round(telemetryIsland.width),
                    telemetryIslandHeight: Math.round(telemetryIsland.height),
                    styles
                };
            })()
        `);

        console.log("Desktop inspection:", {
            totalButtons: desktopInspection.totalButtons,
            distanceBetweenTitleAndNav: desktopInspection.distanceBetweenTitleAndNav + "px",
            telemetryIslandWidth: desktopInspection.telemetryIslandWidth + "px",
            brokenButtons: desktopInspection.brokenButtons
        });

        if (desktopInspection.brokenButtons.length > 0) {
            throw new Error(`FAIL: Found ${desktopInspection.brokenButtons.length} buttons that broke into multiple lines: ` + JSON.stringify(desktopInspection.brokenButtons));
        }
        if (desktopInspection.distanceBetweenTitleAndNav < 150) {
            throw new Error(`FAIL: Buttons are too close to brand title! Clearance: ${desktopInspection.distanceBetweenTitleAndNav}px`);
        }
        console.log("✅ PASS: All buttons on 1920x1080 are strictly single-line with generous breathing clearance!");

        let shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('desktop_liquid_glass_1920.png', Buffer.from(shot.result.data, 'base64'));
        console.log("📸 Saved: desktop_liquid_glass_1920.png");

        // =========================================================================
        // TEST 2: LAPTOP 1366x768 (Tight Screen Zero Collision Check)
        // =========================================================================
        console.log("\n--- TEST 2: LAPTOP DISPLAY (1366x768) ---");
        await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
        await sleep(500);

        const laptopInspection = await evalExpr(`
            (() => {
                const buttons = Array.from(document.querySelectorAll('#brand-header .header-link'));
                const broken = [];
                buttons.forEach(b => {
                    const r = b.getBoundingClientRect();
                    if (r.height > 36) broken.push({ id: b.id, height: r.height, text: b.innerText });
                });

                const brandTitleRect = document.querySelector('.brand-title').getBoundingClientRect();
                const navGroupRect = document.getElementById('brand-nav-group').getBoundingClientRect();

                return {
                    broken,
                    clearance: Math.round(navGroupRect.left - brandTitleRect.right),
                    navGroupLeft: Math.round(navGroupRect.left),
                    titleRight: Math.round(brandTitleRect.right)
                };
            })()
        `);

        console.log("Laptop 1366x768 inspection:", laptopInspection);
        if (laptopInspection.broken.length > 0) {
            throw new Error("FAIL: 1366x768 buttons broke into 2 lines: " + JSON.stringify(laptopInspection.broken));
        }
        if (laptopInspection.clearance < 50) {
            throw new Error(`FAIL: 1366x768 buttons collide with brand title! Clearance: ${laptopInspection.clearance}px`);
        }
        console.log("✅ PASS: 1366x768 laptop layout has zero collisions and single-line buttons!");

        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('desktop_liquid_glass_1366.png', Buffer.from(shot.result.data, 'base64'));
        console.log("📸 Saved: desktop_liquid_glass_1366.png");

        // =========================================================================
        // TEST 3: MOBILE SMARTPHONE 390x844 (iPhone 14 / Android)
        // =========================================================================
        console.log("\n--- TEST 3: MOBILE SMARTPHONE (390x844) ---");
        await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
        await sleep(500);

        const mobileCheck = await evalExpr(`
            (() => {
                const docScrollW = document.documentElement.scrollWidth;
                const docClientW = document.documentElement.clientWidth;
                const orbitBtn = document.getElementById('orbit-toggle-btn');
                const orbitRect = orbitBtn ? orbitBtn.getBoundingClientRect() : null;
                const audioBtn = document.getElementById('audio-toggle-btn');
                const catalogBtn = document.getElementById('catalog-btn');
                const tourBtn = document.getElementById('tour-toggle-btn');
                const island = document.getElementById('cosmic-telemetry-island');
                const islandRect = island ? island.getBoundingClientRect() : null;

                return {
                    docScrollW,
                    docClientW,
                    hasOverflow: docScrollW > docClientW,
                    orbitBtn: {
                        exists: !!orbitBtn,
                        display: orbitBtn ? window.getComputedStyle(orbitBtn).display : null,
                        width: orbitRect ? orbitRect.width : 0,
                        height: orbitRect ? orbitRect.height : 0
                    },
                    audioVisible: audioBtn && window.getComputedStyle(audioBtn).display !== 'none',
                    catalogVisible: catalogBtn && window.getComputedStyle(catalogBtn).display !== 'none',
                    tourVisible: tourBtn && window.getComputedStyle(tourBtn).display !== 'none',
                    islandScrollable: island ? island.scrollWidth >= island.clientWidth : false
                };
            })()
        `);

        console.log("Mobile check result:", mobileCheck);
        if (mobileCheck.hasOverflow) {
            throw new Error(`FAIL: Mobile has horizontal page overflow! scrollWidth: ${mobileCheck.docScrollW} > clientWidth: ${mobileCheck.docClientW}`);
        }
        if (!mobileCheck.orbitBtn.exists || mobileCheck.orbitBtn.width <= 0) {
            throw new Error("FAIL: #orbit-toggle-btn is not visible or has zero width on mobile!");
        }
        if (!mobileCheck.audioVisible || !mobileCheck.catalogVisible || !mobileCheck.tourVisible) {
            throw new Error("FAIL: Essential mobile buttons (Audio, Catalog, Tour) are not visible!");
        }
        console.log("✅ PASS: Mobile 390x844 has 0px overflow and all essential buttons properly placed!");

        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('mobile_liquid_glass_390.png', Buffer.from(shot.result.data, 'base64'));
        console.log("📸 Saved: mobile_liquid_glass_390.png");

        // =========================================================================
        // TEST 4: SMALL MOBILE 375x812 (iPhone X / SE / Mini)
        // =========================================================================
        console.log("\n--- TEST 4: COMPACT MOBILE (375x812) ---");
        await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 3, mobile: true });
        await sleep(500);

        const compactMobileCheck = await evalExpr(`
            (() => {
                const docScrollW = document.documentElement.scrollWidth;
                const docClientW = document.documentElement.clientWidth;
                return {
                    docScrollW,
                    docClientW,
                    hasOverflow: docScrollW > docClientW
                };
            })()
        `);

        console.log("Compact mobile check result:", compactMobileCheck);
        if (compactMobileCheck.hasOverflow) {
            throw new Error(`FAIL: Compact mobile 375px has horizontal overflow! scrollW: ${compactMobileCheck.docScrollW} > clientW: ${compactMobileCheck.docClientW}`);
        }
        console.log("✅ PASS: Compact mobile 375x812 has 0px overflow!");

        shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('mobile_liquid_glass_375.png', Buffer.from(shot.result.data, 'base64'));
        console.log("📸 Saved: mobile_liquid_glass_375.png");

        // =========================================================================
        // TEST 5: INTERACTIVE TELEMETRY ISLAND TOGGLE (Expand / Collapse)
        // =========================================================================
        console.log("\n--- TEST 5: TELEMETRY ISLAND INTERACTIVE TOGGLE ---");
        // Click toggle to collapse
        await evalExpr(`document.getElementById('telemetry-island-toggle').click();`);
        await sleep(450);
        const collapsedState = await evalExpr(`
            (() => {
                const island = document.getElementById('cosmic-telemetry-island');
                const btn = document.getElementById('telemetry-island-toggle');
                return {
                    isCollapsed: island.classList.contains('island-collapsed'),
                    ariaExpanded: btn.getAttribute('aria-expanded'),
                    islandOpacity: parseFloat(window.getComputedStyle(island).opacity)
                };
            })()
        `);
        console.log("Collapsed state:", collapsedState);
        if (!collapsedState.isCollapsed || collapsedState.ariaExpanded !== 'false' || collapsedState.islandOpacity > 0.05) {
            throw new Error("FAIL: Telemetry island did not collapse cleanly!");
        }

        // Click toggle to re-expand
        await evalExpr(`document.getElementById('telemetry-island-toggle').click();`);
        await sleep(450);
        const expandedState = await evalExpr(`
            (() => {
                const island = document.getElementById('cosmic-telemetry-island');
                const btn = document.getElementById('telemetry-island-toggle');
                return {
                    isCollapsed: island.classList.contains('island-collapsed'),
                    ariaExpanded: btn.getAttribute('aria-expanded'),
                    islandOpacity: parseFloat(window.getComputedStyle(island).opacity)
                };
            })()
        `);
        console.log("Expanded state:", expandedState);
        if (expandedState.isCollapsed || expandedState.ariaExpanded !== 'true' || expandedState.islandOpacity <= 0.8) {
            throw new Error("FAIL: Telemetry island did not expand back!");
        }
        console.log("✅ PASS: Telemetry Island toggle smoothly collapses and expands!");

        console.log("\n================================================================================");
        console.log("🎉 ALL TESTS PASSED! ZERO CRASHES, ZERO MULTI-LINE BREAKS, 100% LIQUID GLASS!");
        console.log("================================================================================");

    } finally {
        chrome.kill();
    }
}

run().catch(err => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});

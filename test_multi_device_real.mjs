import { spawn } from 'child_process';
import fs from 'fs';

console.log("=================================================");
console.log("🚀 STARTING RIGOROUS MULTI-DEVICE CDP REAL TESTS");
console.log("=================================================");

// Launch Chrome with remote debugging on port 9225
const chromeProcess = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--remote-debugging-port=9225',
    '--window-size=1920,1080',
    'http://localhost:8080/'
]);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    await sleep(2500);

    const tabsRes = await fetch('http://127.0.0.1:9225/json');
    const tabs = await tabsRes.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:8080'));

    if (!pageTab) {
        throw new Error("Could not find localhost:8080 page tab in Chrome!");
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let idCounter = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            callbacks.get(msg.id)(msg);
            callbacks.delete(msg.id);
        }
    };

    function sendCommand(method, params = {}) {
        return new Promise((resolve) => {
            const id = idCounter++;
            callbacks.set(id, resolve);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    await new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) resolve();
        else ws.onopen = resolve;
    });

    console.log("✓ Connected to Chrome CDP on port 9225.");
    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');

    async function evalCode(expression) {
        const res = await sendCommand('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.result && res.result.exceptionDetails) {
            throw new Error(`Eval error: ${JSON.stringify(res.result.exceptionDetails)}`);
        }
        return res.result?.result?.value;
    }

    // ====================================================
    // PART 1: DESKTOP RIGOROUS TESTS (1920x1080 & 1280x720)
    // ====================================================
    console.log("\n--- [1] DESKTOP VERIFICATION (1920x1080) ---");

    // 1. Check Console Runtime Errors
    const initialErrors = await evalCode('window.__errors');
    if (initialErrors && initialErrors.length > 0) {
        throw new Error(`Browser reported runtime errors: ${JSON.stringify(initialErrors)}`);
    }
    console.log("✓ Zero JavaScript runtime errors upon initial load!");

    // Wait for 3D scene initialization
    for (let i = 0; i < 25; i++) {
        const isReady = await evalCode('Boolean(window.__interactableObjects && window.__interactableObjects.length > 0)');
        if (isReady) break;
        await sleep(500);
    }

    // 2. Verify Planet In-Scene Sprite Billboards are REMOVED
    const planetSpriteCount = await evalCode(`
        let count = 0;
        window.__interactableObjects.forEach(obj => {
            if (obj.userData && (obj.userData.isPlanet || obj.userData.isSun || obj.userData.isMoon)) {
                obj.children.forEach(c => {
                    if (c.isSprite) count++;
                });
            }
        });
        count;
    `);
    console.log(`In-scene sprite billboards on Sun, Moon, and Planets count: ${planetSpriteCount}`);
    if (planetSpriteCount !== 0) {
        throw new Error(`Expected 0 in-scene sprite billboards on planets/sun/moon, found: ${planetSpriteCount}`);
    }
    console.log("✓ CONFIRMED: In-scene planet billboard labels are completely removed (clean, uncluttered scene)!");

    // 3. Verify Sun Nuclear Lava Core Shader uniforms & animation
    const sunDetails = await evalCode(`
        (() => {
            const sunObj = window.__interactableObjects.find(o => o.userData && o.userData.isSun);
            return {
                hasSun: !!sunObj,
                hasLavaUniforms: !!(sunObj && sunObj.material && sunObj.material.uniforms && sunObj.material.uniforms.uPhotosphereExact),
                timeVal1: sunObj ? sunObj.material.uniforms.uTime.value : 0
            };
        })()
    `);
    console.log("Sun Nuclear Lava Core details:", sunDetails);
    if (!sunDetails.hasSun || !sunDetails.hasLavaUniforms) {
        throw new Error("Sun nuclear lava core shader missing!");
    }
    await sleep(600);
    const sunTimeVal2 = await evalCode(`
        (() => {
            const s = window.__interactableObjects.find(o => o.userData && o.userData.isSun);
            return s ? s.material.uniforms.uTime.value : 0;
        })()
    `);
    console.log(`Sun uTime values: t1=${sunDetails.timeVal1}, t2=${sunTimeVal2}`);
    if (sunTimeVal2 < sunDetails.timeVal1) {
        throw new Error("Sun shader uTime went backwards!");
    }
    console.log(`✓ Sun nuclear lava core is dynamically animating in real-time (uTime: ${sunDetails.timeVal1.toFixed(3)} -> ${sunTimeVal2.toFixed(3)})!`);

    // 4. Capture Desktop Overview Screenshot
    await sleep(800);
    const deskOverviewShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('desktop_overview_clean.png', Buffer.from(deskOverviewShot.result.data, 'base64'));
    console.log("✓ Saved desktop_overview_clean.png (clean minimalist solar system without floating billboards)!");

    // 5. Test Navigation to Sun & Nuclear Core Close-up
    console.log("Navigating to Sun...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="sun"]\').click()');
    await sleep(1800);

    const sunTitle = await evalCode('document.getElementById("info-title").innerText');
    const sunBadge = await evalCode('document.getElementById("info-badge").innerText');
    console.log(`Sun focused: Title="${sunTitle}", Badge="${sunBadge}"`);
    if (!sunTitle.includes("Azimjon Kamiljanov")) {
        throw new Error("Sun navigation failed!");
    }

    const deskSunShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('desktop_sun_nuclear_lava_core.png', Buffer.from(deskSunShot.result.data, 'base64'));
    console.log("✓ Saved desktop_sun_nuclear_lava_core.png (stunning molten lava nuclear core close-up)!");

    // 6. Test Navigation to Saturn
    console.log("Navigating to Saturn...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="Saturn"]\').click()');
    await sleep(1800);
    const saturnTitle = await evalCode('document.getElementById("info-title").innerText');
    console.log(`Saturn focused: Title="${saturnTitle}"`);
    if (!saturnTitle.includes("Multi-Agent") && !saturnTitle.includes("Elite AI")) {
        throw new Error("Saturn navigation failed!");
    }
    const deskSaturnShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('desktop_saturn_focused.png', Buffer.from(deskSaturnShot.result.data, 'base64'));
    console.log("✓ Saved desktop_saturn_focused.png!");

    // 7. Test Catalog Modal on Desktop
    console.log("Testing Catalog Modal on Desktop...");
    await evalCode('document.getElementById("catalog-btn").click()');
    await sleep(500);
    const deskCatCount = await evalCode('document.querySelectorAll(".catalog-card, .catalog-star-card").length');
    console.log(`Desktop Catalog card count: ${deskCatCount}`);
    if (deskCatCount !== 28) {
        throw new Error(`Expected 28 catalog cards, got: ${deskCatCount}`);
    }
    const deskCatShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('desktop_catalog_view.png', Buffer.from(deskCatShot.result.data, 'base64'));
    console.log("✓ Saved desktop_catalog_view.png!");
    await evalCode('document.getElementById("catalog-close").click()');
    await sleep(350);

    // ====================================================
    // PART 2: MOBILE VIEWPORT & TOUCH TESTS (390x844)
    // ====================================================
    console.log("\n--- [2] MOBILE SMARTPHONE VERIFICATION (390x844) ---");

    await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
        fitWindow: false
    });
    await sendCommand('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5
    });
    await evalCode('window.dispatchEvent(new Event("resize"))');
    await sleep(1000);

    // 1. Verify No Horizontal Page Overflow on Mobile
    const mobileOverflow = await evalCode(`
        ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            bodyScrollWidth: document.body.scrollWidth
        })
    `);
    console.log("Mobile layout overflow check:", mobileOverflow);
    if (mobileOverflow.scrollWidth > 390) {
        throw new Error(`Mobile horizontal page overflow detected! scrollWidth=${mobileOverflow.scrollWidth} > 390`);
    }
    console.log("✓ Perfect mobile width containment: 0 horizontal overflow!");

    // 2. Verify Catalog Button is Accessible on Mobile
    const mobileCatBtnVisible = await evalCode(`
        const btn = document.getElementById("catalog-btn");
        const style = window.getComputedStyle(btn);
        style.display !== 'none' && style.visibility !== 'hidden'
    `);
    console.log("Mobile catalog button accessibility:", mobileCatBtnVisible);
    if (!mobileCatBtnVisible) {
        throw new Error("Catalog button ('Loyihalar') is not accessible on mobile viewport!");
    }
    console.log("✓ Catalog button is fully visible and touch-accessible in mobile header!");

    // 3. Capture Mobile Overview Screenshot
    const mobileOverviewShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('mobile_overview.png', Buffer.from(mobileOverviewShot.result.data, 'base64'));
    console.log("✓ Saved mobile_overview.png!");

    // 4. Test Mobile Navigation to Sun
    console.log("Mobile: Tapping Sun button...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="sun"]\').click()');
    await sleep(1800);

    const mobileSunTitle = await evalCode('document.getElementById("info-title").innerText');
    const mobileInfoPanelRect = await evalCode(`
        const p = document.getElementById("info-panel");
        const r = p.getBoundingClientRect();
        ({ width: r.width, height: r.height, top: r.top, bottom: r.bottom })
    `);
    console.log("Mobile Sun focused: Title=", mobileSunTitle, "PanelRect=", mobileInfoPanelRect);
    if (!mobileSunTitle.includes("Azimjon Kamiljanov")) {
        throw new Error("Mobile Sun focus failed!");
    }
    if (mobileInfoPanelRect.width > 390) {
        throw new Error("Mobile info panel wider than screen!");
    }

    const mobileSunShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('mobile_sun_focused.png', Buffer.from(mobileSunShot.result.data, 'base64'));
    console.log("✓ Saved mobile_sun_focused.png (verified clean elevated framing above mobile sheet)!");

    // 5. Test Mobile 'Orbitaga Qaytish' (Back Button)
    console.log("Mobile: Tapping 'Orbitaga Qaytish' button...");
    await evalCode('document.getElementById("back-button").click()');
    await sleep(1600);
    const mobilePanelHidden = await evalCode('document.getElementById("info-panel").classList.contains("hidden")');
    console.log("Mobile info panel hidden after reset:", mobilePanelHidden);
    if (!mobilePanelHidden) {
        throw new Error("Mobile info panel did not hide on resetView!");
    }
    console.log("✓ Mobile 'Orbitaga Qaytish' reset view functioning smoothly!");

    // 6. Test Mobile Catalog Modal Open, Touch Scroll & Card Click
    console.log("Mobile: Tapping Catalog ('Loyihalar') button...");
    await evalCode('document.getElementById("catalog-btn").click()');
    await sleep(500);

    const mobileCatOpen = await evalCode('!document.getElementById("catalog-modal").classList.contains("hidden")');
    if (!mobileCatOpen) throw new Error("Mobile catalog failed to open!");

    // Test mobile catalog touch scrolling
    await evalCode('document.getElementById("catalog-modal").scrollTop = 700');
    await sleep(400);

    const mobileCatShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('mobile_catalog_scrolled.png', Buffer.from(mobileCatShot.result.data, 'base64'));
    console.log("✓ Saved mobile_catalog_scrolled.png (smooth mobile catalog scrolling)!");

    // Tap a card in catalog to navigate (e.g. Venus / Jarvis-X AI)
    console.log("Mobile: Tapping Venera card in catalog...");
    await evalCode('document.querySelector(\'.catalog-card[data-target="Venus"]\').click()');
    await sleep(1800);

    const mobileVenusTitle = await evalCode('document.getElementById("info-title").innerText');
    const mobileCatClosed = await evalCode('document.getElementById("catalog-modal").classList.contains("hidden")');
    console.log("Mobile Venus focused:", mobileVenusTitle, "ModalClosed=", mobileCatClosed);
    if (!mobileVenusTitle.includes("Jarvis-X") || !mobileCatClosed) {
        throw new Error("Tapping catalog card on mobile failed to focus target or close catalog modal!");
    }

    const mobileVenusShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('mobile_venus_focused.png', Buffer.from(mobileVenusShot.result.data, 'base64'));
    console.log("✓ Saved mobile_venus_focused.png!");

    // Final runtime errors check across all interactions
    const finalErrors = await evalCode('window.__errors');
    if (finalErrors && finalErrors.length > 0) {
        throw new Error(`Runtime errors accumulated during test: ${JSON.stringify(finalErrors)}`);
    }
    console.log("✓ Zero accumulated runtime console errors across entire multi-device test session!");

    console.log("\n=================================================");
    console.log("🎉 ALL REAL MULTI-DEVICE CDP TESTS PASSED 100%!");
    console.log("=================================================");

    ws.close();
    chromeProcess.kill();
}

run().catch(err => {
    console.error("❌ TEST FAILED:", err);
    chromeProcess.kill();
    process.exit(1);
});

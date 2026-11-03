import { spawn } from 'child_process';
import fs from 'fs';

console.log("=================================================");
console.log("🚀 STARTING MULTILINGUAL & TYPOGRAPHY TESTS");
console.log("=================================================");

const chromeProcess = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--remote-debugging-port=9226',
    '--window-size=1920,1080',
    'http://localhost:8080/'
]);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    await sleep(2500);

    const tabsRes = await fetch('http://127.0.0.1:9226/json');
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

    console.log("✓ Connected to Chrome CDP on port 9226.");
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

    // 1. Check Console Runtime Errors
    const initialErrors = await evalCode('window.__errors');
    if (initialErrors && initialErrors.length > 0) {
        throw new Error(`Runtime errors found: ${JSON.stringify(initialErrors)}`);
    }
    console.log("✓ 0 JavaScript runtime errors upon initialization!");

    // Wait for 3D scene initialization
    for (let i = 0; i < 20; i++) {
        const isReady = await evalCode('Boolean(window.__interactableObjects && window.__interactableObjects.length > 0)');
        if (isReady) break;
        await sleep(500);
    }

    // 2. Test Typography / Font families
    console.log("\n--- [1] TYPOGRAPHY VERIFICATION ---");
    const bodyFont = await evalCode('getComputedStyle(document.body).fontFamily');
    console.log(`Body font family: ${bodyFont}`);
    if (!bodyFont.includes('Plus Jakarta Sans')) {
        throw new Error(`Expected body font to include Plus Jakarta Sans, got: ${bodyFont}`);
    }

    const brandTitleFont = await evalCode('getComputedStyle(document.querySelector(".brand-title")).fontFamily');
    console.log(`Brand title font family: ${brandTitleFont}`);
    if (!brandTitleFont.includes('Orbitron')) {
        throw new Error(`Expected brand title font to include Orbitron, got: ${brandTitleFont}`);
    }

    const catalogHeadingFont = await evalCode('getComputedStyle(document.querySelector(".catalog-heading")).fontFamily');
    console.log(`Catalog heading font family: ${catalogHeadingFont}`);
    if (!catalogHeadingFont.includes('Orbitron')) {
        throw new Error(`Expected catalog heading font to include Orbitron, got: ${catalogHeadingFont}`);
    }

    const navBtnFont = await evalCode('getComputedStyle(document.querySelector(".nav-btn")).fontFamily');
    console.log(`HUD Nav button font family: ${navBtnFont}`);
    if (!navBtnFont.includes('JetBrains Mono')) {
        throw new Error(`Expected HUD nav font to include JetBrains Mono, got: ${navBtnFont}`);
    }
    console.log("✓ Typography hierarchy verified (Orbitron / Plus Jakarta Sans / JetBrains Mono)!");

    // 3. Test Language Switching (UZ -> EN -> RU -> UZ)
    console.log("\n--- [2] MULTILINGUAL DYNAMIC SWITCHING ---");
    
    // Check initial Uzbek state
    const uzSubtitle = await evalCode('document.querySelector(".brand-subtitle").innerText');
    const uzSunLabel = await evalCode('document.querySelector(\'.nav-btn[data-target="sun"] .label\').innerText');
    const uzEarthLabel = await evalCode('document.querySelector(\'.nav-btn[data-target="Earth"] .label\').innerText');
    console.log(`Initial UZ: Subtitle="${uzSubtitle}", Sun="${uzSunLabel}", Earth="${uzEarthLabel}"`);
    if (!uzSubtitle.includes('9 Sayyora') || uzSunLabel !== 'Quyosh' || uzEarthLabel !== 'Yer') {
        throw new Error(`UZ language defaults incorrect!`);
    }

    // Switch to English (Click EN button)
    await evalCode('document.querySelector(\'.lang-btn[data-lang="en"]\').click()');
    await sleep(200);

    const enSubtitle = await evalCode('document.querySelector(".brand-subtitle").innerText');
    const enSunLabel = await evalCode('document.querySelector(\'.nav-btn[data-target="sun"] .label\').innerText');
    const enEarthLabel = await evalCode('document.querySelector(\'.nav-btn[data-target="Earth"] .label\').innerText');
    const enCatalogBtn = await evalCode('document.getElementById("catalog-btn-text").innerText');
    const enCatalogHeading = await evalCode('document.querySelector(".catalog-heading").innerText');
    console.log(`Switched to EN: Subtitle="${enSubtitle}", Sun="${enSunLabel}", Earth="${enEarthLabel}", Catalog="${enCatalogBtn}"`);
    console.log(`Catalog heading: "${enCatalogHeading}"`);
    if (!enSubtitle.includes('9-Planet') || enSunLabel !== 'Sun' || enEarthLabel !== 'Earth' || enCatalogBtn !== 'Projects') {
        throw new Error(`EN language texts failed to update!`);
    }

    // Focus Sun and verify English Info modal
    await evalCode('window.__focusOnObject(window.__interactableObjects.find(o => o.userData.isSun))');
    await sleep(1600);
    const enModalTitle = await evalCode('document.getElementById("info-title").innerText');
    const enModalBadge = await evalCode('document.getElementById("info-badge").innerText');
    console.log(`EN Sun Modal: Badge="${enModalBadge}", Title="${enModalTitle}"`);
    if (!enModalBadge.toLowerCase().includes('central star') || !enModalTitle.includes('Azimjon')) {
        throw new Error(`EN Sun Modal content mismatch: ${enModalBadge} / ${enModalTitle}`);
    }

    // Switch to Russian (Click RU button while modal is open)
    await evalCode('document.querySelector(\'.lang-btn[data-lang="ru"]\').click()');
    await sleep(200);

    const ruSubtitle = await evalCode('document.querySelector(".brand-subtitle").innerText');
    const ruSunLabel = await evalCode('document.querySelector(\'.nav-btn[data-target="sun"] .label\').innerText');
    const ruEarthLabel = await evalCode('document.querySelector(\'.nav-btn[data-target="Earth"] .label\').innerText');
    const ruCatalogBtn = await evalCode('document.getElementById("catalog-btn-text").innerText');
    const ruModalBadge = await evalCode('document.getElementById("info-badge").innerText');
    console.log(`Switched to RU: Subtitle="${ruSubtitle}", Sun="${ruSunLabel}", Earth="${ruEarthLabel}", ModalBadge="${ruModalBadge}"`);
    if (!ruSubtitle.includes('Портфолио 9 Планет') || ruSunLabel !== 'Солнце' || ruEarthLabel !== 'Земля' || ruCatalogBtn !== 'Проекты') {
        throw new Error(`RU language texts failed to update!`);
    }
    if (!ruModalBadge.toLowerCase().includes('центральная звезда')) {
        throw new Error(`RU Modal badge failed to live-update while open!`);
    }

    // Switch back to Uzbek
    await evalCode('document.querySelector(\'.lang-btn[data-lang="uz"]\').click()');
    await sleep(200);
    const uzRestoredBadge = await evalCode('document.getElementById("info-badge").innerText');
    console.log(`Restored UZ ModalBadge="${uzRestoredBadge}"`);
    if (!uzRestoredBadge.toLowerCase().includes('markaziy yulduz')) {
        throw new Error(`Failed to restore UZ modal content!`);
    }

    // Close modal
    await evalCode('window.__resetView()');
    await sleep(300);

    // 4. Test Mobile Viewport (390x844)
    console.log("\n--- [3] MOBILE VIEWPORT VERIFICATION (390x844) ---");
    await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true
    });
    await sleep(500);

    const mobileLangBtnsVisible = await evalCode(`
        const c = document.querySelector('.lang-switch-container');
        const rect = c.getBoundingClientRect();
        rect.width > 0 && rect.height > 0 && rect.top >= 0
    `);
    console.log(`Mobile Language Switcher visible and in viewport: ${mobileLangBtnsVisible}`);
    if (!mobileLangBtnsVisible) {
        throw new Error("Mobile Language Switcher is not visible or clipped!");
    }

    // Take Desktop & Mobile screenshots
    console.log("\n--- [4] CAPTURING VERIFICATION SCREENSHOT ---");
    const mobileScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/home/cyber/projects/3d-portfolio/mobile_multilingual_test.png', Buffer.from(mobileScreenshot.result.data, 'base64'));
    console.log("✓ Mobile screenshot saved to mobile_multilingual_test.png");

    // Reset to Desktop for desktop screenshot
    await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false
    });
    await sleep(500);

    const desktopScreenshot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/home/cyber/projects/3d-portfolio/desktop_multilingual_test.png', Buffer.from(desktopScreenshot.result.data, 'base64'));
    console.log("✓ Desktop screenshot saved to desktop_multilingual_test.png");

    console.log("\n=================================================");
    console.log("🎉 ALL MULTILINGUAL & TYPOGRAPHY TESTS PASSED 100%!");
    console.log("=================================================");
}

run()
    .catch(err => {
        console.error("❌ TEST FAILED:", err);
        process.exitCode = 1;
    })
    .finally(() => {
        chromeProcess.kill('SIGKILL');
        process.exit();
    });

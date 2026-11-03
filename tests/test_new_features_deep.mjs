import { spawn } from 'child_process';
import http from 'http';

console.log("================================================================================");
console.log("🚀 TESTING NEW FEATURES: GUIDE WALKTHROUGH, CONTACT TABS & MOON CHANNELS");
console.log("================================================================================");

const port = 9235;
const width = 390;
const height = 844;
const userDataDir = `/tmp/chrome_test_profile_${port}_${Date.now()}`;
const chromeArgs = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--enable-unsafe-swiftshader',
    '--ignore-certificate-errors',
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    `--user-data-dir=${userDataDir}`,
    'http://127.0.0.1:8080/'
];

const chromeProc = spawn('google-chrome-stable', chromeArgs);

let ws = null;
let idCounter = 1;
const callbacks = new Map();

function send(method, params = {}) {
    return new Promise((resolve) => {
        const id = idCounter++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function evalCode(expression) {
    const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
    });
    if (res.result && res.result.exceptionDetails) {
        throw new Error("Evaluation error: " + JSON.stringify(res.result.exceptionDetails));
    }
    return res.result ? res.result.result ? res.result.result.value : undefined : undefined;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

try {
    await sleep(2500);
    const tabsRes = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await tabsRes.json();
    const pageTab = tabs.find(t => t.type === 'page');
    if (!pageTab) throw new Error("Could not find any page tab!");

    ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && callbacks.has(msg.id)) {
            callbacks.get(msg.id)(msg);
            callbacks.delete(msg.id);
        }
    };

    await new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) resolve();
        else ws.onopen = resolve;
    });

    await send('Runtime.enable');
    await send('Page.enable');

    console.log("1. Waiting for Three.js engine and UI to be ready...");
    for (let i = 0; i < 30; i++) {
        const ready = await evalCode('typeof window.__setLanguage === "function"');
        if (ready) break;
        await sleep(400);
    }

    // [TEST 1] Guide Walkthrough Modal Open / Close
    console.log("\n--- [TEST 1] GUIDE WALKTHROUGH MODAL ---");
    const guideToggleVisible = await evalCode('!!document.getElementById("guide-toggle-btn")');
    if (!guideToggleVisible) throw new Error("Guide toggle button not found!");

    await evalCode('document.getElementById("guide-toggle-btn").click()');
    await sleep(300);
    const guideOpen = await evalCode(`(() => {
        const c = document.getElementById("guide-modal-container");
        return c && !c.classList.contains("hidden") && window.getComputedStyle(c).display !== "none";
    })()`);
    if (!guideOpen) throw new Error("Guide modal failed to open when clicking #guide-toggle-btn!");
    console.log("  ✓ Guide modal opened successfully via #guide-toggle-btn!");

    // Verify 4 steps presence
    const stepsCheck = await evalCode(`({
        heading: document.getElementById("guide-heading")?.innerText,
        step1: document.getElementById("guide-step1-title")?.innerText,
        step2: document.getElementById("guide-step2-title")?.innerText,
        step3: document.getElementById("guide-step3-title")?.innerText,
        step4: document.getElementById("guide-step4-title")?.innerText
    })`);
    console.log("  - Guide Steps:", stepsCheck);
    if (!stepsCheck.step1 || !stepsCheck.step2 || !stepsCheck.step3 || !stepsCheck.step4) {
        throw new Error("Guide modal missing step elements!");
    }

    // Close guide
    await evalCode('document.getElementById("guide-close-btn").click()');
    await sleep(600);
    const diag = await evalCode(`(() => {
        const c = document.getElementById("guide-modal-container");
        return {
            exists: !!c,
            classes: c ? c.className : null,
            hasHidden: c ? c.classList.contains("hidden") : false,
            display: c ? window.getComputedStyle(c).display : null
        };
    })()`);
    console.log("  - Guide Close Diag:", diag);
    const guideClosed = diag.hasHidden || diag.display === 'none';
    if (!guideClosed) throw new Error("Guide modal failed to close! Diag: " + JSON.stringify(diag));
    console.log("  ✓ Guide modal closed successfully via #guide-close-btn!");

    // [TEST 2] Guide Localization Sync
    console.log("\n--- [TEST 2] GUIDE LOCALIZATION SYNC ---");
    await evalCode('document.querySelector(".lang-btn[data-lang=\\"en\\"]").click()');
    await sleep(300);
    const guideEnText = await evalCode(`({
        btnText: document.getElementById("guide-toggle-text")?.innerText,
        heading: document.getElementById("guide-heading")?.innerText,
        step3: document.getElementById("guide-step3-title")?.innerText
    })`);
    console.log("  - Guide EN:", guideEnText);
    if (guideEnText.btnText !== "Guide" || !guideEnText.heading.includes("Welcome")) {
        throw new Error(`Guide localization to EN failed! text: ${JSON.stringify(guideEnText)}`);
    }
    console.log("  ✓ Guide localization to EN verified!");

    // Switch back to UZ
    await evalCode('document.querySelector(".lang-btn[data-lang=\\"uz\\"]").click()');
    await sleep(300);

    // [TEST 3] Moon Terminal Contact Channels & Direct VoIP
    console.log("\n--- [TEST 3] MOON TERMINAL CONTACT TABS & DIRECT CHANNELS ---");
    await evalCode('document.querySelector(".nav-btn[data-target=\\"moon\\"]").click()');
    await sleep(1500);

    const termUiState = await evalCode(`({
        isOpen: !document.getElementById("moon-terminal-container").classList.contains("hidden"),
        hasNoticeBox: !!document.querySelector(".terminal-notice-box"),
        noticeText: document.querySelector(".terminal-notice-box .notice-text")?.innerText,
        tabsCount: document.querySelectorAll(".terminal-type-tabs .type-tab").length,
        activeTab: document.querySelector(".terminal-type-tabs .type-tab.active")?.getAttribute("data-type"),
        contactPrefix: document.getElementById("terminal-contact-prefix")?.innerText,
        hasTgChannel: !!document.querySelector(".channel-btn.channel-tg"),
        hasEmailChannel: !!document.querySelector(".channel-btn.channel-email"),
        hasVoipChannel: !!document.querySelector(".channel-btn.channel-voip"),
        hasVoipHint: !!document.querySelector(".voip-hint")
    })`);
    console.log("  - Moon Terminal UI:", termUiState);
    if (!termUiState.isOpen) throw new Error("Moon terminal not displayed!");
    if (!termUiState.hasNoticeBox || !termUiState.noticeText.includes("Azimjondan")) {
        throw new Error("Notice banner from Azimjon missing or inaccurate!");
    }
    if (termUiState.tabsCount !== 3) {
        throw new Error(`Expected 3 contact channel tabs, found ${termUiState.tabsCount}!`);
    }
    if (!termUiState.hasTgChannel || !termUiState.hasEmailChannel || !termUiState.hasVoipChannel) {
        throw new Error("Direct contact channels (Telegram, Email, VoIP) missing!");
    }
    console.log("  ✓ Notice box, 3 channel tabs, and direct channels verified!");

    // Test Tab Switching: Click Email tab
    console.log("\n--- [TEST 4] SWITCHING CONTACT CHANNELS ---");
    await evalCode('document.querySelector(".type-tab[data-type=\\"email\\"]").click()');
    await sleep(200);
    const emailTabState = await evalCode(`({
        activeTab: document.querySelector(".terminal-type-tabs .type-tab.active")?.getAttribute("data-type"),
        prefix: document.getElementById("terminal-contact-prefix")?.innerText,
        placeholder: document.getElementById("terminal-contact")?.placeholder
    })`);
    console.log("  - Email Tab State:", emailTabState);
    if (emailTabState.activeTab !== 'email' || emailTabState.prefix !== '📧' || !emailTabState.placeholder.includes('@')) {
        throw new Error(`Email tab switch failed! state: ${JSON.stringify(emailTabState)}`);
    }
    console.log("  ✓ Switched to Email channel tab (prefix: 📧, email placeholder)");

    // Test Tab Switching: Click Phone tab
    await evalCode('document.querySelector(".type-tab[data-type=\\"phone\\"]").click()');
    await sleep(200);
    const phoneTabState = await evalCode(`({
        activeTab: document.querySelector(".terminal-type-tabs .type-tab.active")?.getAttribute("data-type"),
        prefix: document.getElementById("terminal-contact-prefix")?.innerText,
        placeholder: document.getElementById("terminal-contact")?.placeholder
    })`);
    console.log("  - Phone Tab State:", phoneTabState);
    if (phoneTabState.activeTab !== 'phone' || phoneTabState.prefix !== '📞') {
        throw new Error(`Phone tab switch failed! state: ${JSON.stringify(phoneTabState)}`);
    }
    console.log("  ✓ Switched to Phone channel tab (prefix: 📞)");

    // Close modal
    await evalCode('document.getElementById("modal-close").click()');
    await sleep(400);

    // Check final runtime console errors
    const errors = await evalCode('window.__errors || []');
    console.log(`\n  - Final Console Errors: ${errors.length}`);
    if (errors.length > 0) {
        throw new Error(`Runtime errors found: ${JSON.stringify(errors)}`);
    }

    console.log("\n================================================================================");
    console.log("🎉 ALL NEW FEATURES VERIFIED WITH 100% SUCCESS (0 ERRORS)!");
    console.log("================================================================================");
    process.exit(0);
} catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
} finally {
    try { ws.close(); } catch(e) {}
    try { chromeProc.kill(); } catch(e) {}
}

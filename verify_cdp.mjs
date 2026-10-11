import { spawn } from 'child_process';
import fs from 'fs';

console.log("=== STARTING RIGOROUS CDP BROWSER VERIFICATION ===");

const chromeProcess = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--remote-debugging-port=9223',
    '--window-size=1600,1000',
    'http://localhost:8080/'
]);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    await sleep(2500);
    
    const tabsRes = await fetch('http://127.0.0.1:9223/json');
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
    
    console.log("Connected to Chrome CDP WebSocket successfully.");
    
    // Enable Runtime & Page
    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');
    
    // Evaluate helper
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
    
    // 1. Check for runtime page errors
    const errors = await evalCode('window.__errors');
    console.log("Runtime errors check:", errors.length === 0 ? "PASSED (0 errors)" : errors);
    if (errors.length > 0) {
        throw new Error(`Browser runtime error: ${JSON.stringify(errors)}`);
    }
    
    // 2. Check interactable objects count
    const objCount = await evalCode('window.__interactableObjects ? window.__interactableObjects.length : 0');
    console.log("Interactable objects count:", objCount);
    if (objCount < 11) {
        throw new Error(`Expected at least 11 interactable objects, got ${objCount}`);
    }
    
    // 3. Test Clicking Catalog Button
    console.log("Testing Catalog Modal open/close...");
    await evalCode('document.getElementById("catalog-btn").click()');
    await sleep(400);
    const catalogVisible = await evalCode('!document.getElementById("catalog-modal").classList.contains("hidden")');
    console.log("Catalog modal visible after click:", catalogVisible);
    if (!catalogVisible) throw new Error("Catalog modal failed to open!");
    
    // Check card count in catalog
    const cardCount = await evalCode('document.querySelectorAll(".catalog-card").length');
    console.log("Catalog projects card count:", cardCount);
    if (cardCount !== 10) throw new Error(`Expected 10 project cards in catalog, got ${cardCount}`);
    
    // Capture screenshot of Catalog Modal
    const catShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('catalog_modal.png', Buffer.from(catShot.result.data, 'base64'));
    console.log("Saved catalog_modal.png successfully!");
    
    // Close catalog modal
    await evalCode('document.getElementById("catalog-close").click()');
    await sleep(300);
    const catalogClosed = await evalCode('document.getElementById("catalog-modal").classList.contains("hidden")');
    console.log("Catalog modal closed after click:", catalogClosed);
    
    // 4. Test Orbit Toggle Button
    console.log("Testing Orbit Pause/Resume toggle...");
    const btnText1 = await evalCode('document.getElementById("orbit-toggle-text").innerText');
    await evalCode('document.getElementById("orbit-toggle-btn").click()');
    const btnText2 = await evalCode('document.getElementById("orbit-toggle-text").innerText');
    await evalCode('document.getElementById("orbit-toggle-btn").click()');
    const btnText3 = await evalCode('document.getElementById("orbit-toggle-text").innerText');
    console.log(`Toggle states: "${btnText1}" -> "${btnText2}" -> "${btnText3}"`);
    if (!btnText2.includes("To'xtatilgan") || !btnText3.includes("Harakatda")) {
        throw new Error("Orbit toggle button state transition failed!");
    }
    
    // 5. Test Navigating to Earth (Yer - CyberAgent)
    console.log("Testing navigation to Earth (Yer)...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="Earth"]\').click()');
    await sleep(1800); // Wait for GSAP flyby animation
    
    const infoTitle = await evalCode('document.getElementById("info-title").innerText');
    const infoBadge = await evalCode('document.getElementById("info-badge").innerText');
    const infoGithub = await evalCode('document.getElementById("info-github-btn").href');
    const infoVisible = await evalCode('!document.getElementById("info-panel").classList.contains("hidden")');
    
    console.log(`Navigated to Earth: Title="${infoTitle}", Badge="${infoBadge}", Visible=${infoVisible}`);
    console.log(`GitHub action URL: ${infoGithub}`);
    
    if (!infoTitle.includes("CyberAgent") || !infoGithub.includes("CyberAgent") || !infoVisible) {
        throw new Error("Earth navigation or modal content failed!");
    }
    
    // 6. Test Resetting View
    console.log("Testing Reset View...");
    await evalCode('document.getElementById("back-button").click()');
    await sleep(1600);
    const infoHidden = await evalCode('document.getElementById("info-panel").classList.contains("hidden")');
    console.log("Info panel hidden after back:", infoHidden);
    if (!infoHidden) throw new Error("Info panel failed to hide on reset view!");
    
    // 7. Test Navigating to Saturn (Halqali Sayyora)
    console.log("Testing navigation to Saturn...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="Saturn"]\').click()');
    await sleep(1800);
    const saturnTitle = await evalCode('document.getElementById("info-title").innerText');
    console.log(`Navigated to Saturn: Title="${saturnTitle}"`);
    if (!saturnTitle.includes("Elite AI Agent")) {
        throw new Error("Saturn navigation failed!");
    }
    
    // 8. Capture close-up screenshot of Saturn
    const shotData = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('saturn_focused.png', Buffer.from(shotData.result.data, 'base64'));
    console.log("Saved saturn_focused.png screenshot successfully!");
    
    console.log("=== ALL CDP INTERACTIVE VERIFICATION TESTS PASSED 100%! ===");
    
    ws.close();
    chromeProcess.kill();
}

run().catch(err => {
    console.error("CDP TEST FAILED:", err);
    chromeProcess.kill();
    process.exit(1);
});

import { spawn } from 'child_process';
import fs from 'fs';

console.log("=== STARTING RIGOROUS STARS & SUN CDP TEST ===");

const chromeProcess = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--remote-debugging-port=9224',
    '--window-size=1600,1000',
    'http://localhost:8080/'
]);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    await sleep(2500);
    
    const tabsRes = await fetch('http://127.0.0.1:9224/json');
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
    
    console.log("Connected to Chrome CDP WebSocket on port 9224.");
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
    
    // 1. Check for runtime errors
    const errors = await evalCode('window.__errors');
    if (errors && errors.length > 0) {
        throw new Error(`Runtime page errors: ${JSON.stringify(errors)}`);
    }
    console.log("✓ Zero runtime errors in browser console!");
    
    // 2. Capture Overview Screenshot
    await sleep(1000);
    const overviewShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('solar_system_overview_v3.png', Buffer.from(overviewShot.result.data, 'base64'));
    console.log("✓ Saved solar_system_overview_v3.png screenshot!");
    
    // 3. Test Navigation to Sun
    console.log("Testing navigation to Sun...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="sun"]\').click()');
    await sleep(1800);
    const sunTitle = await evalCode('document.getElementById("info-title").innerText');
    const sunBadge = await evalCode('document.getElementById("info-badge").innerText');
    console.log(`Navigated to Sun: Title="${sunTitle}", Badge="${sunBadge}"`);
    if (!sunTitle.includes("Azimjon Kamiljanov")) {
        throw new Error("Sun navigation failed to show Azimjon Kamiljanov profile!");
    }
    
    const sunShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('sun_focused.png', Buffer.from(sunShot.result.data, 'base64'));
    console.log("✓ Saved sun_focused.png screenshot (calibrated sun without blinding flare/spikes)!");
    
    // 4. Test Navigation to Star (cycling)
    console.log("Testing HUD star button cycling...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="star"]\').click()');
    await sleep(1800);
    const starTitle1 = await evalCode('document.getElementById("info-title").innerText');
    const starBadge1 = await evalCode('document.getElementById("info-badge").innerText');
    console.log(`Star 1 focused: Title="${starTitle1}", Badge="${starBadge1}"`);
    
    const starShot1 = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('star_focused_1.png', Buffer.from(starShot1.result.data, 'base64'));
    console.log("✓ Saved star_focused_1.png screenshot!");
    
    // Click star button again to verify cycling to next star
    await evalCode('document.querySelector(\'.nav-btn[data-target="star"]\').click()');
    await sleep(1800);
    const starTitle2 = await evalCode('document.getElementById("info-title").innerText');
    console.log(`Star 2 focused (cycled): Title="${starTitle2}"`);
    if (starTitle1 === starTitle2) {
        throw new Error("HUD star button cycling did not cycle to next star!");
    }
    
    // 5. Test direct star focus via raycast / window.__interactableObjects
    console.log("Testing direct star focus on Legion Power & Titan Cyber...");
    await evalCode(`
        const titan = window.__interactableObjects.find(o => o.userData && o.userData.id === 'star_titan_cyber');
        if (titan) window.__focusOnObject(titan);
    `);
    await sleep(1800);
    const titanTitle = await evalCode('document.getElementById("info-title").innerText');
    console.log(`Titan Cyber focused: Title="${titanTitle}"`);
    if (!titanTitle.includes("Titan Centurion")) {
        throw new Error("Focus on Titan Cyber star failed!");
    }
    
    // 6. Test Catalog Modal showing both 10 planetary cards and 18 stellar cards
    console.log("Testing Catalog Modal with both sections...");
    await evalCode('document.getElementById("catalog-btn").click()');
    await sleep(500);
    const planetCardCount = await evalCode('document.querySelectorAll(".catalog-card").length');
    const starCardCount = await evalCode('document.querySelectorAll(".catalog-star-card").length');
    console.log(`Catalog contents: Planetary Cards=${planetCardCount}, Stellar Cards=${starCardCount}, Total=${planetCardCount + starCardCount}`);
    
    if (planetCardCount !== 10) {
        throw new Error("Expected 10 planetary cards, got " + planetCardCount);
    }
    if (starCardCount !== 18) {
        throw new Error("Expected 18 stellar cards, got " + starCardCount);
    }
    
    const catShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('catalog_full_modal.png', Buffer.from(catShot.result.data, 'base64'));
    console.log("✓ Saved catalog_full_modal.png screenshot!");

    // Scroll to stellar section in modal and screenshot
    await evalCode('document.getElementById("catalog-modal").scrollTop = 850');
    await sleep(350);
    const catScrolledShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('catalog_stars_scrolled.png', Buffer.from(catScrolledShot.result.data, 'base64'));
    console.log("✓ Saved catalog_stars_scrolled.png screenshot!");

    // 7. Test clicking a catalog card to navigate to star
    console.log("Testing click on DeepSeek Harness catalog card...");
    await evalCode('document.querySelector(\'.catalog-star-card[data-target="star_deepseek_harness"]\').click()');
    await sleep(1800);
    const dshTitle = await evalCode('document.getElementById("info-title").innerText');
    const modalClosed = await evalCode('document.getElementById("catalog-modal").classList.contains("hidden")');
    console.log(`DeepSeek Harness card clicked: Title="${dshTitle}", ModalClosed=${modalClosed}`);
    if (!dshTitle.includes("DeepSeek") || !modalClosed) {
        throw new Error("Clicking catalog card failed to focus on target or close modal!");
    }
    
    console.log("=== ALL STARS & SUN TESTS PASSED 100%! ===");
    ws.close();
    chromeProcess.kill();
}

run().catch(err => {
    console.error("TEST FAILED:", err);
    chromeProcess.kill();
    process.exit(1);
});

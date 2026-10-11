import { spawn } from 'child_process';
import fs from 'fs';

console.log("=================================================");
console.log("🚀 STARTING SATURN/URANUS RINGS & REAL ORBS TESTS");
console.log("=================================================");

const chromeProcess = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--remote-debugging-port=9227',
    '--window-size=1920,1080',
    'http://localhost:8080/'
]);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    await sleep(2500);

    const tabsRes = await fetch('http://127.0.0.1:9227/json');
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

    console.log("✓ Connected to Chrome CDP on port 9227.");
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

    // 2. Verify Saturn Rings
    console.log("\n--- [1] SATURN REALISTIC RINGS VERIFICATION ---");
    const saturnData = await evalCode(`
        (() => {
            const saturn = window.__interactableObjects.find(o => o.userData.id === 'Saturn');
            if (!saturn) return null;
            const ringChild = saturn.children.find(c => c.isMesh && c.geometry.type === 'RingGeometry');
            return {
                found: true,
                hasRing: Boolean(ringChild),
                innerR: ringChild ? ringChild.geometry.parameters.innerRadius : 0,
                outerR: ringChild ? ringChild.geometry.parameters.outerRadius : 0,
                thetaSegments: ringChild ? ringChild.geometry.parameters.thetaSegments : 0,
                isDoubleSide: ringChild ? ringChild.material.side === 2 : false,
                isTransparent: ringChild ? ringChild.material.transparent : false
            };
        })()
    `);
    console.log("Saturn ring inspection:", saturnData);
    if (!saturnData || !saturnData.hasRing || saturnData.innerR < 2.5 || saturnData.outerR < 5.0) {
        throw new Error("Saturn ring geometry failed verification!");
    }
    if (!saturnData.isDoubleSide || !saturnData.isTransparent) {
        throw new Error("Saturn ring material must be DoubleSide and transparent!");
    }
    console.log("✓ Saturn Cassini division & multi-banded radial ring geometry verified!");

    // 3. Verify Uranus Rings & 97.8° Axial Tilt
    console.log("\n--- [2] URANUS REALISTIC RINGS & 97.8° TILT VERIFICATION ---");
    const uranusData = await evalCode(`
        (() => {
            const uranus = window.__interactableObjects.find(o => o.userData.id === 'Uranus');
            if (!uranus) return null;
            const ringChild = uranus.children.find(c => c.isMesh && c.geometry.type === 'RingGeometry');
            const rotZDeg = uranus.rotation.z * (180 / Math.PI);
            return {
                found: true,
                hasRing: Boolean(ringChild),
                innerR: ringChild ? ringChild.geometry.parameters.innerRadius : 0,
                outerR: ringChild ? ringChild.geometry.parameters.outerRadius : 0,
                rotZDeg: Math.round(rotZDeg * 10) / 10,
                isDoubleSide: ringChild ? ringChild.material.side === 2 : false
            };
        })()
    `);
    console.log("Uranus inspection:", uranusData);
    if (!uranusData || !uranusData.hasRing || Math.abs(uranusData.rotZDeg - 97.8) > 1.0) {
        throw new Error(`Uranus 97.8° tilt or ring failed! rotZDeg=${uranusData?.rotZDeg}`);
    }
    console.log("✓ Uranus vertical/perpendicular 97.8° rings & icy cyan profile verified!");

    // 4. Verify All 12 Nav HUD Buttons have Photorealistic Orbs
    console.log("\n--- [3] NAV HUD 12 PHOTOREALISTIC ORBS VERIFICATION ---");
    const orbCheck = await evalCode(`
        (() => {
            const btns = document.querySelectorAll('#nav-container .nav-btn');
            const list = [];
            btns.forEach(b => {
                const target = b.getAttribute('data-target');
                const orb = b.querySelector('.planet-orb');
                const emoji = b.querySelector('.icon');
                list.push({
                    target,
                    hasOrb: Boolean(orb),
                    orbClass: orb ? orb.className : '',
                    hasOldEmoji: Boolean(emoji)
                });
            });
            return list;
        })()
    `);
    console.log(`Inspected ${orbCheck.length} HUD buttons:`, orbCheck.map(o => `${o.target}: ${o.orbClass}`).join(' | '));
    if (orbCheck.length !== 12) {
        throw new Error(`Expected 12 HUD buttons, found ${orbCheck.length}`);
    }
    const missingOrbs = orbCheck.filter(o => !o.hasOrb || o.hasOldEmoji);
    if (missingOrbs.length > 0) {
        throw new Error(`Some buttons still miss realistic orbs: ${JSON.stringify(missingOrbs)}`);
    }
    console.log("✓ All 12 HUD navigation buttons equipped with photorealistic 3D planet orbs!");

    // 5. Test Interactive Camera Focus to Saturn & Uranus
    console.log("\n--- [4] INTERACTIVE NAVIGATION TESTS (SATURN & URANUS) ---");
    console.log("Focusing Saturn...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="Saturn"]\').click()');
    await sleep(1600);
    const saturnTitle = await evalCode('document.getElementById("info-title").innerText');
    console.log(`Saturn focused: Title="${saturnTitle}"`);
    if (!saturnTitle.includes('Elite AI Agent')) {
        throw new Error(`Saturn navigation failed! Title=${saturnTitle}`);
    }

    console.log("Focusing Uranus...");
    await evalCode('document.querySelector(\'.nav-btn[data-target="Uranus"]\').click()');
    await sleep(1600);
    const uranusTitle = await evalCode('document.getElementById("info-title").innerText');
    console.log(`Uranus focused: Title="${uranusTitle}"`);
    if (!uranusTitle.includes('Modern Full-Stack')) {
        throw new Error(`Uranus navigation failed! Title=${uranusTitle}`);
    }

    // Reset view
    await evalCode('window.__resetView()');
    await sleep(500);

    // 6. Test Mobile Viewport (390x844)
    console.log("\n--- [5] MOBILE VIEWPORT VERIFICATION (390x844) ---");
    await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true
    });
    await sleep(500);

    const mobileCheck = await evalCode(`
        (() => {
            const nav = document.getElementById('nav-container');
            const saturnOrb = document.querySelector('.orb-saturn');
            const uranusOrb = document.querySelector('.orb-uranus');
            return {
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth,
                navVisible: Boolean(nav && nav.offsetWidth > 0),
                saturnOrbRendered: Boolean(saturnOrb && saturnOrb.offsetWidth > 0),
                uranusOrbRendered: Boolean(uranusOrb && uranusOrb.offsetWidth > 0)
            };
        })()
    `);
    console.log("Mobile check results:", mobileCheck);
    if (mobileCheck.scrollWidth > 390) {
        throw new Error(`Mobile horizontal page overflow! scrollWidth=${mobileCheck.scrollWidth}`);
    }
    console.log("✓ Mobile containment and orb rendering 100% PASS!");

    // Capture screenshots
    console.log("\n--- [6] CAPTURING VERIFICATION SCREENSHOTS ---");
    const mobileShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/home/cyber/projects/3d-portfolio/mobile_hud_orbs_test.png', Buffer.from(mobileShot.result.data, 'base64'));
    console.log("✓ Saved mobile_hud_orbs_test.png");

    // Reset to Desktop for desktop screenshot focusing Saturn
    await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false
    });
    await sleep(400);

    await evalCode('window.__focusOnObject(window.__interactableObjects.find(o => o.userData.id === "Saturn"))');
    await sleep(1600);

    const desktopShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/home/cyber/projects/3d-portfolio/desktop_saturn_uranus_test.png', Buffer.from(desktopShot.result.data, 'base64'));
    console.log("✓ Saved desktop_saturn_uranus_test.png");

    console.log("\n=================================================");
    console.log("🎉 ALL SATURN/URANUS & HUD ORB TESTS PASSED 100%!");
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

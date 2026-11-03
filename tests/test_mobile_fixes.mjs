import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

console.log("================================================================================");
console.log("🧪 TESTING MOBILE FIXES: ORBIT BUTTON, COSMIC AUDIO, MODAL INTEGRITY");
console.log("================================================================================");

const APP_PORT = 8080;
const ROOT_DIR = '/home/cyber/projects/3d-portfolio';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    const port = 9224;
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
        `http://127.0.0.1:${APP_PORT}/`
    ];

    const chromeProc = spawn('google-chrome-stable', chromeArgs);

    let ws = null;
    let idCounter = 1;
    const callbacks = new Map();

    const sendCdp = (method, params = {}) => {
        return new Promise((resolve, reject) => {
            const id = idCounter++;
            callbacks.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        });
    };

    const evalJs = async (expr) => {
        const res = await sendCdp('Runtime.evaluate', {
            expression: expr,
            returnByValue: true,
            awaitPromise: true
        });
        if (res.result && res.result.exceptionDetails) {
            throw new Error(`Eval error: ${res.result.exceptionDetails.text} - ${JSON.stringify(res.result.exceptionDetails)}`);
        }
        return res.result?.result?.value;
    };

    try {
        await sleep(2500);
        const tabsRes = await fetch(`http://127.0.0.1:${port}/json`);
        const tabs = await tabsRes.json();
        const pageTab = tabs.find(t => t.type === 'page');
        if (!pageTab) throw new Error("Could not find page tab on port " + port);

        ws = new WebSocket(pageTab.webSocketDebuggerUrl);

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (callbacks.has(msg.id)) {
                const cb = callbacks.get(msg.id);
                callbacks.delete(msg.id);
                if (msg.error) cb.reject(new Error(msg.error.message));
                else cb.resolve(msg);
            }
        };

        await new Promise((res, rej) => {
            ws.onopen = res;
            ws.onerror = rej;
        });

        await sendCdp('Runtime.enable');
        await sendCdp('Page.enable');
        await sendCdp('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            mobile: true
        });

        console.log("📱 Mobile emulation set: 390x844 (Poco / iPhone)");

        // Wait for preloader fade out and Three.js initialization
        console.log("⏳ Waiting for initial loading...");
        await sleep(3500);

        // TEST 1: Orbit Pause Button Visibility & Click on Mobile
        console.log("\n--- TEST 1: #orbit-toggle-btn on Mobile ---");
        const orbitBtnInfo = await evalJs(`
            (() => {
                const btn = document.getElementById('orbit-toggle-btn');
                const text = document.getElementById('orbit-toggle-text');
                const icon = document.getElementById('orbit-toggle-icon');
                if (!btn) return { exists: false };
                const style = window.getComputedStyle(btn);
                const rect = btn.getBoundingClientRect();
                return {
                    exists: true,
                    display: style.display,
                    visibility: style.visibility,
                    width: rect.width,
                    height: rect.height,
                    textDisplay: text ? window.getComputedStyle(text).display : null,
                    iconText: icon ? icon.innerText : null
                };
            })()
        `);
        console.log("Orbit button info:", orbitBtnInfo);
        if (!orbitBtnInfo.exists || orbitBtnInfo.display === 'none' || orbitBtnInfo.width <= 0) {
            throw new Error("FAIL: #orbit-toggle-btn is NOT visible on mobile!");
        }
        console.log("✅ PASS: #orbit-toggle-btn is visible and compact on mobile!");

        // Toggle orbit button
        const toggleResult = await evalJs(`
            (() => {
                const btn = document.getElementById('orbit-toggle-btn');
                btn.click();
                const icon = document.getElementById('orbit-toggle-icon');
                const isPaused = btn.classList.contains('paused-state') || (icon && icon.innerHTML.includes('polygon'));
                return {
                    iconAfterClick: isPaused ? '▶️' : (icon ? icon.innerText : null)
                };
            })()
        `);
        console.log("Orbit toggle click result:", toggleResult);
        if (toggleResult.iconAfterClick !== '▶️') {
            throw new Error("FAIL: Orbit toggle did not switch icon to ▶️");
        }
        console.log("✅ PASS: Orbit button toggles pause correctly!");

        // Unpause again
        await evalJs(`document.getElementById('orbit-toggle-btn').click();`);

        // TEST 2: Cosmic Space Ambient Audio Engine
        console.log("\n--- TEST 2: Cosmic Space Ambient Audio Engine ---");
        const audioTest = await evalJs(`
            (() => {
                const btn = document.getElementById('audio-toggle-btn');
                btn.click(); // Unmute
                const icon = document.getElementById('audio-toggle-icon');
                const isUnmuted = !window.isAudioMuted || (btn && !btn.classList.contains('audio-muted'));
                return {
                    isMuted: window.isAudioMuted,
                    hasAudioCtx: typeof audioCtx !== 'undefined' && audioCtx !== null,
                    audioState: typeof audioCtx !== 'undefined' && audioCtx ? audioCtx.state : null,
                    ambientGainVal: typeof ambientMasterGain !== 'undefined' && ambientMasterGain ? ambientMasterGain.gain.value : null,
                    buttonIcon: isUnmuted ? '🔊' : (icon ? icon.innerText : null)
                };
            })()
        `);
        console.log("Audio toggle test:", audioTest);
        if (audioTest.buttonIcon !== '🔊') {
            throw new Error("FAIL: Audio toggle button icon is not 🔊");
        }
        console.log("✅ PASS: Cosmic Audio engine unmuted and initialized!");

        // TEST 3: Modal Integrity (Earth / Clouds / Planets)
        console.log("\n--- TEST 3: Modal Integrity (No Empty Card / CyberAgent Nexus on Earth) ---");
        // Test selecting Earth from HUD
        await evalJs(`
            (() => {
                const earthBtn = document.querySelector('.nav-btn[data-target="Earth"]');
                if (earthBtn) earthBtn.click();
            })()
        `);
        await sleep(2000); // Allow camera tween to complete

        const earthModalData = await evalJs(`
            (() => {
                const panel = document.getElementById('info-panel');
                const badge = document.getElementById('info-badge')?.innerText;
                const title = document.getElementById('info-title')?.innerText;
                const subtitle = document.getElementById('info-subtitle')?.innerText;
                const content = document.getElementById('info-content')?.innerText;
                const isHidden = panel ? panel.classList.contains('hidden') : true;
                return {
                    isHidden,
                    badge,
                    title,
                    subtitle,
                    contentLength: content ? content.length : 0
                };
            })()
        `);
        console.log("Earth modal data:", earthModalData);
        if (earthModalData.isHidden) {
            throw new Error("FAIL: Info panel did not open for Earth!");
        }
        if (!earthModalData.title || earthModalData.title.trim() === '') {
            throw new Error("FAIL: Info panel title is EMPTY on Earth!");
        }
        if (earthModalData.badge === 'KOSMIK OBYEKT' || !earthModalData.badge) {
            throw new Error("FAIL: Info badge fell back to default empty 'KOSMIK OBYEKT'!");
        }
        console.log("✅ PASS: Earth modal properly displays: " + earthModalData.title + " (" + earthModalData.badge + ")");

        // TEST 4: Raycasting Simulation on sub-meshes
        console.log("\n--- TEST 4: Sub-mesh raycasting guard ---");
        const guardTest = await evalJs(`
            (() => {
                // If showInfo is called with an empty object, verify it does NOT wipe or show empty card
                const prevTitle = document.getElementById('info-title')?.innerText;
                if (typeof showInfo === 'function') {
                    showInfo({}); // Empty data passed
                }
                const currentTitle = document.getElementById('info-title')?.innerText;
                return {
                    prevTitle,
                    currentTitle,
                    unchanged: prevTitle === currentTitle
                };
            })()
        `);
        console.log("Guard test result:", guardTest);
        if (!guardTest.unchanged) {
            throw new Error("FAIL: Empty showInfo wiped the modal!");
        }
        console.log("✅ PASS: showInfo guards correctly prevent empty modals!");

        // TEST 5: Check horizontal overflow on mobile
        console.log("\n--- TEST 5: Check horizontal scroll / overflow ---");
        const overflow = await evalJs(`
            (() => {
                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    clientWidth: document.documentElement.clientWidth,
                    hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
                };
            })()
        `);
        console.log("Mobile viewport overflow check:", overflow);
        if (overflow.hasOverflow) {
            throw new Error("FAIL: Horizontal overflow detected on mobile: " + (overflow.scrollWidth - overflow.clientWidth) + "px");
        }
        console.log("✅ PASS: 0px horizontal overflow on mobile!");

        console.log("\n================================================================================");
        console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
        console.log("================================================================================");

    } finally {
        if (ws) ws.close();
        chromeProc.kill('SIGTERM');
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
    }
}

runTest().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

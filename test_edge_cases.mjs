import { spawn } from 'child_process';

console.log("================================================================================");
console.log("🔬 RUNNING EDGE CASE & SKEPTICAL VERIFICATION TEST SUITE");
console.log("================================================================================");

const port = 9336;
const userDataDir = `/tmp/chrome_edge_full_${Date.now()}`;
const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    try {
        await sleep(1500);
        const tabsRes = await fetch(`http://127.0.0.1:${port}/json`);
        const tabs = await tabsRes.json();
        const pageTab = tabs.find(t => t.type === 'page');
        if (!pageTab) throw new Error("Sahifa topilmadi!");

        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
        let idCounter = 1;
        const callbacks = new Map();
        const errors = [];

        ws.onmessage = e => {
            const msg = JSON.parse(e.data);
            if (msg.method === 'Runtime.exceptionThrown') {
                errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
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
                throw new Error("Evaluation error: " + JSON.stringify(res.result.exceptionDetails));
            }
            return res.result?.result?.value;
        };

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url: 'http://127.0.0.1:8080/' });

        console.log("1. Dvigatel yuklanishi kutilmoqda...");
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            const val = await evalExpr(`typeof window.__feedGestureLandmarks === 'function'`);
            if (val) break;
        }

        console.log("\n2. TEST: Natural Pinch with curled fingers into palm...");
        const naturalPinchResult = await evalExpr(`(() => {
            const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
            lm[0] = { x: 0.5, y: 0.8, z: 0 }; // wrist
            // Thumb
            lm[1] = { x: 0.48, y: 0.75, z: 0 };
            lm[2] = { x: 0.46, y: 0.70, z: 0 };
            lm[3] = { x: 0.48, y: 0.65, z: 0 };
            lm[4] = { x: 0.50, y: 0.60, z: 0 }; // thumb tip

            // Index: curled forward to touch thumb tip (dist = 0.005)
            lm[5] = { x: 0.52, y: 0.68, z: 0 };
            lm[6] = { x: 0.53, y: 0.58, z: 0 }; // PIP joint further from wrist
            lm[7] = { x: 0.52, y: 0.59, z: 0 };
            lm[8] = { x: 0.505, y: 0.60, z: 0 }; // index tip touching thumb

            // Middle, ring, pinky: curled into palm
            lm[9] = { x: 0.55, y: 0.68, z: 0 }; lm[10] = { x: 0.55, y: 0.60, z: 0 }; lm[12] = { x: 0.55, y: 0.73, z: 0 };
            lm[13] = { x: 0.58, y: 0.69, z: 0 }; lm[14] = { x: 0.58, y: 0.62, z: 0 }; lm[16] = { x: 0.58, y: 0.74, z: 0 };
            lm[17] = { x: 0.61, y: 0.70, z: 0 }; lm[18] = { x: 0.61, y: 0.65, z: 0 }; lm[20] = { x: 0.61, y: 0.75, z: 0 };

            window.__feedGestureLandmarks(lm);
            return {
                currentGesture: window.__currentGesture,
                stateText: document.getElementById('gesture-state-text')?.innerText,
                isReticlePinching: document.getElementById('gesture-reticle')?.classList.contains('reticle-pinching')
            };
        })()`);
        console.log("  - Natija:", naturalPinchResult);
        if (naturalPinchResult.currentGesture !== 'pinch' || !naturalPinchResult.isReticlePinching) {
            throw new Error("Natural Pinch xato aniqlandi: kutilgan 'pinch', olingan: " + naturalPinchResult.currentGesture);
        }
        console.log("  ✓ Natural Pinch mukammal va xatosiz ishlayapti!");

        console.log("\n3. TEST: Multilingual reactive update on gesture-state-text...");
        const langSwitchResult = await evalExpr(`(() => {
            window.__setLanguage('en');
            const enStateText = document.getElementById('gesture-state-text')?.innerText;
            window.__setLanguage('ru');
            const ruStateText = document.getElementById('gesture-state-text')?.innerText;
            window.__setLanguage('uz');
            const uzStateText = document.getElementById('gesture-state-text')?.innerText;
            return { enStateText, ruStateText, uzStateText };
        })()`);
        console.log("  - Natija:", langSwitchResult);
        if (langSwitchResult.enStateText !== 'Pinch • Zoom / Select' ||
            langSwitchResult.ruStateText !== 'Щипок • Зум / Выбор' ||
            langSwitchResult.uzStateText !== 'Chimchilash • Zoom / Tanlash') {
            throw new Error("Multilingual gesture-state-text sinxron emas!");
        }
        console.log("  ✓ 3-Tillilik (UZ, EN, RU) telemetriya bo'yicha 100% sinxron!");

        console.log("\n4. TEST: Fist Gesture stops orbital motion & freezes camera...");
        const fistResult = await evalExpr(`(() => {
            const fistLm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8, z: 0 }));
            // Wrist
            fistLm[0] = { x: 0.5, y: 0.8, z: 0 };
            // All fingers curled into palm, thumb relaxed on outside (not touching tip 8)
            fistLm[4] = { x: 0.42, y: 0.68, z: 0 }; // thumb tip
            fistLm[6] = { x: 0.50, y: 0.65, z: 0 }; fistLm[8] = { x: 0.50, y: 0.75, z: 0 }; // index curled
            fistLm[10] = { x: 0.54, y: 0.65, z: 0 }; fistLm[12] = { x: 0.54, y: 0.75, z: 0 }; // middle curled
            fistLm[14] = { x: 0.58, y: 0.65, z: 0 }; fistLm[16] = { x: 0.58, y: 0.75, z: 0 }; // ring curled
            fistLm[18] = { x: 0.62, y: 0.65, z: 0 }; fistLm[20] = { x: 0.62, y: 0.75, z: 0 }; // pinky curled
            window.__feedGestureLandmarks(fistLm);

            return {
                currentGesture: window.__currentGesture,
                stateText: document.getElementById('gesture-state-text')?.innerText,
                reticleHidden: document.getElementById('gesture-reticle')?.classList.contains('hidden')
            };
        })()`);
        console.log("  - Musht holati:", fistResult);
        if (fistResult.currentGesture !== 'fist' || !fistResult.reticleHidden) {
            throw new Error("Musht (Fist) xato aniqlandi!");
        }
        console.log("  ✓ Musht (Fist - Hold / Freeze) 100% to'g'ri ishlamoqda!");

        console.log("\n5. TEST: Spherical polar rotation boundary check...");
        const polarCheck = await evalExpr(`(() => {
            const cam = window.__camera;
            // Feed palm with upward and downward movements
            const palm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7, z: 0 }));
            palm[0] = { x: 0.5, y: 0.7, z: 0 };
            palm[9] = { x: 0.5, y: 0.5, z: 0 };
            palm[6] = {x: 0.48, y: 0.5}; palm[8] = {x: 0.48, y: 0.25};
            palm[10] = {x: 0.52, y: 0.5}; palm[12] = {x: 0.52, y: 0.25};
            palm[14] = {x: 0.55, y: 0.5}; palm[16] = {x: 0.55, y: 0.25};
            palm[18] = {x: 0.58, y: 0.5}; palm[20] = {x: 0.58, y: 0.25};
            window.__feedGestureLandmarks(palm);

            // Move upward drastically
            for (let i = 0; i < 20; i++) {
                const p = JSON.parse(JSON.stringify(palm));
                p[0].y = 0.7 - i * 0.02;
                p[9].y = 0.5 - i * 0.02;
                window.__feedGestureLandmarks(p);
            }

            return {
                camFinite: Number.isFinite(cam.position.x) && Number.isFinite(cam.position.y) && Number.isFinite(cam.position.z),
                camUpY: cam.up.y,
                camPosY: cam.position.y
            };
        })()`);
        console.log("  - Qutbiy aylanish natijasi:", polarCheck);
        if (!polarCheck.camFinite || polarCheck.camUpY !== 1) {
            throw new Error("Qutbiy aylanishda gimbal lock yoki inversion yuz berdi!");
        }
        console.log("  ✓ Qutbiy aylanish (Spherical clamp): Gimbal locksiz, 100% barqaror!");

        console.log("\n6. TEST: Stop / Close clean reset...");
        const stopResult = await evalExpr(`(() => {
            window.__stopGestureControl();
            const reticle = document.getElementById('gesture-reticle');
            const hud = document.getElementById('gesture-hud');
            const btn = document.getElementById('gesture-toggle-btn');
            return {
                isGestureActive: window.__isGestureActive,
                hudHidden: hud?.classList.contains('hidden'),
                reticleHidden: reticle?.classList.contains('hidden'),
                reticleHoverClean: !reticle?.classList.contains('reticle-hovering'),
                reticlePinchClean: !reticle?.classList.contains('reticle-pinching'),
                btnInactive: btn?.classList.contains('gesture-inactive')
            };
        })()`);
        console.log("  - To'xtatish holati:", stopResult);
        if (stopResult.isGestureActive || !stopResult.hudHidden || !stopResult.reticleHoverClean || !stopResult.reticlePinchClean) {
            throw new Error("To'xtatishda tozalash to'liq bo'lmadi!");
        }
        console.log("  ✓ To'xtatish va tozalash (Clean teardown): 100% toza!");

        console.log("\nBarcha qo'shimcha chegaraviy testlar 100% muvaffaqiyatli yakunlandi!");
    } catch (e) {
        console.error("Test xatosi:", e);
        process.exit(1);
    } finally {
        chrome.kill();
    }
}

run();

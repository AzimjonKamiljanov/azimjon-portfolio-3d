import { spawn } from 'child_process';

console.log("=================================================");
console.log("🔍 RUNNING COMPREHENSIVE SYSTEM & UX AUDIT");
console.log("=================================================");

const chromeProcess = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--remote-debugging-port=9228',
    '--window-size=1920,1080',
    'http://localhost:8080/'
]);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    await sleep(2500);

    const tabsRes = await fetch('http://127.0.0.1:9228/json');
    const tabs = await tabsRes.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('localhost:8080'));

    if (!pageTab) throw new Error("Could not find localhost:8080 page tab in Chrome!");

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let idCounter = 1;
    const callbacks = new Map();

    const consoleLogs = [];
    const networkFailures = [];

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Log.entryAdded') {
            consoleLogs.push(msg.params.entry);
        }
        if (msg.method === 'Network.responseReceived') {
            if (msg.params.response.status >= 400) {
                networkFailures.push({ url: msg.params.response.url, status: msg.params.response.status });
            }
        }
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

    await sendCommand('Runtime.enable');
    await sendCommand('Page.enable');
    await sendCommand('Network.enable');
    await sendCommand('Log.enable');

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

    // Wait for 3D scene
    for (let i = 0; i < 20; i++) {
        const isReady = await evalCode('Boolean(window.__interactableObjects && window.__interactableObjects.length > 0)');
        if (isReady) break;
        await sleep(500);
    }

    console.log("\n--- [AUDIT 1] BROWSER ERRORS & NETWORK REQUESTS ---");
    const runtimeErrors = await evalCode('window.__errors');
    console.log("window.__errors:", runtimeErrors);
    console.log("Console log entries (warnings/errors):", consoleLogs);
    console.log("Network 4xx/5xx failures:", networkFailures);

    console.log("\n--- [AUDIT 2] WEBGL RENDERER METRICS & PERFORMANCE ---");
    const webglStats = await evalCode(`
        (() => {
            // Find renderer
            const canvas = document.querySelector('canvas');
            return {
                interactableCount: window.__interactableObjects.length,
                canvasWidth: canvas ? canvas.width : 0,
                canvasHeight: canvas ? canvas.height : 0
            };
        })()
    `);
    console.log("WebGL stats:", webglStats);

    // Measure FPS over 1.5 seconds
    const fpsMeasure = await evalCode(`
        new Promise(resolve => {
            let frames = 0;
            const start = performance.now();
            function count() {
                frames++;
                if (performance.now() - start < 1500) {
                    requestAnimationFrame(count);
                } else {
                    const elapsed = (performance.now() - start) / 1000;
                    resolve(Math.round(frames / elapsed));
                }
            }
            requestAnimationFrame(count);
        })
    `);
    console.log("Measured Animation FPS (Headless SwiftShader software render):", fpsMeasure);

    console.log("\n--- [AUDIT 3] HTML HEAD & METADATA AUDIT ---");
    const headMeta = await evalCode(`
        (() => {
            return {
                title: document.title,
                description: document.querySelector('meta[name="description"]')?.content || null,
                keywords: document.querySelector('meta[name="keywords"]')?.content || null,
                author: document.querySelector('meta[name="author"]')?.content || null,
                themeColor: document.querySelector('meta[name="theme-color"]')?.content || null,
                ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
                ogDescription: document.querySelector('meta[property="og:description"]')?.content || null,
                ogImage: document.querySelector('meta[property="og:image"]')?.content || null,
                favicon: document.querySelector('link[rel="icon"]')?.href || document.querySelector('link[rel="shortcut icon"]')?.href || null
            };
        })()
    `);
    console.log("Metadata status:", headMeta);

    console.log("\n--- [AUDIT 4] CATALOG MODAL & CARD LINK AUDIT ---");
    const catalogCards = await evalCode(`
        (() => {
            const cards = document.querySelectorAll('.catalog-card, .catalog-star-card');
            const data = [];
            cards.forEach(c => {
                const title = c.querySelector('h3')?.innerText;
                const link = c.querySelector('.card-link')?.href;
                const target = c.getAttribute('data-target');
                data.push({ target, title, link });
            });
            return {
                totalCards: cards.length,
                cards: data
            };
        })()
    `);
    console.log(`Total catalog cards: ${catalogCards.totalCards}`);
    const noLinks = catalogCards.cards.filter(c => !c.link || c.link.endsWith('#') || c.link === '');
    console.log("Cards with empty or placeholder links:", noLinks);

    console.log("\n--- [AUDIT 5] CONTROLS & USER INTERACTION AUDIT ---");
    const controlsAudit = await evalCode(`
        (() => {
            const c = window.__controls;
            return {
                enableDamping: c.enableDamping,
                dampingFactor: c.dampingFactor,
                minDistance: c.minDistance,
                maxDistance: c.maxDistance,
                enablePan: c.enablePan,
                hasOrbitToggle: Boolean(document.getElementById('orbit-toggle-btn')),
                hasAudioSupport: Boolean(document.querySelector('audio') || window.__audioContext),
                hasSearchFilter: Boolean(document.querySelector('#catalog-search') || document.querySelector('.search-input')),
                hasResetViewBtn: Boolean(document.querySelector('#reset-cam-btn') || document.querySelector('#home-btn'))
            };
        })()
    `);
    console.log("Controls & interactive features:", controlsAudit);

    console.log("\n--- [AUDIT 6] MOBILE USABILITY (360x640 Small Screen) ---");
    await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 360,
        height: 640,
        deviceScaleFactor: 2,
        mobile: true
    });
    await sleep(400);
    const smallMobileAudit = await evalCode(`
        (() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth,
                navScrollWidth: document.getElementById('nav-container')?.scrollWidth,
                navClientWidth: document.getElementById('nav-container')?.clientWidth,
                headerHeight: document.getElementById('brand-header')?.offsetHeight
            };
        })()
    `);
    console.log("Small mobile (360x640) metrics:", smallMobileAudit);

    console.log("\n=================================================");
    console.log("✅ AUDIT DATA COLLECTION COMPLETE");
    console.log("=================================================");
}

run()
    .catch(err => {
        console.error("❌ AUDIT FAILED:", err);
    })
    .finally(() => {
        chromeProcess.kill('SIGKILL');
        process.exit();
    });

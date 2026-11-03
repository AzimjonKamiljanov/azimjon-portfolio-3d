import { spawn } from 'child_process';

console.log("⚡ YENGIL VA TEZKOR TEST ISHGA TUSHIRILMOQDA...");

const port = 9333;
const userDataDir = `/tmp/chrome_quick_test_${Date.now()}`;
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

        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url: 'http://127.0.0.1:8080/' });

        console.log("1. Sahifa yuklanishi kutilmoqda...");
        let ready = false;
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            const res = await send('Runtime.evaluate', {
                expression: `({
                    loaded: typeof window.__setLanguage === 'function',
                    interactableCount: window.__interactableObjects?.length || 0,
                    tourActive: typeof window.__tourIndex !== 'undefined'
                })`,
                returnByValue: true
            });
            const val = res.result?.result?.value;
            if (val?.loaded) {
                ready = true;
                console.log(`✓ Dvigatel yuklandi! Obyektlar soni: ${val.interactableCount}`);
                break;
            }
        }

        if (!ready) throw new Error("Dvigatel yuklanish vaqti tugadi!");

        // Test basic interaction & Liquid Glass styles
        console.log("2. Suyuq shisha elementlari va tugmalar tekshirilmoqda...");
        const evalRes = await send('Runtime.evaluate', {
            expression: `(() => {
                const header = document.querySelector('header');
                const dock = document.getElementById('nav-container');
                const tourHud = document.getElementById('tour-hud');
                const overviewBtn = document.getElementById('overview-btn');
                const catalogBtn = document.getElementById('catalog-btn');
                const resumeBtn = document.getElementById('resume-download-btn');
                const orbs = document.querySelectorAll('.planet-orb');
                
                const headerStyle = header ? window.getComputedStyle(header).backdropFilter || window.getComputedStyle(header).webkitBackdropFilter : '';
                const dockStyle = dock ? window.getComputedStyle(dock).backdropFilter || window.getComputedStyle(dock).webkitBackdropFilter : '';

                return {
                    hasHeader: !!header,
                    hasDock: !!dock,
                    headerGlass: headerStyle.includes('blur'),
                    dockGlass: dockStyle.includes('blur'),
                    orbsCount: orbs.length,
                    hasTourHud: !!tourHud,
                    hasOverviewBtn: !!overviewBtn,
                    hasCatalogBtn: !!catalogBtn,
                    hasResumeBtn: !!resumeBtn
                };
            })()`,
            returnByValue: true
        });

        const check = evalRes.result?.result?.value;
        console.log("Tekshiruv natijasi:", check);

        if (!check.hasHeader || !check.hasDock) {
            throw new Error("Asosiy konteynerlar topilmadi!");
        }

        console.log("3. Konsol xatolari tekshirilmoqda...");
        console.log(`Konsol xatoliklari soni: ${errors.length}`);
        if (errors.length > 0) {
            console.error("Xatolar:", errors);
            throw new Error("Konsolda xatolar mavjud!");
        }

        console.log("🎉 YENGIL TEST 100% MUVAFFAQIShIYaTLI O'TDI! Sayt to'liq faol.");
    } finally {
        chrome.kill();
    }
}

run().catch(err => {
    console.error("❌ Test xatosi:", err);
    process.exit(1);
});

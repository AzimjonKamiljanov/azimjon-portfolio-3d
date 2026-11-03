import { spawn } from 'child_process';
import fs from 'fs';

console.log("📸 BOTTOM DOCK SCREENSHOT VA TELEMETRIYA TEKSHIRILMOQDA...");

const port = 9444;
const userDataDir = `/tmp/chrome_dock_test_${Date.now()}`;
const chrome = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1920,1080',
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

        ws.onmessage = e => {
            const msg = JSON.parse(e.data);
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
        await send('Emulation.setDeviceMetricsOverride', {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1,
            mobile: false
        });

        await send('Page.navigate', { url: 'http://127.0.0.1:8080/' });
        await sleep(2500);

        const dockMetrics = await send('Runtime.evaluate', {
            expression: `(() => {
                const nav = document.getElementById('nav-container');
                const rect = nav.getBoundingClientRect();
                const style = window.getComputedStyle(nav);
                const buttons = document.querySelectorAll('#nav-container .nav-btn');
                const firstBtn = buttons[0]?.getBoundingClientRect();
                const lastBtn = buttons[buttons.length - 1]?.getBoundingClientRect();
                
                return {
                    dockWidth: rect.width,
                    dockHeight: rect.height,
                    dockLeft: rect.left,
                    dockRight: rect.right,
                    windowWidth: window.innerWidth,
                    leftPadding: firstBtn ? firstBtn.left - rect.left : 0,
                    rightPadding: lastBtn ? rect.right - lastBtn.right : 0,
                    backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
                    background: style.background,
                    borderRadius: style.borderRadius
                };
            })()`,
            returnByValue: true
        });

        console.log("Desktop Dock Metriklari:", dockMetrics.result?.result?.value);

        // Clip screenshot directly around bottom dock
        const navClip = await send('Runtime.evaluate', {
            expression: `(() => {
                const nav = document.getElementById('nav-container');
                const rect = nav.getBoundingClientRect();
                return {
                    x: Math.max(0, rect.left - 40),
                    y: Math.max(0, rect.top - 30),
                    width: rect.width + 80,
                    height: rect.height + 60,
                    scale: 1
                };
            })()`,
            returnByValue: true
        });

        const clip = navClip.result?.result?.value;
        const shotRes = await send('Page.captureScreenshot', {
            clip: {
                x: clip.x,
                y: clip.y,
                width: clip.width,
                height: clip.height,
                scale: 1
            }
        });

        if (shotRes.result?.data) {
            fs.writeFileSync('/tmp/dock_liquid_glass.png', Buffer.from(shotRes.result.data, 'base64'));
            console.log("📸 Suyuq shisha dok skrinshoti saqlandi: /tmp/dock_liquid_glass.png");
        }

        // Also full 1920x1080 screenshot
        const fullShot = await send('Page.captureScreenshot', {});
        if (fullShot.result?.data) {
            fs.writeFileSync('/tmp/desktop_full_dock.png', Buffer.from(fullShot.result.data, 'base64'));
            console.log("📸 Butun desktop skrinshoti saqlandi: /tmp/desktop_full_dock.png");
        }

    } finally {
        chrome.kill();
    }
}

run().catch(console.error);

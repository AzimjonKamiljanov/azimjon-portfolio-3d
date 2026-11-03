import { spawn } from 'child_process';

const port = 9240;
const chromeProc = spawn('google-chrome-stable', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    `--remote-debugging-port=${port}`,
    'http://127.0.0.1:8080/'
]);

await new Promise(r => setTimeout(r, 2000));
const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const tab = tabs.find(t => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 1;
const req = (method, params = {}) => new Promise(res => {
    const cur = id++;
    const h = (e) => {
        const m = JSON.parse(e.data);
        if (m.id === cur) { ws.removeEventListener('message', h); res(m.result); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: cur, method, params }));
});

await new Promise(r => ws.onopen = r);
await req('Runtime.enable');

// Wait for load
await new Promise(r => setTimeout(r, 2000));

const res = await req('Runtime.evaluate', {
    expression: `(() => {
        const btn = document.getElementById("guide-toggle-btn");
        const container = document.getElementById("guide-modal-container");
        const closeBtn = document.getElementById("guide-close-btn");
        
        btn.click();
        const opened = container.classList.contains("hidden");
        
        closeBtn.click();
        const closed = container.classList.contains("hidden");
        const styleDisplay = window.getComputedStyle(container).display;
        
        return {
            hasCloseBtn: !!closeBtn,
            closeBtnOuter: closeBtn ? closeBtn.outerHTML : null,
            openedHidden: opened,
            closedHidden: closed,
            styleDisplay: styleDisplay,
            containerClasses: container.className
        };
    })()`,
    returnByValue: true
});

console.log("DEBUG GUIDE RESULT:", res.result ? res.result.value : res);
ws.close();
chromeProc.kill();

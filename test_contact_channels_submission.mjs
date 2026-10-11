import { spawn } from 'child_process';

console.log("================================================================================");
console.log("🧪 TESTING CONTACT CHANNELS SUBMISSION: TG, EMAIL, PHONE");
console.log("================================================================================");

const port = 9245;
const chromeArgs = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    `--remote-debugging-port=${port}`,
    'http://127.0.0.1:8080/'
];

const chromeProc = spawn('google-chrome-stable', chromeArgs);

let ws = null;
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

const evalCode = async (expr) => {
    const res = await req('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
    });
    if (res && res.exceptionDetails) {
        throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res ? res.result?.value : undefined;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

try {
    await sleep(2500);
    const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const tab = tabs.find(t => t.type === 'page');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    await req('Runtime.enable');

    console.log("1. Waiting for page load and opening Moon terminal...");
    await sleep(2000);

    // Open Moon section
    await evalCode(`document.querySelector('.nav-btn[data-target="moon"]').click()`);
    await sleep(1500);

    // Test 1: Submit with Email
    console.log("\n--- TEST 1: SUBMISSION WITH EMAIL ---");
    const emailResult = await evalCode(`(async () => {
        // Switch to email tab
        const emailTab = document.querySelector('.type-tab[data-type="email"]');
        if (emailTab) emailTab.click();

        document.getElementById('terminal-name').value = 'Test Email Foydalanuvchi';
        document.getElementById('terminal-contact').value = 'test_investor@startup.io';
        document.getElementById('terminal-message').value = 'Salom! Yangi AI startap loyihasi boʻyicha hamkorlik taklif qilamiz.';

        const form = document.getElementById('terminal-form');
        const submitPromise = new Promise(resolve => {
            const obs = new MutationObserver(() => {
                const fb = document.getElementById('terminal-feedback');
                if (fb && !fb.classList.contains('hidden') && !fb.classList.contains('sending')) {
                    obs.disconnect();
                    resolve({
                        text: fb.innerText,
                        isSuccess: fb.classList.contains('success'),
                        isError: fb.classList.contains('error')
                    });
                }
            });
            obs.observe(document.getElementById('terminal-feedback'), { attributes: true, childList: true, subtree: true });
        });

        form.requestSubmit();
        return await Promise.race([
            submitPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for email submission feedback')), 12000))
        ]);
    })()`);
    console.log("Email Submission Result:", emailResult);
    if (!emailResult.isSuccess) {
        throw new Error("Email submission failed! Result: " + JSON.stringify(emailResult));
    }
    console.log("✅ PASS: Email submission succeeded!");

    await sleep(1000);

    // Test 2: Submit with Phone Number
    console.log("\n--- TEST 2: SUBMISSION WITH PHONE NUMBER ---");
    const phoneResult = await evalCode(`(async () => {
        // Switch to phone tab
        const phoneTab = document.querySelector('.type-tab[data-type="phone"]');
        if (phoneTab) phoneTab.click();

        document.getElementById('terminal-name').value = 'Test Telefon Foydalanuvchi';
        document.getElementById('terminal-contact').value = '+998 90 777 88 99';
        document.getElementById('terminal-message').value = 'Shoshilinch enterprise integratsiyasi uchun telefon raqam qoldirdim.';

        const form = document.getElementById('terminal-form');
        const submitPromise = new Promise(resolve => {
            const obs = new MutationObserver(() => {
                const fb = document.getElementById('terminal-feedback');
                if (fb && !fb.classList.contains('hidden') && !fb.classList.contains('sending')) {
                    obs.disconnect();
                    resolve({
                        text: fb.innerText,
                        isSuccess: fb.classList.contains('success'),
                        isError: fb.classList.contains('error')
                    });
                }
            });
            obs.observe(document.getElementById('terminal-feedback'), { attributes: true, childList: true, subtree: true });
        });

        form.requestSubmit();
        return await Promise.race([
            submitPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for phone submission feedback')), 12000))
        ]);
    })()`);
    console.log("Phone Submission Result:", phoneResult);
    if (!phoneResult.isSuccess) {
        throw new Error("Phone submission failed! Result: " + JSON.stringify(phoneResult));
    }
    console.log("✅ PASS: Phone submission succeeded!");

    await sleep(1000);

    // Test 3: Submit with TG username
    console.log("\n--- TEST 3: SUBMISSION WITH TG USERNAME ---");
    const tgResult = await evalCode(`(async () => {
        const tgTab = document.querySelector('.type-tab[data-type="tg"]');
        if (tgTab) tgTab.click();

        document.getElementById('terminal-name').value = 'Test TG Foydalanuvchi';
        document.getElementById('terminal-contact').value = '@test_developer_uz';
        document.getElementById('terminal-message').value = 'Telegram bot va AI agentlar boʻyicha hamkorlik.';

        const form = document.getElementById('terminal-form');
        const submitPromise = new Promise(resolve => {
            const obs = new MutationObserver(() => {
                const fb = document.getElementById('terminal-feedback');
                if (fb && !fb.classList.contains('hidden') && !fb.classList.contains('sending')) {
                    obs.disconnect();
                    resolve({
                        text: fb.innerText,
                        isSuccess: fb.classList.contains('success'),
                        isError: fb.classList.contains('error')
                    });
                }
            });
            obs.observe(document.getElementById('terminal-feedback'), { attributes: true, childList: true, subtree: true });
        });

        form.requestSubmit();
        return await Promise.race([
            submitPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for TG submission feedback')), 12000))
        ]);
    })()`);
    console.log("TG Submission Result:", tgResult);
    if (!tgResult.isSuccess) {
        throw new Error("TG submission failed! Result: " + JSON.stringify(tgResult));
    }
    console.log("✅ PASS: TG submission succeeded!");

    console.log("\n================================================================================");
    console.log("🎉 ALL 3 CONTACT CHANNELS (EMAIL, PHONE, TG) TESTED & PASSED 100%!");
    console.log("================================================================================");
    process.exit(0);

} catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
} finally {
    try { ws.close(); } catch(e) {}
    try { chromeProc.kill(); } catch(e) {}
}

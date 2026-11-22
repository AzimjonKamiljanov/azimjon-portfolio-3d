import { spawn } from "child_process";
import fs from "fs";

console.log("=== STARTING AFTER-HARDENING CDP MEASUREMENT ===");

const chromeProcess = spawn("google-chrome-stable", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu-sandbox",
  "--use-gl=angle",
  "--use-angle=vulkan",
  "--remote-debugging-port=9224",
  "--window-size=1600,1000",
  "http://127.0.0.1:8080/",
]);

chromeProcess.stderr.on("data", () => {
  // Swallow Chrome's ANGLE/GPU noise; only our own output matters here.
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await sleep(2000);

  const tabsRes = await fetch("http://127.0.0.1:9224/json");
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(
    (t) => t.type === "page" && t.url.includes("127.0.0.1:8080"),
  );

  if (!pageTab) {
    throw new Error("Could not find 127.0.0.1:8080 tab!");
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

  console.log("CDP Connected.");

  await sendCommand("Runtime.enable");
  await sendCommand("Page.enable");

  // Wait 2.5s for initial dive & animations to settle
  await sleep(2500);

  // 1. Check Console / Runtime Errors
  const errorsEval = await sendCommand("Runtime.evaluate", {
    expression: "JSON.stringify(window.__errors || [])",
    returnByValue: true,
  });
  const errorList = JSON.parse(errorsEval.result?.result?.value || "[]");
  console.log(`[ERRORS] Console/Runtime Errors Count: ${errorList.length}`);
  if (errorList.length > 0) {
    console.log("Error details:", errorList);
  }

  // 2. Measure steady FPS & Frame Time over 60 rAF frames
  console.log("Measuring FPS across 60 frames...");
  const fpsEval = await sendCommand("Runtime.evaluate", {
    expression: `new Promise(resolve => {
            const frames = [];
            let last = performance.now();
            let count = 0;
            function tick(now) {
                frames.push(now - last);
                last = now;
                count++;
                if (count < 60) {
                    requestAnimationFrame(tick);
                } else {
                    const avgDelta = frames.slice(1).reduce((a, b) => a + b, 0) / (frames.length - 1);
                    const fps = 1000 / avgDelta;
                    resolve({ fps, avgFrameTimeMs: avgDelta });
                }
            }
            requestAnimationFrame(tick);
        })`,
    awaitPromise: true,
    returnByValue: true,
  });

  const perfMetrics = fpsEval.result?.result?.value || {
    fps: 0,
    avgFrameTimeMs: 0,
  };
  console.log(`[PERF] Measured FPS: ${perfMetrics.fps.toFixed(2)}`);
  console.log(
    `[PERF] Average Frame Time: ${perfMetrics.avgFrameTimeMs.toFixed(2)} ms`,
  );

  // 3. Capture After Screenshot
  console.log("Capturing visual screenshot...");
  const screenshotRes = await sendCommand("Page.captureScreenshot", {
    format: "png",
  });
  if (screenshotRes.result?.data) {
    fs.writeFileSync(
      "docs/screenshots/desktop_after_hardening.png",
      Buffer.from(screenshotRes.result.data, "base64"),
    );
    console.log("Saved docs/screenshots/desktop_after_hardening.png");
  }

  // 4. Test Catalog Opening & Rendering
  console.log("Testing catalog modal opening...");
  const catalogTest = await sendCommand("Runtime.evaluate", {
    expression: `(() => {
            const btn = document.getElementById('catalog-btn');
            if (btn) btn.click();
            const modal = document.getElementById('catalog-modal');
            const cards = document.querySelectorAll('.catalog-card');
            return {
                modalVisible: modal && !modal.classList.contains('hidden'),
                cardsCount: cards.length
            };
        })()`,
    returnByValue: true,
  });
  console.log(
    `[CATALOG TEST] Modal Open: ${catalogTest.result?.result?.value?.modalVisible}, Cards Count: ${catalogTest.result?.result?.value?.cardsCount}`,
  );

  // Clean close
  ws.close();
  chromeProcess.kill("SIGTERM");
  console.log("=== AFTER-HARDENING CDP MEASUREMENT COMPLETED ===");
}

run().catch((e) => {
  console.error("Test failed:", e);
  chromeProcess.kill("SIGTERM");
  process.exit(1);
});

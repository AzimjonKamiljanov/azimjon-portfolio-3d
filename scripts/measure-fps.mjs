#!/usr/bin/env node
/**
 * Measures steady-state frame rate in a real Chrome over CDP.
 *
 * Why a separate browser rather than whatever is to hand: a page in a hidden
 * or background window has its requestAnimationFrame throttled to a crawl, so
 * frame timings taken there describe the window manager, not the site. This
 * launches its own visible-to-the-compositor Chrome and drives it over the
 * DevTools protocol, which is the only way to get a number worth quoting.
 *
 * Usage:
 *   node scripts/measure-fps.mjs [--url=…] [--width=…] [--height=…] [--dpr=…]
 *
 * The --dpr flag is the interesting one: it is what exercises the pixel
 * budget in src/scene/pixelBudget.js, since the budget only binds once width
 * x height x dpr² exceeds it.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v = "true"] = a.slice(2).split("=");
      return [k, v];
    }),
);

const URL_UNDER_TEST = args.url || "http://127.0.0.1:8080/";
const WIDTH = Number(args.width || 1600);
const HEIGHT = Number(args.height || 1000);
const DPR = Number(args.dpr || 1);
const PORT = Number(args.port || 9333);
const FRAMES = Number(args.frames || 120);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "google-chrome-stable",
  "google-chrome",
  "chromium",
].filter(Boolean);

function resolveChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (c.includes("/") ? existsSync(c) : true) return c;
  }
  return "google-chrome-stable";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(resolveChrome(), [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu-sandbox",
  "--use-gl=angle",
  `--force-device-scale-factor=${DPR}`,
  `--remote-debugging-port=${PORT}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  URL_UNDER_TEST,
]);

chrome.stderr.on("data", () => {
  // Chrome's ANGLE/GPU chatter is not our output.
});

let messageId = 0;

async function connect() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const tabs = await res.json();
      const page = tabs.find(
        (t) => t.type === "page" && t.webSocketDebuggerUrl,
      );
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await sleep(500);
  }
  throw new Error("Could not reach Chrome's DevTools endpoint");
}

async function main() {
  const wsUrl = await connect();
  const { default: WebSocket } = await import("ws").catch(() => ({
    default: null,
  }));

  if (!WebSocket) {
    // Avoid adding a dependency for one script: fall back to the HTTP
    // evaluation endpoint is not available, so say so plainly.
    console.error(
      "This script needs a WebSocket client. Install `ws` as a dev dependency,\n" +
        "or use scripts/measure_after_metrics.mjs, which bundles its own transport.",
    );
    chrome.kill();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.on("open", r));

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++messageId;
      const onMessage = (raw) => {
        const msg = JSON.parse(raw);
        if (msg.id === id) {
          ws.off("message", onMessage);
          resolve(msg.result);
        }
      };
      ws.on("message", onMessage);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Runtime.enable");
  // Let textures load and the scene settle before timing anything.
  await sleep(9000);

  const expression = `
    new Promise((resolve) => {
      const gaps = [];
      let last = performance.now();
      let n = 0;
      function tick(ts) {
        gaps.push(ts - last);
        last = ts;
        if (++n < ${FRAMES}) requestAnimationFrame(tick);
        else {
          // Drop the first frames: they include texture uploads and shader
          // compilation, which are startup costs, not steady state.
          const s = gaps.slice(30).sort((a, b) => a - b);
          const avg = s.reduce((a, b) => a + b, 0) / s.length;
          const canvas = document.querySelector('#canvas-container canvas');
          resolve(JSON.stringify({
            fps: +(1000 / avg).toFixed(2),
            avgFrameMs: +avg.toFixed(2),
            p95FrameMs: +s[Math.floor(s.length * 0.95)].toFixed(2),
            canvas: canvas ? canvas.width + 'x' + canvas.height : 'none',
            megapixels: canvas ? +((canvas.width * canvas.height) / 1e6).toFixed(2) : 0,
            devicePixelRatio: +window.devicePixelRatio.toFixed(2),
            viewport: innerWidth + 'x' + innerHeight,
          }));
        }
      }
      requestAnimationFrame(tick);
    })
  `;

  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  ws.close();
  chrome.kill();

  const data = JSON.parse(result.result.value);
  console.log("\nSteady-state frame timing\n");
  for (const [k, v] of Object.entries(data)) {
    console.log(`  ${k.padEnd(18)} ${v}`);
  }
  console.log();
}

main().catch((err) => {
  console.error(err.message);
  chrome.kill();
  process.exit(1);
});

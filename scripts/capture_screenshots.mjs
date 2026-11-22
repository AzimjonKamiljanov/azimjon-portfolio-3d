import { chromium } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-gpu-sandbox",
      "--use-gl=angle",
      "--use-angle=vulkan",
    ],
  });

  // 1. Deep space realism 1920x1080
  const page1 = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page1.addInitScript(() => {
    localStorage.setItem("solar_guide_v2_dismissed", "true");
    localStorage.setItem("solar_guide_dismissed", "true");
  });
  await page1.goto("http://127.0.0.1:8080/");
  await page1.waitForSelector("#canvas-container canvas", { timeout: 10000 });
  await page1.waitForTimeout(3000);
  await page1.screenshot({
    path: "docs/screenshots/deep_space_realism_1920.png",
  });
  await page1.close();

  // 2. Guide modal with interactive practice chips
  const page2 = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await page2.goto("http://127.0.0.1:8080/");
  await page2.waitForSelector("#canvas-container canvas", { timeout: 10000 });
  await page2.keyboard.press("h");
  await page2.waitForSelector("#guide-modal-container:not(.hidden)");
  await page2.waitForTimeout(500);
  await page2.screenshot({
    path: "docs/screenshots/hand_gestures_practice_guide.png",
  });
  await page2.close();

  // 3. Mobile 320x568 responsive view
  const page3 = await browser.newPage({
    viewport: { width: 320, height: 568 },
  });
  await page3.addInitScript(() => {
    localStorage.setItem("solar_guide_v2_dismissed", "true");
    localStorage.setItem("solar_guide_dismissed", "true");
  });
  await page3.goto("http://127.0.0.1:8080/");
  await page3.waitForSelector("#canvas-container canvas", { timeout: 10000 });
  await page3.waitForTimeout(3000);
  await page3.screenshot({
    path: "docs/screenshots/responsive_mobile_320.png",
  });
  await page3.close();

  await browser.close();
  console.log("Screenshots captured successfully!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

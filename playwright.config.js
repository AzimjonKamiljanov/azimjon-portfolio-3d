import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  // A GPU-less CI runner renders this WebGL scene in software, which
  // takes roughly six times as long as a local machine. The per-test
  // ceiling has to clear the scaled waits inside each test, or the test
  // times out before its own assertions get a chance to run.
  timeout: process.env.CI ? 150000 : 30000,
  workers: 1,
  webServer: {
    command: "npx vite preview --port 8080 --host 127.0.0.1",
    port: 8080,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chrome",
      use: {
        channel: "chrome",
        headless: true,
        permissions: ["camera"],
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-gpu-sandbox",
            "--use-gl=angle",
            "--use-angle=vulkan",
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
  ],
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  workers: 1,
  webServer: {
    command: 'npx vite preview --port 8080 --host 127.0.0.1',
    port: 8080,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
        headless: true,
        permissions: ['camera'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-gpu-sandbox',
            '--use-gl=angle',
            '--use-angle=vulkan',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream'
          ]
        }
      }
    }
  ]
});

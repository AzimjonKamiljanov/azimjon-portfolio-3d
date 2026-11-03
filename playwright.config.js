import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  projects: [
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
        headless: true,
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-gpu-sandbox',
            '--use-gl=angle',
            '--use-angle=vulkan'
          ]
        }
      }
    }
  ]
});

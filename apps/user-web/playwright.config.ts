import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    // Uses an installed browser; PLAYWRIGHT_CHANNEL=chromium uses Playwright's download.
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    headless: true,
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
});

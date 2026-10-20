import { assertIsolatedWrites } from '../../packages/test-support/src/client';
assertIsolatedWrites();
import { defineConfig } from '@playwright/test';

const webPort = Number(process.env.E2E_WEB_PORT || 5173);
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 15000 },
  use: {
    baseURL: externalBaseUrl || `http://127.0.0.1:${webPort}`,
    // Uses an installed browser; PLAYWRIGHT_CHANNEL=chromium uses Playwright's download.
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    headless: true,
    trace: 'off',
  },
  // scripts/run-web-e2e.mjs owns and reaps the exact Vite child on Windows.
  webServer: undefined,
});

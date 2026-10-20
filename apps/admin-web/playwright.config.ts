import { assertIsolatedWrites } from '../../packages/test-support/src/client';
assertIsolatedWrites();
import { defineConfig } from '@playwright/test';
const webPort = Number(process.env.E2E_WEB_PORT || 5174);
const externalBaseUrl = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: './tests', workers: 1, fullyParallel: false, retries: 0,
  timeout: 45000, expect: { timeout: 15000 },
  use: { baseURL: externalBaseUrl || `http://127.0.0.1:${webPort}`, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, trace: 'off' },
  // Never record network traces containing Basic auth credentials. The repository
  // E2E runner owns Vite and stops its exact process tree on Windows.
  webServer: undefined,
});

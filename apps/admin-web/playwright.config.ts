import { assertIsolatedWrites } from '../../packages/test-support/src/client';
assertIsolatedWrites();
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, fullyParallel: false, retries: 0,
  timeout: 45000, expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:5174', channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true, trace: 'off' },
  // Never record network traces containing Basic auth credentials.
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5174', reuseExistingServer: true },
});

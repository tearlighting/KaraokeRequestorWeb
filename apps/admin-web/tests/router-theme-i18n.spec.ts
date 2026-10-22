import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { testCredentials } from '../../../packages/test-support/src/client';
const appUrl = (route: string) => `${(process.env.E2E_APP_PATH || '/').replace(/\/$/, '')}/${route}`;

test('admin routes require session and preserve theme/locale across refresh', async ({ page }) => {
  const shots = resolve(process.cwd(), '../../.local/phase15-shots'); await mkdir(shots, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appUrl('system')); await expect(page).toHaveURL(/\/login$/); await expect(page.getByTestId('admin-password')).toBeVisible();
  const credentials = testCredentials(); await page.getByTestId('admin-password').fill(credentials.password);
  if (credentials.easyPass) { await page.getByText('アクセスパスワードも設定している場合').click(); await page.getByLabel('アクセスパスワード').fill(credentials.easyPass); }
  await page.getByTestId('admin-login').click(); await expect(page).toHaveURL(/\/admin\/?$|\/$/); await expect(page.getByTestId('admin-nav-queue')).toBeVisible();
  await page.getByTestId('theme-switch').selectOption('default');
  await page.screenshot({ path: resolve(shots, 'admin-default-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: resolve(shots, 'admin-default-desktop.png'), fullPage: true });
  await page.getByTestId('theme-switch').selectOption('anisong-dark');
  await page.screenshot({ path: resolve(shots, 'admin-dark-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(shots, 'admin-dark-mobile.png'), fullPage: true });
  await page.getByTestId('locale-switch').selectOption('zh-CN');
  await expect(page.getByTestId('admin-nav-settings')).toContainText('设置');
  await page.getByTestId('admin-nav-system').click(); await expect(page.getByTestId('admin-page-title')).toHaveText('系统诊断');
  await page.reload(); await expect(page.getByTestId('admin-page-title')).toHaveText('系统诊断');
  await page.getByTestId('admin-nav-settings').click(); await expect(page.getByTestId('admin-page-title')).toHaveText('系统设置');
  await page.goto(appUrl('not-a-route')); await expect(page.getByRole('heading', { name: '找不到页面' })).toBeVisible();
  await page.getByRole('button', { name: '退出登录' }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.goto(appUrl('system')); await expect(page).toHaveURL(/\/login$/);
});

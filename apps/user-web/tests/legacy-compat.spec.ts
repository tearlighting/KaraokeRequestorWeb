import { expect, test } from '@playwright/test';
import { phpBase } from '../../../packages/test-support/src/client';

test('旧搜索 UI 经同源代理读取 Node-native 状态，业务请求继续由 PHP 处理', async ({ page }) => {
  const nodeRequests: string[] = [];
  const failedAssets: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(phpBase) && ['script', 'stylesheet', 'font', 'image'].includes(response.request().resourceType()) && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) nodeRequests.push(new URL(request.url()).pathname);
  });
  const health = page.waitForResponse(phpBase + '/api/v1/meta/health');
  await page.goto(phpBase + '/search.php');
  expect((await health).status()).toBe(200);
  await expect(page.locator('#node-api-status')).toHaveAttribute('data-state', 'connected');
  await expect(page.locator('body')).toContainText('旧業務は PHP');
  expect(nodeRequests).toEqual(['/api/v1/meta/health']);
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
});

test('Node 状态不可达时旧 PHP 页面仍可访问并显示明确提示', async ({ page }) => {
  await page.route('**/api/v1/meta/health', (route) => route.abort('connectionrefused'));
  await page.goto(phpBase + '/search.php');
  await expect(page.locator('#node-api-status')).toHaveAttribute('data-state', 'unavailable');
  await expect(page.locator('body')).toContainText('旧 PHP は引き続き利用できます');
  await expect(page.locator('input').first()).toBeAttached();
});

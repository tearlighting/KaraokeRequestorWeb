import { testConfigPath } from '../../../packages/test-support/src/client.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { TestAgent, testCredentials, apiBase, phpBase } from '../../../packages/test-support/src/client';

test('绕过 Vite 也必须有 Node 管理会话，空密码、角色伪造和 CSRF 被拒绝', async ({ request }) => {
  const guest = new TestAgent();
  for (const path of ['/admin/queue', '/admin/status', '/settings']) expect((await guest.call(path)).status).toBe(401);
  for (const [path, method] of [['/admin/requests/2147483647', 'DELETE'], ['/admin/requests/2147483647/move', 'POST'], ['/settings', 'PUT'], ['/playback/control', 'POST']]) expect((await guest.call(path, method, {})).status).toBe(401);
  expect((await guest.call('/admin/session', 'POST', { username: 'admin', password: '' })).status).toBe(400);
  expect((await guest.call('/admin/session', 'POST', { username: 'admin', password: 'invalid-validation-password' })).status).toBe(401);
  await guest.user();
  expect((await guest.call('/admin/queue', 'GET', undefined, { 'X-Yukari-Role': 'admin' })).status).toBe(401);
  const admin = new TestAgent(); await admin.admin();
  expect((await admin.call('/admin/queue', 'GET', undefined, { Origin: 'http://127.0.0.1:5173' })).status).toBe(403);
  expect((await request.post(apiBase + '/api/v1/admin/session', { data: {} })).status()).toBe(403);
  expect((await request.get('http://127.0.0.1:5173/api/v1/admin/queue')).status()).toBe(403);
  expect((await request.get('/php/api/admin.php?operation=queue')).status()).toBe(403);
  await admin.call('/admin/session', 'DELETE', {});
  expect((await admin.call('/admin/queue')).status).toBe(401);
});

test('认证只读和设置无变化保存，经统一 API 保留版本冲突', async () => {
  const admin = new TestAgent(); await admin.admin();
  expect((await admin.call('/admin/queue')).status).toBe(200);
  expect((await admin.call('/admin/status')).status).toBe(200);
  const config = testConfigPath;
  const hash = () => createHash('sha256').update(readFileSync(config)).digest('hex');
  const before = hash(); const settings = (await admin.call('/settings')).body.data;
  const saved = await admin.call('/settings', 'PUT', settings);
  expect(saved.status).toBe(200); expect(saved.body.data.changed).toBe(false);
  const stale = await admin.call('/settings', 'PUT', { ...settings, revision: '0'.repeat(64) });
  expect(stale.status).toBe(409); expect(stale.body.error.legacyReason).toContain('设置已变化');
  expect(hash()).toBe(before);
});

test('真实 UI 登录、调序、删除、设置及播放器失败；无双写与原数据不变', async ({ page }, testInfo) => {
  const admin = new TestAgent(); await admin.admin();
  const before = (await admin.call('/admin/queue')).body.data;
  const status = (await admin.call('/admin/status')).body.data;
  test.skip(Boolean(status.playback || status.mpc_reachable || status.foobar_reachable), '活动播放器不写测试队列');
  test.skip(before.items.map((item: {reqorder: number}) => item.reqorder).sort((a: number, b: number) => a - b).some((value: number, i: number) => value !== i + 1), '非连续原队列不运行归一化测试');
  const user = new TestAgent(); const userid = await user.user();
  const singer = `AdminNodeE2E_${Date.now()}`;
  const ids: number[] = [];
  try {
    for (const suffix of ['A', 'B']) {
      const created = await user.call('/requests', 'POST', { filename: singer + suffix, singer, comment: 'Node admin E2E', kind: '小休止', fullpath: '' });
      expect(created.status).toBe(201); ids.push(created.body.data.id);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/'); const credentials = testCredentials();
    await page.getByLabel('管理密码', { exact: true }).fill(credentials.password);
    if (credentials.easyPass) { await page.getByText('另外启用了访问口令？').click(); await page.getByLabel('原版访问口令').fill(credentials.easyPass); }
    await page.getByRole('button', { name: '登录管理端' }).click();
    await expect(page.getByRole('heading', { name: '现场管理', exact: true })).toBeVisible();
    const pending = (await admin.call('/admin/queue')).body.data;
    expect(pending.total).toBe(before.total + 2);
    const positions = ids.map((id) => pending.items.findIndex((item: {id: number}) => item.id === id)).sort((a, b) => a - b);
    expect(positions[1] - positions[0]).toBe(1);
    const upper = pending.items[positions[0]].id, lower = pending.items[positions[1]].id;
    const moved = page.waitForResponse((response) => response.url().endsWith(`/api/v1/admin/requests/${lower}/move`));
    await page.locator(`[data-request-id="${lower}"]`).getByRole('button', { name: '上移', exact: true }).click();
    expect((await moved).ok()).toBe(true);
    await expect.poll(async () => (await admin.call('/admin/queue')).body.data.items.filter((item: {id: number}) => ids.includes(item.id)).map((item: {id: number}) => item.id)).toEqual([lower, upper]);
    await page.locator(`[data-request-id="${lower}"]`).getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.locator(`[data-request-id="${lower}"]`)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('admin-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: '系统与播放器', exact: true }).click();
    await expect(page.getByText('运行环境', { exact: true })).toBeVisible();
    if (!status.mpc_reachable) { await page.getByRole('button', { name: '播放', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('播放器不可达'); }
    const nativeRead = page.waitForResponse((response) => response.url().endsWith('/api/v1/settings') && response.request().method() === 'GET');
    await page.getByRole('button', { name: '管理设置', exact: true }).click();
    expect((await nativeRead).headers()['x-yukari-owner']).toBe('node-settings-read');
    await expect(page.getByLabel('播放模式')).toBeVisible();
    await page.getByRole('button', { name: '保存设置' }).click();
    await expect(page.getByRole('status')).toContainText('设置没有变化');
    await page.getByRole('button', { name: '退出管理端' }).click();
    await expect(page.getByRole('button', { name: '登录管理端' })).toBeVisible();
    expect((await page.request.get('/api/v1/admin/session', { headers: { 'X-Yukari-Client': '1' } })).status()).toBe(401);
    expect(errors).toEqual([]);
  } finally {
    for (const item of (await admin.call('/admin/queue')).body.data.items.filter((item: {singer: string}) => item.singer === singer)) expect((await admin.call(`/admin/requests/${item.id}`, 'DELETE', {})).status).toBe(200);
    await fetch(`${phpBase}/api/mypage.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'history_remove', userid, fullpath: '' }) });
    expect((await admin.call('/admin/queue')).body.data).toEqual(before);
  }
});

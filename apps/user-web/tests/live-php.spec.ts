import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { TestAgent, phpBase } from '../../../packages/test-support/src/client';

test('用户代理连接统一 Node API，拒绝管理和旧 PHP 路径', async ({ request }) => {
  const session = await request.post('/api/v1/user/session', { headers: { 'X-Yukari-Client': '1' }, data: {} });
  expect(session.ok()).toBe(true);
  const queue = await request.get('/api/v1/queue', { headers: { 'X-Yukari-Client': '1' } });
  expect(Array.isArray((await queue.json()).data.items)).toBe(true);
  for (const path of ['/api/v1/admin/queue', '/api/v1/settings', '/php/init.php', '/php/api/player.php', '/php/api/node_bridge.php']) expect((await request.get(path)).status()).toBe(403);
  for (const path of ['/', '/search.php', '/requestlist_top.php']) expect((await request.get(phpBase + path)).ok()).toBe(true);
  expect((await request.get(phpBase + '/init.php')).status()).toBe(401);
});

test('手机真实搜索；连接失败保留原因，不伪造成功空列表', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '下一首，唱你的。' })).toBeVisible();
  await page.getByLabel('歌曲或关键词').fill(`NoSuchSong_${randomUUID()}`);
  for (const backend of ['everything', 'lister']) {
    await page.getByLabel('曲库来源').selectOption(backend);
    const response = page.waitForResponse((response) => response.url().includes('/api/v1/search?'));
    await page.getByRole('button', { name: '搜索歌曲' }).click();
    const result = await response; const body = await result.json();
    if (!result.ok()) {
      expect(body.ok).toBe(false); expect(body.error.message).toBeTruthy();
      await expect(page.getByRole('alert')).toContainText(body.error.message);
      expect(await page.getByText('没有返回歌曲。', { exact: false }).count()).toBe(0);
    } else await expect(page.getByText('没有返回歌曲。', { exact: false })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
});

test('React → Node → PHP 小休止预约，查询队列并通过 Node 管理接口清理', async ({ page }, testInfo) => {
  const admin = new TestAgent(); await admin.admin();
  const before = (await admin.call('/admin/queue')).body.data;
  const status = (await admin.call('/admin/status')).body.data;
  test.skip(Boolean(status.playback || status.mpc_reachable || status.foobar_reachable), '活动播放器不写测试队列');
  test.skip(before.items.map((item: {reqorder: number}) => item.reqorder).sort((a: number, b: number) => a - b).some((value: number, i: number) => value !== i + 1), '非连续队列不运行归一化测试');
  const singer = `ReactNodeE2E_${Date.now()}`;
  let userid = '';
  try {
    const session = page.waitForResponse((response) => response.url().endsWith('/api/v1/user/session'));
    await page.goto('/'); userid = (await (await session).json()).data.userId;
    await page.getByLabel('你的名字').fill(singer);
    await page.getByLabel('备注（选填）').fill('Unified API integration; auto cleanup');
    const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/requests') && response.request().method() === 'POST');
    await page.getByRole('button', { name: '提交休息预约' }).click();
    const result = await created; expect(result.status()).toBe(201);
    const id = (await result.json()).data.id;
    await expect(page.getByRole('status').filter({ hasText: `预约已保存，ID ${id}` })).toBeVisible();
    await expect(page.locator(`[data-request-id="${id}"]`)).toContainText(singer);
    await expect(page.locator(`[data-request-id="${id}"]`)).toContainText('未再生');
    const current = (await admin.call('/admin/queue')).body.data;
    expect(current.total).toBe(before.total + 1);
    expect(current.items.find((item: {id: number}) => item.id === id).kind).toBe('小休止');
    await page.screenshot({ path: testInfo.outputPath('reservation.png'), fullPage: true });
  } finally {
    for (const item of (await admin.call('/admin/queue')).body.data.items.filter((item: {singer: string}) => item.singer === singer)) expect((await admin.call(`/admin/requests/${item.id}`, 'DELETE', {})).status).toBe(200);
    if (userid) await fetch(`${phpBase}/api/mypage.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'history_remove', userid, fullpath: '' }) });
    expect((await admin.call('/admin/queue')).body.data).toEqual(before);
  }
});

test('真实歌曲预约链（需接入真实曲库）', async ({ page }) => {
  test.skip(!process.env.E2E_SONG_KEYWORD, '外部曲库不是 Phase 3 前提，未用 mock 替代命中');
  const admin = new TestAgent(); await admin.admin();
  const singer = `RealSongNodeE2E_${Date.now()}`;
  try {
    await page.goto('/');
    await page.getByLabel('曲库来源').selectOption(process.env.E2E_SEARCH_BACKEND || 'lister');
    await page.getByLabel('歌曲或关键词').fill(process.env.E2E_SONG_KEYWORD!);
    await page.getByRole('button', { name: '搜索歌曲' }).click();
    await page.getByRole('button', { name: '选择预约' }).first().click();
    await page.getByLabel('你的名字').fill(singer);
    await page.getByRole('button', { name: '提交歌曲预约' }).click();
    await expect(page.getByTestId('queue')).toContainText(singer);
  } finally {
    for (const item of (await admin.call('/admin/queue')).body.data.items.filter((item: {singer: string}) => item.singer === singer)) await admin.call(`/admin/requests/${item.id}`, 'DELETE', {});
  }
});

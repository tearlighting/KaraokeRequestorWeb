import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { TestAgent, phpBase } from '../../../packages/test-support/src/client';

test('Legacy 浏览器身份 → 队列票据 → Node SQLite；原 PHP 预约即时可见且保密', async ({ page, browser }) => {
  const admin = new TestAgent(); await admin.admin();
  const before = (await admin.call('/admin/queue')).body.data;
  const status = (await admin.call('/admin/status')).body.data;
  test.skip(Boolean(status.playback || status.mpc_reachable || status.foobar_reachable), '活动播放器不运行写测试');
  test.skip(before.items.map((item: { reqorder: number }) => item.reqorder).sort((a: number,b: number) => a-b).some((n: number,i: number) => n !== i+1), '非连续原队列不运行归一化测试');
  const singer = 'LegacyNative_' + randomUUID();
  let id = 0;
  let userid = '';
  const outsider = await browser.newContext({ userAgent: 'DifferentLegacyQueueTestUA', baseURL: phpBase });
  try {
    await page.goto(phpBase + '/search.php');
    const ua = await page.evaluate(() => navigator.userAgent);
    const intentResponse = await page.request.post(phpBase + '/api/request_intent.php', { headers: { 'X-Yukari-Client': '1' }, data: {} });
    expect(intentResponse.ok()).toBe(true);
    const intent = (await intentResponse.json()).data;
    const created = await page.request.post(phpBase + '/exec.php', {
      headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': ua },
      form: { filename: singer, singer, freesinger: '', comment: 'isolated queue integration; cleanup', kind: '小休止', fullpath: '', secret: '1',
        submission_receipt: intent.submission_receipt, submission_csrf: intent.submission_csrf },
    });
    expect(created.ok()).toBe(true); id = (await created.json()).newid; expect(id).toBeGreaterThan(0);
    userid = (await page.context().cookies(phpBase)).find((cookie) => cookie.name === 'YkariUserID')?.value || '';
    const native = page.waitForResponse((response) => response.url().includes('/api/v1/legacy/queue?'));
    const oldReads: string[] = [];
    page.on('request', (request) => { if (request.url().includes('requestlist_swipe_json.php')) oldReads.push(request.url()); });
    await page.goto(phpBase + '/requestlist_swipe.php');
    const response = await native;
    expect(response.headers()['x-yukari-owner']).toBe('node-queue-read');
    const owner = (await response.json()).data.items.find((item: {id: number}) => item.id === id);
    expect(owner.songfile).toBe(singer); expect(owner.masked).toBe(0);
    expect(oldReads).toEqual([]);
    const otherPage = await outsider.newPage();
    const otherRead = otherPage.waitForResponse((response) => response.url().includes('/api/v1/legacy/queue?'));
    await otherPage.goto('/requestlist_swipe.php');
    const hidden = (await (await otherRead).json()).data.items.find((item: {id: number}) => item.id === id);
    expect(hidden.masked).toBe(1); expect(hidden.songfile).not.toBe(singer); expect(hidden.fullpath).toBe(''); expect(hidden.song_name).toBe('');
    expect((await admin.call('/admin/queue')).body.data.items.find((item: {id: number}) => item.id === id).songfile).toBe(singer);
    await expect(page.locator('#node-queue-error')).toHaveCount(0);
  } finally {
    await outsider.close();
    for (const item of (await admin.call('/admin/queue')).body.data.items.filter((item: { singer: string }) => item.singer === singer)) {
      expect((await admin.call(`/admin/requests/${item.id}`, 'DELETE', {})).status).toBe(200);
    }
    if (userid) await page.request.post(phpBase + '/api/mypage.php', { form: { action: 'history_remove', userid, fullpath: '' } });
    expect((await admin.call('/admin/queue')).body.data).toEqual(before);
  }
});

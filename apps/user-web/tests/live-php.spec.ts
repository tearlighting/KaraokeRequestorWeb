import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { TestAgent, apiBase, phpBase, testCredentials } from '../../../packages/test-support/src/client';

test('用户代理连接统一 Node API，拒绝管理和旧 PHP 路径', async ({ request }) => {
  const session = await request.post('/api/v1/user/session', { headers: { 'X-Yukari-Client': '1' }, data: {} });
  expect(session.ok()).toBe(true);
  const queue = await request.get('/api/v1/queue', { headers: { 'X-Yukari-Client': '1' } });
  expect(Array.isArray((await queue.json()).data.items)).toBe(true);
  for (const path of ['/api/v1/admin/queue', '/api/v1/settings']) expect([401, 403]).toContain((await request.get(path)).status());
  for (const path of ['/php/init.php', '/php/api/player.php', '/php/api/node_bridge.php']) expect([403, 404]).toContain((await request.get(path)).status());
  for (const path of ['/', '/search.php', '/requestlist_top.php']) expect((await request.get(phpBase + path)).ok()).toBe(true);
  expect((await request.get(phpBase + '/init.php')).status()).toBe(401);
});

test('手机真实搜索；连接失败保留原因，不伪造成功空列表', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.E2E_APP_PATH || '/');
  await expect(page.getByTestId('user-heading')).toBeVisible();
  await page.getByTestId('search-keyword').fill(`NoSuchSong_${randomUUID()}`);
  for (const backend of ['everything', 'lister']) {
    await page.getByLabel('検索元').selectOption(backend);
    const response = page.waitForResponse((response) => response.url().includes('/api/v1/search?'));
    await page.getByTestId('search-submit').click();
    const result = await response; const body = await result.json();
    if (!result.ok()) {
      expect(body.ok).toBe(false); expect(body.error.message).toBeTruthy();
      await expect(page.getByRole('alert')).toContainText(body.error.message);
      expect(await page.getByTestId('search-empty').count()).toBe(0);
    } else await expect(page.getByTestId('search-empty')).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
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
    await page.goto(process.env.E2E_APP_PATH || '/'); userid = (await (await session).json()).data.userId;
    await page.getByTestId('reservation-singer').fill(singer);
    await page.getByTestId('reservation-comment').fill('Unified API integration; auto cleanup');
    await page.getByTestId('reservation-private').check();
    const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/requests') && response.request().method() === 'POST');
    await page.getByTestId('reservation-submit').click();
    const result = await created; expect(result.status()).toBe(201);
    expect((await result.request().postDataJSON()).secret).toBe(1);
    const id = (await result.json()).data.id;
    await expect(page.getByTestId('reservation-feedback')).toContainText('未再生');
    await expect(page.locator(`[data-request-id="${id}"]`)).toContainText(singer);
    await expect(page.locator(`[data-request-id="${id}"]`)).toContainText('未再生');
    const current = (await admin.call('/admin/queue')).body.data;
    expect(current.total).toBe(before.total + 1);
    expect(current.items.find((item: {id: number}) => item.id === id).kind).toBe('小休止');
    await page.screenshot({ path: testInfo.outputPath('reservation.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: testInfo.outputPath('reservation-desktop.png'), fullPage: true });
  } finally {
    for (const item of (await admin.call('/admin/queue')).body.data.items.filter((item: {singer: string}) => item.singer === singer)) expect((await admin.call(`/admin/requests/${item.id}`, 'DELETE', {})).status).toBe(200);
    if (userid) await fetch(`${phpBase}/api/mypage.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'history_remove', userid, fullpath: '' }) });
    expect((await admin.call('/admin/queue')).body.data).toEqual(before);
  }
});

test('Legacy v2 旧浏览器预约通过 CSRF intent 到达 Node 写入 Owner', async ({ page }) => {
  const admin = new TestAgent(); await admin.admin();
  const before = (await admin.call('/admin/queue')).body.data;
  const status = (await admin.call('/admin/status')).body.data;
  test.skip(Boolean(status.playback || status.mpc_reachable || status.foobar_reachable), '活动播放器不写测试队列');
  const singer = `LegacyV2_${Date.now()}`;
  let id = 0;
  try {
    await page.goto(`${phpBase}/v2/search.html`);
    const result = await page.evaluate(async (name) => {
      return (window as unknown as { postRequest: (fields: Record<string, string>) => Promise<{newid:number}> }).postRequest({
        filename: 'legacy v2 synthetic pause', singer: name, comment: 'isolated compatibility test', kind: '小休止', fullpath: '', secret: '1'
      });
    }, singer);
    id = result.newid;
    expect(id).toBeGreaterThan(0);
    const found = (await admin.call('/admin/queue')).body.data.items.find((item: {id:number}) => item.id === id);
    expect(found.singer).toBe(singer); expect(found.kind).toBe('小休止');
  } finally {
    if (id) expect((await admin.call(`/admin/requests/${id}`, 'DELETE', {})).status).toBe(200);
    expect((await admin.call('/admin/queue')).body.data).toEqual(before);
  }
});

test('Legacy 队列页面仅复用已登录 Node 管理会话完成批量排序与 Undo',async({page})=>{
  const admin=new TestAgent();await admin.admin();const before=(await admin.call('/admin/queue')).body.data;
  const status=(await admin.call('/admin/status')).body.data;
  test.skip(Boolean(status.playback||status.mpc_reachable||status.foobar_reachable),'活动播放器不写测试队列');
  const contiguous=before.items.map((item:{reqorder:number})=>item.reqorder).sort((a:number,b:number)=>a-b);
  test.skip(contiguous.some((value:number,index:number)=>value!==index+1),'非连续原队列不运行归一化测试');
  const user=new TestAgent();await user.user();const token=`LegacyReorder_${Date.now()}`;const ids:number[]=[];
  try{
    for(const name of ['A','B']){
      const created=await user.call('/requests','POST',{filename:`${token}_${name}`,singer:token,comment:'legacy bulk reorder',kind:'小休止',fullpath:'',secret:1});
      expect(created.status).toBe(201);ids.push(created.body.data.id);
    }
    const login=await page.request.post(`${apiBase}/api/v1/admin/session`,{headers:{'X-Yukari-Client':'1',Origin:'http://127.0.0.1:5174'},data:testCredentials()});
    expect(login.ok()).toBe(true);
    await page.goto(`${phpBase}/requestlist_swipe.php`);
    const order=[...ids].reverse().concat(before.items.map((item:{id:number})=>item.id));
    const moved=await page.evaluate(async(ids)=>{
      const response=await fetch('/api/v1/admin/queue/reorder',{method:'POST',headers:{'Content-Type':'application/json','X-Yukari-Client':'1'},body:JSON.stringify({ids})});
      return {status:response.status,owner:response.headers.get('x-yukari-owner'),body:await response.json()};
    },order);
    expect(moved.status).toBe(200);expect(moved.owner).toBe('node-queue-mutation');
    const current=(await admin.call('/admin/queue')).body.data.items.filter((item:{id:number})=>ids.includes(item.id)).map((item:{id:number})=>item.id);
    expect(current).toEqual([...ids].reverse());
  }finally{
    for(const id of ids)await admin.call(`/admin/requests/${id}`,'DELETE',{});
    expect((await admin.call('/admin/queue')).body.data).toEqual(before);
  }
});

test('真实歌曲预约链（需接入真实曲库）', async ({ page }) => {
  test.skip(!process.env.E2E_SONG_KEYWORD, '外部曲库不是 Phase 3 前提，未用 mock 替代命中');
  const admin = new TestAgent(); await admin.admin();
  const singer = `RealSongNodeE2E_${Date.now()}`;
  try {
    await page.goto(process.env.E2E_APP_PATH || '/');
    await page.getByLabel('検索元').selectOption(process.env.E2E_SEARCH_BACKEND || 'lister');
    await page.getByTestId('search-keyword').fill(process.env.E2E_SONG_KEYWORD!);
    await page.getByTestId('search-submit').click();
    await page.getByRole('button', { name: 'この曲を予約' }).first().click();
    await page.getByTestId('reservation-singer').fill(singer);
    await page.getByTestId('reservation-submit').click();
    await expect(page.getByTestId('queue')).toContainText(singer);
  } finally {
    for (const item of (await admin.call('/admin/queue')).body.data.items.filter((item: {singer: string}) => item.singer === singer)) await admin.call(`/admin/requests/${item.id}`, 'DELETE', {});
  }
});

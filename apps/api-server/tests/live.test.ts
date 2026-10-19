import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { TestAgent, apiBase, phpBase, testCredentials } from '../../../packages/test-support/src/client.js';

test('真实统一 API：认证、授权、CSRF、Basic 禁用、Bridge 伪造拒绝', async () => {
  const guest = new TestAgent();
  assert.equal((await guest.call('/admin/queue')).status, 401);
  assert.equal((await guest.call('/admin/session', 'POST', { username: 'admin', password: '' })).status, 400);
  assert.equal((await guest.call('/admin/session', 'POST', { username: 'admin', password: randomUUID() })).status, 401);
  assert.equal((await guest.call('/admin/session', 'POST', testCredentials(), { Origin: 'http://127.0.0.1:5173' })).status, 403);
  assert.equal((await guest.call('/queue', 'GET', undefined, { Authorization: 'Basic YWRtaW46' })).status, 400);
  const raw = await fetch(`${apiBase}/api/v1/admin/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(raw.status, 403);
  const invalid = await fetch(`${apiBase}/api/v1/user/session`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yukari-Client': '1' }, body: '{invalid' });
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).error.code, 'INVALID_REQUEST');
  assert.equal((await fetch(`${phpBase}/api/node_bridge.php?operation=admin-queue`, { method: 'POST', headers: { 'X-Yukari-Role': 'admin', 'X-Yukari-Bridge': 'forged' } })).status, 403);
  await guest.user();
  assert.equal((await guest.call('/admin/queue', 'GET', undefined, { 'X-Yukari-Role': 'admin' })).status, 401);
  assert.equal((await guest.call('/admin/requests/2147483647', 'DELETE', {})).status, 401);
  const admin = new TestAgent();
  const login = await admin.call('/admin/session', 'POST', testCredentials());
  assert.equal(login.status, 200);
  const oldCookie = login.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await admin.call('/admin/session')).status, 200);
  assert.equal((await admin.call('/admin/session', 'DELETE', {})).status, 200);
  assert.equal((await admin.call('/admin/queue')).status, 401);
  const replay = await fetch(`${apiBase}/api/v1/admin/queue`, { headers: { 'X-Yukari-Client': '1', Cookie: oldCookie } });
  assert.equal(replay.status, 401); // Server token revoked, not just a cleared browser cookie.
});

test('真实只读链路、设置版本、不写配置、保留搜索/播放器错误原因', async () => {
  const user = new TestAgent(); await user.user();
  const queue = await user.call('/queue'); assert.equal(queue.status, 200); assert.ok(Array.isArray(queue.body.data.items));
  const caps = await user.call('/capabilities'); assert.equal(caps.status, 200);
  const search = await user.call('/search?backend=everything&keyword=NoSuch_' + randomUUID());
  if (!caps.body.data.features.everything_search) {
    assert.equal(search.status, 503); assert.equal(search.body.error.code, 'SEARCH_UNAVAILABLE');
  } else assert.equal(search.status, 200);
  const lister = await user.call('/search?backend=lister&keyword=NoSuch_' + randomUUID());
  if (lister.status !== 200) assert.ok(lister.body.error.legacyReason);
  const admin = new TestAgent(); await admin.admin();
  const config = new URL('../../../config.ini', import.meta.url);
  const hash = () => createHash('sha256').update(readFileSync(config)).digest('hex');
  const before = hash();
  const settings = await admin.call('/settings'); assert.equal(settings.status, 200);
  const saved = await admin.call('/settings', 'PUT', settings.body.data); assert.equal(saved.status, 200); assert.equal(saved.body.data.changed, false);
  assert.equal((await admin.call('/settings', 'PUT', { ...settings.body.data, revision: '0'.repeat(64) })).status, 409);
  assert.equal(hash(), before);
  const status = await admin.call('/admin/status'); assert.equal(status.status, 200);
  if (!status.body.data.mpc_reachable) {
    const result = await admin.call('/playback/control', 'POST', { player: 'mpc', action: 'play' });
    assert.equal(result.status, 502); assert.match(result.body.error.message, /播放器不可达/);
  }
});

test('真实预约无双写、会话身份隔离、管理调序删除、清理后原队列不变', async (t) => {
  const admin = new TestAgent(); await admin.admin();
  const original = (await admin.call('/admin/queue')).body.data;
  const status = (await admin.call('/admin/status')).body.data;
  if (status.playback || status.mpc_reachable || status.foobar_reachable) { t.skip('活动播放器，不写测试队列'); return; }
  if (original.items.map((item: {reqorder: number}) => item.reqorder).sort((a: number, b: number) => a - b).some((n: number, i: number) => n !== i + 1)) { t.skip('原队列存在间隔，避免归一化影响'); return; }
  const owner = new TestAgent(); const userid = await owner.user();
  const stranger = new TestAgent(); await stranger.user();
  const token = 'NodeLive_' + randomUUID();
  const ids: number[] = [];
  try {
    for (const name of ['A', 'B']) {
      const created = await owner.call('/requests', 'POST', { filename: token + name, singer: token, comment: 'Node real API test', kind: '小休止', fullpath: '', secret: 1 });
      assert.equal(created.status, 201, created.body.error?.message); ids.push(created.body.data.id);
    }
    const saved = (await admin.call('/admin/queue')).body.data;
    assert.equal(saved.total, original.total + 2); // Exactly one PHP insert per Node request.
    const publicQueue = (await stranger.call('/queue', 'GET', undefined, { Cookie: `YkariUserID=${userid}`, 'X-Yukari-Role': 'admin' })).body.data;
    for (const id of ids) assert.ok(!publicQueue.items.find((item: {id: number}) => item.id === id).songfile.includes(token));
    const own = (await owner.call('/queue')).body.data;
    for (const id of ids) assert.ok(own.items.find((item: {id: number}) => item.id === id).songfile.includes(token));
    const positions = ids.map((id) => saved.items.findIndex((item: {id: number}) => item.id === id)).sort((a, b) => a - b);
    assert.equal(positions[1] - positions[0], 1);
    const upper = saved.items[positions[0]].id, lower = saved.items[positions[1]].id;
    assert.equal((await admin.call(`/admin/requests/${lower}/move`, 'POST', { action: 'up' })).status, 200);
    const moved = (await admin.call('/admin/queue')).body.data.items.filter((item: {id: number}) => ids.includes(item.id)).map((item: {id: number}) => item.id);
    assert.deepEqual(moved, [lower, upper]);
    assert.equal((await admin.call(`/admin/requests/${lower}`, 'DELETE', {})).status, 200);
  } finally {
    for (const item of (await admin.call('/admin/queue')).body.data.items.filter((item: {singer: string}) => item.singer === token)) {
      assert.equal((await admin.call(`/admin/requests/${item.id}`, 'DELETE', {})).status, 200);
    }
    await fetch(`${phpBase}/api/mypage.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ action: 'history_remove', userid, fullpath: '' }) });
    assert.deepEqual((await admin.call('/admin/queue')).body.data, original);
  }
});

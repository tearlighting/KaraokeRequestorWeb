import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiBase, phpBase, testCredentials } from '../../../packages/test-support/src/client.js';

test('Legacy 同源适配仅开放 Node-native 健康状态，保留 URL 和权限边界', async () => {
  const direct = await fetch(`${apiBase}/api/v1/meta/health`);
  const proxy = await fetch(`${phpBase}/api/v1/meta/health`, {
    headers: { Authorization: 'Basic YWRtaW46', Cookie: 'yukari_admin=forged' },
  });
  assert.equal(direct.status, 200);
  assert.equal(proxy.status, 200);
  assert.deepEqual(await proxy.json(), await direct.json());
  for (const path of ['/api/v1/admin/queue', '/api/v1/user/session', '/api/v1/settings', '/api/v1/meta/health/extra']) {
    const result = await fetch(phpBase + path, { headers: { 'X-Yukari-Client': '1', 'X-Yukari-Role': 'admin' } });
    assert.equal(result.status, 403, path);
  }
  for (const path of ['/config.ini', '/ini.ini', '/request.db', '/request.db-wal', '/runtime/queue/', '/runtime/queue/request.db', '/runtime/queue/request.db-wal', '/pfwd_forykr/ykrnkkr.ppk']) {
    assert.equal((await fetch(phpBase + path)).status, 403, path);
  }
  for (const path of ['/', '/search.php', '/requestlist_top.php', '/api/server_info.php', '/api/requests.php', '/js/node-status.js', '/css/bootstrap.min.css']) {
    const response = await fetch(phpBase + path);
    assert.equal(response.status, 200, path);
    if (path === '/search.php') assert.match(await response.text(), /\/js\/node-status\.js/);
  }
  assert.equal((await fetch(phpBase + '/init.php')).status, 401);
  assert.equal((await fetch(phpBase + '/api/admin.php?operation=queue', {
    headers: { 'X-Yukari-Admin': '1', 'X-Yukari-Role': 'admin' },
  })).status, 401);
  // Check legacy Basic read authentication without loading init.php, whose GET
  // historically serializes config.ini. Never print or persist these credentials.
  const credentials = testCredentials();
  const legacyQueue = await fetch(phpBase + '/api/admin.php?operation=queue', {
    headers: {
      Authorization: `Basic ${Buffer.from(`admin:${credentials.password}`).toString('base64')}`,
      'X-Yukari-Admin': '1', 'X-Yukari-Easy-Pass': credentials.easyPass || '',
    },
  });
  assert.equal(legacyQueue.status, 200);
  assert.ok(Array.isArray((await legacyQueue.json()).data.items));
});

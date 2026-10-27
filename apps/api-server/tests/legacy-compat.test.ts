import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiBase, phpBase } from '../../../packages/test-support/src/client.js';

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
    // The unified reverse proxy now lets Fastify answer API paths. Its auth
    // boundary may return 401, while unsupported methods/paths return 404;
    // none may be treated as a successful legacy-page bypass.
    assert.ok([401, 403, 404].includes(result.status), `${path}: ${result.status}`);
  }
  for (const path of ['/config.ini', '/ini.ini', '/request.db', '/request.db-wal', '/runtime/queue/', '/runtime/queue/request.db', '/runtime/queue/request.db-wal', '/pfwd_forykr/ykrnkkr.ppk']) {
    assert.equal((await fetch(phpBase + path)).status, 403, path);
  }
  for (const path of ['/search.php', '/search_bs5.php', '/js/node-status.js', '/css/bootstrap.min.css']) {
    const response = await fetch(phpBase + path);
    assert.equal(response.status, 200, path);
    if (path === '/search.php') assert.match(await response.text(), /\/js\/node-status\.js/);
  }
  for (const path of ['/', '/requestlist_top.php', '/api/server_info.php', '/api/requests.php', '/api/mypage.php', '/init.php']) {
    assert.equal((await fetch(phpBase + path)).status, 410, path);
  }
  assert.equal((await fetch(phpBase + '/api/admin.php?operation=queue', {
    headers: { 'X-Yukari-Admin': '1', 'X-Yukari-Role': 'admin' },
  })).status, 410);
  assert.equal((await fetch(phpBase + '/api/admin.php?operation=session')).status, 401);
});

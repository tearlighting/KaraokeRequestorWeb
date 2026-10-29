import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { isAllowedAdminLanOrigin, isAllowedUserLanOrigin } from '../src/app.js';
import { createApp } from '../src/app.js';

test('LAN user origin accepts only matching private IPv4 requests from the dedicated proxy', () => {
  assert.equal(isAllowedUserLanOrigin('http://192.168.1.24:8181', '192.168.1.24:8181', '1'), true);
  assert.equal(isAllowedUserLanOrigin('http://10.0.0.9:8181', '10.0.0.9:8181', '1'), true);
  assert.equal(isAllowedUserLanOrigin('http://172.20.4.3:8181', '172.20.4.3:8181', '1'), true);
  assert.equal(isAllowedUserLanOrigin('http://192.168.1.24:8181', '192.168.1.25:8181', '1'), false);
  assert.equal(isAllowedUserLanOrigin('http://192.168.1.24:8181', '192.168.1.24:8181', undefined), false);
  assert.equal(isAllowedUserLanOrigin('http://192.168.1.24:8181', '192.168.1.24:8181', '1', 8282), false);
  assert.equal(isAllowedUserLanOrigin('http://8.8.8.8:8181', '8.8.8.8:8181', '1'), false);
  assert.equal(isAllowedUserLanOrigin('http://127.0.0.1:8181', '127.0.0.1:8181', '1'), false);
  assert.equal(isAllowedUserLanOrigin('https://192.168.1.24:8181', '192.168.1.24:8181', '1'), false);
  assert.equal(isAllowedUserLanOrigin('http://192.168.1.24:8181/path', '192.168.1.24:8181', '1'), false);
});

test('LAN Admin origin requires its private-gateway marker and matching host', () => {
  assert.equal(isAllowedAdminLanOrigin('http://192.168.1.24:8181', '192.168.1.24:8181', '1'), true);
  assert.equal(isAllowedAdminLanOrigin('http://192.168.1.24:8181', '192.168.1.25:8181', '1'), false);
  assert.equal(isAllowedAdminLanOrigin('http://192.168.1.24:8181', '192.168.1.24:8181', undefined), false);
  assert.equal(isAllowedAdminLanOrigin('http://8.8.8.8:8181', '8.8.8.8:8181', '1'), false);
});

test('the dedicated LAN proxy can create a user session but cannot reach Admin routes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-lan-origin-'));
  const legacy = createServer((request, response) => {
    const operation = new URL(request.url || '/', 'http://legacy').searchParams.get('operation');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, data: operation === 'user-auth' || operation === 'admin-auth' ? { proof: 'p'.repeat(64) } : {} }));
  });
  await new Promise<void>(resolve => legacy.listen(0, '127.0.0.1', resolve));
  const address = legacy.address(); assert.ok(address && typeof address !== 'string');
  const app = createApp({ legacyUrl: `http://127.0.0.1:${address.port}`, bridgeToken: 'b'.repeat(48), userOrigins: [], adminOrigins: [], userLanPort: 8181, playerStatePath: join(root, 'state.json') });
  const origin = 'http://192.168.1.24:8181';
  const headers = { origin, 'x-forwarded-host': '192.168.1.24:8181', 'x-yukari-user-lan-proxy': '1', 'x-yukari-client': '1', 'content-type': 'application/json' };
  const adminLanHeaders = { ...headers, 'x-yukari-admin-lan-proxy': '1' };
  try {
    const login = await app.inject({ method: 'POST', url: '/api/v1/user/session', headers, payload: {} });
    assert.equal(login.statusCode, 200);
    assert.match(String(login.headers['set-cookie']), /YukariUserSession=/);
    const admin = await app.inject({ method: 'GET', url: '/api/v1/admin/queue', headers });
    assert.equal(admin.statusCode, 403);
    assert.equal(admin.json().error.code, 'ORIGIN_DENIED');
    const adminWithoutSession = await app.inject({ method: 'GET', url: '/api/v1/admin/queue', headers: adminLanHeaders });
    assert.equal(adminWithoutSession.statusCode, 401);
    const adminLogin = await app.inject({ method: 'POST', url: '/api/v1/admin/session', headers: adminLanHeaders, payload: { username: 'admin', password: 'isolated-test-password' } });
    assert.equal(adminLogin.statusCode, 200);
    const adminCookie = String(adminLogin.headers['set-cookie']).split(';')[0];
    const adminSession = await app.inject({ method: 'GET', url: '/api/v1/admin/session', headers: { ...adminLanHeaders, cookie: adminCookie } });
    assert.equal(adminSession.statusCode, 200);
    const gatewayStatus = await app.inject({ method: 'GET', url: '/api/v1/admin/gateway/status', headers: { ...adminLanHeaders, cookie: adminCookie } });
    assert.equal(gatewayStatus.statusCode, 200);
    assert.equal(typeof gatewayStatus.json().data.configured, 'boolean');
    assert.equal(typeof gatewayStatus.json().data.connected, 'boolean');
    const forgedHost = await app.inject({ method: 'POST', url: '/api/v1/user/session', headers: { ...headers, 'x-forwarded-host': '192.168.1.25:8181' }, payload: {} });
    assert.equal(forgedHost.statusCode, 403);
  } finally {
    await app.close();
    await new Promise<void>(resolve => legacy.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});

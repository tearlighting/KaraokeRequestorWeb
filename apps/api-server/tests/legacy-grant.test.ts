import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phpBase, testCredentials } from '../../../packages/test-support/src/client.js';

test('真实 Legacy 授权端点：用户不被角色头升级；Basic 必须有效，跨站/缺标记拒绝', async () => {
  const issue = (extra: Record<string, string> = {}) => fetch(phpBase + '/api/queue_ticket.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yukari-Client': '1', 'User-Agent': 'LegacyGrantTestUA', ...extra }, body: '{}',
  });
  const anonymous = await issue({ 'X-Yukari-Role': 'admin' });
  if (anonymous.status === 410) {
    const disabled = await anonymous.json();
    assert.equal(disabled.error.code, 'LEGACY_FEATURE_DISABLED');
    assert.equal((await issue({ Authorization: `Basic ${Buffer.from('admin:invalid').toString('base64')}` })).status, 410);
    return; // MySQL mode deliberately disables the old PHP queue-ticket page.
  }
  assert.equal(anonymous.status, 200);
  const ticket = (await anonymous.json()).data.ticket as string;
  const claims = JSON.parse(Buffer.from(ticket.split('.')[0], 'base64url').toString());
  assert.equal(claims.role, 'user'); assert.equal(claims.aud, 'legacy-queue'); assert.equal(claims.ua, 'LegacyGrantTestUA');
  assert.ok(claims.exp - claims.iat <= 30);
  const read = await fetch(phpBase + '/api/v1/legacy/queue?limit=1&offset=0', { headers: {
    'X-Yukari-Client': '1', 'X-Yukari-Legacy-Queue': ticket, 'X-Yukari-Role': 'admin', 'User-Agent': 'LegacyGrantTestUA',
  } });
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('x-yukari-owner'), 'node-queue-read');
  assert.ok(Array.isArray((await read.json()).data.items));
  assert.equal((await fetch(phpBase + '/api/v1/legacy/queue', { headers: { 'X-Yukari-Client': '1', 'X-Yukari-Legacy-Queue': ticket, 'User-Agent': 'WrongUA' } })).status, 401);
  assert.equal((await issue({ Authorization: 'Basic YWRtaW46aW52YWxpZA==' })).status, 401);
  assert.equal((await issue({ Origin: 'http://untrusted.example' })).status, 403);
  assert.equal((await issue({ 'X-Yukari-Client': '' })).status, 403);
  const credentials = testCredentials();
  const admin = await issue({ Authorization: `Basic ${Buffer.from(`admin:${credentials.password}`).toString('base64')}` });
  assert.equal(admin.status, 200);
  const grant = (await admin.json()).data.ticket as string;
  assert.equal(JSON.parse(Buffer.from(grant.split('.')[0], 'base64url').toString()).role, 'admin');
  assert.equal((await fetch(phpBase + '/api/v1/legacy/queue', { headers: {
    'X-Yukari-Client': '1', 'X-Yukari-Legacy-Queue': grant, 'User-Agent': 'LegacyGrantTestUA',
  } })).status, 200);
});

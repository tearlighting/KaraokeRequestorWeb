import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { verifyQueueTicket } from '../src/legacy-queue.js';

function php(input: Record<string, unknown>) {
  return JSON.parse(execFileSync('docker', ['compose', '-f', process.env.E2E_COMPOSE_FILE || 'docker/compose.yaml', 'exec', '-T', 'web', 'php',
    '/workspace/apps/api-server/tests/php/queue-ticket-oracle.php'], { cwd: resolve('../..'), input: JSON.stringify(input), encoding: 'utf8', timeout: 10000 }));
}
test('真实 PHP 签发与 Node 票据验证：角色不可升级、过期/UA/用途限制及策略撤销', () => {
  const secret = 'synthetic-service-key-for-tests-only'.repeat(2);
  const config = { configpass: 'synthetic-admin-only', useeasyauth: 0 };
  for (const role of ['user', 'admin']) {
    const ticket = php({ operation: 'issue', config, secret, role }).ticket as string;
    assert.equal(verifyQueueTicket(ticket, secret, 'test-UA').role, role);
    assert.throws(() => verifyQueueTicket(ticket, secret, 'different-UA'), { status: 401 });
    const [payload, signature] = ticket.split('.');
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...value, role: role === 'user' ? 'admin' : 'user' })).toString('base64url');
    assert.throws(() => verifyQueueTicket(forged + '.' + signature, secret, 'test-UA'), { status: 401 });
    for (const change of [{ aud: 'admin' }, { exp: value.iat - 1 }, { exp: value.iat + 3600 }]) {
      const data = Buffer.from(JSON.stringify({ ...value, ...change })).toString('base64url');
      const signed = data + '.' + createHmac('sha256', secret).update('legacy-queue-v1\0' + data).digest('hex');
      assert.throws(() => verifyQueueTicket(signed, secret, 'test-UA'), { status: 401 });
      assert.equal(php({ operation: 'verify', config, secret, ticket: signed }).valid, false);
    }
    const changed = role === 'admin' ? { ...config, configpass: 'changed-synthetic' } : { ...config, useeasyauth: 1 };
    assert.equal(php({ operation: 'verify', config: changed, secret, ticket }).valid, false);
  }
});

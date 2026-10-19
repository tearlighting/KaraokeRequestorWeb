import { testConfigPath } from '../../../packages/test-support/src/client.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, link, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { createApp } from '../src/app.js';
import { projectSettings, SettingsRepository, SettingsService } from '../src/settings.js';
import { TestAgent } from '../../../packages/test-support/src/client.js';

const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
function phpProjection(fixtures: string[]) {
  return JSON.parse(execFileSync('docker', ['compose', '-f', process.env.E2E_COMPOSE_FILE || 'docker/compose.yaml', 'exec', '-T', 'web',
    'php', '/workspace/apps/api-server/tests/php/settings-oracle.php'], {
    cwd: resolve('../..'), input: JSON.stringify(fixtures), encoding: 'utf8', timeout: 15000,
  }));
}

test('Node-native 设置与原 PHP 投影等价：默认、空值、布尔、注释、重复项、边界与范围错误', () => {
  const fixtures = [
    '', '; empty\n', 'playmode=3\nstartvolume=50\nrequestlistactivereload=off\n',
    'playmode="5"\r\nstartvolume="0"\r\nrequestlistactivereload=yes\r\n',
    'playmode=1\nstartvolume=100\nrequestlistactivereload=0\n',
    'playmode=2\nplaymode=4 ; duplicate\nstartvolume=27.9\nrequestlistactivereload=true\n',
    '[main]\nplaymode=3\n[more]\nstartvolume=23\nrequestlistactivereload=no\n',
    'playmode=3\nstartvolume="19things"\nrequestlistactivereload=null\n',
    'playmode=3\nstartvolume=\nrequestlistactivereload=none\n',
    'playmode=3\nstartvolume="words;still quoted"\nrequestlistactivereload=on\n',
    'other[0]=value\nconfigpass=synthetic-not-a-real-password\nplaymode=3\n',
    'requestlistactivereload=false\nstartvolume=61\nplaymode=2\n',
    'playmode=0\n', 'playmode=6\n', 'startvolume=-1\n', 'startvolume=101\n', 'requestlistactivereload=2\n',
  ];
  const oracle = phpProjection(fixtures);
  fixtures.forEach((fixture, index) => {
    const result = oracle[index];
    const valid = result.playmode >= 1 && result.playmode <= 5 && result.startvolume >= 0 && result.startvolume <= 100
      && result.requestlistactivereload >= 0 && result.requestlistactivereload <= 1;
    if (valid) assert.deepEqual(projectSettings(Buffer.from(fixture)), result, `fixture ${index}`);
    else assert.throws(() => projectSettings(Buffer.from(fixture)), { code: 'LEGACY_CONTRACT_ERROR' });
  });
  for (const fixture of ['playmode[]=3\n', 'playmode=1|2\n', 'playmode="${MODE}"\n', 'playmode=PHP_INT_MAX\n', 'playmode="unfinished',
    '"playmode"=5\n', 'other="multiline\nplaymode=5\n"\n']) {
    assert.throws(() => projectSettings(Buffer.from(fixture)), { code: 'SETTINGS_UNAVAILABLE' });
  }
});

test('只读 repository：版本冲突、原子替换后的失效挂载、文件缺失；不创建或修改数据', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yukari-settings-'));
  const path = join(directory, 'config.ini');
  const text = 'configpass=synthetic-only\nplaymode=3\n';
  try {
    const service = new SettingsService(new SettingsRepository(path));
    await assert.rejects(service.read(hash(text)), { code: 'SETTINGS_UNAVAILABLE' });
    await writeFile(path, text);
    assert.deepEqual(await service.read(hash(text)), projectSettings(Buffer.from(text)));
    await assert.rejects(service.read('0'.repeat(64)), { code: 'SETTINGS_UNAVAILABLE' });
    const retained = join(directory, 'retained-inode.ini');
    await link(path, retained);
    const replacement = join(directory, 'replacement.ini');
    await writeFile(replacement, text + 'startvolume=12\n');
    await rename(replacement, path);
    await assert.rejects(service.read(hash(text)), { code: 'SETTINGS_UNAVAILABLE' });
    // A retained inode models Docker's single-file bind after atomic replacement.
    await assert.rejects(new SettingsService(new SettingsRepository(retained)).read(hash(text + 'startvolume=12\n')), { code: 'SETTINGS_UNAVAILABLE' });
    assert.equal((await service.read(hash(text + 'startvolume=12\n'))).startvolume, 12);
    assert.equal(await readFile(path, 'utf8'), text + 'startvolume=12\n');
    assert.throws(() => new SettingsRepository('relative/config.ini'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('真实 Node-native GET 与无数据库的旧 PHP 投影对照；权限及真实配置字节不变', async () => {
  const path = testConfigPath;
  const original = await readFile(path);
  const before = hash(original);
  const guest = new TestAgent();
  assert.equal((await guest.call('/settings')).status, 401);
  await guest.user();
  assert.equal((await guest.call('/settings')).status, 401);
  const admin = new TestAgent(); await admin.admin();
  assert.equal((await admin.call('/settings', 'GET', undefined, { Origin: 'http://127.0.0.1:5173' })).status, 403);
  const result = await admin.call('/settings'); assert.equal(result.status, 200);
  // Snapshot travels over stdin only; the PHP oracle emits three fields + hash,
  // loads no runtime config/commonfunc and cannot initialize the real database.
  assert.deepEqual(result.body.data, phpProjection([original.toString('utf8')])[0]);
  assert.equal(hash(await readFile(path)), before);
});

test('隔离授权门：PHP 不提供设置数据也能读取；撤销、并发变化与秘密字段隔离', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yukari-settings-auth-'));
  const path = join(directory, 'config.ini');
  const text = 'configpass=synthetic-only\nprivate_key=never-expose\nplaymode=4\nstartvolume=22\nrequestlistactivereload=off\n';
  await writeFile(path, text);
  const gate = Fastify({ logger: false });
  const calls: string[] = [];
  let mode: 'normal' | 'revoke' | 'change' = 'normal';
  let checks = 0;
  gate.post('/api/node_bridge.php', async (request, reply) => {
    const operation = (request.query as { operation: string }).operation;
    calls.push(operation);
    if (operation === 'admin-auth') return { ok: true, data: { proof: 'a'.repeat(64) } };
    if (operation !== 'admin-session') return reply.code(500).send({ ok: false, error: 'Business forwarding forbidden in this test' });
    checks++;
    if (mode === 'revoke') return reply.code(401).send({ ok: false, error: '会话已失效' });
    return { ok: true, data: { config_revision: mode === 'change' && checks === 2 ? '0'.repeat(64) : hash(text) } };
  });
  // This isolated gate stubs authentication only, never the settings business.
  gate.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => done(null, body));
  const base = await gate.listen({ host: '127.0.0.1', port: 0 });
  const app = createApp({ legacyUrl: base, bridgeToken: 'b'.repeat(64), settingsPath: path, userOrigins: [], adminOrigins: [] });
  try {
    const login = await app.inject({ method: 'POST', url: '/api/v1/admin/session', headers: { 'x-yukari-client': '1' },
      payload: { username: 'admin', password: 'synthetic-only' } });
    assert.equal(login.statusCode, 200);
    const cookies = login.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    const read = () => app.inject({ method: 'GET', url: '/api/v1/settings', headers: { 'x-yukari-client': '1', cookie: cookies } });
    const response = await read();
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['x-yukari-owner'], 'node-settings-read');
    assert.deepEqual(response.json().data, projectSettings(Buffer.from(text)));
    assert.ok(!response.body.includes('synthetic-only') && !response.body.includes('never-expose'));
    assert.deepEqual(calls, ['admin-auth', 'admin-session', 'admin-session']);
    mode = 'change'; checks = 0;
    assert.equal((await read()).json().error.code, 'SETTINGS_CHANGED');
    mode = 'revoke';
    assert.equal((await read()).statusCode, 401);
    assert.ok(!calls.includes('admin-settings'));
    assert.equal(await readFile(path, 'utf8'), text);
  } finally {
    await app.close(); await gate.close(); await rm(directory, { recursive: true, force: true });
  }
});

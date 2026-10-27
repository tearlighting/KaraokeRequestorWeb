import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import type { MysqlStore } from '../src/mysql.js';

test('MySQL playback scheduler is reported available only when explicitly enabled and Agent-authenticated', async () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-mysql-autoplay-capability-'));
  const legacyOperations: string[] = [];
  const legacy = createServer((request, response) => {
    const operation = new URL(request.url || '/', 'http://legacy').searchParams.get('operation');
    legacyOperations.push(operation || '');
    const data = operation === 'admin-auth' ? { proof: 'p'.repeat(64) } : {};
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, data }));
  });
  await new Promise<void>((resolve) => legacy.listen(0, '127.0.0.1', resolve));
  const address = legacy.address();
  assert.ok(address && typeof address !== 'string');

  const mysqlStore = {
    ping: async () => undefined,
    close: async () => undefined,
    rows: async (sql: string) => sql.includes('information_schema.tables') ? [{ n: 2 }] : [],
    transaction: async <T>(callback: (connection: unknown) => Promise<T>) => callback({ query: async () => [[]], execute: async () => [{ affectedRows: 0 }] }),
  } as unknown as MysqlStore;
  const app = createApp({
    legacyUrl: `http://127.0.0.1:${address.port}`, bridgeToken: 'b'.repeat(48), playerAgentToken: 'a'.repeat(48),
    playerStatePath: join(root, 'agent-state.json'), queueRoot: root, nodeAutoplay: true,
    mysqlStore, userOrigins: ['http://user'], adminOrigins: ['http://admin'],
  });
  const store = mysqlStore as unknown as { rows: (sql: string) => Promise<unknown[]> };
  store.rows = async (sql: string) => sql.includes('information_schema.tables') ? [{ n: 2 }]
    : sql.includes('FROM app_setting') ? [
      { setting_key: 'playmode', value_json: '1', revision: 1 },
      { setting_key: 'startvolume', value_json: '50', revision: 1 },
      { setting_key: 'requestlistactivereload', value_json: '1', revision: 1 },
      { setting_key: 'request_automove', value_json: '1', revision: 1 },
      { setting_key: 'request_automove_reset', value_json: '1', revision: 1 },
      { setting_key: 'request_automove_midjoin_first', value_json: '0', revision: 1 },
    ] : [];
  const headers = { 'x-yukari-client': '1', 'content-type': 'application/json' };
  try {
    const login = await app.inject({ method: 'POST', url: '/api/v1/admin/session', headers, payload: { username: 'admin', password: 'fixture-only' } });
    assert.equal(login.statusCode, 200);
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const status = await app.inject({ method: 'GET', url: '/api/v1/admin/player-agent', headers: { ...headers, cookie } });
    assert.equal(status.statusCode, 200, status.body);
    assert.equal(status.json().data.nodeAutoplayAvailable, true);
    const system = await app.inject({ method: 'GET', url: '/api/v1/admin/status', headers: { ...headers, cookie } });
    assert.equal(system.statusCode, 200, system.body);
    assert.equal(system.json().data.playmode, 1);
    assert.ok(legacyOperations.includes('admin-session'));
    assert.ok(!legacyOperations.includes('admin-status'));
    const disabledApp=createApp({legacyUrl:`http://127.0.0.1:${address.port}`,bridgeToken:'b'.repeat(48),playerAgentToken:'a'.repeat(48),playerStatePath:join(root,'disabled-agent-state.json'),queueRoot:root,nodeAutoplay:false,mysqlStore,userOrigins:['http://user'],adminOrigins:['http://admin']});
    try{
      const disabledLogin=await disabledApp.inject({method:'POST',url:'/api/v1/admin/session',headers,payload:{username:'admin',password:'fixture-only'}});
      const disabledCookie=String(disabledLogin.headers['set-cookie']).split(';')[0];
      const disabledStatus=await disabledApp.inject({method:'GET',url:'/api/v1/admin/player-agent',headers:{...headers,cookie:disabledCookie}});
      assert.equal(disabledStatus.json().data.nodeAutoplayAvailable,false);
      assert.match(disabledStatus.json().data.autoplayUnavailableReason,/YUKARI_NODE_AUTOPLAY=0/);
    }finally{await disabledApp.close();}
  } finally {
    await app.close();
    await new Promise<void>((resolve) => legacy.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});

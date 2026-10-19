import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../src/app.js';

test('隔离真实 SQLite + 授权替身：user/admin 差异、字段白名单、无 PHP 队列调用、策略撤销', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yukari-queue-boundary-'));
  const db = new DatabaseSync(join(directory, 'request.db'));
  db.exec(`CREATE TABLE requesttable(id INTEGER PRIMARY KEY,songfile TEXT,fullpath TEXT,singer TEXT,comment TEXT,kind TEXT,
    reqorder INTEGER,nowplaying TEXT,secret INTEGER,loop INTEGER,pause INTEGER,track INTEGER,keychange INTEGER,audiodelay INTEGER,
    duration INTEGER,volume INTEGER,song_name TEXT,lister_artist TEXT,lister_work TEXT,lister_op_ed TEXT,lister_comment TEXT,clientip TEXT,clientua TEXT);
    INSERT INTO requesttable(id,songfile,singer,kind,reqorder,nowplaying,secret,clientip,clientua) VALUES(1,'private title','Alice','動画',1,'未再生',1,'another-ip','another-UA');`);
  const gate = Fastify({ logger: false });
  const calls: string[] = [];
  let revoked = false;
  gate.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => done(null, body));
  gate.post('/api/node_bridge.php', (request, reply) => {
    const operation = (request.query as { operation: string }).operation; calls.push(operation);
    if (operation === 'user-auth' || operation === 'admin-auth') return { ok: true, data: { proof: 'a'.repeat(64) } };
    if (operation === 'queue-notify') return { ok: true, data: { notified: true } };
    if (operation !== 'queue-context') return reply.code(500).send({ ok: false, error: 'PHP queue business absent' });
    if (revoked) return reply.code(401).send({ ok: false, error: 'Policy revoked' });
    return { ok: true, data: { database: 'request.db', role: request.headers['x-yukari-role'], ip: 'bridge-ip',
      ua: request.headers['user-agent'], secret_text: '保密' } };
  });
  const base = await gate.listen({ host: '127.0.0.1', port: 0 });
  const app = createApp({ legacyUrl: base, bridgeToken: 'b'.repeat(64), queueRoot: directory, userOrigins: [], adminOrigins: [] });
  try {
    assert.equal((await app.inject({ url: '/api/v1/queue', headers: { 'x-yukari-client': '1' } })).statusCode, 401);
    const user = await app.inject({ method: 'POST', url: '/api/v1/user/session', headers: { 'x-yukari-client': '1' }, payload: {} });
    const cookie = user.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const headers = { cookie, 'x-yukari-client': '1', 'x-yukari-role': 'admin' };
    const masked = await app.inject({ url: '/api/v1/queue', headers });
    assert.equal(masked.statusCode, 200);
    assert.equal(masked.json().data.items[0].songfile, '保密');
    assert.equal(masked.headers['x-yukari-owner'], 'node-queue-read');
    assert.equal((await app.inject({ url: '/api/v1/admin/queue', headers })).statusCode, 401);
    const admin = await app.inject({ method: 'POST', url: '/api/v1/admin/session', headers: { 'x-yukari-client': '1' }, payload: { username: 'admin', password: 'synthetic-only' } });
    const adminCookie = admin.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const clear = await app.inject({ url: '/api/v1/admin/queue', headers: { 'x-yukari-client': '1', cookie: adminCookie } });
    assert.equal(clear.json().data.items[0].songfile, 'private title');
    assert.deepEqual(Object.keys(clear.json().data.items[0]).sort(), ['id','position','reqorder','display_name','songfile','singer','nowplaying','kind'].sort());
    db.prepare("UPDATE requesttable SET clientip='bridge-ip',clientua=? WHERE id=1").run('YukariNode/' + user.json().data.userId);
    assert.equal((await app.inject({ url: '/api/v1/queue', headers })).json().data.items[0].songfile, 'private title');
    const adminHeaders = { 'x-yukari-client':'1', cookie:adminCookie };
    const move = await app.inject({method:'POST',url:'/api/v1/admin/requests/1/move',headers:adminHeaders,payload:{action:'up'}});
    assert.equal(move.statusCode,200); assert.equal(move.headers['x-yukari-owner'],'node-queue-mutation');
    assert.equal((await app.inject({method:'DELETE',url:'/api/v1/admin/requests/1',headers,payload:{}})).statusCode,401);
    revoked = true;
    assert.equal((await app.inject({method:'DELETE',url:'/api/v1/admin/requests/1',headers:adminHeaders,payload:{}})).statusCode,401);
    assert.ok(db.prepare('SELECT id FROM requesttable WHERE id=1').get());
    assert.equal((await app.inject({ url: '/api/v1/queue', headers })).statusCode, 401);
    assert.ok(calls.every((operation) => ['user-auth','admin-auth','queue-context','queue-notify'].includes(operation)));
  } finally { db.close(); await app.close(); await gate.close(); await rm(directory, { recursive: true, force: true }); }
});

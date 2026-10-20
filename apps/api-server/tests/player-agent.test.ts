import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import { agentAuthorized, PlayerTaskStore } from '../src/player-agent.js';

test('Player Agent token and durable task transitions are strict and single-owner', () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-player-state-'));
  const path = join(root, 'state.json');
  try {
    let now = 1000;
    const store = new PlayerTaskStore(path, () => now);
    assert.throws(() => store.createTest(), { code: 'PLAYER_AGENT_OFFLINE' });
    assert.throws(() => store.armManual(), { code: 'PLAYER_AGENT_OFFLINE' });
    store.report('agent-one', { playback: 'idle', testReady: false });
    assert.throws(() => store.createTest(), { code: 'PLAYER_TEST_NOT_READY' });
    store.report('agent-one', { playback: 'idle', testReady: true });
    store.report('agent-one', { playback: 'idle', testReady: true });
    const task = store.createTest();
    assert.equal(task.state, 'pending');
    assert.equal(store.next('agent-one', true).task?.state, 'claimed');
    assert.equal(store.next('agent-two', true).task, null);
    assert.throws(() => store.createTest(), { code: 'PLAYER_BUSY' });
    assert.throws(() => store.report('agent-one', { taskId: task.id, state: 'completed', playback: 'idle' }), { code: 'INVALID_PLAYER_TRANSITION' });
    store.report('agent-one', { taskId: task.id, state: 'playing', playback: 'playing', file: 'test.mp4' });
    const restarted = new PlayerTaskStore(path, () => now);
    assert.equal(restarted.status().task?.id, task.id);
    now += 16000; assert.equal(restarted.status().connected, false);
    restarted.report('agent-one', { taskId: task.id, state: 'completed', playback: 'idle' });
    assert.equal(restarted.status().task?.state, 'completed');
    assert.throws(() => restarted.report('agent-two', { taskId: task.id, state: 'playing', playback: 'playing' }), { code: 'STALE_PLAYER_TASK' });
    assert.ok(agentAuthorized(`Bearer ${'a'.repeat(48)}`, 'a'.repeat(48)));
    assert.ok(!agentAuthorized(`Bearer ${'b'.repeat(48)}`, 'a'.repeat(48)));
    assert.ok(!agentAuthorized(`Bearer ${'a'.repeat(47)}`, 'a'.repeat(48)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('manual strategy waits for one explicit start request per song and survives state reload', () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-manual-player-'));
  const path = join(root, 'state.json');
  try {
    let now = 1000; const store = new PlayerTaskStore(path, () => now);
    store.report('agent-one', { playback: 'idle', testReady: false });
    assert.deepEqual(store.armManual(), { autoplayEnabled: true, manualMode: true });
    assert.equal(store.status().manualStartRequested, false);
    const restarted = new PlayerTaskStore(path, () => now);
    assert.equal(restarted.status().manualMode, true);
    restarted.requestManualStart(); assert.equal(restarted.status().manualStartRequested, true);
    restarted.consumeManualStart(); assert.equal(restarted.status().manualStartRequested, false);
    restarted.autoplayAction('stop'); assert.equal(restarted.status().manualMode, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Fastify agent routes require agent token; test task/control require admin session; public status is sanitized', async () => {
  const root = mkdtempSync(join(tmpdir(), 'yukari-agent-api-'));
  const legacy = createServer((request, response) => {
    const operation = new URL(request.url || '/', 'http://legacy').searchParams.get('operation');
    const data = operation === 'admin-auth' || operation === 'user-auth' ? { proof: 'p'.repeat(64) }
      : operation === 'admin-session' ? { config_revision: 'a'.repeat(64) } : {};
    response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: true, data }));
  });
  await new Promise<void>(resolve => legacy.listen(0, '127.0.0.1', resolve));
  const address = legacy.address(); assert.ok(address && typeof address !== 'string');
  const app = createApp({ legacyUrl: `http://127.0.0.1:${address.port}`, bridgeToken: 'b'.repeat(48), playerAgentToken: 'a'.repeat(48),
    playerStatePath: join(root, 'state.json'), settingsPath: join(root, 'config.ini'), queueRoot: root,
    userOrigins: ['http://user'], adminOrigins: ['http://admin'] });
  try {
    const headers = { 'x-yukari-client': '1', 'content-type': 'application/json' };
    const login = await app.inject({ method: 'POST', url: '/api/v1/admin/session', headers, payload: { username: 'admin', password: 'not-persisted' } });
    assert.equal(login.statusCode, 200);
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const adminHeaders = { ...headers, cookie };
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/admin/player-agent/test', headers, payload: {} })).statusCode, 401);
    const agentHeaders = { ...headers, authorization: `Bearer ${'a'.repeat(48)}` };
    const ready = await app.inject({ method: 'POST', url: '/api/v1/agent/report', headers: agentHeaders, payload: { agentId: 'one', playback: 'idle', testReady: true } });
    assert.equal(ready.statusCode, 200);
    const created = await app.inject({ method: 'POST', url: '/api/v1/admin/player-agent/test', headers: adminHeaders, payload: {} });
    assert.equal(created.statusCode, 200); const taskId = created.json().data.id;
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/agent/next', headers, payload: { agentId: 'one' } })).statusCode, 401);
    const claimed = await app.inject({ method: 'POST', url: '/api/v1/agent/next', headers: { ...headers, authorization: `Bearer ${'a'.repeat(48)}` }, payload: { agentId: 'one', testReady: true } });
    assert.equal(claimed.statusCode, 200); assert.equal(claimed.json().data.task.id, taskId);
    const user = await app.inject({ method: 'POST', url: '/api/v1/user/session', headers, payload: {} }); assert.equal(user.statusCode, 200);
    const userCookie = String(user.headers['set-cookie']).split(', ').find(value => value.startsWith('YukariUserSession='))?.split(';')[0]; assert.ok(userCookie);
    const publicStatus = await app.inject({ method: 'GET', url: '/api/v1/playback/agent', headers: { 'x-yukari-client': '1', cookie: userCookie } });
    assert.equal(publicStatus.statusCode, 200); assert.deepEqual(Object.keys(publicStatus.json().data).sort(), ['active','connected','playback']);
    const control = await app.inject({ method: 'POST', url: '/api/v1/admin/player-agent/control', headers: adminHeaders, payload: { action: 'pause' } });
    assert.equal(control.statusCode, 200);
    const next = await app.inject({ method: 'POST', url: '/api/v1/agent/next', headers: { ...headers, authorization: `Bearer ${'a'.repeat(48)}` }, payload: { agentId: 'one', testReady: true } });
    assert.equal(next.json().data.command, 'pause');
  } finally { await app.close(); await new Promise<void>(resolve => legacy.close(() => resolve())); rmSync(root, { recursive: true, force: true }); }
});

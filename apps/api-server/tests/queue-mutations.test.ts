import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { buildSync } from 'esbuild';
import { QueueMutationRepository, QueueMutationService, type QueueAction } from '../src/queue-mutations.js';

const schema = `CREATE TABLE requesttable(id INTEGER PRIMARY KEY,reqorder INTEGER,nowplaying TEXT,payload TEXT);
CREATE TABLE history(id INTEGER PRIMARY KEY,payload TEXT); INSERT INTO history VALUES(7,'must survive');`;
function fixture(rows: unknown[][], parent = tmpdir()) {
  const directory = mkdtempSync(join(parent, 'yukari-mutation-'));
  const path = join(directory, 'request.db'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL;' + schema);
  for (const row of rows) db.prepare('INSERT INTO requesttable VALUES(?,?,?,?)').run(...row as [number, number, string, string]);
  return { directory, path, db, repository: new QueueMutationRepository(directory), cleanup() { db.close(); rmSync(directory, { recursive: true }); } };
}
test('原 PHP helpers + normalization 对照：删除/上下边界/插队/间隔/重复/9999/历史与全字段', () => {
  const scenarios = [[], [[1,null,null,'A'],[2,'abc','未再生','B'],[3,2.5,'再生中','C']], [[1,1,'未再生','A']], [[1,-2,'再生済','A'],[2,4,'再生中','B'],[3,8,'未再生','C'],[4,8,'1','D'],[5,9999,'未再生','E']],
    [[1,1,'再生済','A'],[2,2,'未再生','B'],[3,3,'再生済','C'],[4,4,'未再生','D']]];
  for (const rows of scenarios) for (const action of ['delete','up','down','warikomi'] as const) {
    const f = fixture(rows);
    const operations = [...rows.map(row => ({ id: Number(row[0]), action })), { id: 999999, action }];
    try {
      const oracle = JSON.parse(execFileSync('docker', ['compose','-f',process.env.E2E_COMPOSE_FILE || 'docker/compose.yaml','exec','-T','web','php',
        '/workspace/apps/api-server/tests/php/queue-mutation-oracle.php'], { cwd: resolve('../..'), input: JSON.stringify({ schema, rows, operations }), encoding: 'utf8', timeout: 15000 }));
      operations.forEach((op, i) => {
        if (oracle[i].error) { assert.throws(() => f.repository.mutate('request.db', op.id, op.action), { code: oracle[i].error }); return; }
        assert.equal(f.repository.mutate('request.db', op.id, op.action), oracle[i].message);
        assert.deepEqual(f.db.prepare('SELECT * FROM requesttable ORDER BY id').all().map(r => ({ ...r })), oracle[i].rows);
        assert.deepEqual(f.db.prepare('SELECT * FROM history').all().map(r => ({ ...r })), oracle[i].history);
      });
    } finally { f.cleanup(); }
  }
});
test('触发器失败整体回滚、缺失文件不创建、锁超时、通知失败不重试已提交事务', async () => {
  const f = fixture([[1,2,'未再生','A'],[2,4,'未再生','B']]);
  try {
    const before = f.db.prepare('SELECT * FROM requesttable').all();
    f.db.exec("CREATE TRIGGER reject_normalize BEFORE UPDATE ON requesttable WHEN NEW.reqorder=1 BEGIN SELECT RAISE(ABORT,'injected failure'); END;");
    for (const action of ['delete','up','down','warikomi'] as QueueAction[]) {
      assert.throws(() => f.repository.mutate('request.db', 1, action), { code: 'QUEUE_WRITE_UNAVAILABLE' });
      assert.deepEqual(f.db.prepare('SELECT * FROM requesttable').all(), before);
    }
    f.db.exec('DROP TRIGGER reject_normalize; BEGIN IMMEDIATE');
    assert.throws(() => f.repository.mutate('request.db', 1, 'delete'), { code: 'QUEUE_WRITE_UNAVAILABLE' });
    f.db.exec('ROLLBACK');
    assert.throws(() => f.repository.mutate('missing.db', 1, 'delete'), { code: 'QUEUE_WRITE_UNAVAILABLE' });
    assert.throws(() => readFileSync(join(f.directory,'missing.db')));
    assert.throws(() => f.repository.mutate('../request.db', 1, 'delete'), { code: 'QUEUE_WRITE_UNAVAILABLE' });
    let notices = 0;
    await assert.rejects(new QueueMutationService(f.repository).execute('request.db', 1, 'delete', async () => { notices++; throw Error('offline'); }), { code: 'QUEUE_COMMITTED_NOTICE_FAILED' });
    assert.equal(notices, 1); assert.equal(f.db.prepare('SELECT COUNT(*) n FROM requesttable WHERE id=1').get()!.n, 0);
  } finally { f.cleanup(); }
});
test('真实 Linux PHP/Node WAL writer：持锁期间等待，提交后新快照调序', async () => {
  assert.equal(process.env.E2E_COMPOSE_FILE, 'docker/compose.isolated.yaml', 'Requires isolated deployment');
  const project = process.env.E2E_COMPOSE_PROJECT;
  const files = (process.env.E2E_COMPOSE_FILES || process.env.E2E_COMPOSE_FILE).split(';');
  const compose = (...args: string[]) => ['compose', ...(project ? ['-p', project] : []), ...files.flatMap(file => ['-f', file]), ...args];
  const runnerHostPath = process.env.E2E_QUEUE_RUNNER_HOST_OUT || '../../.local/phase7-test-tools/queue-runner.mjs';
  const runnerContainerPath = process.env.E2E_QUEUE_RUNNER_CONTAINER_PATH || '/test/queue-runner.mjs';
  buildSync({ entryPoints: ['tests/queue-mutation-runner.ts'], bundle: true, platform: 'node', format: 'esm',
    outfile: runnerHostPath });
  const name = 'yukari-mutation-' + randomUUID(), path = '/var/www/html/runtime/queue/' + name + '/request.db';
  const args = compose('exec','-T','web','php','/workspace/apps/api-server/tests/php/queue-lock-writer.php',path);
  execFileSync('docker', [...args,'init'], { cwd: resolve('../..'), timeout:10000 });
  const child = execFile('docker', args, { cwd: resolve('../..'), timeout:10000 });
  const completed = new Promise<void>((resolve, reject) => { child.once('error',reject); child.once('exit',code=>code===0?resolve():reject(Error('PHP writer failed'))); });
  void completed.catch(()=>{});
  await new Promise<void>((resolve,reject)=>{ child.stdout!.once('data',data=>String(data).includes('locked')?resolve():reject(Error('No PHP lock: '+String(data)))); child.once('error',reject); });
  const runner = execFile('docker', compose('exec','-T','api-server','node',
    runnerContainerPath,name+'/request.db'), { cwd: resolve('../..'), encoding:'utf8',timeout:10000 });
  let output = '';
  runner.stdout!.on('data', data => {
    output += String(data);
    if (String(data).includes('waiting')) setTimeout(() => child.stdin!.end('commit\n'), 150);
  });
  await new Promise<void>((resolve,reject) => { runner.once('error',reject); runner.once('exit',code=>code===0?resolve():reject(Error('Node runner failed'))); });
  await completed;
  const result = JSON.parse(output.trim().split('\n').at(-1)!);
  assert.ok(result.elapsed >= 100, 'Must actually wait for PHP-held write lock');
  assert.deepEqual(result.rows, [{id:2,reqorder:1},{id:1,reqorder:2}]);
});

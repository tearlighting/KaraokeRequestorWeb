import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { QueueRepository, QueueService, type QueueContext } from '../src/queue.js';

const schema = `CREATE TABLE requesttable(id INTEGER PRIMARY KEY, songfile TEXT, fullpath TEXT, singer TEXT, comment TEXT,
 kind TEXT, reqorder INTEGER, nowplaying TEXT, secret INTEGER, loop INTEGER, pause INTEGER, track INTEGER, keychange INTEGER,
 audiodelay INTEGER, duration INTEGER, volume INTEGER, song_name TEXT, lister_artist TEXT,lister_work TEXT,lister_op_ed TEXT,lister_comment TEXT,clientip TEXT,clientua TEXT)`;
const base = { songfile: 'real title', fullpath: 'C:\\media\\song.mp4', singer: 'Alice', comment: 'comment', kind: '動画', nowplaying: '未再生', secret: 1,
  loop: 0, pause: 0, track: 0, keychange: 0, audiodelay: 0, duration: 123, volume: null, song_name: 'metadata',
  lister_artist: 'artist', lister_work: 'work', lister_op_ed: 'OP', lister_comment: 'metadata comment', clientip: 'owner', clientua: 'owner-UA' };
function insert(db: DatabaseSync, row: Record<string, unknown>) {
  const entries = Object.entries(row);
  db.prepare(`INSERT INTO requesttable (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`).run(...entries.map(([,v]) => v as string | number | null));
}
const context: QueueContext = { database: 'request.db', ip: 'guest', ua: 'guest-UA', role: 'user', secret_text: '保密 🎤' };

test('真实 PHP 对照：空队列、DESC/position/分页、owner 同名、管理员、保密和异常标量', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yukari-queue-'));
  try {
    for (const empty of [true, false]) {
      const rows = empty ? [] : [
        { ...base, id: 1, reqorder: 1 },
        { ...base, id: 2, reqorder: 8, clientip: 'another', clientua: 'another-UA' }, // same-name fallback
        { ...base, id: 3, reqorder: 4, singer: 'Bob', clientip: 'another', nowplaying: '再生中' },
        { ...base, id: 4, reqorder: 4, singer: 'Carol', clientip: 'another', nowplaying: '', duration: -10, volume: '' },
        { ...base, id: 5, reqorder: -2, singer: 'Dan', clientip: '', nowplaying: '0', secret: '1foo', duration: 12.9 },
        { ...base, id: 6, reqorder: 2, singer: 'Eve', clientip: '', nowplaying: null, secret: '1', duration: null },
      ];
      const path = join(directory, 'request.db');
      const db = new DatabaseSync(path); db.exec('DROP TABLE IF EXISTS requesttable'); db.exec(schema);
      for (const row of rows) insert(db, row);
      db.close();
      const contexts = [context, { ...context, ip: 'owner', ua: 'owner-UA' }, { ...context, role: 'admin' as const },
        { ...context, limit: 2, offset: 1 }, { ...context, limit: 0, offset: 3 }, { ...context, limit: 1, offset: 99 }];
      const oracle = JSON.parse(execFileSync('docker', ['compose', '-f', process.env.E2E_COMPOSE_FILE || 'docker/compose.yaml', 'exec', '-T', 'web', 'php',
        '/workspace/apps/api-server/tests/php/queue-oracle.php'], { cwd: resolve('../..'), input: JSON.stringify({ schema, rows, contexts }), encoding: 'utf8', timeout: 15000 }));
      const service = new QueueService(new QueueRepository(directory));
      contexts.forEach((ctx, i) => assert.deepEqual(service.read(ctx, 'limit' in ctx ? ctx.limit : 0, 'offset' in ctx ? ctx.offset : 0), oracle[i], `empty=${empty}, context=${i}`));
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('SQLite 只读：WAL 未 checkpoint 提交可见，未提交不可见；缺失/损坏/缺表/路径越界不创建数据', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yukari-queue-wal-'));
  const path = join(directory, 'request.db');
  let writer: DatabaseSync | undefined;
  try {
    const service = new QueueService(new QueueRepository(directory));
    assert.throws(() => service.read(context), { code: 'QUEUE_UNAVAILABLE' });
    await assert.rejects(readFile(path));
    writer = new DatabaseSync(path); writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;'); writer.exec(schema);
    insert(writer, { ...base, id: 1, reqorder: 1 });
    assert.equal(service.read(context).total, 1);
    writer.exec('BEGIN IMMEDIATE'); insert(writer, { ...base, id: 2, reqorder: 2 });
    assert.equal(service.read(context).total, 1);
    writer.exec('COMMIT'); assert.equal(service.read(context).total, 2);
    assert.throws(() => service.read({ ...context, database: '../request.db' }), { code: 'QUEUE_UNAVAILABLE' });
    writer.close(); writer = undefined;
    await writeFile(join(directory, 'bad.db'), 'not sqlite');
    assert.throws(() => service.read({ ...context, database: 'bad.db' }), { code: 'QUEUE_UNAVAILABLE' });
    const noTable = new DatabaseSync(join(directory, 'empty.db')); noTable.close();
    assert.throws(() => service.read({ ...context, database: 'empty.db' }), { code: 'QUEUE_UNAVAILABLE' });
    const malformed = new DatabaseSync(path);
    malformed.prepare('UPDATE requesttable SET secret=? WHERE id=1').run(Buffer.from('1'));
    malformed.close();
    assert.throws(() => service.read(context), { code: 'QUEUE_UNAVAILABLE' });
  } finally { writer?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('并发 WAL writer 下统计/记录来自同一事务；独占锁超时明确失败', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'yukari-queue-concurrent-'));
  const path = join(directory, 'request.db');
  let worker: Worker | undefined;
  try {
    const writer = new DatabaseSync(path); writer.exec('PRAGMA journal_mode=WAL;'); writer.exec(schema); writer.close();
    worker = new Worker(`
      const {DatabaseSync}=require('node:sqlite'); const {parentPort,workerData}=require('node:worker_threads');
      const db=new DatabaseSync(workerData.path,{timeout:1000}); parentPort.postMessage('ready');
      for(let i=1;i<=50;i++) {
        db.exec("BEGIN IMMEDIATE; DELETE FROM requesttable;");
        for(let j=0;j<i%7+1;j++) db.prepare("INSERT INTO requesttable(id,songfile,singer,kind,reqorder,nowplaying,secret,duration) VALUES(?, 'song', 'singer', '動画', ?, '未再生',0,10)").run(j+1,j+1);
        db.exec('COMMIT'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1);
      }
      db.close(); parentPort.postMessage('done');`, { eval: true, workerData: { path } });
    const done = new Promise<void>((resolve, reject) => { worker!.on('message', (value) => { if (value === 'done') resolve(); }); worker!.on('error', reject); });
    await new Promise<void>((resolve, reject) => { worker!.once('message', () => resolve()); worker!.once('error', reject); });
    const service = new QueueService(new QueueRepository(directory));
    for (let i = 0; i < 300; i++) {
      const data = service.read(context);
      assert.equal(data.total, data.items.length);
      assert.equal(data.remaining_count, data.total);
      assert.equal(data.remaining_seconds, data.total * 10);
    }
    await done;
    await worker.terminate(); worker = undefined;
    const locked = new DatabaseSync(join(directory, 'locked.db'));
    try {
      locked.exec(schema); locked.exec('BEGIN EXCLUSIVE');
      const start = Date.now();
      assert.throws(() => service.read({ ...context, database: 'locked.db' }), { code: 'QUEUE_UNAVAILABLE' });
      assert.ok(Date.now() - start < 1500);
      locked.exec('ROLLBACK');
    } finally { locked.close(); }
  } finally { await worker?.terminate(); await rm(directory, { recursive: true, force: true }); }
});

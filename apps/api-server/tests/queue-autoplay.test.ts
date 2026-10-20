import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QueueAutoplayOwner, QueueAutoplayRepository } from '../src/queue-autoplay.js';

const schema = `CREATE TABLE requesttable(id INTEGER PRIMARY KEY,songfile TEXT,fullpath TEXT,kind TEXT,reqorder INTEGER,nowplaying TEXT,playtimes INTEGER,loop INTEGER,pause INTEGER,track INTEGER,keychange INTEGER,audiodelay INTEGER,volume INTEGER);
CREATE TABLE request_submission(key_hash TEXT PRIMARY KEY,input_hash TEXT,owner_id TEXT,request_id INTEGER,operation TEXT,created_at INTEGER,result_json TEXT);
INSERT INTO requesttable VALUES(2,'second','D:\\media\\second.mp4','動画',2,'未再生',0,0,0,0,0,0,0);
INSERT INTO requesttable VALUES(1,'first','D:\\media\\first.mp4','動画',1,'未再生',0,0,0,0,0,0,0);`;
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'yukari-autoplay-'));
  const db=new DatabaseSync(join(root,'request.db'));
  db.exec(schema);db.close();
  return {root,repo:new QueueAutoplayRepository(root),dbPath:join(root,'request.db'),close(){rmSync(root,{recursive:true,force:true})}};
}

test('sequential claim uses reqorder ASC and only real playback/EOF advance existing status markers',()=>{
  const f=fixture();
  try {
    const first=f.repo.claimNext('request.db',1)!;
    assert.equal(first.id,1);assert.equal(first.nowplaying,'再生開始待ち');
    assert.throws(()=>f.repo.markCompleted('request.db',1),{code:'AUTOPLAY_STATE_CONFLICT'});
    const db=new DatabaseSync(f.dbPath);assert.equal(db.prepare('SELECT nowplaying FROM requesttable WHERE id=1').get()?.nowplaying,'再生開始待ち');db.close();
    assert.equal(f.repo.markPlaying('request.db',1),true);
    assert.equal(f.repo.markPlaying('request.db',1),false);
    assert.equal(f.repo.read('request.db',1)?.playtimes,1);
    assert.equal(f.repo.markCompleted('request.db',1),true);
    assert.equal(f.repo.markCompleted('request.db',1),false);
    const next=f.repo.claimNext('request.db',1)!;assert.equal(next.id,2);
  } finally { f.close(); }
});

test('unsupported Legacy play modes and item options fail closed without changing queue state',()=>{
  const f=fixture();
  try {
    assert.throws(()=>f.repo.claimNext('request.db',2),{code:'AUTOPLAY_MODE_UNSUPPORTED'});
    const db=new DatabaseSync(f.dbPath);db.prepare('UPDATE requesttable SET track=2 WHERE id=1').run();db.close();
    assert.throws(()=>f.repo.claimNext('request.db',1),{code:'AUTOPLAY_OPTIONS_UNSUPPORTED'});
    const check=new DatabaseSync(f.dbPath);assert.equal(check.prepare('SELECT nowplaying FROM requesttable WHERE id=1').get()?.nowplaying,'未再生');check.close();
  } finally { f.close(); }
});

test('pause items stop autoplay without being claimed or rewritten',()=>{
  const f=fixture();
  try {
    const db=new DatabaseSync(f.dbPath);db.prepare("UPDATE requesttable SET kind='小休止' WHERE id=1").run();db.close();
    assert.throws(()=>f.repo.claimNext('request.db',1),{code:'AUTOPLAY_ITEM_UNSUPPORTED'});
    const check=new DatabaseSync(f.dbPath);assert.deepEqual({ ...check.prepare('SELECT kind,nowplaying,playtimes FROM requesttable WHERE id=1').get() as object },{kind:'小休止',nowplaying:'未再生',playtimes:0});check.close();
  } finally { f.close(); }
});

test('empty queue returns no task and concurrent claims never mark two rows active',()=>{
  const f=fixture();
  try {
    assert.equal(f.repo.claimNext('request.db',1)?.id,1);
    const [a,b]=[f.repo.claimNext('request.db',1),f.repo.claimNext('request.db',1)];
    assert.deepEqual([a?.id,b?.id],[1,1]);
    const db=new DatabaseSync(f.dbPath);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM requesttable WHERE nowplaying IN ('再生開始待ち','再生中')").get()?.n,1);
    db.exec("UPDATE requesttable SET nowplaying='停止中' WHERE id=1; UPDATE requesttable SET nowplaying='停止中' WHERE id=2;");db.close();
    assert.equal(f.repo.claimNext('request.db',1),null);
  } finally { f.close(); }
});

test('failed state transaction rolls back and never marks the item completed',()=>{
  const f=fixture();
  try {
    f.repo.claimNext('request.db',1);
    const db=new DatabaseSync(f.dbPath);db.exec("CREATE TRIGGER fail_play BEFORE UPDATE OF nowplaying ON requesttable WHEN NEW.nowplaying='再生中' BEGIN SELECT RAISE(ABORT,'injected'); END;");db.close();
    assert.throws(()=>f.repo.markPlaying('request.db',1),{code:'AUTOPLAY_QUEUE_UNAVAILABLE'});
    const check=new DatabaseSync(f.dbPath);const row=check.prepare('SELECT nowplaying,playtimes FROM requesttable WHERE id=1').get();check.close();
    assert.deepEqual({ ...row },{nowplaying:'再生開始待ち',playtimes:0});
  } finally { f.close(); }
});

test('owner fence is explicit and release only removes its dedicated file',()=>{
  const f=fixture();
  try {
    const owner=new QueueAutoplayOwner(f.root);
    assert.equal(owner.active(),false);owner.acquire();assert.equal(owner.active(),true);
    owner.release();assert.equal(owner.active(),false);
  } finally { f.close(); }
});

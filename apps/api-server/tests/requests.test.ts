import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { RequestRepository, RequestService, SubmissionReceipts, requestInputSchema, type RequestContext } from '../src/requests.js';
import { automaticOrder, type OrderRow } from '../src/request-order.js';

const schema = `CREATE TABLE requesttable(id INTEGER PRIMARY KEY AUTOINCREMENT,songfile TEXT,singer TEXT,comment TEXT,kind TEXT,fullpath TEXT,nowplaying TEXT,status TEXT,clientip TEXT,clientua TEXT,playtimes INTEGER,secret,loop,keychange,track,pause,audiodelay,duration,volume,reqorder INTEGER DEFAULT 0,song_name TEXT,lister_artist TEXT,lister_work TEXT,lister_op_ed TEXT,lister_comment TEXT);
CREATE TABLE mypage_user(userid TEXT PRIMARY KEY,displayname TEXT DEFAULT '',created_at INTEGER NOT NULL);
CREATE TABLE mypage_history(id INTEGER PRIMARY KEY AUTOINCREMENT,userid TEXT NOT NULL,fullpath TEXT NOT NULL,songfile TEXT NOT NULL,kind TEXT NOT NULL DEFAULT '',requested_at INTEGER NOT NULL);
CREATE TABLE request_submission(key_hash TEXT PRIMARY KEY,input_hash TEXT NOT NULL,owner_id TEXT NOT NULL,request_id INTEGER NOT NULL,operation TEXT NOT NULL,committed_at INTEGER NOT NULL,result_json TEXT NOT NULL);`;
const context: RequestContext = { database:'request.db', ip:'127.0.0.9', ua:'fixture-UA', userid:'11111111-1111-4111-8111-111111111111', automove:false, reset:false, midjoin:false, history:true,
  metadata:{song_name:'fixture title',lister_artist:'artist',lister_work:'work',lister_op_ed:'OP',lister_comment:'note'},nonameusername:'名無しさん',displayname:'Singer Display' };
const input = requestInputSchema.parse({filename:'【ニコカラ】Fixture Song.mp4', singer:'Singer', freesinger:'Guest', comment:'fixture', kind:'動画', fullpath:'C:\\synthetic\\song.mp4', secret:1, keychange:'-2.5', audiodelay:'9901', volume:'-101', duration:'20'});

function phpExecOracle(value:unknown){
  return JSON.parse(execFileSync('docker',['compose','-f',process.env.E2E_COMPOSE_FILE||'docker/compose.yaml','exec','-T','web','php','/workspace/apps/api-server/tests/php/exec-oracle.php'],{cwd:resolve('../..'),input:JSON.stringify(value),encoding:'utf8',timeout:15000}));
}

async function fixture(run:(root:string,db:DatabaseSync)=>Promise<void>|void) {
  const root=await mkdtemp(join(tmpdir(),'yukari-request-'));
  const db=new DatabaseSync(join(root,'request.db'));
  try { db.exec('PRAGMA journal_mode=WAL;'); db.exec(schema); await run(root,db); }
  finally { db.close(); await rm(root,{recursive:true,force:true}); }
}

test('native create persists legacy defaults, history, metadata, order and a durable replay result exactly once', async()=>fixture(async(root,db)=>{
  const receipts=new SubmissionReceipts('x'.repeat(64)), receipt=receipts.issue(), service=new RequestService(new RequestRepository(root),receipts);
  let notices=0;
  const first=await service.submit(context,input,receipt,async()=>{notices++;});
  const replay=await service.submit(context,input,receipt,async()=>{notices++;});
  assert.equal(first.result.id,replay.result.id); assert.equal(replay.replayed,true); assert.equal(notices,1);
  const row=db.prepare('SELECT * FROM requesttable').get() as Record<string,unknown>;
  assert.equal(row.songfile,'Fixture Song'); assert.equal(row.singer,'Guest'); assert.equal(row.kind,'動画'); assert.equal(row.nowplaying,'未再生');
  assert.equal(row.status,'OK'); assert.equal(row.clientip,context.ip); assert.equal(row.clientua,context.ua); assert.equal(row.reqorder,1);
  assert.equal(row.secret,1); assert.equal(row.keychange,-2.5); assert.equal(row.audiodelay,0); assert.equal(row.volume,0);
  assert.equal(row.song_name,'fixture title'); assert.equal(db.prepare('SELECT COUNT(*) n FROM mypage_history').get()!.n,1);
  assert.equal(db.prepare('SELECT displayname FROM mypage_user WHERE userid=?').get(context.userid)!.displayname,'Singer Display');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM request_submission').get()!.n,1);
  assert.equal(service.lookup('request.db',receipt,context.userid)?.id,first.result.id);
  assert.throws(()=>service.lookup('request.db',receipt,'22222222-2222-4222-8222-222222222222'),{code:'SUBMISSION_NOT_FOUND'});
  await assert.rejects(()=>service.submit(context,{...input,comment:'different'},receipt,async()=>{}),{code:'SUBMISSION_CONFLICT'});
}));

test('replacement preserves identity/order/status/play count and a failed required history write rolls back queue plus receipt', async()=>fixture(async(root,db)=>{
  db.prepare(`INSERT INTO requesttable(id,songfile,singer,comment,kind,fullpath,nowplaying,status,clientip,clientua,playtimes,reqorder) VALUES(7,'old','Old singer','','動画','old-path','再生中','playing','old-ip','old-UA',4,3)`).run();
  const receipts=new SubmissionReceipts('y'.repeat(64)), service=new RequestService(new RequestRepository(root),receipts);
  const replaceInput=requestInputSchema.parse({...input,selectid:'7'}), result=await service.submit(context,replaceInput,receipts.issue(),async()=>{});
  assert.equal(result.result.id,7); const row=db.prepare('SELECT * FROM requesttable WHERE id=7').get() as Record<string,unknown>;
  assert.equal(row.reqorder,3); assert.equal(row.clientip,'old-ip'); assert.equal(row.clientua,'old-UA'); assert.equal(row.status,'playing'); assert.equal(row.playtimes,4); assert.equal(row.nowplaying,'変更中');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mypage_history').get()!.n,0);
  const failing=receipts.issue(); db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON mypage_history BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
  await assert.rejects(()=>service.submit(context,input,failing,async()=>{}),{code:'SUBMISSION_UNAVAILABLE'});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM requesttable').get()!.n,1); assert.equal(db.prepare('SELECT COUNT(*) n FROM request_submission').get()!.n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mypage_history').get()!.n,0);
}));

test('unknown notification outcome is durably queryable and replay never repeats request or notification',async()=>fixture(async(root,db)=>{
  const receipts=new SubmissionReceipts('z'.repeat(64)),receipt=receipts.issue(),service=new RequestService(new RequestRepository(root),receipts);let calls=0;
  const first=await service.submit({...context,history:false},input,receipt,async()=>{calls++;throw Error('offline');});
  const retry=await service.submit({...context,history:false},input,receipt,async()=>{calls++;});
  assert.equal(first.result.notification,'unconfirmed'); assert.equal(retry.result.id,first.result.id); assert.equal(retry.result.notification,'unconfirmed');
  assert.equal(calls,1); assert.equal(db.prepare('SELECT COUNT(*) n FROM requesttable').get()!.n,1);
}));

test('PHP MoveItem oracle matches Node automatic reqorder placement across rounds, breaks, played rows and midjoin',()=>{
  const cases=[
    {rows:[],fresh:{id:10,reqorder:1,singer:'New',kind:'動画',nowplaying:'未再生'},reset:false,midjoin:false},
    {rows:[['A',1],['B',2],['A',3],['B',4]].map(([s,i])=>({id:Number(i),reqorder:Number(i),singer:String(s),kind:'動画',nowplaying:'未再生'})),fresh:{id:10,reqorder:5,singer:'C',kind:'動画',nowplaying:'未再生'},reset:false,midjoin:false},
    {rows:[['A',1,'再生済み'],['B',2,'未再生'],['A',3,'未再生'],['C',4,'未再生']].map(([s,i,p])=>({id:Number(i),reqorder:Number(i),singer:String(s),kind:'動画',nowplaying:String(p)})),fresh:{id:10,reqorder:5,singer:'D',kind:'動画',nowplaying:'未再生'},reset:false,midjoin:true},
    {rows:[{id:1,reqorder:1,singer:'A',kind:'動画',nowplaying:'再生済み'},{id:2,reqorder:2,singer:'休止',kind:'小休止',nowplaying:'未再生'},{id:3,reqorder:3,singer:'B',kind:'動画',nowplaying:'未再生'}],fresh:{id:10,reqorder:4,singer:'A',kind:'動画',nowplaying:'未再生'},reset:true,midjoin:false},
  ];
  const output=execFileSync('docker',['compose','-f',process.env.E2E_COMPOSE_FILE||'docker/compose.yaml','exec','-T','web','php','/workspace/apps/api-server/tests/php/request-order-oracle.php'],{cwd:resolve('../..'),input:JSON.stringify(cases),encoding:'utf8',timeout:15000});
  const oracle=JSON.parse(output) as Array<Array<{id:number;reqorder:number}>>;
  cases.forEach((c,index)=>{
    const actual=automaticOrder([...c.rows,c.fresh] as OrderRow[],c.fresh.id,c.reset,c.midjoin).sort((a,b)=>a.reqorder-b.reqorder||a.id-b.id).map(({id,reqorder})=>({id,reqorder}));
    assert.deepEqual(actual,oracle[index],`case ${index}`);
  });
});

test('actual Legacy exec.php create matches Node transaction fields, identity, defaults and mypage history on isolated DBs',async()=>fixture(async(root,db)=>{
  const uid=context.userid,display='Persistent singer';
  const php=phpExecOracle({input,ip:context.ip,ua:context.ua,userid:uid,displayname:display,history:true});
  assert.equal(php.failed,false);assert.equal(php.id,1);
  const nodeContext={...context,displayname:display,metadata:null};
  const repository=new RequestRepository(root),receipt=new SubmissionReceipts('p'.repeat(64)),service=new RequestService(repository,receipt);
  const native=await service.submit(nodeContext,input,receipt.issue(),async()=>{});
  const phpRow=php.rows[0] as Record<string,unknown>;
  const nodeRow=db.prepare('SELECT * FROM requesttable WHERE id=?').get(native.result.id) as Record<string,unknown>;
  const fields=['id','songfile','singer','comment','kind','reqorder','fullpath','nowplaying','status','clientip','clientua','playtimes','secret','loop','keychange','track','pause','audiodelay','duration','volume','song_name','lister_artist','lister_work','lister_op_ed','lister_comment'];
  assert.deepEqual(Object.fromEntries(fields.map(key=>[key,nodeRow[key]])),Object.fromEntries(fields.map(key=>[key,phpRow[key]])));
  assert.equal(php.history.length,1);assert.equal(php.history[0].userid,uid);assert.equal(db.prepare('SELECT COUNT(*) n FROM mypage_history').get()!.n,1);
  assert.equal(php.users[0].displayname,display);assert.equal(db.prepare('SELECT displayname FROM mypage_user WHERE userid=?').get(uid)!.displayname,display);
}));

test('Legacy post-commit history fault leaves a partial reservation; Node keeps core and history atomic',async()=>fixture(async(root,db)=>{
  const php=phpExecOracle({input,ip:context.ip,ua:context.ua,userid:context.userid,displayname:'',history:true,fail:'history'});
  assert.equal(php.failed,true);assert.equal(php.rows.length,1);assert.equal(php.history.length,0);
  db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON mypage_history BEGIN SELECT RAISE(ABORT,'fixture fault'); END");
  const receipts=new SubmissionReceipts('q'.repeat(64)),service=new RequestService(new RequestRepository(root),receipts);
  await assert.rejects(()=>service.submit(context,input,receipts.issue(),async()=>{}),{code:'SUBMISSION_UNAVAILABLE'});
  assert.equal(db.prepare('SELECT COUNT(*) n FROM requesttable').get()!.n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM request_submission').get()!.n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM mypage_history').get()!.n,0);
}));

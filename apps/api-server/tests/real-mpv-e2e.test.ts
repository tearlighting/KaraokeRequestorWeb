import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';

test('real Windows mpv maps POSIX queue paths and advances two isolated requests only after EOF', {skip:process.env.RUN_REAL_MPV_E2E!=='1'}, async()=>{
  const media=process.env.REAL_MPV_TEST_VIDEO||'D:\\project\\yukari\\test-media\\agent-test.mp4';
  const secondMedia=process.env.REAL_MPV_TEST_VIDEO_SECOND||media;
  const mpv=process.env.MPV_PATH||'C:\\Program Files\\MPV Player\\mpv.exe';
  assert.ok(existsSync(media),'Set REAL_MPV_TEST_VIDEO to an existing external test video');assert.ok(existsSync(secondMedia),'Set REAL_MPV_TEST_VIDEO_SECOND to an existing external second test video');assert.ok(existsSync(mpv),'Set MPV_PATH to the installed mpv.exe');
  const root=join(tmpdir(),`yukari-real-mpv-${randomUUID()}`);mkdirSync(root,{recursive:true});
  const dbPath=join(root,'request.db');const db=new DatabaseSync(dbPath);
  db.exec('CREATE TABLE requesttable(id INTEGER PRIMARY KEY,songfile TEXT,fullpath TEXT,kind TEXT,reqorder INTEGER,nowplaying TEXT,playtimes INTEGER,loop INTEGER,pause INTEGER,track INTEGER,keychange INTEGER,audiodelay INTEGER,volume INTEGER)');
  const mediaRoot=join(root,'media');mkdirSync(mediaRoot);copyFileSync(media,join(mediaRoot,'first.mp4'));copyFileSync(secondMedia,join(mediaRoot,'second.mp4'));
  db.prepare('INSERT INTO requesttable VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(700001,'Phase 11 isolated first fixture','/synthetic-media/first.mp4','\u52d5\u753b',1,'\u672a\u518d\u751f',0,0,0,0,0,0,0);
  db.prepare('INSERT INTO requesttable VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(700002,'Phase 11 isolated second fixture','/synthetic-media/second.mp4','\u52d5\u753b',2,'\u672a\u518d\u751f',0,0,0,0,0,0,0);
  db.prepare('INSERT INTO requesttable VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(700003,'Phase 11 isolated skip fixture','/synthetic-media/first.mp4','\u52d5\u753b',3,'\u672a\u518d\u751f',0,0,0,0,0,0,0);
  db.prepare('INSERT INTO requesttable VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(700004,'Phase 11 isolated stop fixture','/synthetic-media/second.mp4','\u52d5\u753b',4,'\u672a\u518d\u751f',0,0,0,0,0,0,0);
  db.exec(readFileSync(new URL('../migrations/002-playback-task.sql',import.meta.url),'utf8'));db.close();
  const settingsPath=join(root,'config.ini');writeFileSync(settingsPath,'playmode=1\nstartvolume=50\nrequestlistactivereload=1\n');
  const legacy=createServer((req,res)=>{const op=new URL(req.url||'/','http://legacy').searchParams.get('operation');const data=op==='admin-auth'?{proof:'fixture-proof-'.padEnd(64,'x')}:op==='queue-notify-service'?{notified:true}:{};res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,data}));});
  await new Promise<void>(r=>legacy.listen(0,'127.0.0.1',r));const la=legacy.address();assert.ok(la&&typeof la!=='string');
  const token=randomBytes(48).toString('hex');const app=createApp({legacyUrl:`http://127.0.0.1:${la.port}`,bridgeToken:randomBytes(48).toString('hex'),playerAgentToken:token,playerStatePath:join(root,'agent-state.json'),settingsPath,queueRoot:root,queueDatabase:'request.db',nodeAutoplay:true,userOrigins:['http://user'],adminOrigins:['http://admin']});
  let agent:ChildProcess|undefined;let agentErr='';let cookie='';const adminHeaders=()=>({'x-yukari-client':'1','content-type':'application/json',cookie});
  const waitFor=async<T>(read:()=>T|undefined,timeout=25000):Promise<T>=>{const until=Date.now()+timeout;while(Date.now()<until){try{const value=read();if(value!==undefined)return value;}catch{/* Wait while isolated process/files initialize. */}await new Promise(r=>setTimeout(r,200));}throw new Error('Timed out waiting for real mpv/API state: '+agentErr.slice(0,800));};
  try{
    await app.listen({host:'127.0.0.1',port:0});
    const login=await app.inject({method:'POST',url:'/api/v1/admin/session',headers:{'x-yukari-client':'1','content-type':'application/json'},payload:{username:'admin',password:'fixture-only'}});assert.equal(login.statusCode,200);cookie=String(login.headers['set-cookie']).split(';')[0];
    const apiAddress=app.server.address();assert.ok(apiAddress&&typeof apiAddress!=='string');
    const id=`e2e_${randomUUID().replaceAll('-','').slice(0,24)}`;const lockDir=join(root,'agent-lock');
    agent=spawn(process.execPath,['../../agents/player-agent/dist/main.js'],{cwd:process.cwd(),stdio:['ignore','ignore','pipe'],env:{...process.env,YUKARI_API_URL:`http://127.0.0.1:${apiAddress.port}`,YUKARI_PLAYER_AGENT_TOKEN:token,YUKARI_PLAYER_AGENT_ID:id,YUKARI_PLAYER_AGENT_LOCK_DIR:lockDir,MPV_PATH:mpv,PLAYER_MEDIA_ROOT:mediaRoot,PLAYER_TEST_VIDEO:'first.mp4',PLAYER_PATH_MAPPINGS:JSON.stringify([{source:'/synthetic-media',target:mediaRoot}])}});
    agent.stderr?.on('data',chunk=>{if(agentErr.length<1000)agentErr+=String(chunk);});agent.once('error',error=>{agentErr=String(error);});
    try{await waitFor(()=>{const state=JSON.parse(readFileSync(join(root,'agent-state.json'),'utf8')) as {agent?:{seenAt:number}};return state.agent?.seenAt?true:undefined;});}catch{throw new Error(`Player Agent did not heartbeat: ${agentErr.slice(0,500)}`);}
    const started=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/autoplay',headers:adminHeaders(),payload:{action:'start'}});assert.equal(started.statusCode,200,started.body);
    const task=await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return c.prepare("SELECT task_id FROM playback_task WHERE state IN ('claimed','playing')").get() as {task_id:string}|undefined;}finally{c.close();}});
    const activeView=await app.inject({method:'GET',url:'/api/v1/admin/player-agent',headers:adminHeaders()});assert.equal(activeView.statusCode,200);assert.equal(activeView.json().data.task.requestId,700001);assert.equal(activeView.json().data.autoplayEnabled,true);
    await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return (c.prepare('SELECT state FROM playback_task WHERE task_id=?').get(task.task_id) as {state:string}).state==='playing'?true:undefined;}finally{c.close();}});
    const paused=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/autoplay',headers:adminHeaders(),payload:{action:'pause'}});assert.equal(paused.statusCode,200,paused.body);
    await waitFor(()=>{const s=JSON.parse(readFileSync(join(root,'agent-state.json'),'utf8')) as {agent?:{playback:string}};return s.agent?.playback==='paused'?true:undefined;});
    const resumed=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/autoplay',headers:adminHeaders(),payload:{action:'resume'}});assert.equal(resumed.statusCode,200,resumed.body);
    await waitFor(()=>{const s=JSON.parse(readFileSync(join(root,'agent-state.json'),'utf8')) as {agent?:{playback:string}};return s.agent?.playback==='playing'?true:undefined;});
    await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return (c.prepare('SELECT state FROM playback_task WHERE task_id=?').get(task.task_id) as {state:string}).state==='completed'?true:undefined;}finally{c.close();}},35000);
    const secondTask=await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return c.prepare("SELECT task_id FROM playback_task WHERE request_id=700002 AND state IN ('claimed','playing','completed')").get() as {task_id:string}|undefined;}finally{c.close();}});await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return (c.prepare('SELECT state FROM playback_task WHERE task_id=?').get(secondTask.task_id) as {state:string}).state==='completed'?true:undefined;}finally{c.close();}},35000);
    const skippedTask=await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return c.prepare("SELECT task_id FROM playback_task WHERE request_id=700003 AND state IN ('claimed','playing')").get() as {task_id:string}|undefined;}finally{c.close();}});
    await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return (c.prepare('SELECT state FROM playback_task WHERE task_id=?').get(skippedTask.task_id) as {state:string}).state==='playing'?true:undefined;}finally{c.close();}});
    const skip=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/autoplay',headers:adminHeaders(),payload:{action:'skip'}});assert.equal(skip.statusCode,200,skip.body);
    await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return (c.prepare('SELECT state FROM playback_task WHERE task_id=?').get(skippedTask.task_id) as {state:string}).state==='failed'?true:undefined;}finally{c.close();}});
    const stoppedTask=await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return c.prepare("SELECT task_id FROM playback_task WHERE request_id=700004 AND state IN ('claimed','playing')").get() as {task_id:string}|undefined;}finally{c.close();}});
    await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return (c.prepare('SELECT state FROM playback_task WHERE task_id=?').get(stoppedTask.task_id) as {state:string}).state==='playing'?true:undefined;}finally{c.close();}});
    const stop=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/autoplay',headers:adminHeaders(),payload:{action:'stop'}});assert.equal(stop.statusCode,200,stop.body);
    await waitFor(()=>{const c=new DatabaseSync(dbPath);try{return (c.prepare('SELECT state FROM playback_task WHERE task_id=?').get(stoppedTask.task_id) as {state:string}).state==='failed'?true:undefined;}finally{c.close();}});
    const history=await app.inject({method:'GET',url:'/api/v1/admin/playback/history',headers:adminHeaders()});assert.equal(history.statusCode,200);assert.equal(history.json().data.tasks.length,4);assert.equal(JSON.stringify(history.json()).includes('synthetic-media'),false);
    const final=new DatabaseSync(dbPath);try{for(const requestId of [700001,700002]){const row=final.prepare('SELECT nowplaying,playtimes FROM requesttable WHERE id=?').get(requestId) as {nowplaying:string;playtimes:number};assert.equal(row.nowplaying,'\u518d\u751f\u6e08');assert.equal(row.playtimes,1);}for(const requestId of [700003,700004]){const row=final.prepare('SELECT nowplaying,playtimes FROM requesttable WHERE id=?').get(requestId) as {nowplaying:string;playtimes:number};assert.equal(row.nowplaying,'\u505c\u6b62\u4e2d');assert.equal(row.playtimes,1);}for(const taskId of [task.task_id,secondTask.task_id])assert.equal((final.prepare("SELECT COUNT(*) n FROM playback_event WHERE task_id=? AND event_type='eof'").get(taskId) as {n:number}).n,1);assert.equal((final.prepare("SELECT COUNT(*) n FROM playback_task WHERE state IN ('claimed','playing')").get() as {n:number}).n,0);}finally{final.close();}
    const stoppedView=await app.inject({method:'GET',url:'/api/v1/admin/player-agent',headers:adminHeaders()});assert.equal(stoppedView.json().data.autoplayEnabled,false);assert.equal(stoppedView.json().data.nodeOwnsQueue,false);
    assert.equal(agentErr,'');
  }finally{
    if(agent&&agent.exitCode===null){agent.kill('SIGINT');await new Promise<void>(r=>{const t=setTimeout(r,5000);agent!.once('exit',()=>{clearTimeout(t);r();});});}
    await app.close();await new Promise<void>(r=>legacy.close(()=>r()));rmSync(root,{recursive:true,force:true});
  }
});

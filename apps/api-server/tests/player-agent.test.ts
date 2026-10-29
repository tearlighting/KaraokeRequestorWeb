import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
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

test('mpv telemetry is private, polling does not consume commands, and controls are task-bound and acknowledged',()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-mpv-state-'));
  try{
    let now=1000;const store=new PlayerTaskStore(join(root,'state.json'),()=>now);
    store.report('agent_one',{playback:'idle',testReady:true});
    const task=store.createTest();store.next('agent_one',true);
    const mpv={connected:true,state:'playing' as const,file:'clip.mkv',duration:30,position:4,volume:80,muted:false,audioTracks:[{id:2,title:'Main',selected:true},{id:8,title:'Karaoke',selected:false}],selectedAudioTrackId:2,subtitleTracks:[],};
    store.report('agent_one',{taskId:task.id,state:'playing',playback:'playing',testReady:true,file:'clip.mkv',mpv});
    const status=store.mpvStatus();assert.equal(status.mpv?.file,'clip.mkv');assert.equal(status.mpv?.selectedAudioTrackId,2);assert.equal(status.observedAt,now,'MPV confirmation has its own timestamp');
    const command=store.requestMpvControl('agent_one',task.id,{action:'audio-track',trackId:8});
    assert.equal(store.next('agent_one',true).task?.id,task.id);
    const delivered=store.pendingMpvControl('agent_one');assert.equal(delivered?.id,command.id);
    assert.throws(()=>store.requestMpvControl('agent_two',task.id,{action:'seek',position:3}),{code:'PLAYER_AGENT_OFFLINE'});
    assert.throws(()=>store.requestMpvControl('agent_one',task.id,{action:'seek',position:3}),{code:'MPV_CONTROL_PENDING'});
    store.report('agent_one',{playback:'playing',testReady:true,mpv:{...mpv,position:8}});
    assert.equal(store.pendingMpvControl('agent_one')?.id,command.id,'status heartbeat must not consume a pending command');
    store.acknowledgeMpvControl('agent_one',{id:command.id,ok:true});
    assert.equal(store.pendingMpvControl('agent_one'),null);assert.equal(store.mpvStatus().controlAck?.ok,true);
    assert.throws(()=>store.acknowledgeMpvControl('agent_one',{id:command.id,ok:true}),{code:'STALE_MPV_CONTROL'});
    const expiring=store.requestMpvControl('agent_one',task.id,{action:'seek',position:10});now+=10001;store.next('agent_one',true);
    assert.equal(store.pendingMpvControl('agent_one'),null);assert.equal(store.mpvStatus().controlAck?.id,expiring.id);assert.equal(store.mpvStatus().controlAck?.ok,false);
    now+=16000;assert.equal(store.mpvStatus().mpv,undefined,'stale Agent telemetry is not presented as live');assert.ok((store.mpvStatus().observedAt||0)<now-5000,'an old idle report cannot authorize recovery');
  }finally{rmSync(root,{recursive:true,force:true});}
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
    assert.equal((await app.inject({ method: 'POST', url: '/api/v1/admin/player-agent/launcher', headers, payload: { action: 'start' } })).statusCode, 401);
    const startLauncher=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/launcher',headers:adminHeaders,payload:{action:'start'}});
    assert.equal(startLauncher.statusCode,200);
    const launcherHeaders={...headers,authorization:`Bearer ${'a'.repeat(48)}`};
    const launcherPoll=await app.inject({method:'POST',url:'/api/v1/agent/launcher/poll',headers:launcherHeaders,payload:{launcherId:'launcher_one',state:'starting'}});
    assert.equal(launcherPoll.statusCode,200);assert.equal(launcherPoll.json().data.command.action,'start');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/agent/launcher/poll',headers,payload:{launcherId:'launcher_one',state:'running'}})).statusCode,401);
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
    assert.equal(publicStatus.statusCode, 200); assert.deepEqual(Object.keys(publicStatus.json().data).sort(), ['active','connected','mpv','playback','taskState']); assert.equal(publicStatus.json().data.taskState,null);
    const control = await app.inject({ method: 'POST', url: '/api/v1/admin/player-agent/control', headers: adminHeaders, payload: { action: 'pause' } });
    assert.equal(control.statusCode, 200);
    const next = await app.inject({ method: 'POST', url: '/api/v1/agent/next', headers: launcherHeaders, payload: { agentId: 'one', testReady: true } });
    assert.equal(next.json().data.command, 'pause');
    const mpv={connected:true,state:'paused',file:'clip.mkv',duration:60,position:12,volume:74,muted:false,keySemitones:0,keyChangeAvailable:true,audioTracks:[{id:2,title:'Vocal',selected:true},{id:7,title:'Instrumental',selected:false}],selectedAudioTrackId:2,subtitleTracks:[{id:4,title:'Lyrics',selected:true}],selectedSubtitleTrackId:4};
    const rawPath=await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'one',playback:'paused',mpv:{...mpv,path:'C:\\private\\clip.mkv'}}});
    assert.equal(rawPath.statusCode,400,'API rejects filesystem paths from Agent telemetry');
    const playerReport=await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'one',taskId,state:'playing',playback:'paused',testReady:true,mpv}});
    assert.equal(playerReport.statusCode,200);
    const live=await app.inject({method:'GET',url:'/api/v1/admin/player-agent/mpv',headers:adminHeaders});
    assert.equal(live.statusCode,200);assert.equal(live.json().data.mpv.position,12);assert.equal(live.json().data.mpv.file,'clip.mkv');
    const publicLive=await app.inject({method:'GET',url:'/api/v1/playback/agent',headers:{...headers,cookie:userCookie}});
    assert.deepEqual(Object.keys(publicLive.json().data).sort(),['active','connected','mpv','playback','taskState']);
    assert.equal(publicLive.json().data.mpv.file,undefined,'public telemetry never contains media names or paths');
    assert.equal(publicLive.json().data.mpv.path,undefined,'public telemetry never contains media paths');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/playback/mpv-control',headers:{...headers,cookie:userCookie},payload:{action:'pause'}})).statusCode,401,'user sessions cannot issue playback controls');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:{...headers,cookie:userCookie},payload:{taskId,action:'seek',position:4}})).statusCode,401,'a user session never gains Admin control rights');
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/player-agent/mpv',headers:{...headers,cookie:userCookie}})).statusCode,401);
    const invalidTrack=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:adminHeaders,payload:{taskId,action:'audio-track',trackId:99}});
    assert.equal(invalidTrack.statusCode,409);
    const seek=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:adminHeaders,payload:{taskId,action:'seek',position:22}});
    assert.equal(seek.statusCode,200);
    const controlAssignment=await app.inject({method:'POST',url:'/api/v1/agent/next',headers:agentHeaders,payload:{agentId:'one',testReady:true}});
    assert.equal(controlAssignment.statusCode,200);assert.equal(controlAssignment.json().data.mpvControl.id,seek.json().data.id);
    const ack=await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'one',playback:'paused',testReady:true,mpv:{...mpv,position:22},controlAck:{id:seek.json().data.id,ok:true}}});
    assert.equal(ack.statusCode,200);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/player-agent/mpv',headers:adminHeaders})).json().data.controlAck.ok,true);
    const volume=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:adminHeaders,payload:{taskId,action:'volume',value:110}});
    assert.equal(volume.statusCode,200,'mpv default volume amplification range is supported');
    const volumeAssignment=await app.inject({method:'POST',url:'/api/v1/agent/next',headers:agentHeaders,payload:{agentId:'one',testReady:true}});
    assert.equal(volumeAssignment.json().data.mpvControl.id,volume.json().data.id);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'one',playback:'paused',testReady:true,mpv,controlAck:{id:volume.json().data.id,ok:true}}})).statusCode,200);
    const key=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:adminHeaders,payload:{taskId,action:'key-change',semitones:1}});
    assert.equal(key.statusCode,200,'Admin can send a bounded semitone control to the active task');
    const keyAssignment=await app.inject({method:'POST',url:'/api/v1/agent/next',headers:agentHeaders,payload:{agentId:'one',testReady:true}});
    assert.equal(keyAssignment.json().data.mpvControl.action,'key-change');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'one',playback:'paused',testReady:true,mpv:{...mpv,keySemitones:1},controlAck:{id:key.json().data.id,ok:true}}})).statusCode,200);
    const invalidKey=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:adminHeaders,payload:{taskId,action:'key-change',semitones:7}});
    assert.equal(invalidKey.statusCode,400,'key controls are limited to the supported range');
    const invalidVolume=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:adminHeaders,payload:{taskId,action:'volume',value:131}});
    assert.equal(invalidVolume.statusCode,400);
    const stale=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/mpv-control',headers:adminHeaders,payload:{taskId:'00000000-0000-4000-8000-000000000000',action:'mute',value:true}});
    assert.equal(stale.statusCode,409);
    const stopLauncher=await app.inject({method:'POST',url:'/api/v1/admin/player-agent/launcher',headers:adminHeaders,payload:{action:'stop'}});
    assert.equal(stopLauncher.statusCode,200);
    const stopPoll=await app.inject({method:'POST',url:'/api/v1/agent/launcher/poll',headers:launcherHeaders,payload:{launcherId:'launcher_one',state:'stopping'}});
    assert.equal(stopPoll.json().data.command.action,'stop');assert.equal(stopPoll.json().data.taskActive,true);
  } finally { await app.close(); await new Promise<void>(resolve => legacy.close(() => resolve())); rmSync(root, { recursive: true, force: true }); }
});

test('user player view is sanitized and limited controls target only active queue playback',async()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-user-player-'));
  const database=join(root,'request.db'),taskId='11111111-1111-4111-8111-111111111111';
  const db=new DatabaseSync(database);
  db.exec('CREATE TABLE requesttable(id INTEGER PRIMARY KEY,nowplaying TEXT); INSERT INTO requesttable VALUES(42,\'再生中\');');
  db.exec(readFileSync(new URL('../migrations/002-playback-task.sql',import.meta.url),'utf8'));
  db.prepare("INSERT INTO playback_task(task_id,request_id,state,agent_id,lease_until,playback_state,created_at,updated_at) VALUES(?,42,'playing','agent_one',9999999999999,'playing',1,1)").run(taskId);
  db.close();
  const legacy=createServer((request,response)=>{const operation=new URL(request.url||'/', 'http://legacy').searchParams.get('operation');const data=operation==='admin-auth'||operation==='user-auth'?{proof:'p'.repeat(64)}:operation==='admin-session'?{config_revision:'a'.repeat(64)}:{};response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({ok:true,data}));});
  await new Promise<void>(resolve=>legacy.listen(0,'127.0.0.1',resolve));const address=legacy.address();assert.ok(address&&typeof address!=='string');
  const app=createApp({legacyUrl:`http://127.0.0.1:${address.port}`,bridgeToken:'b'.repeat(48),playerAgentToken:'a'.repeat(48),playerStatePath:join(root,'state.json'),settingsPath:join(root,'config.ini'),queueRoot:root,queueDatabase:'request.db',userOrigins:['http://user'],adminOrigins:['http://admin']});
  try{
    const headers={'x-yukari-client':'1','content-type':'application/json'};
    const login=await app.inject({method:'POST',url:'/api/v1/user/session',headers,payload:{}});assert.equal(login.statusCode,200);
    const cookie=String(login.headers['set-cookie']).split(', ').find(value=>value.startsWith('YukariUserSession='))?.split(';')[0];assert.ok(cookie);
    const userHeaders={...headers,cookie};
    const agentHeaders={...headers,authorization:`Bearer ${'a'.repeat(48)}`};
    const mpv={connected:true,state:'playing' as const,file:'private-video.mkv',duration:90,position:8,volume:72,muted:false,audioDelay:0,fullscreen:false,keySemitones:0,keyChangeAvailable:true,audioTracks:[{id:2,title:'Vocal',selected:true},{id:7,title:'Instrumental',selected:false}],selectedAudioTrackId:2,subtitleTracks:[],};
    assert.equal((await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'agent_one',playback:'playing',mpv}})).statusCode,200);
    const status=await app.inject({method:'GET',url:'/api/v1/playback/agent',headers:userHeaders});assert.equal(status.statusCode,200);assert.equal(status.json().data.active,true);assert.equal(status.json().data.taskState,'playing');assert.equal(status.json().data.mpv.path,undefined);assert.equal(status.json().data.mpv.file,undefined);assert.equal(JSON.stringify(status.json().data).includes('private-video'),false);
    const seek=await app.inject({method:'POST',url:'/api/v1/user/player/control',headers:userHeaders,payload:{action:'seek',position:18}});assert.equal(seek.statusCode,200);assert.equal(seek.json().data.queued,true);
    const assignment=await app.inject({method:'POST',url:'/api/v1/agent/next',headers:agentHeaders,payload:{agentId:'agent_one'}});assert.equal(assignment.statusCode,200);assert.equal(assignment.json().data.mpvControl.action,'seek');assert.equal(assignment.json().data.mpvControl.taskId,taskId);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'agent_one',playback:'playing',mpv,controlAck:{id:seek.json().data.mpvControl?.id||seek.json().data.id,ok:true}}})).statusCode,200);
    const key=await app.inject({method:'POST',url:'/api/v1/user/player/control',headers:userHeaders,payload:{action:'key-change',semitones:-1}});assert.equal(key.statusCode,200);
    const keyAssignment=await app.inject({method:'POST',url:'/api/v1/agent/next',headers:agentHeaders,payload:{agentId:'agent_one'}});assert.equal(keyAssignment.json().data.mpvControl.action,'key-change');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/agent/report',headers:agentHeaders,payload:{agentId:'agent_one',playback:'playing',mpv,controlAck:{id:key.json().data.id,ok:true}}})).statusCode,200);
    const delay=await app.inject({method:'POST',url:'/api/v1/user/player/control',headers:userHeaders,payload:{action:'audio-delay',value:0.1}});assert.equal(delay.statusCode,200);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/user/player/control',headers:userHeaders,payload:{action:'skip'}})).statusCode,400,'the user endpoint does not accept queue actions');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/user/player/control',headers:userHeaders,payload:{action:'volume',value:131}})).statusCode,400,'volume is bounded');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/user/player/control',headers:userHeaders,payload:{action:'volume',value:50,taskId}})).statusCode,400,'clients cannot choose a task ID');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/user/player/control',headers,payload:{action:'pause'}})).statusCode,401,'a user session is required');
    const adminLogin=await app.inject({method:'POST',url:'/api/v1/admin/session',headers,payload:{username:'admin',password:'not-persisted'}});assert.equal(adminLogin.statusCode,200);const adminCookie=String(adminLogin.headers['set-cookie']).split(', ').find(value=>value.startsWith('YukariAdminSession='))?.split(';')[0];assert.ok(adminCookie);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/user/player/control',headers:{...headers,cookie:adminCookie},payload:{action:'pause'}})).statusCode,401,'Admin identity alone is not accepted as a User session');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/playback/mpv-control',headers:userHeaders,payload:{action:'seek',position:18}})).statusCode,401,'the old Admin-only route remains protected');
    assert.equal((await app.inject({method:'POST',url:'/api/v1/playback/mpv-control',headers:{...headers,origin:'http://admin'},payload:{action:'pause'}})).statusCode,401,'Admin origin without a user session is not authorized');
  }finally{await app.close();await new Promise<void>(resolve=>legacy.close(()=>resolve()));rmSync(root,{recursive:true,force:true});}
});

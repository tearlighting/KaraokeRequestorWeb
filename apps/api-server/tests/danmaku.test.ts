import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DanmakuBuffer, normalizeDanmaku } from '../src/danmaku.js';
import { BoundaryError } from '../src/errors.js';
import { createApp } from '../src/app.js';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MysqlDanmakuSettingsRepository } from '../src/danmaku.js';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlPlaybackRepository } from '../src/mysql-domain.js';

test('danmaku accepts bounded plain text, is shared to the authenticated Agent cursor, and clear invalidates old cursors', () => {
  let now = 1000;
  const bus = new DanmakuBuffer(() => now, 2);
  const first = bus.publish(' hello\nworld ', 'Guest', '192.168.1.2');
  assert.equal(first.id, 1);
  assert.deepEqual(bus.poll({ enabled: true, cursor: 0, clearVersion: 0 }).messages[0]?.text, 'Guest: hello world');
  bus.publish('second', '', '192.168.1.3');
  bus.publish('third', '', '192.168.1.4');
  assert.equal(bus.poll({ enabled: true, cursor: 0, clearVersion: 0 }).messages.length, 2, 'memory buffer stays bounded');
  const cleared = bus.clear();
  assert.deepEqual(bus.poll({ enabled: true, cursor: 0, clearVersion: 0 }), { enabled: true, clearVersion: cleared.clearVersion, clear: true, reset: false, cursor: 3, messages: [] });
  bus.publish('after clear', '', '192.168.1.5');
  assert.equal(bus.poll({ enabled: true, cursor: 0, clearVersion: 0 }).messages[0]?.text, 'after clear', 'messages sent after a Clear remain deliverable with the clear signal');
  assert.deepEqual(bus.poll({ enabled: false, cursor: 3, clearVersion: cleared.clearVersion }).messages, []);
  now += 30_001;
  assert.deepEqual(bus.poll({ enabled: true, cursor: 0, clearVersion: cleared.clearVersion }).messages, [], 'reconnect cannot replay stale messages');
  now += 1;
});

test('danmaku rate limits per visitor and globally; invalid text fails closed', () => {
  let now = 1000;
  const bus = new DanmakuBuffer(() => now);
  bus.publish('one', '', 'visitor'); bus.publish('two', '', 'visitor'); bus.publish('three', '', 'visitor');
  assert.throws(() => bus.publish('four', '', 'visitor'), (error: unknown) => error instanceof BoundaryError && error.code === 'DANMAKU_RATE_LIMITED');
  assert.throws(() => normalizeDanmaku('   ', ''), { code: 'DANMAKU_INVALID' });
  assert.throws(() => normalizeDanmaku('x'.repeat(101), ''), { code: 'DANMAKU_INVALID' });
  assert.equal(normalizeDanmaku('hello\u0000\nworld', ''), 'hello world');
  now += 2500;
  assert.equal(bus.publish('again', '', 'visitor').accepted, true);
});

test('reservation comment is queued once by its playback transition path, sanitized, bounded, and ephemeral',()=>{
  let now=10_000;
  const bus=new DanmakuBuffer(()=>now,2);
  const published=bus.publishReservationComment('  hello\nworld  '.repeat(10),'  Guest\u0000 ');
  assert.equal(published.accepted,true);
  const message=bus.poll({enabled:true,cursor:0,clearVersion:0}).messages[0];
  assert.equal(message?.text?.startsWith('Guest: hello world hello world'),true);
  assert.equal([...message!.text].length<=140,true);
  assert.deepEqual(bus.publishReservationComment('  \n ','Guest'),{accepted:false});
  now+=30_001;
  assert.equal(bus.poll({enabled:true,cursor:0,clearVersion:0}).messages.length,0);
});

test('playback comment lookup returns only the reservation display fields, never its media path',async()=>{
  let sql='';
  const store={rows:async(query:string)=>{sql=query;return[{singer:'Guest',comment:'starting message'}];}} as unknown as MysqlStore;
  const value=await new MysqlPlaybackRepository(store).reservationCommentForTask('task-id');
  assert.deepEqual(value,{singer:'Guest',comment:'starting message'});
  assert.match(sql,/JOIN reservation r ON r\.id=t\.request_id/);
  assert.doesNotMatch(sql,/fullpath|songfile/);
});

test('a Fastify restart resets an Agent cursor instead of hiding new message IDs',()=>{
  const restarted=new DanmakuBuffer(()=>10_000);
  const recovery=restarted.poll({enabled:true,cursor:24,clearVersion:3});
  assert.equal(recovery.reset,true);assert.equal(recovery.clear,true);assert.equal(recovery.cursor,0);
  restarted.publish('new process message','','visitor');
  assert.equal(restarted.poll({enabled:true,cursor:recovery.cursor,clearVersion:recovery.clearVersion}).messages[0]?.text,'new process message');
});

test('bounded poll batches can be drained without skipping messages beyond the first page',()=>{
  const bus=new DanmakuBuffer(()=>1000,100);
  for(let i=0;i<25;i++)bus.publish(`message ${i}`,'',`visitor-${i}`);
  const first=bus.poll({enabled:true,cursor:0,clearVersion:0});
  assert.equal(first.messages.length,12);
  assert.equal(first.messages.at(-1)?.id,12);
  const second=bus.poll({enabled:true,cursor:first.messages.at(-1)!.id,clearVersion:first.clearVersion});
  assert.equal(second.messages.length,12);
  assert.equal(second.messages[0]?.id,13);
  const third=bus.poll({enabled:true,cursor:second.messages.at(-1)!.id,clearVersion:second.clearVersion});
  assert.equal(third.messages[0]?.id,25);
});

test('Agent poll requires the private token and current Agent identity; Admin controls remain session-protected', async()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-danmaku-api-'));
  const legacy=createServer((_request,response)=>{response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({ok:true,data:{proof:'p'.repeat(64)}}));});
  await new Promise<void>(resolve=>legacy.listen(0,'127.0.0.1',resolve));const address=legacy.address();assert.ok(address&&typeof address!=='string');
  const token='a'.repeat(48);const app=createApp({legacyUrl:`http://127.0.0.1:${address.port}`,bridgeToken:'b'.repeat(48),playerAgentToken:token,playerStatePath:join(root,'state.json'),queueRoot:root,userOrigins:['http://user'],adminOrigins:['http://admin']});
  const headers={authorization:`Bearer ${token}`,'content-type':'application/json'};
  try{
    const denied=await app.inject({method:'POST',url:'/api/v1/agent/danmaku/poll',headers:{...headers,authorization:`Bearer ${'x'.repeat(48)}`},payload:{agentId:'agent-1',cursor:0,clearVersion:0}});assert.equal(denied.statusCode,401);
    const user=await app.inject({method:'POST',url:'/api/v1/agent/next',headers,payload:{agentId:'agent-1',testReady:false,searchReady:false}});assert.equal(user.statusCode,200,user.body);
    const poll=await app.inject({method:'POST',url:'/api/v1/agent/danmaku/poll',headers,payload:{agentId:'agent-1',cursor:0,clearVersion:0}});assert.equal(poll.statusCode,200,poll.body);assert.equal(poll.json().data.enabled,false);
    const wrongIdentity=await app.inject({method:'POST',url:'/api/v1/agent/danmaku/poll',headers,payload:{agentId:'agent-2',cursor:0,clearVersion:0}});assert.equal(wrongIdentity.statusCode,401);
    const admin=await app.inject({method:'PUT',url:'/api/v1/admin/danmaku/settings',headers:{'x-yukari-client':'1','content-type':'application/json',origin:'http://admin'},payload:{enabled:true}});assert.equal(admin.statusCode,401);
    const forgedOrigin=await app.inject({method:'POST',url:'/api/v1/danmaku',headers:{'x-yukari-client':'1','content-type':'application/json',origin:'http://evil.example','x-forwarded-host':'192.168.1.24:8181','x-yukari-user-lan-proxy':'1'},payload:{text:'hello'}});assert.equal(forgedOrigin.statusCode,403);
    const lanOrigin=await app.inject({method:'POST',url:'/api/v1/danmaku',headers:{'x-yukari-client':'1','content-type':'application/json',origin:'http://192.168.1.24:8181','x-forwarded-host':'192.168.1.24:8181','x-yukari-user-lan-proxy':'1'},payload:{text:'hello'}});assert.equal(lanOrigin.statusCode,503);assert.equal(lanOrigin.json().error.code,'DANMAKU_UNAVAILABLE');
  }finally{await app.close();await new Promise<void>(resolve=>legacy.close(()=>resolve()));rmSync(root,{recursive:true,force:true});}
});

test('MySQL comment setting defaults off and persists through the existing app_setting table',async()=>{
  let value:unknown=undefined,revision=0;
  const store={
    rows:async()=>value===undefined?[]:[{setting_key:'danmaku_enabled',value_json:JSON.stringify(value)}],
    transaction:async<T>(run:(connection:unknown)=>Promise<T>)=>run({
      execute:async(sql:string,params:unknown[])=>{if(sql.startsWith('INSERT IGNORE')&&value===undefined){value=false;revision=0;}if(sql.startsWith('UPDATE app_setting')){value=JSON.parse(String(params[0]));revision=Number(params[2]);}return[{affectedRows:1},[]];},
      query:async()=>[[{revision}],[]],
    } as never),
  } as unknown as MysqlStore;
  const settings=new MysqlDanmakuSettingsRepository(store);
  assert.equal(await settings.enabled(),false);
  assert.deepEqual(await settings.setEnabled(true),{enabled:true,revision:1});
  assert.equal(await new MysqlDanmakuSettingsRepository(store).enabled(),true);
  assert.deepEqual(await settings.setEnabled(false),{enabled:false,revision:2});
  assert.equal(await settings.enabled(),false);
});

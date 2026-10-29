import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlPlaybackRepository } from '../src/mysql-domain.js';

function fixture(initialState:'uncertain'|'failed'|'playing'='uncertain',reservationExists=true){
  const task:{request_id:number;state:string;agent_id:string;playback_state:string;command:string;started_at:number}={request_id:17,state:initialState,agent_id:'agent-a',playback_state:initialState==='uncertain'||initialState==='playing'?'playing':'stopped',command:'stop',started_at:123};
  const reservation={nowplaying:initialState==='uncertain'?'再生開始待ち':initialState==='playing'?'再生中':'停止中',playtimes:2};
  const events=new Map<string,{event_id:number;details_json:string}>();let eventId=0;
  const settings=new Map<string,{value:string;revision:number}>([['playmode',{value:'1',revision:1}],['scheduler_enabled',{value:'false',revision:1}],['manual_start_requested',{value:'false',revision:1}]]);
  const connection={execute:async(sql:string,values:unknown[]=[]):Promise<[unknown,unknown]>=>{
    if(sql.startsWith('SELECT request_id,state,agent_id,playback_state,command,started_at FROM playback_task'))return [[{...task}],[]];
    if(sql.startsWith('SELECT request_id,state,agent_id FROM playback_task'))return [[{request_id:task.request_id,state:task.state,agent_id:task.agent_id}],[]];
    if(sql.startsWith('SELECT request_id,state FROM playback_task'))return [[{request_id:task.request_id,state:task.state}],[]];
    if(sql.startsWith('SELECT nowplaying FROM reservation'))return [reservationExists?[{nowplaying:reservation.nowplaying}]:[],[]];
    if(sql.startsWith('SELECT setting_key,value_json,revision FROM app_setting'))return [[...settings.entries()].map(([setting_key,value])=>({setting_key,value_json:value.value,revision:value.revision})),[]];
    if(sql.includes('SELECT task_id FROM playback_task WHERE state IN'))return [[],[]];
    if(sql.includes('SELECT event_id FROM playback_event')){
      if(sql.includes('event_key IN'))return [[...events.keys()].some(key=>values.slice(1).includes(key))?[{event_id:1}]:[],[]];
      return [events.has(String(values[1]))?[{event_id:1}]:[],[]];
    }
    if(sql.startsWith('UPDATE playback_task SET state=\'completed\'')){task.state='completed';task.playback_state='idle';task.command='';return [{affectedRows:1},[]];}
    if(sql.startsWith('UPDATE playback_task SET state=\'playing\'')){task.state='playing';task.playback_state=String(values[0]);task.command='';return [{affectedRows:1},[]];}
    if(sql.startsWith('UPDATE playback_task SET state=\'failed\'')){task.state='failed';task.playback_state='stopped';task.command='';return [{affectedRows:1},[]];}
    if(sql.startsWith('UPDATE playback_task SET playback_state=?')){task.playback_state=String(values[0]);return [{affectedRows:1},[]];}
    if(sql.startsWith('UPDATE reservation SET nowplaying=?')){if(sql.includes('AND nowplaying=')&&reservation.nowplaying!==values.at(-1))return [{affectedRows:0},[]];if(sql.includes('AND nowplaying IN')&&!values.slice(2).includes(reservation.nowplaying))return [{affectedRows:0},[]];reservation.nowplaying=String(values[0]);return [{affectedRows:1},[]];}
    if(sql.startsWith('INSERT INTO app_setting')){settings.set(String(values[0]),{value:String(values[1]),revision:Number(values[3])});return [{affectedRows:1},[]];}
    if(sql.startsWith('INSERT IGNORE INTO playback_event')){const key=String(values[1]);if(!events.has(key))events.set(key,{event_id:++eventId,details_json:String(values[5])});return [{affectedRows:1},[]];}
    if(sql.startsWith('SELECT task_id AS id'))return [[{id:'task-a',requestId:17,state:task.state,agentId:task.agent_id,playback:task.playback_state,command:task.command,createdAt:1}],[]];
    throw new Error(`Unexpected SQL in recovery fixture: ${sql}`);
  }};
  const store={transaction:async<T>(run:(connection:never)=>Promise<T>)=>run(connection as never),rows:async(sql:string,values:unknown[]=[])=>{
    if(sql.startsWith('SELECT event_id FROM playback_event'))return [...events.keys()].includes(String(values[1]))?[{event_id:1}]:[];
    throw new Error(`Unexpected recovery rows query: ${sql}`);
  }} as unknown as MysqlStore;
  return {repository:new MysqlPlaybackRepository(store),task,reservation,events,settings};
}

test('uncertain task can be re-adopted only after the owning Agent verifies the same active media',async()=>{
  const f=fixture();
  await assert.rejects(f.repository.report('task-a','agent-b',{state:'playing',recovery:'verified_active',playback:'playing'}),{code:'STALE_PLAYER_TASK'});
  const result=await f.repository.report('task-a','agent-a',{state:'playing',recovery:'verified_active',playback:'paused'});
  assert.equal(result.state?.state,'playing');assert.equal(f.reservation.nowplaying,'再生中');assert.equal(f.reservation.playtimes,2);
  assert.equal(f.events.has('recovered-playing'),true);
});

test('MySQL current task projection identifies formal tasks as queue playback',async()=>{
  const store={rows:async()=>[{id:'task-a',requestId:17,state:'playing',agentId:'agent-a',playback:'playing'}]} as unknown as MysqlStore;
  const task=await new MysqlPlaybackRepository(store).current();
  assert.equal(task?.kind,'queue');
  assert.equal(task?.state,'playing');
});

test('a genuine EOF report received after restart completes once without double-counting playtimes',async()=>{
  const f=fixture();
  const result=await f.repository.report('task-a','agent-a',{state:'completed',playback:'idle',endReason:'eof'});
  assert.equal(result.state?.state,'completed');assert.equal(f.reservation.nowplaying,'再生済');assert.equal(f.reservation.playtimes,2);
  assert.equal(f.events.has('eof'),true);
  await assert.rejects(f.repository.report('task-a','agent-b',{state:'completed',playback:'idle',endReason:'eof'}),{code:'STALE_PLAYER_TASK'});
});

test('confirmed inactive recovery becomes failed/stopped, never completed or played',async()=>{
  const f=fixture();
  const result=await f.repository.report('task-a','agent-a',{state:'failed',recovery:'confirmed_inactive',playback:'playing'});
  assert.equal(result.state?.state,'failed');assert.equal(f.reservation.nowplaying,'停止中');assert.equal(f.reservation.playtimes,2);
  assert.equal(f.events.has('recovery-inactive'),true);assert.equal(f.events.has('eof'),false);
});

test('ordinary Agent failure projects canonical Node queue statuses to stopped instead of leaving a claimed row',async()=>{
  const f=fixture('playing');
  const result=await f.repository.report('task-a','agent-a',{state:'failed',playback:'unavailable',error:'mpv exited'});
  assert.equal(result.state?.state,'failed');assert.equal(f.reservation.nowplaying,'停止中');assert.equal(f.reservation.playtimes,2);
});

test('manual retry returns a failed reservation to the queue only once and does not alter play count',async()=>{
  const f=fixture('failed');
  const result=await f.repository.retry('task-a',false,'mpv was closed by admin');
  assert.equal(result.state,'queued');assert.equal(f.reservation.nowplaying,'未再生');assert.equal(f.reservation.playtimes,2);
  await assert.rejects(f.repository.retry('task-a'),{code:'PLAYBACK_RECOVERY_ALREADY_APPLIED'});
  assert.equal(f.events.has('retry-requested:task-a'),true);
  assert.equal(JSON.parse(f.events.get('retry-requested:task-a')!.details_json).reason,'mpv was closed by admin');
});

test('explicit retry in FIFO mode atomically resumes the scheduler while keeping the failed attempt',async()=>{
  const f=fixture('failed');
  const result=await f.repository.retry('task-a',true);
  assert.equal(result.schedulerResumed,true);assert.equal(f.settings.get('scheduler_enabled')?.value,'true');
  assert.equal(f.reservation.nowplaying,'未再生');assert.equal(f.reservation.playtimes,2);
  assert.equal(f.events.has('retry-requested:task-a'),true);
});

test('manual handling records a reason without pretending playback or incrementing play count',async()=>{
  const f=fixture('failed');
  const result=await f.repository.markHandled('task-a','operator confirmed this item should not play');
  assert.equal(result.state,'handled');assert.equal(f.reservation.nowplaying,'停止中');assert.equal(f.reservation.playtimes,2);
  const event=[...f.events.keys()].find(key=>key.startsWith('manual-handled:'));
  assert.ok(event);assert.equal(f.events.has('eof'),false);
});

test('administrator can explicitly settle an uncertain task without Agent telemetry or claiming EOF',async()=>{
  const f=fixture();
  const result=await f.repository.confirmInactiveByAdmin('task-a','Operator confirmed the player is not in use');
  assert.equal(result.state,'failed');assert.equal(result.playback,'stopped');assert.equal(result.playtimesChanged,false);
  assert.equal(f.task.state,'failed');assert.equal(f.reservation.nowplaying,'停止中');assert.equal(f.reservation.playtimes,2);
  assert.equal(f.events.has('admin-confirmed-inactive:task-a'),true);assert.equal(f.events.has('eof'),false);
  assert.equal(await f.repository.hasAdminInactiveConfirmation('task-a'),true);
});

test('administrator inactive confirmation is idempotent and requires a reason',async()=>{
  const f=fixture();
  await assert.rejects(f.repository.confirmInactiveByAdmin('task-a','  '),{code:'PLAYBACK_REASON_REQUIRED'});
  await f.repository.confirmInactiveByAdmin('task-a','Confirmed not playing');
  const again=await f.repository.confirmInactiveByAdmin('task-a','Confirmed not playing');
  assert.equal(again.state,'already_confirmed');
  assert.equal([...f.events.keys()].filter(key=>key==='admin-confirmed-inactive:task-a').length,1);
  const terminal=fixture('failed');
  const terminalResult=await terminal.repository.confirmInactiveByAdmin('task-a','Confirmed mpv is closed');
  assert.equal(terminalResult.state,'failed');assert.equal(terminal.task.state,'failed');
  assert.equal(terminal.reservation.playtimes,2);assert.equal(terminal.events.has('eof'),false);
  assert.equal(await terminal.repository.hasAdminInactiveConfirmation('task-a'),true);
});

test('explicitly skipping a failed reservation keeps its failed task and resumes FIFO for the next song',async()=>{
  const f=fixture('failed');
  const result=await f.repository.markHandled('task-a','Skip this failed item and continue',true);
  assert.equal(result.state,'handled');assert.equal(result.schedulerResumed,true);
  assert.equal(f.settings.get('scheduler_enabled')?.value,'true');
  assert.equal(f.reservation.nowplaying,'停止中');assert.equal(f.reservation.playtimes,2);
  assert.equal(f.events.has('eof'),false);
});

test('deleted reservation remains recoverable as an orphan task and can be closed without recreating it',async()=>{
  const f=fixture('uncertain',false);
  const result=await f.repository.confirmInactiveByAdmin('task-a','Reservation was deleted and mpv is not in use');
  assert.equal(result.state,'orphan_closed');assert.equal(result.reservationExists,false);assert.equal(result.playtimesChanged,false);
  assert.equal(f.task.state,'failed');assert.equal(f.events.has('admin-confirmed-inactive:task-a'),true);assert.equal(f.events.has('manual-handled:task-a'),true);assert.equal(f.events.has('eof'),false);
});

test('startup recovery fences a playing task and disables scheduler without marking EOF',async()=>{
  let state='playing';
  const settings=new Map<string,string>([['scheduler_enabled','true'],['manual_start_requested','true']]);
  const events:string[]=[];
  const connection={
    query:async(sql:string,values:unknown[]=[]):Promise<[unknown,unknown]>=>{
      if(sql.startsWith('SELECT task_id,agent_id,state FROM playback_task'))return [[{task_id:'task-a',agent_id:'agent-a',state}],[]];
      if(sql.startsWith('SELECT setting_key,revision FROM app_setting'))return [[...settings.keys()].map(setting_key=>({setting_key,revision:2})),[]];
      throw new Error('Unexpected recovery query: '+sql);
    },
    execute:async(sql:string,values:unknown[]=[]):Promise<[unknown,unknown]>=>{
      if(sql.startsWith('INSERT INTO app_setting')){settings.set(String(values[0]),String(values[1]));return [{affectedRows:1},[]];}
      if(sql.startsWith("UPDATE playback_task SET state='uncertain'")){state='uncertain';return [{affectedRows:1},[]];}
      if(sql.startsWith('UPDATE reservation SET nowplaying='))return [{affectedRows:1},[]];
      if(sql.startsWith('INSERT IGNORE INTO playback_event')){events.push(String(values[2]));return [{affectedRows:1},[]];}
      throw new Error('Unexpected recovery statement: '+sql);
    },
  };
  const store={transaction:async<T>(run:(c:never)=>Promise<T>)=>run(connection as never)} as unknown as MysqlStore;
  const repository=new MysqlPlaybackRepository(store);
  assert.equal(await repository.recoverOnStartup(),1);
  assert.equal(state,'uncertain');
  assert.equal(settings.get('scheduler_enabled'),'false');
  assert.equal(settings.get('manual_start_requested'),'false');
  assert.deepEqual(events,['uncertain']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlPlaybackRepository } from '../src/mysql-domain.js';

type QueueRow = { id:number;songfile:string;fullpath:string;kind:string;nowplaying:string;loop:number;pause:number;track:number;keychange:number;audiodelay:number;volume:number };

function schedulerStore(mode:number,enabled:boolean,manualStart:boolean,volume:number) {
  const settings=new Map<string,unknown>([['playmode',mode],['scheduler_enabled',enabled],['manual_start_requested',manualStart],['startvolume',volume]]);
  const queue:QueueRow[]=[{id:71,songfile:'Fixture',fullpath:'C:/media/fixture.mp4',kind:'動画',nowplaying:'未再生',loop:0,pause:0,track:0,keychange:0,audiodelay:0,volume:0}];
  const tasks:Array<{task_id:string;request_id:number;state:string;agent_id:string;lease_until:number;command:null}> = [];
  const writes:string[]=[];
  const connection={
    execute:async(sql:string,values:unknown[]=[]):Promise<[unknown,unknown]>=>{
      writes.push(sql);
      if(sql.startsWith('SELECT value_json FROM app_setting'))return [[{value_json:JSON.stringify(settings.get('startvolume'))}],[]];
      if(sql.includes('FROM app_setting')) {
        return [[...settings].filter(([key])=>values.map(String).includes(key)).map(([setting_key,value_json])=>({setting_key,value_json:JSON.stringify(value_json),revision:1})) ,[]];
      }
      if(sql.includes('FROM playback_task'))return [tasks.filter(task=>['claimed','playing','uncertain'].includes(task.state)),[]];
      if(sql.startsWith('UPDATE playback_task SET lease_until='))return [{affectedRows:1},[]];
      if(sql.includes('FROM reservation')&&sql.includes('nowplaying IN (?,?,?,?,?)'))return [[],[]];
      if(sql.startsWith('SELECT fullpath,keychange FROM reservation')){const row=queue.find(item=>item.id===Number(values[0]));return [[row?{fullpath:row.fullpath,keychange:row.keychange}:undefined].filter(Boolean),[]];}
      if(sql.includes('FROM reservation')&&sql.includes('nowplaying IN (?,?,?)')) {
        return [queue.filter(row=>values.map(String).includes(row.nowplaying)),[]];
      }
      if(sql.startsWith('UPDATE app_setting SET value_json=')) {settings.set(String(values[3]),JSON.parse(String(values[0])));return [{affectedRows:1},[]];}
      if(sql.startsWith('INSERT INTO playback_task')) {
        tasks.push({task_id:String(values[0]),request_id:Number(values[1]),state:'claimed',agent_id:String(values[2]),lease_until:Number(values[3]),command:null});return [{affectedRows:1},[]];
      }
      if(sql.startsWith('UPDATE reservation SET nowplaying=')) {
        const row=queue.find(item=>item.id===Number(values[1]));if(row)row.nowplaying=String(values[0]);return [{affectedRows:row?1:0},[]];
      }
      if(sql.startsWith('INSERT IGNORE INTO playback_event'))return [{affectedRows:1},[]];
      throw new Error(`Unexpected scheduler SQL: ${sql}`);
    },
    query:async(sql:string,values:unknown[]=[]):Promise<[unknown,unknown]>=>connection.execute(sql,values),
  };
  const store={transaction:async<T>(run:(connection:unknown)=>Promise<T>)=>run(connection),rows:async()=>[]} as unknown as MysqlStore;
  return {store,settings,queue,tasks,writes};
}

test('MySQL manual mode claims exactly one explicitly requested song and passes initial volume once per new task',async()=>{
  const fixture=schedulerStore(2,true,false,37),repository=new MysqlPlaybackRepository(fixture.store);
  const idle=await repository.claimNext('agent-one');
  assert.equal(idle.task,null,'manual ownership alone must not start a queued reservation');
  assert.equal(fixture.queue[0].nowplaying,'未再生');

  fixture.settings.set('manual_start_requested',true);
  const claimed=await repository.claimNext('agent-one');
  assert.ok(claimed.task);assert.equal(claimed.task.requestId,71);assert.equal(claimed.task.initialVolume,37);
  assert.equal(fixture.settings.get('manual_start_requested'),false,'the one-shot start intent is consumed atomically with claim');
  assert.equal(fixture.queue[0].nowplaying,'再生開始待ち');

  const recovery=await repository.claimNext('agent-one');
  assert.equal(recovery.task?.id,claimed.task.id,'the owning Agent gets the active task back, never a second reservation');
  assert.equal(fixture.tasks.length,1);
});

test('MySQL FIFO mode claims automatically only while the durable scheduler and deployment gate are enabled',async()=>{
  const fixture=schedulerStore(1,true,false,62),repository=new MysqlPlaybackRepository(fixture.store);
  const claimed=await repository.claimNext('agent-one',false);
  assert.equal(claimed.task,null,'the deployment/owner fence gate blocks a new claim');
  assert.equal(fixture.queue[0].nowplaying,'未再生');
  const enabled=await repository.claimNext('agent-one',true);
  assert.ok(enabled.task);assert.equal(enabled.task.initialVolume,62);
  assert.equal(fixture.queue[0].nowplaying,'再生開始待ち');

  const stopped=schedulerStore(1,false,false,62);
  assert.equal((await new MysqlPlaybackRepository(stopped.store).claimNext('agent-one',true)).task,null,'saved FIFO mode does not run until an Admin explicitly enables scheduling');
});

test('MySQL queue claim passes the saved semitone shift to the Agent and rejects unsafe values',async()=>{
  const fixture=schedulerStore(1,true,false,50),repository=new MysqlPlaybackRepository(fixture.store);
  fixture.queue[0].keychange=3;
  const claim=await repository.claimNext('agent-one');
  assert.equal(claim.task?.initialKeySemitones,3);
  const resumed=await repository.claimNext('agent-one');
  assert.equal(resumed.task?.initialKeySemitones,3,'a claimed task keeps receiving its reservation key until playback is confirmed');

  const invalid=schedulerStore(1,true,false,50);invalid.queue[0].keychange=7;
  await assert.rejects(new MysqlPlaybackRepository(invalid.store).claimNext('agent-one'),{code:'AUTOPLAY_KEY_CHANGE_UNSUPPORTED'});
  assert.equal(invalid.queue[0].nowplaying,'未再生','invalid key settings do not claim or mutate the reservation');
  assert.equal(invalid.tasks.length,0);
});

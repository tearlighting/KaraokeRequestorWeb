import test from 'node:test';
import type { RowDataPacket } from 'mysql2/promise';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { MysqlStore, mysqlConfigFromEnv } from '../src/mysql.js';
import { MysqlPlaybackRepository, MysqlQueueMutationRepository, MysqlQueueRepository, MysqlRequestRepository, MysqlSettingsRepository } from '../src/mysql-domain.js';

test('MySQL reservation, queue, idempotency, ordering and delete use one durable database', { skip: !(process.env.MYSQL_TEST_ISOLATED === '1' && process.env.MYSQL_TEST_PASSWORD_FILE && process.env.MYSQL_TEST_DATABASE?.endsWith('_test')) }, async () => {
  const store=new MysqlStore(mysqlConfigFromEnv({ ...process.env, MYSQL_HOST:process.env.MYSQL_TEST_HOST||'127.0.0.1', MYSQL_PORT:process.env.MYSQL_TEST_PORT||'3307', MYSQL_DATABASE:process.env.MYSQL_TEST_DATABASE!, MYSQL_USER:'yukari_app', MYSQL_PASSWORD_FILE:process.env.MYSQL_TEST_PASSWORD_FILE }));
  const userId=randomUUID(), receipt=randomBytes(32).toString('hex'), key=receipt.padEnd(64,'0').slice(0,64);
  const context={database:'unused',ip:'192.0.2.10',ua:'mysql-integration',userid:userId,automove:false,reset:false,midjoin:false,history:true,metadata:null,nonameusername:'Anonymous',displayname:'MySQL test'};
  const input={filename:'Phase16_Test.mp4',singer:'MySQL Phase16 Test',comment:'integration marker',kind:'動画',fullpath:'X:/fixture/Phase16_Test.mp4',secret:0,loop:0,keychange:0,track:0,pause:0,audiodelay:0,volume:0,duration:15} as const;
  let requestId=0,taskId='';
  let scheduleSnapshot:Array<{setting_key:string;value_json:unknown;updated_at:number;revision:number}>=[];
  let scheduleSnapshotReady=false;
  try {
    await store.ping();
    scheduleSnapshot=await store.rows<RowDataPacket & {setting_key:string;value_json:unknown;updated_at:number;revision:number}>('SELECT setting_key,value_json,updated_at,revision FROM app_setting WHERE setting_key IN (?,?,?,?)',['playmode','scheduler_enabled','manual_start_requested','startvolume']);
    scheduleSnapshotReady=true;
    const settings=new MysqlSettingsRepository(store);const existing=await settings.read();const noChange=await settings.update({...existing});assert.equal(noChange.changed,false);
    const requests=new MysqlRequestRepository(store);
    const created=await requests.commit(context,input as never,key);requestId=created.result.id;
    const replay=await requests.commit(context,input as never,key);
    assert.equal(replay.replayed,true);assert.equal(replay.result.id,requestId);
    assert.equal((await requests.lookup(key,userId))?.id,requestId);
    const queue=new MysqlQueueRepository(store);
    assert.equal((await queue.row(requestId))?.nowplaying,'未再生');
    const visible=await queue.read({secret_text:'Private request',ip:context.ip,ua:context.ua,role:'user'});
    assert.ok(visible.items.some(item=>item.id===requestId&&item.songfile==='Phase16_Test'));
    assert.equal(visible.total,1);
    await new MysqlQueueMutationRepository(store).mutate(requestId,'up');
    const row=await queue.row(requestId);assert.equal(Number(row?.reqorder),1);
    await store.transaction(async c=>{for(const[key,value]of [['playmode',1],['scheduler_enabled',true],['manual_start_requested',false],['startvolume',41]] as const)await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=VALUES(updated_at),revision=revision+1',[key,JSON.stringify(value),Math.floor(Date.now()/1000)]);});
    const playback=new MysqlPlaybackRepository(store);const claim=await playback.claimNext('mysql-test-agent');assert.ok(claim.task);assert.equal(claim.task.initialVolume,41);taskId=claim.task.id;
    const started=await playback.report(taskId,'mysql-test-agent',{state:'playing',playback:'playing'});assert.equal(started.state?.state,'playing');
    assert.deepEqual(await queue.playback(),{playing:true,status:'再生中',playingtitle:'Phase16_Test',playingsinger:'MySQL Phase16 Test',kind:'動画'});
    const eof=await playback.report(taskId,'mysql-test-agent',{state:'completed',playback:'idle',endReason:'eof'});assert.equal(eof.eventType,'eof');
    assert.deepEqual(await queue.playback(),{playing:false});
    const duplicate=await playback.report(taskId,'mysql-test-agent',{state:'completed',playback:'idle',endReason:'eof'});assert.equal(duplicate.changed,false);
    const finalRow=await queue.row(requestId);assert.equal(finalRow?.nowplaying,'\u518d\u751f\u6e08');assert.equal(Number(finalRow?.playtimes),1);
    const history=await playback.history(20,0);assert.equal(history.tasks.length,1);assert.equal(history.events.filter(event=>(event as unknown as { type: string }).type==='eof').length,1);
    const deleted=await new MysqlQueueMutationRepository(store).mutate(requestId,'delete');assert.equal(deleted,'');
    const after=await queue.read({secret_text:'Private request',ip:context.ip,ua:context.ua,role:'user'});assert.equal(after.total,0);
  } finally {
    if(taskId){await store.execute('DELETE FROM playback_event WHERE task_id=?',[taskId]);await store.execute('DELETE FROM playback_task WHERE task_id=?',[taskId]);}
    if(requestId){await store.execute('DELETE FROM request_submission WHERE key_hash=?',[key]);await store.execute('DELETE FROM request_history WHERE userid=?',[userId]);await store.execute('DELETE FROM reservation WHERE id=?',[requestId]);await store.execute('DELETE FROM app_user WHERE userid=?',[userId]);}
    if(scheduleSnapshotReady)await store.transaction(async c=>{
      await c.execute('DELETE FROM app_setting WHERE setting_key IN (?,?,?,?)',['playmode','scheduler_enabled','manual_start_requested','startvolume']);
      for(const row of scheduleSnapshot)await c.execute('INSERT INTO app_setting(setting_key,value_json,updated_at,revision) VALUES(?,?,?,?)',[row.setting_key,typeof row.value_json==='string'?row.value_json:JSON.stringify(row.value_json),row.updated_at,row.revision]);
    });
    await store.close();
  }
});

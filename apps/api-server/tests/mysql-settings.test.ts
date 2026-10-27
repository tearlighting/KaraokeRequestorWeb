import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlSettingsRepository } from '../src/mysql-domain.js';
import { projectSettings } from '../src/settings.js';

function settingsStore() {
  const values = new Map<string, unknown>([['playmode',3],['startvolume',50],['requestlistactivereload',1],['request_automove',1],['request_automove_reset',1],['request_automove_midjoin_first',0],['scheduler_enabled',false],['manual_start_requested',false]]);
  let revision = 1;let activeTasks=0;
  const store = {
    rows: async () => [...values].map(([setting_key,value])=>({setting_key,value_json:JSON.stringify(value),revision})),
    transaction: async <T>(run:(connection:unknown)=>Promise<T>) => {
      const previous=new Map(values);const previousRevision=revision;
      const connection={
        query:async(sql:string,params:unknown[]=[])=>{if(sql.includes('FROM playback_task'))return [activeTasks?[{task_id:'active'}]:[],[]];const selected=new Set(params.map(String));const rows=[...values].filter(([key])=>!selected.size||selected.has(key));return [sql.includes('SELECT setting_key,revision')?rows.map(([setting_key])=>({setting_key,revision})):rows.map(([setting_key,value_json])=>({setting_key,value_json:JSON.stringify(value_json),revision})),[]];},
        execute:async(_sql:string,params:unknown[])=>{const[key,json,_updated,next]=params;values.set(String(key),JSON.parse(String(json)));revision=Number(next);return [{affectedRows:1},[]];},
      };
      try{return await run(connection as never);}catch(error){values.clear();for(const entry of previous)values.set(...entry);revision=previousRevision;throw error;}
    },
  } as unknown as MysqlStore;
  return {store,values,setActiveTasks:(count:number)=>{activeTasks=count;}};
}

test('MySQL settings persistence and runtime capability boundary are explicit',async()=>{
  const imported=projectSettings(Buffer.from('playmode=3\nstartvolume=44\nrequestlistactivereload=1\nrequest_automove=0\nrequest_automove_reset=1\nrequest_automove_midjoin_first=1\n'));
  assert.deepEqual([imported.playmode,imported.request_automove,imported.request_automove_reset,imported.request_automove_midjoin_first],[3,0,1,1]);
  const legacyOff=projectSettings(Buffer.from('request_automove=2\nrequest_automove_reset=2\nrequest_automove_midjoin_first=2\n'));
  assert.deepEqual([legacyOff.request_automove,legacyOff.request_automove_reset,legacyOff.request_automove_midjoin_first],[0,0,0]);
  const legacyRefreshOff=projectSettings(Buffer.from('requestlistactivereload=2\n'));
  assert.equal(legacyRefreshOff.requestlistactivereload,0);
  const {store,values,setActiveTasks}=settingsStore();
  const repo=new MysqlSettingsRepository(store);
  const initial=await repo.read();
  assert.equal((await repo.update({...initial})).changed,false);
  const manual=await repo.update({...initial,playmode:2});assert.equal(manual.playmode,2);
  const volume=await repo.update({...await repo.read(),startvolume:42});assert.equal(volume.startvolume,42);
  await assert.rejects(async()=>repo.update({...await repo.read(),requestlistactivereload:0}),{code:'SETTING_NOT_EFFECTIVE'});
  assert.equal(values.get('playmode'),2);
  const saved=await repo.update({...await repo.read(),playmode:1});
  assert.equal(saved.changed,true);
  assert.equal((await new MysqlSettingsRepository(store).read()).playmode,1,'value survives a repository restart');
  const ordering=await repo.update({...await repo.read(),request_automove:0,request_automove_reset:0,request_automove_midjoin_first:1});
  assert.equal(ordering.changed,true);
  const context=await repo.applyRequestOrdering({automove:true,reset:true,midjoin:false} as never);
  assert.deepEqual([context.automove,context.reset,context.midjoin],[false,false,true]);
  assert.deepEqual(await repo.scheduling(),{enabled:false,manualStartRequested:false,playmode:1});
  await repo.setSchedulerEnabled(true);assert.equal((await repo.scheduling()).enabled,true);
  await assert.rejects(async()=>repo.update({...await repo.read(),playmode:2}),{code:'PLAYMODE_CHANGE_BLOCKED'});
  await repo.setSchedulerEnabled(false);
  setActiveTasks(1);
  await assert.rejects(async()=>repo.update({...await repo.read(),playmode:2}),{code:'PLAYMODE_CHANGE_BLOCKED'});
  setActiveTasks(0);
  const manualMode=await repo.update({...await repo.read(),playmode:2});assert.equal(manualMode.playmode,2);
  await repo.setSchedulerEnabled(true);
  assert.equal((await repo.requestManualStart()).manualStartRequested,true);
  await assert.rejects(()=>repo.requestManualStart(),{code:'MANUAL_START_PENDING'});
  await repo.setSchedulerEnabled(false);assert.deepEqual(await repo.scheduling(),{enabled:false,manualStartRequested:false,playmode:2});
});

test('legacy disabled value 2 remains an effective off value when already stored in MySQL',async()=>{
  const {store,values}=settingsStore();
  values.set('requestlistactivereload',2);
  values.set('request_automove',2);
  values.set('request_automove_reset',2);
  values.set('request_automove_midjoin_first',2);
  const repo=new MysqlSettingsRepository(store);
  const current=await repo.read();
  assert.deepEqual([current.requestlistactivereload,current.request_automove,current.request_automove_reset,current.request_automove_midjoin_first],[0,0,0,0]);
  assert.equal((await repo.update({...current})).changed,false);
  assert.deepEqual([values.get('requestlistactivereload'),values.get('request_automove'),values.get('request_automove_reset'),values.get('request_automove_midjoin_first')],[2,2,2,2]);
});

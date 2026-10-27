import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import type { MysqlStore } from '../src/mysql.js';

test('React Admin settings GET/PUT are authenticated and persist through MySQL only',async()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-settings-api-'));
  const values=new Map<string,unknown>([['playmode',1],['startvolume',50],['requestlistactivereload',1],['request_automove',1],['request_automove_reset',1],['request_automove_midjoin_first',0],['scheduler_enabled',false],['manual_start_requested',false]]);
  const revisions=new Map([...values.keys()].map(key=>[key,1]));
  const operations:string[]=[];
  const legacy=createServer((request,response)=>{
    const operation=new URL(request.url||'/','http://legacy').searchParams.get('operation')||'';
    operations.push(operation);
    const data=operation==='admin-auth'?{proof:'p'.repeat(64)}:operation==='admin-session'?{config_revision:'a'.repeat(64)}:{};
    response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({ok:true,data}));
  });
  await new Promise<void>(resolve=>legacy.listen(0,'127.0.0.1',resolve));
  const address=legacy.address();assert.ok(address&&typeof address!=='string');
  const mysqlStore={
    ping:async()=>undefined,close:async()=>undefined,
    rows:async(sql:string)=>sql.includes('FROM app_setting')?[...values].map(([setting_key,value])=>({setting_key,value_json:JSON.stringify(value),revision:revisions.get(setting_key)!})):[],
    transaction:async<T>(callback:(connection:unknown)=>Promise<T>)=>{
      const connection={
        query:async(sql:string,params:unknown[]=[])=>{if(sql.includes('FROM playback_task'))return [[]];const selected=new Set(params.map(String));const rows=[...values].filter(([key])=>!selected.size||selected.has(key));return [rows.map(([setting_key,value])=>sql.includes('SELECT setting_key,revision')?{setting_key,revision:revisions.get(setting_key)}:{setting_key,value_json:JSON.stringify(value)})]},
        execute:async(_sql:string,params:unknown[])=>{const[key,json,_updated,revision]=params;values.set(String(key),JSON.parse(String(json)));revisions.set(String(key),Number(revision));return [{affectedRows:1},[]];},
      };
      return callback(connection as never);
    },
  } as unknown as MysqlStore;
  const app=createApp({legacyUrl:`http://127.0.0.1:${address.port}`,bridgeToken:'b'.repeat(48),playerStatePath:join(root,'state.json'),queueRoot:root,mysqlStore,userOrigins:['http://user'],adminOrigins:['http://admin']});
  const headers={'x-yukari-client':'1','content-type':'application/json'};
  try{
    const login=await app.inject({method:'POST',url:'/api/v1/admin/session',headers,payload:{username:'admin',password:'fixture-only'}});
    assert.equal(login.statusCode,200,login.body);
    const cookie=String(login.headers['set-cookie']).split(';')[0];
    const read=await app.inject({method:'GET',url:'/api/v1/settings',headers:{...headers,cookie}});
    assert.equal(read.statusCode,200,read.body);assert.equal(read.headers['x-yukari-owner'],'node-settings-read');
    const current=read.json().data;
    const write=await app.inject({method:'PUT',url:'/api/v1/settings',headers:{...headers,cookie},payload:{...current,playmode:2,startvolume:37,request_automove:0,request_automove_reset:0,request_automove_midjoin_first:1}});
    assert.equal(write.statusCode,200,write.body);assert.equal(write.json().data.changed,true);
    const reread=await app.inject({method:'GET',url:'/api/v1/settings',headers:{...headers,cookie}});
    assert.deepEqual([reread.json().data.playmode,reread.json().data.startvolume,reread.json().data.request_automove,reread.json().data.request_automove_reset,reread.json().data.request_automove_midjoin_first],[2,37,0,0,1]);
    assert.equal(values.get('playmode'),2);assert.equal(values.get('startvolume'),37);assert.equal(values.get('request_automove'),0);assert.equal(values.get('request_automove_reset'),0);assert.equal(values.get('request_automove_midjoin_first'),1);
    assert.ok(!operations.includes('admin-settings-save'));
  }finally{
    await app.close();await new Promise<void>(resolve=>legacy.close(()=>resolve()));rmSync(root,{recursive:true,force:true});
  }
});

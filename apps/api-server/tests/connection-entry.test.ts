import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, normalizePublicUserUrl } from '../src/app.js';
import type { MysqlStore } from '../src/mysql.js';

test('public room URL is normalized and rejects unsafe/non-user destinations',()=>{
  assert.equal(normalizePublicUserUrl(' https://karaoke.example.org/user '),'https://karaoke.example.org/user/');
  assert.equal(normalizePublicUserUrl('https://karaoke.example.org/'),'https://karaoke.example.org/user/');
  for(const value of ['http://karaoke.example.org/user/','https://karaoke.example.org/admin/','https://name:secret@karaoke.example.org/user/','https://127.0.0.1/user/'])assert.throws(()=>normalizePublicUserUrl(value));
});

test('configured public entry is persisted, verified by exact proxy origin and creates Secure user cookies',async()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-entry-api-'));const values=new Map<string,unknown>(),revisions=new Map<string,number>();
  const mysqlStore={ping:async()=>undefined,close:async()=>undefined,rows:async(sql:string,params:unknown[]=[])=>{if(sql.includes('information_schema.tables'))return[{n:2}];if(!sql.includes('FROM app_setting'))return[];const keys=new Set(params.map(String));return [...values].filter(([key])=>!keys.size||keys.has(key)).map(([setting_key,value_json])=>({setting_key,value_json:JSON.stringify(value_json),revision:revisions.get(setting_key)||1}));},transaction:async<T>(callback:(connection:unknown)=>Promise<T>)=>{const connection={query:async(_sql:string,params:unknown[]=[])=>[[...values].filter(([key])=>params.map(String).includes(key)).map(([setting_key])=>({setting_key,revision:revisions.get(setting_key)||1}))],execute:async(_sql:string,params:unknown[])=>{const[key,value,_now,revision]=params;values.set(String(key),JSON.parse(String(value)));revisions.set(String(key),Number(revision));return[{affectedRows:1},[]];}};return callback(connection);}} as unknown as MysqlStore;
  const legacy=createServer((request,response)=>{const operation=new URL(request.url||'/','http://legacy').searchParams.get('operation');const data=operation==='admin-auth'||operation==='user-auth'?{proof:'p'.repeat(64)}:operation==='capabilities'?{features:{everything_search:true},server:{room_name:'old'}}:{};response.writeHead(200,{'content-type':'application/json'});response.end(JSON.stringify({ok:true,data}));});
  await new Promise<void>(resolve=>legacy.listen(0,'127.0.0.1',resolve));const address=legacy.address();assert.ok(address&&typeof address!=='string');
  const app=createApp({legacyUrl:`http://127.0.0.1:${address.port}`,bridgeToken:'b'.repeat(48),playerStatePath:join(root,'state.json'),queueRoot:root,mysqlStore,userOrigins:[],adminOrigins:['http://admin']});
  const base={'x-yukari-client':'1','content-type':'application/json'};
  try{
    const login=await app.inject({method:'POST',url:'/api/v1/admin/session',headers:{...base,origin:'http://admin'},payload:{username:'admin',password:'fixture-only'}});assert.equal(login.statusCode,200,login.body);const cookie=String(login.headers['set-cookie']).split(';')[0];
    const saved=await app.inject({method:'PUT',url:'/api/v1/admin/connection-entry',headers:{...base,origin:'http://admin',cookie},payload:{roomName:'Room A',publicUrl:'https://karaoke.example.org/user/',preferredMode:'public'}});assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().data.publicUrl,'https://karaoke.example.org/user/');
    const lanDefault=await app.inject({method:'PUT',url:'/api/v1/admin/connection-entry',headers:{...base,origin:'http://admin',cookie},payload:{roomName:'Room A',publicUrl:'https://karaoke.example.org/user/',preferredMode:'lan'}});assert.equal(lanDefault.statusCode,200,lanDefault.body);
    const origin='https://karaoke.example.org',proxy={origin,'x-forwarded-host':'karaoke.example.org','x-yukari-user-lan-proxy':'1','x-yukari-client':'1','content-type':'application/json'};
    const user=await app.inject({method:'POST',url:'/api/v1/user/session',headers:proxy,payload:{}});assert.equal(user.statusCode,200,user.body);assert.match(String(user.headers['set-cookie']),/Secure/);
    const lanOrigin=await app.inject({method:'POST',url:'/api/v1/user/session',headers:{...proxy,origin:'http://192.168.0.9:8181','x-forwarded-host':'192.168.0.9:8181'},payload:{}});assert.equal(lanOrigin.statusCode,200,lanOrigin.body);
    const forged=await app.inject({method:'POST',url:'/api/v1/user/session',headers:{...proxy,'x-forwarded-host':'evil.example.org'},payload:{}});assert.equal(forged.statusCode,403);
    const adminFromPublic=await app.inject({method:'GET',url:'/api/v1/admin/queue',headers:{...proxy,cookie}});assert.equal(adminFromPublic.statusCode,403);
    const nonce='5ec8d4d6-4474-4edc-9b6e-65fc9c8a4797';const probe=await app.inject({method:'GET',url:`/api/v1/user/entry-probe?nonce=${nonce}`});assert.equal(probe.statusCode,200);assert.equal(probe.json().data.nonce,nonce);assert.equal(probe.headers['access-control-allow-origin'],'*');
    const caps=await app.inject({method:'GET',url:'/api/v1/capabilities',headers:{...base,cookie:String(user.headers['set-cookie']).split(';')[0]}});assert.equal(caps.statusCode,200);assert.equal(caps.json().data.server.room_name,'Room A');
  }finally{await app.close();await new Promise<void>(resolve=>legacy.close(()=>resolve()));rmSync(root,{recursive:true,force:true});}
});

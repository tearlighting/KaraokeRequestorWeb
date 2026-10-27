import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AgentSearchCoordinator } from '../src/agent-search.js';
import { BoundaryError } from '../src/errors.js';

test('search handoff is bounded, agent-owned, one-shot, and browser paths are opaque/user-bound',async()=>{
  let now=10;const store=new AgentSearchCoordinator(()=>now,1,1000);const pending=store.create('clip','user-a');const job=store.claim('agent-a',true);assert.ok(job);
  assert.throws(()=>store.create('other','user-a'),(error:unknown)=>error instanceof BoundaryError&&error.code==='SEARCH_BUSY');
  assert.throws(()=>store.complete(job!.id,'agent-b',[{name:'clip.mp4',path:'D:\\Media\\clip.mp4',size:10}],'connected_media_found'),/Search request/);
  store.complete(job!.id,'agent-a',[{name:'clip.mp4',path:'D:\\Media\\clip.mp4',size:10}],'connected_media_found');
  const result=await pending;assert.match(result.items[0]!.fullpath,/^media:/);assert.equal(result.items[0]!.fullpath.includes('D:\\'),false);
  assert.equal(store.resolveSelection('user-a',result.items[0]!.fullpath),'D:\\Media\\clip.mp4');
  assert.throws(()=>store.resolveSelection('user-b',result.items[0]!.fullpath),(error:unknown)=>error instanceof BoundaryError&&error.code==='MEDIA_SELECTION_EXPIRED');
  assert.throws(()=>store.complete(job!.id,'agent-a',[],'connected_no_media'),(error:unknown)=>error instanceof BoundaryError&&error.code==='STALE_SEARCH_JOB');
});

test('search jobs expire, release capacity and never report timeout as an empty success',async()=>{
  let now=0;const store=new AgentSearchCoordinator(()=>now,1,100);const pending=store.create('needle','user');const rejected=assert.rejects(pending,(error:unknown)=>error instanceof BoundaryError&&error.code==='SEARCH_TIMEOUT');now=101;assert.equal(store.claim('agent',true),null);await rejected;const next=store.create('fresh','user');assert.equal(store.claim('agent',true)?.keyword,'fresh');void next.catch(()=>{});
});

test('Agents that do not advertise search capability cannot consume search jobs',async()=>{
  const store=new AgentSearchCoordinator(()=>0,1,1000);const pending=store.create('clip','user');
  assert.equal(store.claim('old-agent',false),null);
  assert.equal(store.claim('new-agent',true)?.keyword,'clip');
  void pending.catch(()=>{});
});

test('Agent search status differentiates no authorized result from service failure',async()=>{
  const store=new AgentSearchCoordinator();const first=store.create('none','u');const job=store.claim('a',true)!;store.complete(job.id,'a',[],'connected_no_media');assert.deepEqual(await first,{items:[],total:0});assert.equal(store.status().everything,'connected_no_media');
  const failed=store.create('x','u');const failure=assert.rejects(failed,(error:unknown)=>error instanceof BoundaryError&&error.code==='EVERYTHING_UNAVAILABLE');const next=store.claim('a',true)!;store.complete(next.id,'a',[],'unavailable','EVERYTHING_TIMEOUT');await failure;assert.equal(store.status().everything,'unavailable');
});

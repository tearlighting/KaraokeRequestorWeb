import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MediaPathResolver } from '../../media-agent/src/media-path.js';
import { searchEverything } from '../../media-agent/src/everything.js';

test('Everything query uses bounded JSON/path columns and returns only real files beneath configured media root',async()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-everything-'));const outside=mkdtempSync(join(tmpdir(),'yukari-outside-'));
  try{
    writeFileSync(join(root,'song.mp4'),'video');writeFileSync(join(outside,'escape.mp4'),'video');
    const resolver=new MediaPathResolver(root);let requested:URL|undefined;
    const fetcher=(async(input:URL|string|Request,init?:RequestInit)=>{requested=new URL(String(input));return new Response(JSON.stringify({totalResults:2,results:[{name:'song.mp4',path:root,size:5},{name:'escape.mp4',path:outside,size:5}]}),{status:200,headers:{'Content-Type':'application/json'}});}) as typeof fetch;
    const result=await searchEverything('song', 'http://127.0.0.1:81/',resolver,{fetcher});
    assert.equal(result.health,'connected_media_found');assert.equal(result.items.length,1);assert.equal(result.items[0]?.name,'song.mp4');
    assert.equal(requested?.searchParams.get('json'),'1');assert.equal(requested?.searchParams.get('count'),'50');assert.equal(requested?.searchParams.get('path_column'),'1');assert.equal(requested?.searchParams.get('size_column'),'1');
  }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});

test('Everything distinguishes HTTP reachability from invalid response and unavailable service',async()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-everything-empty-'));
  try{
    const resolver=new MediaPathResolver(root);
    const empty=await searchEverything('anything','http://127.0.0.1:81/',resolver,{fetcher:(async()=>new Response(JSON.stringify({totalResults:0,results:[]}))) as typeof fetch});
    assert.equal(empty.health,'connected_no_media');
    const denied=await searchEverything('anything','http://127.0.0.1:81/',resolver,{fetcher:(async()=>new Response('',{status:401})) as typeof fetch});
    assert.equal(denied.error,'EVERYTHING_AUTH_FAILED');assert.equal(denied.health,'unavailable');
    const malformed=await searchEverything('anything','http://127.0.0.1:81/',resolver,{fetcher:(async()=>new Response('<html>')) as typeof fetch});
    assert.equal(malformed.error,'EVERYTHING_INVALID_JSON');
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('Everything rejects non-http endpoint and errors stay path-free',async()=>{
  const root=mkdtempSync(join(tmpdir(),'yukari-everything-url-'));
  try{const result=await searchEverything('x','file:///secret',new MediaPathResolver(root));assert.equal(result.health,'unavailable');assert.equal(result.error,'EVERYTHING_CONFIG_INVALID');}
  finally{rmSync(root,{recursive:true,force:true});}
});

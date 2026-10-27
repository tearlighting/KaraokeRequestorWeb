import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireInstanceLock } from '../src/instance-lock.js';

test('lock rejects a live process without deleting its lock',()=>{const root=mkdtempSync(join(tmpdir(),'yukari-lock-'));const file=join(root,'agent.lock');try{writeFileSync(file,JSON.stringify({pid:42}));assert.throws(()=>acquireInstanceLock(file,43,()=>true),/already running/);assert.equal(JSON.parse(readFileSync(file,'utf8')).pid,42);}finally{rmSync(root,{recursive:true,force:true});}});
test('lock refuses an owner that cannot be confirmed exited',()=>{const root=mkdtempSync(join(tmpdir(),'yukari-lock-'));const file=join(root,'agent.lock');try{writeFileSync(file,JSON.stringify({pid:42}));assert.throws(()=>acquireInstanceLock(file,43,()=>{throw new Error('denied');}),/Cannot confirm/);assert.equal(JSON.parse(readFileSync(file,'utf8')).pid,42);}finally{rmSync(root,{recursive:true,force:true});}});
test('lock removes confirmed stale owner and cleans only its own lock',()=>{const root=mkdtempSync(join(tmpdir(),'yukari-lock-'));const file=join(root,'agent.lock');try{writeFileSync(file,JSON.stringify({pid:42}));const release=acquireInstanceLock(file,43,()=>false);assert.equal(JSON.parse(readFileSync(file,'utf8')).pid,43);release();assert.throws(()=>readFileSync(file));}finally{rmSync(root,{recursive:true,force:true});}});
test('malformed lock is preserved for manual process verification',()=>{const root=mkdtempSync(join(tmpdir(),'yukari-lock-'));const file=join(root,'agent.lock');try{writeFileSync(file,'partial');assert.throws(()=>acquireInstanceLock(file),/cannot be verified/);assert.equal(readFileSync(file,'utf8'),'partial');}finally{rmSync(root,{recursive:true,force:true});}});

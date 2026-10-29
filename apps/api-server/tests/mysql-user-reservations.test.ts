import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlRequestRepository, reservationViewState } from '../src/mysql-domain.js';

test('personal reservation reads are actor-scoped, paginated and omit media paths',async()=>{
  let sql='';let values:unknown[]=[];
  const store={rows:async(query:string,params:unknown[])=>{sql=query;values=params;return [{id:8,songfile:'song.mkv',singer:'Singer',kind:'動画',nowplaying:'未再生',reqorder:4,created_at:123,task_state:null,started_at:null,finished_at:null,error_code:null}];}} as unknown as MysqlStore;
  const result=await new MysqlRequestRepository(store).listOwned('actor-session-id',21,40);
  assert.deepEqual(values,['actor-session-id']);assert.match(sql,/LIMIT 21 OFFSET 40/);
  assert.match(sql,/s\.owner_id=\?/);assert.doesNotMatch(sql,/fullpath|media_path/i);
  assert.equal(result[0]?.songfile,'song.mkv');
});

test('personal reservation pagination clamps integers before embedding LIMIT and OFFSET',async()=>{
  let sql='';
  const store={rows:async(query:string)=>{sql=query;return [];}} as unknown as MysqlStore;
  await new MysqlRequestRepository(store).listOwned('actor-session-id',Number.MAX_SAFE_INTEGER,-1);
  assert.match(sql,/LIMIT 51 OFFSET 0/);
  await new MysqlRequestRepository(store).listOwned('actor-session-id',Number.NaN,Number.POSITIVE_INFINITY);
  assert.match(sql,/LIMIT 21 OFFSET 0/);
});

test('personal history uses stable status values across current and legacy reservation rows',()=>{
  assert.equal(reservationViewState('\u672a\u518d\u751f',null),'queued');
  assert.equal(reservationViewState('\u518d\u751f\u4e2d',null),'playing');
  assert.equal(reservationViewState('\u672a\u518d\u751f','failed'),'failed');
  assert.equal(reservationViewState('\u672a\u518d\u751f','uncertain'),'uncertain');
  assert.equal(reservationViewState('\u518d\u751f\u6e08',null),'completed');
});

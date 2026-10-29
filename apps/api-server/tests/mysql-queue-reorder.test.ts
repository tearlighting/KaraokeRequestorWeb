import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlQueueMutationRepository } from '../src/mysql-domain.js';

function makeStore(initial:Array<{id:number;nowplaying:string;reqorder:number}>){
  const rows=initial.map(row=>({...row}));const calls:string[]=[];
  type FakeConnection={execute:(sql:string,values?:unknown[])=>Promise<unknown>;query:(sql:string)=>Promise<unknown>};
  const connection: FakeConnection={
    execute:async(sql:string,values:unknown[]=[])=>{calls.push(sql);if(sql.startsWith('UPDATE reservation SET reqorder=')){const row=rows.find(item=>item.id===Number(values[1]));if(row)row.reqorder=Number(values[0]);}return [{affectedRows:1}];},
    query:async(sql:string)=>{calls.push(sql);return [rows.map(row=>({...row}))];},
  };
  const store={transaction:async<T>(fn:(connection:FakeConnection)=>Promise<T>)=>fn(connection)} as unknown as MysqlStore;
  return {store,rows,calls};
}

test('queue reorder locks the queue, preserves active rows, and applies a full unplayed permutation',async()=>{
  const fixture=makeStore([{id:10,nowplaying:'再生中',reqorder:1},{id:11,nowplaying:'未再生',reqorder:2},{id:12,nowplaying:'未再生',reqorder:3}]);
  const count=await new MysqlQueueMutationRepository(fixture.store).reorder([12,11]);
  assert.equal(count,2);assert.equal(fixture.calls[0], 'SELECT lock_id FROM queue_mutex WHERE lock_id=1 FOR UPDATE');
  assert.deepEqual(fixture.rows.map(row=>[row.id,row.reqorder]),[[10,1],[11,3],[12,2]]);
});

test('stale and duplicate queue reorder submissions fail instead of silently dropping IDs',async()=>{
  const fixture=makeStore([{id:1,nowplaying:'未再生',reqorder:1},{id:2,nowplaying:'未再生',reqorder:2}]);
  await assert.rejects(()=>new MysqlQueueMutationRepository(fixture.store).reorder([1,1]),(error:unknown)=>Boolean(error&&typeof error==='object'&&'code'in error&&(error as {code:string}).code==='INVALID_QUEUE_ORDER'));
  await assert.rejects(()=>new MysqlQueueMutationRepository(fixture.store).reorder([1]),(error:unknown)=>Boolean(error&&typeof error==='object'&&'code'in error&&(error as {code:string}).code==='QUEUE_CHANGED'));
  assert.deepEqual(fixture.rows.map(row=>row.reqorder),[1,2]);
});

test('a queue whose visible order changed after drag preview is rejected',async()=>{
  const fixture=makeStore([{id:2,nowplaying:'\u672a\u518d\u751f',reqorder:1},{id:1,nowplaying:'\u672a\u518d\u751f',reqorder:2}]);
  await assert.rejects(()=>new MysqlQueueMutationRepository(fixture.store).reorder([2,1],[1,2]),(error:unknown)=>Boolean(error&&typeof error==='object'&&'code'in error&&(error as {code:string}).code==='QUEUE_CHANGED'));
  assert.deepEqual(fixture.rows.map(row=>row.reqorder),[1,2]);
});

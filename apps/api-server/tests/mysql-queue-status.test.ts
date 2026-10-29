import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlQueueMutationRepository, MysqlQueueRepository } from '../src/mysql-domain.js';

function row(id:number,status:string){return {id,songfile:`track-${id}`,fullpath:`Z:/private/track-${id}.mp4`,singer:'Requester',comment:'',kind:'動画',reqorder:id,nowplaying:status,secret:1,loop:0,pause:0,track:0,keychange:0,audiodelay:0,duration:20,volume:0,song_name:'metadata',lister_artist:'',lister_work:'',lister_op_ed:'',lister_comment:'',clientip:'192.0.2.1',clientua:'legacy-browser'};}

test('MySQL queue projects old mojibake playback values into the React contract and keeps secret masking',async()=>{
  const rows=[row(2,'譛ｪ蜀咲函'),row(1,'未再生')];
  const store={pool:{query:async()=>[rows]}} as unknown as MysqlStore;
  const result=await new MysqlQueueRepository(store).read({secret_text:'Secret reservation',ip:'198.51.100.3',ua:'other-browser',role:'user'},0,0,true);
  assert.equal(result.total,2);
  assert.equal(result.remaining_count,2);
  assert.deepEqual(result.items.map(item=>item.nowplaying),['未再生','未再生']);
  assert.deepEqual(result.items.map(item=>item.songfile),['Secret reservation','Secret reservation']);
  assert.deepEqual((result as unknown as {items:Array<{masked:number;fullpath:string}>}).items.map(item=>[item.masked,item.fullpath]),[[1,''],[1,'']]);
});

test('User active queue scope contains only queued and confirmed playing requests, with server pagination',async()=>{
  const rows=[row(5,'再生済'),row(4,'再生中'),row(3,'再生開始待ち'),row(2,'譛ｪ蜀咲函'),row(1,'再生失敗')];
  const store={pool:{query:async()=>[rows]}} as unknown as MysqlStore;
  const repository=new MysqlQueueRepository(store);
  const context={secret_text:'Secret',ip:'192.0.2.1',ua:'legacy-browser',role:'user' as const};
  const first=await repository.read(context,2,0,false,false,true);
  assert.equal(first.total,3);
  assert.equal(first.remaining_count,1);
  assert.deepEqual(first.items.map(item=>item.id),[4,3]);
  assert.equal(first.has_more,true);
  const second=await repository.read(context,2,2,false,false,true);
  assert.deepEqual(second.items.map(item=>item.id),[2]);
  assert.equal(second.has_more,false);
});

test('reservation comments are returned only in the explicit admin queue projection',async()=>{
  const rows=[{...row(7,'未再生'),comment:'Please start with the chorus'}];
  const store={pool:{query:async()=>[rows]}} as unknown as MysqlStore;
  const repository=new MysqlQueueRepository(store);
  const publicQueue=await repository.read({secret_text:'Private',ip:'192.0.2.1',ua:'legacy-browser',role:'user'});
  assert.equal('comment' in publicQueue.items[0]!,false,'public React queue does not receive reservation notes');
  const adminQueue=await repository.read({secret_text:'Private',ip:'192.0.2.1',ua:'legacy-browser',role:'admin'},0,0,false,true);
  assert.equal((adminQueue.items[0] as {comment?:string}|undefined)?.comment,'Please start with the chorus');
});

test('admin reservation note update is serialized by queue_mutex and updates only the selected row',async()=>{
  const calls:Array<{sql:string;params:unknown[]}> = [];
  const connection={execute:async(sql:string,params:unknown[]=[]):Promise<unknown>=>{calls.push({sql,params});return sql.startsWith('SELECT id FROM reservation')?[[{id:7}],[]]:[{affectedRows:1},[]];}};
  const store={transaction:async<T>(run:(connection:never)=>Promise<T>)=>run(connection as never)} as unknown as MysqlStore;
  const result=await new MysqlQueueMutationRepository(store).updateComment(7,'Singer requested the second verse');
  assert.deepEqual(result,{id:7,comment:'Singer requested the second verse',updated:true});
  assert.equal(calls[0]?.sql,'SELECT lock_id FROM queue_mutex WHERE lock_id=1 FOR UPDATE');
  assert.deepEqual(calls.at(-1),{sql:'UPDATE reservation SET comment=? WHERE id=?',params:['Singer requested the second verse',7]});
});

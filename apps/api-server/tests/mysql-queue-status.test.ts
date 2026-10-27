import test from 'node:test';
import assert from 'node:assert/strict';
import type { MysqlStore } from '../src/mysql.js';
import { MysqlQueueRepository } from '../src/mysql-domain.js';

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

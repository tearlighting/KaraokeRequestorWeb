import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TestAgent, assertIsolatedWrites, phpBase } from '../../../packages/test-support/src/client.js';

test('Legacy bulk reorder/undo operation is available only through admin-authorized Node transaction',async(t)=>{
  assertIsolatedWrites();
  const admin=new TestAgent();await admin.admin();const original=(await admin.call('/admin/queue')).body.data;
  const status=(await admin.call('/admin/status')).body.data;
  if(status.playback||status.mpc_reachable||status.foobar_reachable){t.skip('active player avoids queue reorder writes');return;}
  const ordered=original.items.map((item:{reqorder:number})=>item.reqorder).sort((a:number,b:number)=>a-b);
  if(ordered.some((value:number,index:number)=>value!==index+1)){t.skip('non-contiguous queue avoids normalization regression');return;}
  const user=new TestAgent();await user.user();const outsider=new TestAgent();await outsider.user();
  assert.equal((await outsider.call('/admin/queue/reorder','POST',{ids:[]})).status,401);
  const token=`BulkOrder_${randomUUID()}`;const ids:number[]=[];
  try{
    for(const name of ['first','second']){
      const created=await user.call('/requests','POST',{filename:`${token}_${name}`,singer:token,comment:'isolated bulk reorder',kind:'小休止',fullpath:'',secret:1});
      assert.equal(created.status,201,created.body.error?.message);ids.push(created.body.data.id);
    }
    const reorderIds=[...ids].reverse();
    const denied=await fetch(`${phpBase}/requestlist_reorder.php`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:reorderIds})});
    assert.equal(denied.status,410);
    const response=await admin.call('/admin/queue/reorder','POST',{ids:reorderIds});
    assert.equal(response.status,200,response.body.error?.message);assert.equal(response.headers.get('x-yukari-owner'),'node-queue-mutation');assert.equal(response.body.data.count,2);
    const after=(await admin.call('/admin/queue')).body.data.items.filter((item:{id:number})=>ids.includes(item.id)).map((item:{id:number})=>item.id);
    assert.deepEqual(after,reorderIds);
  }finally{
    for(const id of ids)await admin.call(`/admin/requests/${id}`,'DELETE',{});
    assert.deepEqual((await admin.call('/admin/queue')).body.data,original);
  }
});

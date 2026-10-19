import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TestAgent, assertIsolatedWrites } from '../../../packages/test-support/src/client.js';

test('真实 API 并发重试使用同一幂等凭据只创建一条预约和一条历史',async()=>{
  assertIsolatedWrites();
  const admin=new TestAgent();await admin.admin();
  const original=(await admin.call('/admin/queue')).body.data;
  const user=new TestAgent();await user.user();
  const intent=await user.call('/requests/intent','POST',{});assert.equal(intent.status,200);
  const token=`Idempotency_${randomUUID()}`;
  const body={filename:token,singer:token,comment:'same durable receipt',kind:'小休止',fullpath:'',secret:1};
  try{
    const headers={'X-Yukari-Submission':intent.body.data.receipt};
    const [a,b]=await Promise.all([user.call('/requests','POST',body,headers),user.call('/requests','POST',body,headers)]);
    assert.equal(a.status,201,a.body.error?.message);assert.equal(b.status,201,b.body.error?.message);
    assert.equal(a.body.data.id,b.body.data.id);
    const queue=(await admin.call('/admin/queue')).body.data;
    assert.equal(queue.total,original.total+1);
    const row=queue.items.find((item:{id:number})=>item.id===a.body.data.id);assert.ok(row);
    assert.equal(row.singer,token);
    assert.equal((await admin.call(`/admin/requests/${row.id}`,'DELETE',{})).status,200);
    assert.deepEqual((await admin.call('/admin/queue')).body.data,original);
  }finally{
    const after=(await admin.call('/admin/queue')).body.data;
    for(const row of after.items.filter((item:{singer:string})=>item.singer===token)) await admin.call(`/admin/requests/${row.id}`,'DELETE',{});
    assert.deepEqual((await admin.call('/admin/queue')).body.data,original);
  }
});

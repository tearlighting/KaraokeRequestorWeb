import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { TestAgent, phpBase, testConfigPath, testCredentials, assertIsolatedWrites } from '../../../packages/test-support/src/client.js';

test('隔离真实 API：Node 写 Owner、通知计数、历史不变、并发删除、旧入口无副作用关闭', async () => {
  assertIsolatedWrites();
  const root = dirname(String(testConfigPath));
  const notice = new DatabaseSync(join(root, 'updatenotice.db'), { readOnly: true });
  const db = new DatabaseSync(join(root, 'runtime/queue/request.db'), { readOnly: true });
  const counter = () => Number(notice.prepare('SELECT requestlist FROM updatenoticetable').get()!.requestlist);
  const increment = (n: number) => n < 50000 ? n + 1 : 0;
  const admin = new TestAgent(), user = new TestAgent(); await admin.admin(); await user.user();
  const created = await user.call('/requests', 'POST', { filename: 'Phase7 isolated notification test', fullpath: '', singer: 'Phase7Fixture', comment: '', kind: '小休止' });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  const snapshot = () => db.prepare('SELECT * FROM requesttable ORDER BY id').all();
  try {
    const history = db.prepare('SELECT * FROM mypage_history ORDER BY rowid').all();
    for (const action of ['up','down','warikomi']) {
      const before = counter();
      const result = await admin.call(`/admin/requests/${id}/move`, 'POST', { action });
      assert.equal(result.status, 200, result.body.error?.message);
      assert.equal(result.headers.get('x-yukari-owner'), 'node-queue-mutation');
      assert.equal(counter(), increment(before));
      assert.deepEqual(db.prepare('SELECT * FROM mypage_history ORDER BY rowid').all(), history);
    }
    const rows = snapshot(), before = counter();
    for (const path of ['/admin/requests/0','/admin/requests/-1','/admin/requests/not-an-id']) {
      assert.equal((await admin.call(path,'DELETE',{})).status,400);
    }
    assert.equal((await admin.call(`/admin/requests/${id}/move`,'POST',{action:'invalid'})).status,400);
    assert.deepEqual(snapshot(),rows); assert.equal(counter(),before);

    const basic = 'Basic ' + Buffer.from('admin:' + testCredentials().password).toString('base64');
    for (const path of ['/delete.php?id='+id, '/api/request_delete.php?id='+id, '/api/request_move.php?id='+id+'&action=up',
      '/requestlist_reorder.php', '/listclear.php', '/listimport.php', '/update.php?id='+id+'&reqorder=999',
      '/api/admin.php?operation=delete', '/api/admin.php?operation=move']) {
      const response = await fetch(phpBase + path, { method: 'POST', headers: { Authorization: basic,
        'X-Yukari-Admin':'1', 'Content-Type':'application/x-www-form-urlencoded' }, body: 'id='+id });
      assert.equal(response.status, 410, path);
    }
    assert.deepEqual(snapshot(), rows); assert.equal(counter(), before);
    const results = await Promise.all([admin.call(`/admin/requests/${id}`, 'DELETE', {}), admin.call(`/admin/requests/${id}`, 'DELETE', {})]);
    assert.deepEqual(results.map(r=>r.status).sort(), [200,404]);
    assert.equal(counter(), increment(before));
    assert.deepEqual(db.prepare('SELECT * FROM mypage_history ORDER BY rowid').all(), history);
  } finally {
    if (db.prepare('SELECT id FROM requesttable WHERE id=?').get(id)) await admin.call(`/admin/requests/${id}`, 'DELETE', {});
    db.close(); notice.close();
  }
});

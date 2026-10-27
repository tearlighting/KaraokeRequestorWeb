import test from 'node:test';
import assert from 'node:assert/strict';
import { MysqlRequestService } from '../src/mysql-domain.js';

test('MySQL reservations do not invoke a Legacy SQLite notifier and report that compatibility refresh is disabled', async () => {
  let acknowledged: unknown;
  const result = { id: 7, committed: true as const, operation: 'create' as const, warnings: [], notification: 'unconfirmed' as const };
  const repository = {
    commit: async () => ({ result: { ...result, warnings: [] }, replayed: false }),
    acknowledge: async (_key: string, value: unknown) => { acknowledged = value; return true; },
  };
  const receipts = { verify: () => 'hashed-receipt' };
  const service = new MysqlRequestService(repository as never, receipts);
  const noLegacyNotifier = await service.submit({} as never, {} as never, 'opaque-receipt', undefined);
  assert.equal(noLegacyNotifier.result.notification, 'unconfirmed');
  assert.match(noLegacyNotifier.result.warnings.join(' '), /Legacy SQLite live-refresh notification is disabled/);
  assert.ok(acknowledged);
});

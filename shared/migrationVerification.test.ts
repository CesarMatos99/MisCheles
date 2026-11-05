import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyMigratedRecord } from './migrationVerification.ts';
test('verifies financial contents and document identity after copying a migration', () => {
  const expected = { amountMinor: 15000, relatedSavingsMovementId: 'saving', limits: [{ category: 'Food', amountMinor: 9000 }] };
  const actual = { ...expected, id: 'doc', ownerUid: 'owner', schemaVersion: 1, origin: 'local_migration', sourceEntity: 'transactions', localSourceId: 'source' };
  const check = (data: Record<string, unknown>, id = 'doc') => verifyMigratedRecord({ uid: 'owner', collection: 'transactions', sourceId: 'source', documentId: 'doc', actualDocumentId: id, expected, actual: data });
  assert.equal(check(actual), true);
  for (const patch of [{ amountMinor: 14999 }, { relatedSavingsMovementId: 'other' }, { limits: [{ category: 'Food', amountMinor: 8999 }] }, { ownerUid: 'other' }, { sourceEntity: 'savingsMovements' }]) assert.equal(check({ ...actual, ...patch }), false);
  assert.equal(check(actual, 'other'), false);
  const missing: Record<string, unknown> = { ...actual }; delete missing.amountMinor;
  assert.equal(check(missing), false);
});

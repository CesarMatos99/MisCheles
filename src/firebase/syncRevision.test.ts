import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudRevision, isStaleCloudWrite } from './syncRevision.ts';

test('normalizes timestamp revisions and treats missing or changed baselines as stale', () => {
  assert.equal(cloudRevision({ updatedAt: { seconds: 12, nanoseconds: 99, toMillis: () => 12000 } }), 'time:12:99');
  const remote = { updatedAt: { toMillis: () => 1200 } };
  assert.equal(cloudRevision(remote), 'time:1200');
  assert.equal(isStaleCloudWrite('time:1200', remote), false);
  assert.equal(isStaleCloudWrite('time:1100', remote), true);
  assert.equal(isStaleCloudWrite(null, remote), true);
  assert.equal(isStaleCloudWrite('time:1200', null), true);
  assert.equal(isStaleCloudWrite(null, null), false);
  const legacy = { id: 'record', amountMinor: 100 };
  const legacyRevision = cloudRevision(legacy);
  assert.ok(legacyRevision?.startsWith('content:'));
  assert.equal(isStaleCloudWrite(legacyRevision, legacy), false);
  assert.equal(isStaleCloudWrite(legacyRevision, { ...legacy, amountMinor: 200 }), true);
});


test('matches shared cloud revision vectors for legacy documents', () => {
  const vectors = JSON.parse(readFileSync('shared/revision_contract_vectors.json', 'utf8')) as Array<{ record: Record<string, unknown>; expected: string }>;
  for (const vector of vectors) assert.equal(cloudRevision(vector.record), vector.expected);
});

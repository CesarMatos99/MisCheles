import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decodeFirestoreRecord, encodeFirestoreRecord } from './firestoreCodec.ts';
import { cloudRevision } from './syncRevision.ts';

test('normalizes Firestore instants while preserving date-only and revision precision', () => {
  const created = { seconds: 1_798_675_200, nanoseconds: 123_000_000 };
  const updated = { seconds: 1_798_675_201, nanoseconds: 456_000_000, toDate: () => new Date(1_798_675_201_456) };
  const decoded = decodeFirestoreRecord('movement-1', { createdAt: created, updatedAt: updated, occurredOn: '2026-12-31', monthKey: '2026-12', amountMinor: 1234 });
  assert.equal(decoded.id, 'movement-1');
  assert.equal(decoded.createdAt, '2026-12-31T00:00:00.123Z');
  assert.equal(decoded.updatedAt, '2026-12-31T00:00:01.456Z');
  assert.equal(decoded._cloudRevision, 'time:1798675201:456000000');
  assert.equal(decoded.occurredOn, '2026-12-31');
  assert.equal(decoded.monthKey, '2026-12');
});

test('leaves existing ISO migration instants intact', () => {
  const decoded = decodeFirestoreRecord('legacy-1', { createdAt: '2025-01-01T12:30:00.000Z', updatedAt: '2025-01-02T12:30:00.000Z' });
  assert.equal(decoded.createdAt, '2025-01-01T12:30:00.000Z');
  assert.equal(decoded.updatedAt, '2025-01-02T12:30:00.000Z');
  assert.equal(decoded._cloudRevision, cloudRevision({ createdAt: '2025-01-01T12:30:00.000Z', updatedAt: '2025-01-02T12:30:00.000Z', id: 'legacy-1' }));
});


test('strips client-only sync metadata before a Firestore write', () => {
  const encoded = encodeFirestoreRecord({ id: 'doc-1', ownerUid: 'uid-1', schemaVersion: 1, _cloudRevision: 'time:1:2', cloudDocumentId: 'doc-1', amountMinor: 123 });
  assert.deepEqual(encoded, { id: 'doc-1', ownerUid: 'uid-1', schemaVersion: 1, amountMinor: 123 });
});


test('normalizes legacy savings mirror kinds by their Firestore collection', () => {
  const fixture = JSON.parse(readFileSync(new URL('./savings_mirror_record_vectors.json', import.meta.url), 'utf8'));
  for (const item of fixture.cases) {
    const decoded = decodeFirestoreRecord('record-1', { kind: item.storedKind }, item.collection);
    assert.equal(decoded.kind, item.expectedKind, item.name);
  }
});

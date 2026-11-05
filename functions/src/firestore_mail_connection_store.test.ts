import assert from 'node:assert/strict';
import test from 'node:test';
import { FirestoreMailConnectionMetadataStore, mailConnectionMetadataDocument, maskMailAddress, type MailConnectionMetadataInput } from './firestore_mail_connection_store.ts';

const base: MailConnectionMetadataInput = {
  provider: 'gmail', emailAddress: 'Mateo.Example@gmail.com',
  grantedScopes: ['gmail.readonly', 'openid', 'openid'], status: 'active',
  connectedAt: '2026-11-01T12:00:00.000Z', lastSyncAt: '2026-11-01T12:10:00.000Z',
};

test('masks mailbox address before it enters account metadata', () => {
  assert.equal(maskMailAddress('Mateo.Example@gmail.com'), 'm***@gmail.com');
  assert.throws(() => maskMailAddress('not-an-email'), /address is invalid/);
});

test('metadata builder allows only sanitized, deduplicated connection fields', () => {
  const input = { ...base, accessToken: 'must-not-persist', refreshToken: 'must-not-persist', cursor: 'provider-secret' };
  const record = mailConnectionMetadataDocument('connection-1', 'uid-1', input, 'created', 'updated');
  assert.deepEqual(Object.keys(record).sort(), [
    'connectedAt', 'createdAt', 'grantedScopes', 'id', 'lastSyncAt', 'maskedAddress',
    'ownerUid', 'provider', 'schemaVersion', 'status', 'updatedAt',
  ].sort());
  assert.equal(record.maskedAddress, 'm***@gmail.com');
  assert.deepEqual(record.grantedScopes, ['gmail.readonly', 'openid']);
  assert.equal(JSON.stringify(record).includes('Mateo.Example@gmail.com'), false);
  assert.equal(JSON.stringify(record).includes('must-not-persist'), false);
  assert.equal(JSON.stringify(record).includes('provider-secret'), false);
});

test('rejects invalid owner, status, provider, timestamps and excessive scope metadata', () => {
  assert.throws(() => mailConnectionMetadataDocument('a/b', 'uid-1', base, 1, 2), /owner or ID/);
  assert.throws(() => mailConnectionMetadataDocument('a', 'uid/1', base, 1, 2), /owner or ID/);
  assert.throws(() => mailConnectionMetadataDocument('a', 'uid-1', { ...base, status: 'active-ish' } as never, 1, 2), /status/);
  assert.throws(() => mailConnectionMetadataDocument('a', 'uid-1', { ...base, provider: 'other' } as never, 1, 2), /provider/);
  assert.throws(() => mailConnectionMetadataDocument('a', 'uid-1', { ...base, connectedAt: 'yesterday' }, 1, 2), /timestamps/);
  assert.throws(() => mailConnectionMetadataDocument('a', 'uid-1', { ...base, grantedScopes: Array(21).fill('scope') }, 1, 2), /scope metadata/);
});

test('Firestore writer stores only under the UID mailbox path and preserves creation time', async () => {
  const documents = new Map<string, Record<string, unknown>>();
  let timestampCount = 0;
  const ref = (path: string) => ({
    path,
    collection: (name: string) => collection(path + '/' + name),
    get: async () => { const value = documents.get(path); return { exists: !!value, data: () => value }; },
    delete: async () => { documents.delete(path); },
  });
  const collection = (path: string) => ({ doc: (id: string) => ref(path + '/' + id) });
  const db = {
    collection: (name: string) => collection(name),
    runTransaction: async (operation: (transaction: any) => Promise<unknown>) => {
      const writes: Array<() => void> = [];
      const transaction = {
        get: async (document: { path: string }) => { const value = documents.get(document.path); return { exists: !!value, data: () => value }; },
        set: (document: { path: string }, value: Record<string, unknown>) => writes.push(() => documents.set(document.path, value)),
      };
      const result = await operation(transaction);
      writes.forEach((write) => write());
      return result;
    },
  };
  const store = new FirestoreMailConnectionMetadataStore(db as never, () => 'server-' + (++timestampCount));
  await store.upsert('uid-1', 'connection-1', base);
  const key = 'users/uid-1/mailConnections/connection-1';
  assert.equal(documents.get(key)?.createdAt, 'server-1');
  assert.equal(documents.get(key)?.updatedAt, 'server-2');
  await store.upsert('uid-1', 'connection-1', { ...base, lastSyncAt: '2026-11-01T12:20:00.000Z' });
  assert.equal(documents.get(key)?.createdAt, 'server-1');
  assert.equal(documents.get(key)?.updatedAt, 'server-3');
  assert.equal(await store.isActive('uid-1', 'connection-1', 'gmail'), true);
  assert.equal(await store.isActive('uid-2', 'connection-1', 'gmail'), false);
  assert.equal(await store.isActive('uid-1', 'connection-1', 'outlook'), false);
  await store.delete('uid-1', 'connection-1');
  assert.equal(documents.has(key), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreMailSyncCheckpointStore } from './firestore_mail_sync_checkpoint_store.ts';
import type { MailSyncCheckpoint } from './mail_sync_contract.ts';

class FakeFirestore {
  documents = new Map<string, Record<string, unknown>>();
  private reference(path: string) {
    return { path, get: async () => { const data = this.documents.get(path); return { exists: Boolean(data), data: () => data }; } };
  }
  collection(name: string) {
    return { doc: (id: string) => ({
      ...this.reference(name + '/' + id),
      collection: (child: string) => ({ doc: (childId: string) => this.reference(name + '/' + id + '/' + child + '/' + childId) }),
    }) };
  }
  async runTransaction<T>(operation: (transaction: any) => Promise<T>): Promise<T> {
    return operation({
      get: async (reference: { path: string }) => { const data = this.documents.get(reference.path); return { exists: Boolean(data), data: () => data }; },
      set: (reference: { path: string }, data: Record<string, unknown>) => this.documents.set(reference.path, data),
    });
  }
}
const initial: MailSyncCheckpoint = { uid: 'uid-1', connectionId: 'connection-1', provider: 'gmail', revision: 1, initialized: true, cursor: 'history-1', lastSyncAtMs: 1_800_000_000_000 };

test('Firestore checkpoint is private, owner-scoped and compare-and-set', async () => {
  const db = new FakeFirestore();
  const store = new FirestoreMailSyncCheckpointStore(db as unknown as Firestore);
  assert.equal(await store.read('uid-1', 'connection-1'), null);
  assert.equal(await store.compareAndSet('uid-1', 'connection-1', null, initial), true);
  assert.deepEqual(await store.read('uid-1', 'connection-1'), initial);
  assert.equal(await store.compareAndSet('uid-1', 'connection-1', null, { ...initial, revision: 1, cursor: 'stale' }), false);
  const next = { ...initial, revision: 2, cursor: 'history-2', lastSyncAtMs: initial.lastSyncAtMs + 1 };
  assert.equal(await store.compareAndSet('uid-1', 'connection-1', 1, next), true);
  assert.equal((await store.read('uid-1', 'connection-1'))?.cursor, 'history-2');
  assert.equal(db.documents.has('privateMailTokens/uid-1/syncState/connection-1'), true);
});

test('malformed checkpoint paths, owners, providers, and cursors are rejected', async () => {
  const db = new FakeFirestore(); const store = new FirestoreMailSyncCheckpointStore(db as unknown as Firestore);
  await assert.rejects(store.read('bad/uid', 'connection-1'), /path/);
  await assert.rejects(store.compareAndSet('uid-1', 'connection-1', null, { ...initial, uid: 'uid-2' }), /owner/);
  await assert.rejects(store.compareAndSet('uid-1', 'connection-1', null, { ...initial, cursor: 'bad\nvalue' }), /invalid/);
});

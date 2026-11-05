import assert from 'node:assert/strict';
import test from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { MAIL_OAUTH_STATE_TTL_MS, type PendingMailAuthorization } from './mail_oauth_flow.ts';
import { deleteExpiredMailOAuthStates, deletePendingMailOAuthStatesForUid, FirestoreMailOAuthStateStore } from './firestore_mail_oauth_state_store.ts';

class FakeFirestore {
  readonly documents = new Map<string, Record<string, unknown>>();
  collection(name: string) {
    const collection = { doc: (id: string) => ({ collection: name, id, path: name + '/' + id }) };
    return Object.assign(collection, {
      where: (field: string, _operator: string, value: unknown) => ({
        limit: (_count: number) => ({ get: async () => {
          const docs = [...this.documents.entries()].filter(([, data]) => _operator === '==' ? data[field] === value : typeof data[field] === 'number' && data[field] <= Number(value)).map(([path, data]) => ({ ref: { path }, data: () => data }));
          return { docs, size: docs.length, empty: docs.length === 0 };
        } }),
      }),
    });
  }
  batch() {
    const deletes: string[] = [];
    return { delete: (ref: { path: string }) => deletes.push(ref.path), commit: async () => { for (const path of deletes) this.documents.delete(path); } };
  }
  async runTransaction<T>(operation: (transaction: any) => Promise<T>): Promise<T> {
    const creates: Array<{ path: string; data: Record<string, unknown> }> = [];
    const deletes: string[] = [];
    const result = await operation({
      get: async (reference: { path: string }) => {
        const data = this.documents.get(reference.path);
        return { exists: Boolean(data), data: () => data };
      },
      create: (reference: { path: string }, data: Record<string, unknown>) => creates.push({ path: reference.path, data }),
      delete: (reference: { path: string }) => deletes.push(reference.path),
    });
    for (const path of deletes) this.documents.delete(path);
    for (const item of creates) {
      if (this.documents.has(item.path)) throw new Error('already exists');
      this.documents.set(item.path, item.data);
    }
    return result;
  }
}

const pending: PendingMailAuthorization = {
  stateHash: 'a'.repeat(64), connectionId: 'connection-1', uid: 'uid-1', provider: 'gmail',
  codeVerifier: 'B'.repeat(43), redirectUri: 'https://app.example.com/callback',
  scopes: ['openid', 'mail.readonly'], createdAtMs: 1_800_000_000_000,
  expiresAtMs: 1_800_000_000_000 + MAIL_OAUTH_STATE_TTL_MS,
};

test('Firestore OAuth state is backend-only, consumed once, and validates its record', async () => {
  const db = new FakeFirestore();
  const store = new FirestoreMailOAuthStateStore(db as unknown as Firestore);
  await store.create(pending);
  const stored = db.documents.get('privateMailOAuthStates/' + pending.stateHash)!;
  assert.equal(stored.uid, pending.uid);
  assert.equal(stored.state, undefined);
  assert.equal(stored.expiresAt instanceof Date, true);
  assert.deepEqual(await store.consume(pending.stateHash, pending.createdAtMs + 1), pending);
  assert.equal(await store.consume(pending.stateHash, pending.createdAtMs + 2), null);
  assert.equal(db.documents.size, 0);
});

test('expired and malformed Firestore state is removed and never returned', async () => {
  const db = new FakeFirestore();
  const store = new FirestoreMailOAuthStateStore(db as unknown as Firestore);
  await store.create(pending);
  assert.equal(await store.consume(pending.stateHash, pending.expiresAtMs), null);
  assert.equal(db.documents.size, 0);
  assert.equal(await store.consume('bad-hash', pending.createdAtMs), null);
});

test('invalid verifier, owner, scope, and lifetime cannot be persisted', async () => {
  const db = new FakeFirestore();
  const store = new FirestoreMailOAuthStateStore(db as unknown as Firestore);
  await assert.rejects(store.create({ ...pending, codeVerifier: 'short' }), /invalid/);
  await assert.rejects(store.create({ ...pending, uid: 'bad/uid' }), /invalid/);
  await assert.rejects(store.create({ ...pending, scopes: [] }), /invalid/);
  await assert.rejects(store.create({ ...pending, expiresAtMs: pending.createdAtMs + 1000 }), /invalid/);
  assert.equal(db.documents.size, 0);
});

test('account deletion removes pending OAuth state only for the selected UID', async () => {
  const db = new FakeFirestore();
  const store = new FirestoreMailOAuthStateStore(db as unknown as Firestore);
  await store.create(pending);
  await store.create({ ...pending, uid: 'uid-2', stateHash: 'b'.repeat(64) });
  const removed = await deletePendingMailOAuthStatesForUid(db as unknown as Firestore, 'uid-1');
  assert.equal(removed, 1);
  assert.equal(db.documents.has('privateMailOAuthStates/' + pending.stateHash), false);
  assert.equal(db.documents.has('privateMailOAuthStates/' + 'b'.repeat(64)), true);
  await assert.rejects(deletePendingMailOAuthStatesForUid(db as unknown as Firestore, 'bad/uid'), /UID/);
});

test('scheduled cleanup removes only expired OAuth state', async () => {
  const db = new FakeFirestore();
  const store = new FirestoreMailOAuthStateStore(db as unknown as Firestore);
  await store.create(pending);
  await store.create({ ...pending, uid: 'uid-2', stateHash: 'c'.repeat(64), createdAtMs: pending.expiresAtMs, expiresAtMs: pending.expiresAtMs + MAIL_OAUTH_STATE_TTL_MS });
  assert.equal(await deleteExpiredMailOAuthStates(db as unknown as Firestore, pending.expiresAtMs), 1);
  assert.equal(db.documents.size, 1);
  await assert.rejects(deleteExpiredMailOAuthStates(db as unknown as Firestore, -1), /time/);
});

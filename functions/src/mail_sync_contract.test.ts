import assert from 'node:assert/strict';
import test from 'node:test';
import type { MailProvider } from './mail_import_contract.ts';
import { syncMailConnection, MailSyncConflictError, type MailSyncCheckpoint, type MailSyncCheckpointStore, type MailProviderDeltaSource } from './mail_sync_contract.ts';

class MemoryCheckpointStore implements MailSyncCheckpointStore {
  value: MailSyncCheckpoint | null = null;
  conflict = false;
  async read() { return this.value ? structuredClone(this.value) : null; }
  async compareAndSet(_uid: string, _connectionId: string, expected: number | null, next: MailSyncCheckpoint) {
    if (this.conflict || (this.value?.revision ?? null) !== expected) return false;
    this.value = structuredClone(next); return true;
  }
}
class MemoryCandidateStore { values = new Set<string>(); }
const message = (providerMessageId: string, day = '2026-11-01') => ({ provider: 'gmail' as const, providerMessageId, receivedAt: day + 'T10:00:00.000Z' });
const auth = { uid: 'uid-1', token: { email_verified: true } };
const notice = { transactionType: 'expense' as const, occurredOn: '2026-11-01', amountMinor: 1250, currency: 'USD', merchant: 'Market', description: 'Bank card purchase' };
const dependencies = (checkpointStore: MemoryCheckpointStore, persistence: MemoryCandidateStore, source: MailProviderDeltaSource, reader = { async readProviderNotice() { return notice; } }) => ({
  auth, connectionId: 'connection-1', provider: 'gmail' as const, checkpointStore, source,
  tokenVault: { async getValidAccessToken() { return 'private-token'; }, async revoke() {} },
  processMessage: async (item: { providerMessageId: string }) => { const parsed = await reader.readProviderNotice(); if (!parsed) return 'ignored' as const; if (persistence.values.has(item.providerMessageId)) return 'duplicate' as const; persistence.values.add(item.providerMessageId); return 'candidate_created' as const; },
  now: () => 1_800_000_000_000,
});

test('sync checkpoints each bounded page and resumes without duplicating candidates', async () => {
  const checkpointStore = new MemoryCheckpointStore(); const persistence = new MemoryCandidateStore();
  let calls = 0;
  const source: MailProviderDeltaSource = { async fetchPage(input) {
    calls += 1;
    if (!input.initialized) return { messages: [message('m1'), message('m2')], initialized: true, nextCursor: 'page-2', hasMore: true };
    assert.equal(input.cursor, 'page-2');
    return { messages: [message('m3')], initialized: true, nextCursor: 'history-7', hasMore: false };
  } };
  const first = await syncMailConnection({ ...dependencies(checkpointStore, persistence, source), maxPages: 1 });
  assert.equal(first.complete, false); assert.equal(first.pages, 1); assert.equal(first.candidatesCreated, 2);
  assert.equal(checkpointStore.value?.cursor, 'page-2');
  const second = await syncMailConnection(dependencies(checkpointStore, persistence, source));
  assert.equal(second.complete, true); assert.equal(second.pages, 1); assert.equal(second.candidatesCreated, 1);
  assert.equal(checkpointStore.value?.cursor, 'history-7'); assert.equal(checkpointStore.value?.revision, 2);
  assert.equal(calls, 2); assert.equal(persistence.values.size, 3);
});

test('failed candidate processing leaves the checkpoint unchanged for safe retry', async () => {
  const checkpointStore = new MemoryCheckpointStore(); const persistence = new MemoryCandidateStore();
  const source: MailProviderDeltaSource = { async fetchPage() { return { messages: [message('m1')], initialized: true, nextCursor: 'next', hasMore: false }; } };
  const reader = { async readProviderNotice() { throw new Error('provider parse failure'); } };
  await assert.rejects(syncMailConnection({ ...dependencies(checkpointStore, persistence, source, reader), processMessage: async () => { throw new Error('provider parse failure'); } }), /parse failure/);
  assert.equal(checkpointStore.value, null); assert.equal(persistence.values.size, 0);
});

test('concurrent checkpoint modification is surfaced instead of overwriting cursor state', async () => {
  const checkpointStore = new MemoryCheckpointStore(); checkpointStore.conflict = true;
  const persistence = new MemoryCandidateStore();
  const source: MailProviderDeltaSource = { async fetchPage() { return { messages: [], initialized: true, nextCursor: 'next', hasMore: false }; } };
  await assert.rejects(syncMailConnection(dependencies(checkpointStore, persistence, source)), MailSyncConflictError);
  assert.equal(checkpointStore.value, null);
});

test('unverified owner, cross-provider messages, and non-advancing pages are rejected', async () => {
  const checkpointStore = new MemoryCheckpointStore(); const persistence = new MemoryCandidateStore();
  const wrongProvider: MailProviderDeltaSource = { async fetchPage() { return { messages: [{ ...message('m1'), provider: 'outlook' }], initialized: true, nextCursor: 'next', hasMore: false }; } };
  await assert.rejects(syncMailConnection({ ...dependencies(checkpointStore, persistence, wrongProvider) }), /message reference/);
  await assert.rejects(syncMailConnection({ ...dependencies(checkpointStore, persistence, wrongProvider), auth: { uid: 'uid-1', token: { email_verified: false } } }), /verified account/);
  const stalled: MailProviderDeltaSource = { async fetchPage(input) { return { messages: [], initialized: true, nextCursor: input.cursor, hasMore: true }; } };
  await assert.rejects(syncMailConnection({ ...dependencies(checkpointStore, persistence, stalled) }), /pagination cursor/);
});

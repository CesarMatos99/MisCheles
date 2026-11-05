import assert from 'node:assert/strict';
import test from 'node:test';
import type { CandidatePersistence, ImportedCandidateDocument, MailAuthContext, MailTokenVault, ParsedBankNotice, SafeMessageReader } from './mail_import_contract';
import type { MailProviderDeltaSource, MailSyncCheckpoint, MailSyncCheckpointStore } from './mail_sync_contract';
import { syncMailWithCandidateReview } from './mail_sync_worker';

const owner: MailAuthContext = { uid: 'uid-1', token: { email_verified: true } };
const notice: ParsedBankNotice = { transactionType: 'expense', occurredOn: '2026-10-02', amountMinor: 12500, currency: 'DOP', merchant: 'Supermercado', description: 'Compra' };
function harness(options: { alreadySeen?: boolean; parsed?: ParsedBankNotice | null } = {}) {
  let checkpoint: MailSyncCheckpoint | null = null;
  const calls = { source: 0, token: 0, reader: 0, readerTokens: [] as string[], saved: [] as ImportedCandidateDocument[] };
  const checkpointStore: MailSyncCheckpointStore = {
    read: async () => checkpoint,
    compareAndSet: async (_uid, _connection, expectedRevision, next) => {
      if ((checkpoint?.revision ?? null) !== expectedRevision) return false;
      checkpoint = next;
      return true;
    },
  };
  const source: MailProviderDeltaSource = {
    fetchPage: async () => {
      calls.source++;
      return { messages: [{ provider: 'gmail', providerMessageId: 'message-1', receivedAt: '2026-10-02T12:00:00.000Z' }], initialized: true, nextCursor: 'cursor-1', hasMore: false };
    },
  };
  const tokenVault: MailTokenVault = {
    getValidAccessToken: async () => { calls.token++; return 'opaque-access-token'; },
    revoke: async () => undefined,
  };
  const reader: SafeMessageReader = {
    readProviderNotice: async (token) => { calls.reader++; calls.readerTokens.push(token); return options.parsed === undefined ? notice : options.parsed; },
  };
  const persistence: CandidatePersistence = {
    hasMessage: async () => options.alreadySeen === true,
    findPossibleDuplicateTransactions: async () => [],
    saveCandidateIfAbsent: async (candidate) => { calls.saved.push(candidate); return true; },
  };
  return { calls, checkpointStore, source, tokenVault, reader, persistence, get checkpoint() { return checkpoint; } };
}

test('coordinates provider paging, secure parsing, candidate persistence, and checkpointing', async () => {
  const h = harness();
  const result = await syncMailWithCandidateReview({ auth: owner, connectionId: 'connection-1', provider: 'gmail', ...h, now: () => Date.parse('2026-10-02T12:01:00.000Z') });
  assert.equal(result.candidatesCreated, 1);
  assert.equal(result.messages, 1);
  assert.equal(result.complete, true);
  assert.equal(h.calls.saved.length, 1);
  assert.equal(h.calls.saved[0].ownerUid, owner.uid);
  assert.equal(h.calls.saved[0].reviewStatus, 'pending_review');
  assert.equal(h.calls.token, 1);
  assert.deepEqual(h.calls.readerTokens, ['opaque-access-token']);
  assert.equal(h.checkpoint?.cursor, 'cursor-1');
});

test('does not create a candidate for an already staged provider message', async () => {
  const h = harness({ alreadySeen: true });
  const result = await syncMailWithCandidateReview({ auth: owner, connectionId: 'connection-1', provider: 'gmail', ...h });
  assert.equal(result.duplicates, 1);
  assert.equal(h.calls.saved.length, 0);
  assert.equal(h.checkpoint?.cursor, 'cursor-1');
});

test('advances only after an unsupported notice is safely ignored', async () => {
  const h = harness({ parsed: null });
  const result = await syncMailWithCandidateReview({ auth: owner, connectionId: 'connection-1', provider: 'gmail', ...h });
  assert.equal(result.ignored, 1);
  assert.equal(h.calls.saved.length, 0);
  assert.equal(h.checkpoint?.cursor, 'cursor-1');
});

test('requires a verified Mis Cheles account before contacting the provider', async () => {
  const h = harness();
  await assert.rejects(syncMailWithCandidateReview({ auth: { uid: 'uid-1', token: { email_verified: false } }, connectionId: 'connection-1', provider: 'gmail', ...h }));
  assert.equal(h.calls.source, 0);
  assert.equal(h.calls.saved.length, 0);
});

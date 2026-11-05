import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateDocumentData, FirestoreCandidatePersistence } from './firestore_mail_persistence.ts';
import { importedCandidateId, type ImportedCandidateDocument } from './mail_import_contract.ts';

const candidate: ImportedCandidateDocument = {
  id: importedCandidateId('gmail', 'connection-1', 'message-1'), ownerUid: 'uid-1', schemaVersion: 1,
  provider: 'gmail', providerMessageId: 'message-1', connectionId: 'connection-1',
  messageFingerprint: 'fingerprint', dedupeKey: 'dedupe', transactionType: 'expense',
  occurredOn: '2026-10-30', amountMinor: 5000, currency: 'DOP', merchant: 'Supermercado',
  description: 'Compra', receivedAt: '2026-10-30T12:00:00.000Z', reviewStatus: 'pending_review',
  possibleDuplicateTransactionIds: [], createdAt: '2026-10-30T12:00:00.000Z', updatedAt: '2026-10-30T12:00:00.000Z',
};

test('candidate document whitelist never stores unmodeled message or OAuth fields', () => {
  const unsafe = { ...candidate, body: 'private email body', accessToken: 'secret', refreshToken: 'secret', cvv: '123' } as unknown as ImportedCandidateDocument;
  const output = candidateDocumentData(unsafe);
  assert.equal('body' in output, false);
  assert.equal('accessToken' in output, false);
  assert.equal('refreshToken' in output, false);
  assert.equal('cvv' in output, false);
  assert.equal(output.ownerUid, 'uid-1');
});

test('candidate IDs are deterministic and isolate provider, mailbox, and message', () => {
  const id = importedCandidateId('gmail', 'connection-1', 'message-1');
  assert.equal(id, candidate.id);
  assert.notEqual(id, importedCandidateId('outlook', 'connection-1', 'message-1'));
  assert.notEqual(id, importedCandidateId('gmail', 'connection-2', 'message-1'));
  assert.notEqual(id, importedCandidateId('gmail', 'connection-1', 'message-2'));
});

test('Firestore persistence creates a candidate at most once under its owning UID', async () => {
  const stored = new Map<string, unknown>();
  const path = (...parts: string[]) => parts.join('/');
  let transactionQueue = Promise.resolve();
  const db = {
    collection: (name: string) => ({
      doc: (uid: string) => ({
        collection: (subcollection: string) => ({
          doc: (id: string) => {
            const key = path(name, uid, subcollection, id);
            return { key, get: async () => ({ exists: stored.has(key) }) };
          },
        }),
      }),
    }),
    runTransaction: async (fn: (tx: any) => Promise<boolean>) => {
      const previous = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        return await fn({
          get: async (ref: {key: string}) => ({ exists: stored.has(ref.key) }),
          create: (ref: {key: string}, value: unknown) => { if (stored.has(ref.key)) throw new Error('already exists'); stored.set(ref.key, value); },
        });
      } finally { release(); }
    },
  };
  const repo = new FirestoreCandidatePersistence(db as any);
  assert.equal(await repo.hasMessage('uid-1', 'gmail', 'connection-1', 'message-1'), false);
  const concurrentResults = await Promise.all([repo.saveCandidateIfAbsent(candidate), repo.saveCandidateIfAbsent(candidate)]);
  assert.deepEqual(concurrentResults.sort(), [false, true]);
  assert.equal(await repo.hasMessage('uid-1', 'gmail', 'connection-1', 'message-1'), true);
  assert.equal(stored.size, 1);
  assert.match([...stored.keys()][0], /^users\/uid-1\/importedCandidates\/mail_/);
});

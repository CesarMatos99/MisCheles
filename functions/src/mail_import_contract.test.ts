import assert from 'node:assert/strict';
import test from 'node:test';
import { findPossibleDuplicateTransactions, processBankNotice, type CandidatePersistence, type ImportedCandidateDocument, type ParsedBankNotice, type ProviderMessageRef } from './mail_import_contract.ts';

const parsed: ParsedBankNotice = {
  transactionType: 'expense', occurredOn: '2026-10-28', amountMinor: 125000, currency: 'DOP',
  merchant: 'Supermercado', description: 'Compra con tarjeta', paymentHint: 'debit_card',
};
const message: ProviderMessageRef = {
  provider: 'gmail', providerMessageId: 'provider-message-123',
  receivedAt: '2026-10-28T14:00:00.000Z',
};
function persistence(saved: ImportedCandidateDocument[], matchedIds: string[] = []) {
  const seen = new Set<string>();
  const adapter: CandidatePersistence = {
    hasMessage: async (uid, provider, connectionId, messageId) => seen.has(JSON.stringify([uid, provider, connectionId, messageId])),
    findPossibleDuplicateTransactions: async () => matchedIds,
    saveCandidateIfAbsent: async (candidate) => {
      const key = JSON.stringify([candidate.ownerUid, candidate.provider, candidate.connectionId, candidate.providerMessageId]);
      if (seen.has(key)) return false;
      saved.push(candidate);
      seen.add(key);
      return true;
    },
  };
  return adapter;
}

test('creates a review candidate and marks a possible manual duplicate without storing secrets or body', async () => {
  const saved: ImportedCandidateDocument[] = [];
  let receivedToken = '';
  let tokenScope: string[] = [];
  const result = await processBankNotice({
    auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: 'connection-1', message, tokenVault: {
      getValidAccessToken: async (uid, connectionId, provider) => { tokenScope = [uid, connectionId, provider]; return 'secret-access-token'; }, revoke: async () => undefined,
    }, reader: { readProviderNotice: async (token) => { receivedToken = token; return { ...parsed, body: 'raw email body', extraSecret: 'should-not-persist' } as ParsedBankNotice; } },
    persistence: persistence(saved, ['manual-transaction-1']), now: new Date('2026-10-29T00:00:00.000Z'),
  });
  assert.equal(result, 'candidate_created');
  assert.equal(receivedToken, 'secret-access-token');
  assert.deepEqual(tokenScope, ['uid-1', 'connection-1', 'gmail']);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].ownerUid, 'uid-1');
  assert.equal(saved[0].reviewStatus, 'possible_duplicate');
  assert.equal(saved[0].transactionType, 'expense');
  assert.equal(saved[0].connectionId, 'connection-1');
  assert.deepEqual(saved[0].possibleDuplicateTransactionIds, ['manual-transaction-1']);
  assert.ok(!JSON.stringify(saved[0]).includes('secret-access-token'));
  assert.ok(!('body' in saved[0]));
  assert.ok(!('accessToken' in saved[0]));
  assert.ok(!('refreshToken' in saved[0]));
  assert.ok(!JSON.stringify(saved[0]).includes('raw email body'));
  assert.ok(!('extraSecret' in saved[0]));
});

test('is idempotent for the same provider message', async () => {
  const saved: ImportedCandidateDocument[] = [];
  const adapter = persistence(saved);
  const input = {
    auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: 'connection-1', message,
    tokenVault: { getValidAccessToken: async (_uid, _connectionId, _provider) => 'token', revoke: async () => undefined },
    reader: { readProviderNotice: async () => parsed }, persistence: adapter,
  };
  assert.equal(await processBankNotice(input), 'candidate_created');
  assert.equal(saved[0].reviewStatus, 'pending_review');
  assert.equal(await processBankNotice(input), 'duplicate');
  assert.equal(saved.length, 1);
});

test('atomically prevents duplicate candidates from concurrent webhook deliveries', async () => {
  const saved: ImportedCandidateDocument[] = [];
  const seen = new Set<string>();
  let readers = 0;
  let releaseReaders!: () => void;
  const bothReadersStarted = new Promise<void>((resolve) => {
    releaseReaders = resolve;
  });
  const adapter: CandidatePersistence = {
    hasMessage: async () => {
      readers += 1;
      if (readers === 2) releaseReaders();
      await bothReadersStarted;
      return false;
    },
    findPossibleDuplicateTransactions: async () => [],
    saveCandidateIfAbsent: async (candidate) => {
      const key = JSON.stringify([candidate.ownerUid, candidate.provider, candidate.connectionId, candidate.providerMessageId]);
      if (seen.has(key)) return false;
      seen.add(key);
      saved.push(candidate);
      return true;
    },
  };
  const input = {
    auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: 'connection-1', message,
    tokenVault: { getValidAccessToken: async () => 'token', revoke: async () => undefined },
    reader: { readProviderNotice: async () => parsed }, persistence: adapter,
  };
  const results = await Promise.all([processBankNotice(input), processBankNotice(input)]);
  assert.deepEqual(results.sort(), ['candidate_created', 'duplicate']);
  assert.equal(saved.length, 1);
});

test('rejects missing or unverified authentication and connection before accessing tokens', async () => {
  let tokenCalls = 0;
  const input = {
    auth: { uid: '  ', token: { email_verified: true } }, connectionId: 'connection-1', message,
    tokenVault: { getValidAccessToken: async (_uid: string, _connectionId: string, _provider: 'gmail' | 'outlook') => { tokenCalls += 1; return 'token'; }, revoke: async () => undefined },
    reader: { readProviderNotice: async () => parsed }, persistence: persistence([]),
  };
  await assert.rejects(processBankNotice(input), /verified signed-in owner/);
  await assert.rejects(processBankNotice({ ...input, auth: null }), /verified signed-in owner/);
  await assert.rejects(processBankNotice({ ...input, auth: { uid: 'uid-1', token: { email_verified: false } } }), /verified signed-in owner/);
  await assert.rejects(processBankNotice({ ...input, auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: ' ' }), /verified signed-in owner/);
  assert.equal(tokenCalls, 0);
});

test('rejects invalid calendar dates, unsafe amounts, malformed currencies and empty merchants', async () => {
  const invalidNotices: ParsedBankNotice[] = [
    { ...parsed, transactionType: 'transfer' as any },
    { ...parsed, occurredOn: '2026-02-30' },
    { ...parsed, amountMinor: Number.NaN },
    { ...parsed, amountMinor: Number.MAX_SAFE_INTEGER + 1 },
    { ...parsed, currency: 'peso' },
    { ...parsed, merchant: '   ' },
  ];
  for (const notice of invalidNotices) {
    const saved: ImportedCandidateDocument[] = [];
    const result = await processBankNotice({
      auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: 'connection-1', message,
      tokenVault: { getValidAccessToken: async () => 'token', revoke: async () => undefined },
      reader: { readProviderNotice: async () => notice }, persistence: persistence(saved),
    });
    assert.equal(result, 'ignored');
    assert.equal(saved.length, 0);
  }
});

test('keeps identical provider message IDs isolated by mailbox connection while sharing a transaction fingerprint', async () => {
  const saved: ImportedCandidateDocument[] = [];
  const adapter = persistence(saved);
  const base = {
    auth: { uid: 'uid-1', token: { email_verified: true } }, message,
    tokenVault: { getValidAccessToken: async () => 'token', revoke: async () => undefined },
    reader: { readProviderNotice: async () => parsed }, persistence: adapter,
  };
  await processBankNotice({ ...base, connectionId: 'mailbox-a' });
  await processBankNotice({ ...base, connectionId: 'mailbox-b' });
  assert.equal(saved.length, 2);
  assert.notEqual(saved[0].id, saved[1].id);
  assert.equal(saved[0].dedupeKey, saved[1].dedupeKey);
  const crossProvider = await processBankNotice({
    ...base, connectionId: 'outlook-mailbox', message: { ...message, provider: 'outlook' },
  });
  assert.equal(crossProvider, 'candidate_created');
  assert.equal(saved[0].dedupeKey, saved[2].dedupeKey);
  assert.notEqual(saved[0].id, saved[2].id);
});


test('suggests duplicates only for matching amount, date, currency and direction', () => {
  const ids = findPossibleDuplicateTransactions(parsed, [
    { id: 'manual-a', transactionType: 'expense', occurredOn: parsed.occurredOn, amountMinor: parsed.amountMinor, currency: parsed.currency, origin: 'manual' },
    { id: 'imported-a', transactionType: 'expense', occurredOn: parsed.occurredOn, amountMinor: parsed.amountMinor, currency: parsed.currency, origin: 'email_import' },
    { id: 'income', transactionType: 'income', occurredOn: parsed.occurredOn, amountMinor: parsed.amountMinor, currency: parsed.currency, origin: 'manual' },
    { id: 'other-date', transactionType: 'expense', occurredOn: '2026-10-29', amountMinor: parsed.amountMinor, currency: parsed.currency, origin: 'manual' },
    { id: 'other-currency', transactionType: 'expense', occurredOn: parsed.occurredOn, amountMinor: parsed.amountMinor, currency: 'USD', origin: 'manual' },
    { id: 'migration', transactionType: 'expense', occurredOn: parsed.occurredOn, amountMinor: parsed.amountMinor, currency: parsed.currency, origin: 'local_migration' },
    { id: 'manual-a', transactionType: 'expense', occurredOn: parsed.occurredOn, amountMinor: parsed.amountMinor, currency: parsed.currency, origin: 'manual' },
  ]);
  assert.deepEqual(ids, ['imported-a', 'manual-a']);
});


test('rejects malformed provider references before accessing OAuth tokens', async () => {
  let tokenCalls = 0;
  const base = {
    auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: 'connection-1', message,
    tokenVault: { getValidAccessToken: async () => { tokenCalls += 1; return 'token'; }, revoke: async () => undefined },
    reader: { readProviderNotice: async () => parsed }, persistence: persistence([]),
  };
  for (const invalid of [
    { ...message, provider: 'unknown' as any },
    { ...message, providerMessageId: '   ' },
    { ...message, providerMessageId: 'bad' + String.fromCharCode(10) + 'message' },
    { ...message, receivedAt: 'not a date' },
  ]) await assert.rejects(processBankNotice({ ...base, message: invalid }));
  await assert.rejects(processBankNotice({ ...base, connectionId: 'bad/path' }));
  assert.equal(tokenCalls, 0);
});


test('persists only minimized bank metadata and hashes references for duplicate matching', async () => {
  const saved: ImportedCandidateDocument[] = [];
  const notice = { ...parsed, occurredAt: '2026-10-28T09:30:00.000-05:00', bankName: 'Banco Ejemplo', bankReference: ' ref-ABC-123 ', paymentInstrumentLastFour: '4321' };
  await processBankNotice({
    auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: 'connection-1', message,
    tokenVault: { getValidAccessToken: async () => 'token', revoke: async () => undefined },
    reader: { readProviderNotice: async () => notice }, persistence: persistence(saved),
  });
  const candidate = saved[0];
  assert.equal(candidate.occurredAt, '2026-10-28T14:30:00.000Z');
  assert.equal(candidate.bankName, 'Banco Ejemplo');
  assert.match(candidate.bankReferenceHash || '', /^[a-f0-9]{64}$/);
  assert.equal(candidate.paymentInstrumentLastFour, '4321');
  assert.equal('bankReference' in candidate, false);
  assert.ok(!JSON.stringify(candidate).includes('ref-ABC-123'));
  assert.deepEqual(findPossibleDuplicateTransactions(notice, [
    { id: 'same-bank-reference', transactionType: 'expense', occurredOn: '2026-10-01', amountMinor: 1, currency: 'USD', origin: 'manual', bankReferenceHash: candidate.bankReferenceHash },
    { id: 'different-bank-reference', transactionType: 'expense', occurredOn: notice.occurredOn, amountMinor: notice.amountMinor, currency: notice.currency, origin: 'manual', bankReferenceHash: 'f'.repeat(64) },
  ]), ['same-bank-reference']);
});

test('rejects invalid timestamps, card fragments, and unsafe bank metadata', async () => {
  const invalidNotices: ParsedBankNotice[] = [
    { ...parsed, occurredAt: 'not-a-timestamp' },
    { ...parsed, paymentInstrumentLastFour: '12345' },
    { ...parsed, bankName: 'Banco\u0000malicioso' },
    { ...parsed, bankReference: 'x'.repeat(1001) },
  ];
  for (const notice of invalidNotices) {
    const saved: ImportedCandidateDocument[] = [];
    const result = await processBankNotice({
      auth: { uid: 'uid-1', token: { email_verified: true } }, connectionId: 'connection-1', message,
      tokenVault: { getValidAccessToken: async () => 'token', revoke: async () => undefined },
      reader: { readProviderNotice: async () => notice }, persistence: persistence(saved),
    });
    assert.equal(result, 'ignored');
    assert.equal(saved.length, 0);
  }
});

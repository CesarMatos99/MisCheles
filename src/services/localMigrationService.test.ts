import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { executeLegacyMigration, includeRemoteMigrationDuplicates, migrationDocumentId, previewLegacyMigration } from './localMigrationService.ts';

const fakeStorage = (data: Record<string, unknown>): Storage => ({
  getItem: (key: string) => data[key] === undefined ? null : key === 'mischeles_language_v1' ? String(data[key]) : JSON.stringify(data[key]),
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
} as Storage);

test('shares deterministic migration document IDs with Flutter', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../shared/migration_document_id_vectors.json', import.meta.url), 'utf8'));
  for (const item of fixture.cases) assert.equal(migrationDocumentId(item.collection, item.sourceId), item.documentId);
});

test('whitelists legacy snapshots and excludes private credentials and full card data', () => {
  const preview = previewLegacyMigration(fakeStorage({ mischeles_transactions_v3: [{
    id: 'private-fields', type: 'expense', amount: 5, monthKey: '2026-10', category: 'Comida', date: '2026-10-01',
    bankReferenceHash: 'a'.repeat(64), paymentInstrumentLastFour: '4321',
    accessToken: 'secret', refreshToken: 'secret', bankReference: 'raw-ref', cardNumber: '4111111111111111', cvv: '123', ownerUid: 'other',
  }] }));
  const snapshot = preview.items[0]?.data.legacySnapshot as Record<string, unknown>;
  assert.equal(snapshot.bankReferenceHash, 'a'.repeat(64));
  assert.equal(snapshot.paymentInstrumentLastFour, '4321');
  for (const key of ['accessToken', 'refreshToken', 'bankReference', 'cardNumber', 'cvv', 'ownerUid']) assert.equal(snapshot[key], undefined);
});

test('previews local data without seeding and excludes the linked savings mirror', () => {
  const storage = fakeStorage({
    mischeles_transactions_v3: [
      { id: 'real-1', monthKey: '2026-10', type: 'expense', amount: 10, category: 'Comida', date: '2026-10-01', description: 'Compra', createdAt: 1 },
      { id: 'mirror-1', monthKey: '2026-10', type: 'expense', amount: 50, category: 'Aporte al Ahorro', relatedSavingsMovementId: 'save-1', date: '2026-10-02', createdAt: 2 },
      { id: 'orphan-mirror-1', monthKey: '2026-10', type: 'expense', amount: 12, category: 'Aporte al Ahorro', relatedSavingsMovementId: 'missing-save', date: '2026-10-03', createdAt: 3 },
      { id: 'legacy-save-1', monthKey: '2026-10', type: 'expense', amount: 8, category: 'Aporte al Ahorro', date: '2026-10-04', createdAt: 4 },
    ],
    mischeles_savings_movements_v3: [{ id: 'save-1', monthKey: '2026-10', type: 'deposit_from_month', amount: 50, description: 'Aporte', date: '2026-10-02', createdAt: 2 }],
  });
  const preview = previewLegacyMigration(storage);
  assert.equal(preview.items.length, 4);
  assert.deepEqual(preview.mirroredSavingsTransactions, ['mirror-1']);
  assert.equal(preview.items.some((item) => item.sourceId === 'mirror-1'), false);
  const orphanMirror = preview.items.find((item) => item.sourceId === 'orphan-mirror-1')!;
  const legacyContribution = preview.items.find((item) => item.sourceId === 'legacy-save-1')!;
  const savingsMovement = preview.items.find((item) => item.sourceId === 'save-1')!;
  assert.equal(orphanMirror.collection, 'transactions');
  assert.equal(orphanMirror.data.kind, 'expense');
  assert.equal(orphanMirror.data.relatedSavingsMovementId, 'missing-save');
  assert.equal(legacyContribution.data.kind, 'expense');
  assert.equal(savingsMovement.collection, 'savingsMovements');
  assert.equal(savingsMovement.data.kind, 'savings_contribution');
  assert.equal(preview.suspectedSamples.length, 0);
});

test('fixtures are identified as fictional and are not included for silent migration', () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_transactions_v3: [{ id: 'tx-aug-1', monthKey: '2026-08', type: 'income', amount: 5000, category: 'Trabajo', date: '2026-08-01' }],
  }));
  assert.equal(preview.items.length, 0);
  assert.equal(preview.suspectedSamples.length, 1);
});

test('surfaces invalid dates and month keys instead of silently uploading them', () => {
  const preview = previewLegacyMigration(fakeStorage({ mischeles_transactions_v3: [
    { id: 'bad-date', type: 'expense', amount: 5, monthKey: '2026-10', category: 'Comida', date: '2026-02-31' },
    { id: 'bad-month', type: 'expense', amount: 5, monthKey: '2026-13', category: 'Comida', date: '2026-10-01' },
  ] }));
  assert.equal(preview.items.length, 0);
  assert.equal(preview.invalid.length, 2);
});

test('rejects zero movements, unsafe minor-unit values, and malformed legacy goal balances', () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_transactions_v3: [
      { id: 'zero-movement', type: 'expense', amount: 0, monthKey: '2026-10', category: 'Otro', date: '2026-10-01' },
      { id: 'unsafe-amount', type: 'income', amount: Number.MAX_SAFE_INTEGER, monthKey: '2026-10', category: 'Otro', date: '2026-10-01' },
      { id: 'fractional-cent', type: 'expense', amount: 1.005, monthKey: '2026-10', category: 'Otro', date: '2026-10-01' },
    ],
    mischeles_savings_goals_v3: [
      { id: 'invalid-balance', title: 'Meta', targetAmount: 100, currentAmount: 'no es un monto' },
    ],
  }));
  assert.equal(preview.items.length, 0);
  assert.equal(preview.invalid.length, 4);
});

test('marks remote source and destination-ID collisions in the preview', async () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_transactions_v3: [
      { id: 'remote-source', type: 'expense', amount: 10, monthKey: '2026-10', category: 'Comida', date: '2026-10-01' },
      { id: 'remote-document', type: 'expense', amount: 20, monthKey: '2026-10', category: 'Transporte', date: '2026-10-02' },
      { id: 'available', type: 'income', amount: 30, monthKey: '2026-10', category: 'Trabajo', date: '2026-10-03' },
    ],
  }));
  const remoteDocumentId = preview.items.find((item) => item.sourceId === 'remote-document')!.documentId;
  const enriched = await includeRemoteMigrationDuplicates('uid-1', preview, {
    existingSourceIds: async (_uid, _collection, sourceIds) => new Set([
      sourceIds.find((id) => id === 'remote-source')!, remoteDocumentId,
    ]),
    writeBatch: async () => undefined,
    verifiedSourceIds: async () => new Set(),
    hasUserSettings: async () => false,
    writeUserSettings: async () => undefined,
    verifyUserSettings: async () => true,
  });
  assert.deepEqual(enriched.items.map((item) => item.sourceId), ['available']);
  assert.deepEqual(enriched.duplicates.map((item) => item.sourceId).sort(), ['remote-document', 'remote-source']);
});

test('requires user confirmation before any remote write', async () => {
  let writes = 0;
  const preview = previewLegacyMigration(fakeStorage({ mischeles_transactions_v3: [{ id: 'real', type: 'expense', amount: 1, monthKey: '2026-10', category: 'Otro' }] }));
  await assert.rejects(executeLegacyMigration({ uid: 'uid-1', preview, selectedSourceKeys: new Set(['transactions:real']), confirmed: false, target: {
    existingSourceIds: async () => new Set(),
    writeBatch: async () => { writes += 1; },
    verifiedSourceIds: async () => new Set(['real']),
    hasUserSettings: async () => false,
    writeUserSettings: async () => { writes += 1; },
    verifyUserSettings: async () => true,
  }}));
  assert.equal(writes, 0);
});

test('preserves existing account settings instead of replacing them with local preferences', async () => {
  const storage = fakeStorage({
    mischeles_transactions_v3: [{ id: 'manual-1', monthKey: '2026-10', type: 'expense', amount: 25.5, category: 'Comida', date: '2026-10-04', description: 'Mercado', createdAt: 10 }],
    mischeles_user_profile_v2: { name: 'Local name', currency: 'RD$', language: 'en', pinCode: '7391' },
  });
  const preview = previewLegacyMigration(storage);
  let settingsWrites = 0;
  let uploaded: string[] = [];
  const result = await executeLegacyMigration({
    uid: 'account-uid', preview, selectedSourceKeys: new Set(['transactions:manual-1']), confirmed: true,
    target: {
      existingSourceIds: async () => new Set(),
      writeBatch: async (_uid, items) => { uploaded.push(...items.map((item) => item.sourceId)); },
      verifiedSourceIds: async (_uid, _collection, ids) => new Set(ids),
      hasUserSettings: async () => true,
      writeUserSettings: async () => { settingsWrites += 1; },
      verifyUserSettings: async () => true,
    },
  });
  assert.equal(result.uploaded, 1);
  assert.deepEqual(uploaded, ['manual-1']);
  assert.equal(settingsWrites, 0);
  assert.ok(storage.getItem('mischeles_transactions_v3'));
});

test('copies only individually selected legacy records and can omit profile preferences', async () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_transactions_v3: [
      { id: 'keep-me', monthKey: '2026-10', type: 'expense', amount: 10, category: 'Comida', date: '2026-10-01' },
      { id: 'skip-me', monthKey: '2026-10', type: 'expense', amount: 20, category: 'Transporte', date: '2026-10-02' },
    ],
    mischeles_user_profile_v2: { name: 'Local only', currency: 'RD$' },
  }));
  const writes: string[] = [];
  let settingsWrites = 0;
  const result = await executeLegacyMigration({
    uid: 'uid-selection', preview: { ...preview, settings: undefined },
    selectedSourceKeys: new Set(['transactions:keep-me']), confirmed: true,
    target: {
      existingSourceIds: async () => new Set(),
      writeBatch: async (_uid, items) => { writes.push(...items.map((item) => item.sourceId)); },
      verifiedSourceIds: async (_uid, _collection, ids) => new Set(ids),
      hasUserSettings: async () => false,
      writeUserSettings: async () => { settingsWrites += 1; },
      verifyUserSettings: async () => true,
    },
  });
  assert.equal(result.uploaded, 1);
  assert.deepEqual(writes, ['keep-me']);
  assert.equal(settingsWrites, 0);
});


test('copies only reviewed records and safe preferences while preserving local data', async () => {
  const source = {
    mischeles_transactions_v3: [{ id: 'manual-1', monthKey: '2026-10', type: 'expense', amount: 25.5, category: 'Comida', date: '2026-10-04', description: 'Mercado', createdAt: 10 }],
    mischeles_user_profile_v2: { name: 'Ana', email: 'local-only@example.com', currency: 'RD$', pinCode: '7391', biometricsEnabled: true, pinLockEnabled: true, monthlyTargetIncome: 1000 },
    mischeles_language_v1: 'en',
  };
  const storage = fakeStorage(source);
  const preview = previewLegacyMigration(storage);
  const writes: string[] = [];
  let savedSettings: Record<string, unknown> | undefined;
  const result = await executeLegacyMigration({
    uid: 'account-uid', preview, selectedSourceKeys: new Set(['transactions:manual-1']), confirmed: true,
    target: {
      existingSourceIds: async () => new Set(),
      writeBatch: async (_uid, items) => { writes.push(...items.map((item) => item.collection + ':' + item.sourceId)); },
      verifiedSourceIds: async (_uid, _collection, ids) => new Set(ids),
      hasUserSettings: async () => false,
      writeUserSettings: async (_uid, settings) => { savedSettings = settings; },
      verifyUserSettings: async (_uid, settings) => JSON.stringify(savedSettings) === JSON.stringify(settings),
    },
  });
  assert.equal(result.uploaded, 2);
  assert.deepEqual(writes, ['transactions:manual-1']);
  assert.equal(savedSettings?.displayName, 'Ana');
  assert.equal(savedSettings?.preferredCurrency, 'DOP');
  assert.equal(savedSettings?.language, 'en');
  assert.equal(preview.items[0]?.data.currency, 'DOP');
  assert.equal(savedSettings?.email, undefined);
  assert.equal(savedSettings?.pinCode, undefined);
  assert.ok(storage.getItem('mischeles_transactions_v3'));
});


test('keeps account document identity and revision when rebuilding an edited local record', () => {
  const preview = previewLegacyMigration(fakeStorage({ mischeles_transactions_v3: [{ id: 'local-id', cloudDocumentId: 'cloud-id', _cloudRevision: 'time:123:456', monthKey: '2026-10', type: 'expense', amount: 12.34, category: 'Comida', date: '2026-10-04', description: 'Compra' }] }));
  const item = preview.items.find((candidate) => candidate.sourceId === 'local-id')!;
  assert.equal(item.data.id, item.documentId);
  assert.equal(item.data.cloudDocumentId, 'cloud-id');
  assert.equal(item.data._cloudRevision, 'time:123:456');
  assert.equal((item.data.legacySnapshot as Record<string, unknown>).cloudDocumentId, undefined);
  assert.equal((item.data.legacySnapshot as Record<string, unknown>)._cloudRevision, undefined);
});


test('reconciles legacy goal balance snapshots with their linked savings history exactly once', () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_savings_goals_v3: [{ id: 'goal-real', title: 'Fondo', targetAmount: 1000, currentAmount: 300 }],
    mischeles_savings_movements_v3: [
      { id: 'deposit-1', goalId: 'goal-real', monthKey: '2026-10', type: 'deposit_from_month', amount: 500, date: '2026-10-01' },
      { id: 'withdraw-1', goalId: 'goal-real', monthKey: '2026-10', type: 'withdraw_to_month', amount: 200, date: '2026-10-02' },
    ],
  }));
  const goal = preview.items.find((item) => item.collection === 'savingsGoals')!;
  assert.equal(goal.data.legacyBalanceMinor, 0, '300 snapshot = +500 deposit - 200 withdrawal');
  assert.equal(preview.items.filter((item) => item.collection === 'savingsMovements').length, 2);
});

test('inactive historical goal movements do not alter the migrated opening balance', () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_savings_goals_v3: [{ id: 'goal-closed', title: 'Fondo', targetAmount: 1000, currentAmount: 50 }],
    mischeles_savings_movements_v3: [{ id: 'old-history', goalId: 'goal-closed', balanceAffecting: false, monthKey: '2026-10', type: 'deposit_from_month', amount: 400, date: '2026-10-01' }],
  }));
  const goal = preview.items.find((item) => item.collection === 'savingsGoals');
  const history = preview.items.find((item) => item.sourceId === 'old-history');
  assert.equal(goal?.data.legacyBalanceMinor, 5000);
  assert.equal(history?.data.balanceAffecting, false);
});

test('marks a savings goal for review when linked history exceeds its legacy snapshot', () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_savings_goals_v3: [{ id: 'goal-bad', title: 'Fondo', targetAmount: 1000, currentAmount: 100 }],
    mischeles_savings_movements_v3: [{ id: 'deposit-too-large', goalId: 'goal-bad', monthKey: '2026-10', type: 'deposit_from_month', amount: 200, date: '2026-10-01' }],
  }));
  assert.equal(preview.items.some((item) => item.collection === 'savingsGoals'), false);
  assert.ok(preview.invalid.some((item) => item.collection === 'savingsGoals' && item.sourceId === 'goal-bad'));
  assert.equal(preview.items.some((item) => item.collection === 'savingsMovements'), false, 'do not migrate a dangling goal contribution');
});


test('account-scope resync treats a stored savings balance as its opening amount', () => {
  const storage = fakeStorage({
    mischeles_savings_goals_v3: [{ id: 'goal-account', title: 'Fondo', targetAmount: 1000, currentAmount: 300 }],
    mischeles_savings_movements_v3: [{ id: 'save-account', goalId: 'goal-account', monthKey: '2026-10', type: 'deposit_from_month', amount: 300, date: '2026-10-01' }],
  });
  const preview = previewLegacyMigration(storage, { savingsGoalBalanceMode: 'opening' });
  assert.equal(preview.items.find((item) => item.collection === 'savingsGoals')?.data.legacyBalanceMinor, 30000);
});


test('normalizes old payment labels to the shared payment classifier contract', () => {
  const preview = previewLegacyMigration(fakeStorage({
    mischeles_transactions_v3: [
      { id: 'cash-payment', type: 'expense', amount: 5, monthKey: '2026-10', category: 'Comida', date: '2026-10-01', paymentMethod: 'Efectivo' },
      { id: 'card-payment', type: 'expense', amount: 5, monthKey: '2026-10', category: 'Comida', date: '2026-10-01', paymentMethod: 'Tarjeta de Crédito' },
      { id: 'transfer-payment', type: 'expense', amount: 5, monthKey: '2026-10', category: 'Comida', date: '2026-10-01', paymentMethod: 'Transferencia Bancaria' },
    ],
  }));
  assert.deepEqual(preview.items.map((item) => item.data.paymentMethod), ['cash', 'credit_card', 'bank_transfer']);
});


test('migration snapshots whitelist financial fields and exclude credentials and full card data', () => {
  const preview = previewLegacyMigration(fakeStorage({ mischeles_transactions_v3: [{
    id: 'metadata-safe', monthKey: '2026-10', type: 'expense', amount: 25, category: 'Comida',
    date: '2026-10-04', description: 'Compra', occurredAt: '2026-10-04T15:20:00.000Z',
    bankName: 'Banco Ejemplo', bankReferenceHash: 'a'.repeat(64), paymentInstrumentLastFour: '4321',
    accessToken: 'secret-token', cardNumber: '4111111111111111', cvv: '123', unknownSecret: 'do-not-copy',
  }] }));
  const snapshot = preview.items[0]?.data.legacySnapshot as Record<string, unknown>;
  assert.equal(snapshot.occurredAt, '2026-10-04T15:20:00.000Z');
  assert.equal(snapshot.bankReferenceHash, 'a'.repeat(64));
  assert.equal(snapshot.paymentInstrumentLastFour, '4321');
  assert.equal(snapshot.accessToken, undefined);
  assert.equal(snapshot.cardNumber, undefined);
  assert.equal(snapshot.cvv, undefined);
  assert.equal(snapshot.unknownSecret, undefined);
});

test('rejects a remotely reviewed preview after changing the destination account', async () => {
  let contacted = false;
  const preview = previewLegacyMigration({ getItem: () => null });
  await assert.rejects(executeLegacyMigration({
    uid: 'owner-b',
    preview: { ...preview, remoteOwnerUid: 'owner-a' },
    selectedSourceKeys: new Set(),
    confirmed: true,
    target: {
      existingSourceIds: async () => { contacted = true; return new Set(); },
      writeBatch: async () => { contacted = true; },
      verifiedSourceIds: async () => new Set(),
      hasUserSettings: async () => false,
      writeUserSettings: async () => { contacted = true; },
      verifyUserSettings: async () => true,
    },
  }), /cuenta de destino cambió/);
  assert.equal(contacted, false);
});

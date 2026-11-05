import type { CategoryBudget, MonthConfig, SavingsGoal, SavingsMovement, Transaction, UserProfile } from '../types';
import { currencyCodeFromDisplay } from '../domain/currency';

export type LegacyCollection = 'transactions' | 'savingsMovements' | 'savingsGoals' | 'monthConfigurations' | 'categoryBudgets';
export interface LegacyMigrationItem { collection: LegacyCollection; sourceId: string; documentId: string; data: Record<string, unknown>; suspectedSample: boolean; }
export interface LegacyMigrationPreview { remoteOwnerUid?: string; items: LegacyMigrationItem[]; suspectedSamples: LegacyMigrationItem[]; duplicates: LegacyMigrationItem[]; invalid: { collection: string; sourceId: string; reason: string }[]; mirroredSavingsTransactions: string[]; settings?: Record<string, unknown>; }
export interface MigrationTarget {
  existingSourceIds(uid: string, collection: LegacyCollection, sourceIds: string[]): Promise<Set<string>>;
  writeBatch(uid: string, items: LegacyMigrationItem[]): Promise<void>;
  verifiedSourceIds(uid: string, collection: LegacyCollection, sourceIds: string[], expectedItems: LegacyMigrationItem[]): Promise<Set<string>>;
  hasUserSettings(uid: string): Promise<boolean>;
  writeUserSettings(uid: string, settings: Record<string, unknown>): Promise<void>;
  verifyUserSettings(uid: string, settings: Record<string, unknown>): Promise<boolean>;
}

const LEGACY_SNAPSHOT_FIELDS: Record<LegacyCollection, readonly string[]> = {
  transactions: ['id', 'monthKey', 'type', 'amount', 'category', 'description', 'date', 'paymentMethod', 'createdAt', 'relatedSavingsMovementId', 'occurredAt', 'notes', 'bankName', 'bankReferenceHash', 'paymentInstrumentLastFour', 'importedCandidateId', 'dedupeKey'],
  savingsMovements: ['id', 'monthKey', 'type', 'amount', 'description', 'category', 'date', 'createdAt', 'destinationType', 'goalId', 'goalTitle', 'balanceAffecting'],
  savingsGoals: ['id', 'title', 'targetAmount', 'currentAmount', 'targetDate', 'icon', 'color'],
  monthConfigurations: ['monthKey', 'year', 'month', 'initialIncome', 'carryoverFromPrev', 'autoRolloverEnabled', 'rolloverAction', 'rolloverGoalId', 'rolloverGoalTitle', 'notes', 'isConfigured'],
  categoryBudgets: ['category', 'amount'],
};

function safeLegacySnapshot(collection: LegacyCollection, value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(LEGACY_SNAPSHOT_FIELDS[collection]
    .filter((key) => value[key] !== undefined)
    .map((key) => [key, value[key]]));
}

const STORAGE_KEYS = {
  transactions: 'mischeles_transactions_v3',
  savingsMovements: 'mischeles_savings_movements_v3',
  savingsGoals: 'mischeles_savings_goals_v3',
  monthConfigurations: 'mischeles_month_configs_v2',
  categoryBudgets: 'mischeles_category_budgets_v1',
  profile: 'mischeles_user_profile_v2',
} as const;

// IDs and labels emitted by the old demo seeder. These are surfaced for review and never
// silently uploaded as a person's financial history.
const KNOWN_SAMPLE_IDS = new Set([
  'tx-aug-1', 'tx-aug-2', 'tx-aug-3', 'tx-aug-4', 'tx-aug-5', 'tx-aug-savings-1',
  'tx-sep-1', 'tx-sep-2', 'tx-sep-3', 'tx-sep-4', 'tx-sep-5', 'tx-sep-6', 'tx-sep-savings-1', 'tx-sep-savings-2',
  'sm-aug-1', 'sm-sep-1', 'sm-sep-2', 'sm-sep-3', 'goal-1', 'goal-2', 'goal-3', '2026-08', '2026-09',
]);

function readJson<T>(storage: Pick<Storage, 'getItem'>, key: string): T | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
function paymentClassifier(value: unknown): string {
  const text = typeof value === 'string' ? value.trim().toLocaleLowerCase('es-DO') : '';
  if (text === 'cash' || text.includes('efectivo')) return 'cash';
  if (text === 'debit_card' || text.includes('débito') || text.includes('debito')) return 'debit_card';
  if (text === 'credit_card' || text.includes('crédito') || text.includes('credito')) return 'credit_card';
  if (text === 'bank_transfer' || text.includes('transferencia') || text.includes('transfer')) return 'bank_transfer';
  return 'other';
}
function amountMinor(value: unknown): number | null {
  const text = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] || '').padEnd(2, '0'));
  const minor = whole * 100 + fraction;
  return Number.isSafeInteger(minor) ? minor : null;
}
function validMonthKey(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function stableSuffix(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function stableDocumentId(collection: LegacyCollection, sourceId: string): string {
  const safe = sourceId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'record';
  return 'legacy_' + collection + '_' + safe + '_' + stableSuffix(sourceId);
}
export function migrationDocumentId(collection: LegacyCollection, sourceId: string): string { return stableDocumentId(collection, sourceId); }

function timestamp(value: unknown): string {
  const parsed = typeof value === 'number' ? new Date(value) : new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}
function sourceIdOf(collection: LegacyCollection, data: Record<string, unknown>): string {
  if (collection === 'monthConfigurations') return String(data.monthKey || '');
  if (collection === 'categoryBudgets') return String(data.monthKey || '') + ':' + String(data.category || '');
  return String(data.id || '');
}
function kindOf(collection: LegacyCollection, data: Record<string, unknown>): string {
  if (collection === 'transactions') {
    if (data.type === 'income') return 'income';
    // Keep every ledger transaction typed as income or expense. A legacy savings
    // contribution mirror remains an expense linked to its savings movement; the
    // financial summary uses that link to avoid counting it as consumption twice.
    return 'expense';
  }
  if (collection !== 'savingsMovements') return '';
  if (data.type === 'deposit_from_month') return 'savings_contribution';
  if (data.type === 'withdraw_to_month') return 'savings_withdrawal';
  if (data.type === 'goal_to_general') return 'savings_reallocation';
  return 'savings_direct_expense';
}

/** Reads only current keys. It deliberately does not call financeApplication getters because those can seed example records. */
export function previewLegacyMigration(
  storage: Pick<Storage, 'getItem'>,
  options: { savingsGoalBalanceMode?: 'snapshot' | 'opening' } = {},
): LegacyMigrationPreview {
  const transactions = readJson<Transaction[]>(storage, STORAGE_KEYS.transactions) || [];
  const savingsMovements = readJson<SavingsMovement[]>(storage, STORAGE_KEYS.savingsMovements) || [];
  const savingsGoals = readJson<SavingsGoal[]>(storage, STORAGE_KEYS.savingsGoals) || [];
  const monthConfigurations = readJson<Record<string, MonthConfig>>(storage, STORAGE_KEYS.monthConfigurations) || {};
  const categoryBudgets = readJson<Record<string, CategoryBudget[]>>(storage, STORAGE_KEYS.categoryBudgets) || {};
  const profile = readJson<UserProfile>(storage, STORAGE_KEYS.profile);
  const currency = currencyCodeFromDisplay(profile?.currency);
  const invalid: LegacyMigrationPreview['invalid'] = [];
  const mirroredSavingsTransactions: string[] = [];
  const savingsMovementIds = new Set(savingsMovements.map((movement) => movement.id));
  const items: LegacyMigrationItem[] = [];

  const append = (collection: LegacyCollection, values: Record<string, unknown>[]) => {
    for (const value of values) {
      if (collection === 'transactions' && value.relatedSavingsMovementId && savingsMovementIds.has(String(value.relatedSavingsMovementId))) {
        mirroredSavingsTransactions.push(String(value.id || ''));
        continue;
      }
      const sourceId = sourceIdOf(collection, value);
      if (!sourceId) { invalid.push({ collection, sourceId, reason: 'No tiene identificador estable.' }); continue; }
      const month = value.monthKey;
      if ((collection === 'transactions' || collection === 'savingsMovements' || collection === 'monthConfigurations' || collection === 'categoryBudgets') && !validMonthKey(month)) { invalid.push({ collection, sourceId, reason: 'El mes no tiene formato válido.' }); continue; }
      if ((collection === 'transactions' || collection === 'savingsMovements') && !validDate(value.date)) { invalid.push({ collection, sourceId, reason: 'La fecha del movimiento no es válida.' }); continue; }
      if (collection === 'monthConfigurations' && (amountMinor(value.initialIncome) === null || amountMinor(value.carryoverFromPrev) === null)) { invalid.push({ collection, sourceId, reason: 'El ingreso inicial o el arrastre no es válido.' }); continue; }
      const amount = ['transactions', 'savingsMovements', 'savingsGoals', 'categoryBudgets'].includes(collection)
        ? amountMinor(collection === 'savingsGoals' ? value.targetAmount : collection === 'categoryBudgets' ? value.amount : value.amount)
        : null;
      if (amount === null && ['transactions', 'savingsMovements', 'savingsGoals', 'categoryBudgets'].includes(collection)) {
        invalid.push({ collection, sourceId, reason: 'Monto inválido; se excluye de la migración automática para revisión.' });
        continue;
      }
      if ((collection === 'transactions' || collection === 'savingsMovements') && amount !== null && amount <= 0) {
        invalid.push({ collection, sourceId, reason: 'Los movimientos deben tener un monto mayor que cero.' });
        continue;
      }
      if (collection === 'savingsGoals' && value.currentAmount != null && amountMinor(value.currentAmount) === null) {
        invalid.push({ collection, sourceId, reason: 'El saldo actual de la meta no es válido.' });
        continue;
      }
      const kind = kindOf(collection, value);
      const data: Record<string, unknown> = {
        id: stableDocumentId(collection, sourceId),
        schemaVersion: 1,
        sourceEntity: collection,
        localSourceId: sourceId,
        origin: 'local_migration',
        createdAt: timestamp(value.createdAt),
        updatedAt: new Date().toISOString(),
        legacySnapshot: safeLegacySnapshot(collection, value),
        ...(typeof value.cloudDocumentId === 'string' ? { cloudDocumentId: value.cloudDocumentId } : {}),
        ...(typeof value._cloudRevision === 'string' ? { _cloudRevision: value._cloudRevision } : {}),
      };
      if (kind) Object.assign(data, {
        kind,
        amountMinor: amount,
        currency,
        occurredOn: String(value.date || '1970-01-01'),
        monthKey: String(value.monthKey || ''),
        categoryName: String(value.category || value.title || ''),
        description: String(value.description || value.title || ''),
        paymentMethod: paymentClassifier(value.paymentMethod),
        ...(value.goalId ? { savingsGoalId: value.goalId } : {}),
        ...(value.balanceAffecting === false ? { balanceAffecting: false } : {}),
        ...(collection === 'transactions' && value.relatedSavingsMovementId ? { relatedSavingsMovementId: value.relatedSavingsMovementId } : {}),
      });
      if (collection === 'monthConfigurations') Object.assign(data, {
        monthKey: String(value.monthKey || ''),
        openingCarryoverMinor: amountMinor(value.carryoverFromPrev) ?? 0,
        initialIncomeMinor: amountMinor(value.initialIncome) ?? 0,
        autoRolloverEnabled: Boolean(value.autoRolloverEnabled),
      });
      if (collection === 'categoryBudgets') Object.assign(data, {
        monthKey: String(value.monthKey || ''),
        categoryName: String(value.category || ''),
        categoryId: String(value.category || '').trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-'),
        assignedMinor: amount,
        currency,
      });
      if (collection === 'savingsGoals') Object.assign(data, {
        title: String(value.title || ''),
        targetMinor: amount,
        legacyBalanceMinor: amountMinor(value.currentAmount) ?? 0,
        currency,
      });
      items.push({ collection, sourceId, documentId: stableDocumentId(collection, sourceId), data, suspectedSample: KNOWN_SAMPLE_IDS.has(sourceId) });
    }
  };

  append('transactions', transactions as unknown as Record<string, unknown>[]);
  append('savingsMovements', savingsMovements as unknown as Record<string, unknown>[]);
  append('savingsGoals', savingsGoals as unknown as Record<string, unknown>[]);
  append('monthConfigurations', Object.values(monthConfigurations) as unknown as Record<string, unknown>[]);
  append('categoryBudgets', Object.entries(categoryBudgets).flatMap(([monthKey, budgets]) => budgets.map((budget) => ({ ...budget, monthKey }))) as unknown as Record<string, unknown>[]);

  // Older React records mirror their complete savings balance on the goal and also
  // keep the contribution/withdrawal ledger. Store only the opening amount in the
  // account so both clients can derive the live balance from opening + ledger once.
  // Account-scope edits already store that opening amount, so sync must leave it as-is.
  if (options.savingsGoalBalanceMode !== 'opening') {
    const movementNetByGoal = new Map<string, number>();
    const invalidGoalIds = new Set<string>();
    for (const item of items) {
      if (item.collection !== 'savingsMovements' || typeof item.data.savingsGoalId !== 'string' || item.data.balanceAffecting === false) continue;
      const delta = item.data.kind === 'savings_contribution' ? Number(item.data.amountMinor) : -Number(item.data.amountMinor);
      movementNetByGoal.set(item.data.savingsGoalId, (movementNetByGoal.get(item.data.savingsGoalId) || 0) + delta);
    }
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.collection !== 'savingsGoals') continue;
      const snapshot = amountMinor(savingsGoals.find((goal) => goal.id === item.sourceId)?.currentAmount) ?? 0;
      const opening = snapshot - (movementNetByGoal.get(item.sourceId) || 0);
      if (opening < 0) {
        invalid.push({ collection: 'savingsGoals', sourceId: item.sourceId, reason: 'El historial vinculado supera el saldo actual de la meta; requiere revisión antes de migrar.' });
        invalidGoalIds.add(item.sourceId);
        items.splice(index, 1);
        continue;
      }
      item.data.legacyBalanceMinor = opening;
    }
    if (invalidGoalIds.size) {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const item = items[index];
        const goalId = item.collection === 'savingsMovements' ? item.data.savingsGoalId : undefined;
        if (typeof goalId === 'string' && invalidGoalIds.has(goalId)) {
          invalid.push({ collection: item.collection, sourceId: item.sourceId, reason: 'Se excluye junto con una meta cuyo saldo requiere revisión; el original local se conserva.' });
          items.splice(index, 1);
        }
      }
    }
  }

  const settings = profile ? {
    displayName: profile.name,
    preferredCurrency: currency,
    language: storage.getItem('mischeles_language_v1') || 'es',
    theme: storage.getItem('presucontrol_theme_v1') || 'light',
    accentColor: storage.getItem('mischeles_accent_v2') || '#012677',
    // PIN, biometric settings, photo and unverified profile email are intentionally excluded.
  } : undefined;
  const suspectedSamples = items.filter((item) => item.suspectedSample);
  const normalItems = items.filter((item) => !item.suspectedSample);
  const seen = new Set<string>();
  const duplicates = normalItems.filter((item) => {
    const key = item.collection + ':' + item.sourceId;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  return { items: normalItems.filter((item) => !duplicates.includes(item)), suspectedSamples, duplicates, invalid, mirroredSavingsTransactions, settings };
}

/** Adds remote source/document collisions to the preview without writing anything. */
export async function includeRemoteMigrationDuplicates(
  uid: string,
  preview: LegacyMigrationPreview,
  target: MigrationTarget,
): Promise<LegacyMigrationPreview> {
  if (!uid.trim() || uid.length > 128 || uid.includes('/')) throw new Error('La cuenta de destino no es válida.');
  const all = [...preview.items, ...preview.suspectedSamples];
  const grouped = new Map<LegacyCollection, LegacyMigrationItem[]>();
  for (const item of all) {
    const group = grouped.get(item.collection) || [];
    group.push(item);
    grouped.set(item.collection, group);
  }
  const duplicateKeys = new Set(preview.duplicates.map((item) => item.collection + ':' + item.sourceId));
  for (const [collection, items] of grouped) {
    const existing = await target.existingSourceIds(uid, collection, items.map((item) => item.sourceId));
    for (const item of items) {
      if (existing.has(item.sourceId) || existing.has(item.documentId)) {
        duplicateKeys.add(item.collection + ':' + item.sourceId);
      }
    }
  }
  const duplicates = [...preview.duplicates];
  for (const item of all) {
    const key = item.collection + ':' + item.sourceId;
    if (duplicateKeys.has(key) && !duplicates.some((duplicate) => duplicate.collection + ':' + duplicate.sourceId === key)) duplicates.push(item);
  }
  return {
    ...preview,
    remoteOwnerUid: uid,
    items: preview.items.filter((item) => !duplicateKeys.has(item.collection + ':' + item.sourceId)),
    suspectedSamples: preview.suspectedSamples.filter((item) => !duplicateKeys.has(item.collection + ':' + item.sourceId)),
    duplicates,
  };
}

/** Uploads only previewed selections; source data is never deleted. */
export async function executeLegacyMigration(input: {
  uid: string;
  preview: LegacyMigrationPreview;
  selectedSourceKeys: Set<string>;
  explicitlyIncludeSampleKeys?: Set<string>;
  confirmed: boolean;
  target: MigrationTarget;
}): Promise<{ uploaded: number; alreadyPresent: number }> {
  if (!input.uid.trim() || input.uid.length > 128 || input.uid.includes('/') || (input.preview.remoteOwnerUid !== undefined && input.preview.remoteOwnerUid !== input.uid)) throw new Error('La cuenta de destino cambió. Actualiza la vista previa antes de migrar.');
  if (!input.confirmed) throw new Error('La migración requiere confirmación después de revisar la vista previa.');
  const candidates = [...input.preview.items, ...(input.explicitlyIncludeSampleKeys?.size ? input.preview.suspectedSamples : [])]
    .filter((item) => input.selectedSourceKeys.has(item.collection + ':' + item.sourceId));
  const grouped = new Map<LegacyCollection, LegacyMigrationItem[]>();
  let alreadyPresent = 0;
  const existingByCollection = new Map<LegacyCollection, Set<string>>();
  for (const item of candidates) {
    if (item.suspectedSample && !input.explicitlyIncludeSampleKeys?.has(item.collection + ':' + item.sourceId)) continue;
    let existing = existingByCollection.get(item.collection);
    if (!existing) {
      existing = await input.target.existingSourceIds(input.uid, item.collection, candidates.filter((candidate) => candidate.collection === item.collection).map((candidate) => candidate.sourceId));
      existingByCollection.set(item.collection, existing);
    }
    if (existing.has(item.sourceId) || existing.has(item.documentId)) { alreadyPresent += 1; continue; }
    const list = grouped.get(item.collection) || [];
    list.push(item);
    grouped.set(item.collection, list);
  }
  for (const [collection, items] of grouped) await input.target.writeBatch(input.uid, items.map((item) => ({ ...item, data: { ...item.data, ownerUid: input.uid } })));

  let uploaded = 0;
  if (input.preview.settings) {
    if (await input.target.hasUserSettings(input.uid)) {
      alreadyPresent += 1;
    } else {
      await input.target.writeUserSettings(input.uid, input.preview.settings);
      if (!(await input.target.verifyUserSettings(input.uid, input.preview.settings))) throw new Error('No se verificaron las preferencias del perfil. Los datos locales siguen intactos.');
      uploaded += 1;
    }
  }
  for (const [collection, items] of grouped) {
    const verified = await input.target.verifiedSourceIds(input.uid, collection, items.map((item) => item.sourceId), items);
    const missing = items.filter((item) => !verified.has(item.sourceId));
    if (missing.length) throw new Error('No se verificó la copia de ' + missing.length + ' registro(s) de ' + collection + '. Los datos originales siguen en el dispositivo.');
    uploaded += items.length;
  }
  return { uploaded, alreadyPresent };
}

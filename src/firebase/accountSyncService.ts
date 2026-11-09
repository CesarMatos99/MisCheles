import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { AccountRepository, ACCOUNT_COLLECTIONS, type AccountCollection, type AccountRecord } from './AccountRepository';
import { firebaseAuth, firestore } from './client';
import { migrationDocumentId, previewLegacyMigration, type LegacyCollection } from '../services/localMigrationService';
import { currencyCodeFromDisplay } from '../domain/currency';
import { cloudRevision, CloudRevisionConflictError, isStaleCloudWrite } from './syncRevision';
import { getScopedPreference, getScopedStorageReader, preferredUnauthenticatedScope, setStorageScope, storageMutationEvent, storageService, type StorageMutation, type SyncCollection } from '../services/storage';

const INCLUDED_SAMPLES_KEY = 'mischeles_sync_included_samples_v1';
let activeUid: string | null = null;
let syncGeneration = 0;
let authGeneration = 0;
let stopDataSync: (() => void) | null = null;
let stopUserDocument: (() => void) | null = null;
let stopAuthObserver: (() => void) | null = null;
let pending = new Map<string, StorageMutation>();
let flushTimer: number | undefined;
let flushingUid: string | null = null;
const outboxKey = (uid: string) => `mischeles_sync_outbox_v1_${uid}`;
export type AccountSyncConflict = { uid: string; collection: AccountCollection; sourceId: string; localRecord: Record<string, unknown>; remoteRecord: Record<string, unknown> | null };
const conflicts = new Map<string, AccountSyncConflict>();
const blockedMutations = new Set<string>();
const mutationKey = (collection: SyncCollection, sourceId: string) => collection + ':' + sourceId;
class SyncConflictError extends Error {
  constructor(readonly conflict: AccountSyncConflict) { super('A record changed on another device; the local version was preserved.'); this.name = 'SyncConflictError'; }
}
function reportConflict(conflict: AccountSyncConflict) {
  conflicts.set(mutationKey(conflict.collection, conflict.sourceId), conflict);
  blockedMutations.add(mutationKey(conflict.collection, conflict.sourceId));
  persistConflicts(conflict.uid);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mischeles:sync-conflict', { detail: conflict }));
}
const conflictStorageKey = (uid: string) => `mischeles_sync_conflicts_v1_${uid}`;
function persistConflicts(uid: string) { try { localStorage.setItem(conflictStorageKey(uid), JSON.stringify([...conflicts.values()])); } catch { reportSyncError(new Error('Could not preserve sync conflict details locally.')); } }
function restoreConflicts(uid: string) {
  conflicts.clear(); blockedMutations.clear();
  try {
    const stored = JSON.parse(localStorage.getItem(conflictStorageKey(uid)) || '[]') as AccountSyncConflict[];
    for (const conflict of stored) if (conflict?.uid === uid && conflict.sourceId && ACCOUNT_COLLECTIONS.includes(conflict.collection)) {
      const key = mutationKey(conflict.collection, conflict.sourceId);
      if (pending.has(key)) { conflicts.set(key, conflict); blockedMutations.add(key); }
    }
  } catch { conflicts.clear(); blockedMutations.clear(); }
}
function persistPending(uid: string) { try { localStorage.setItem(outboxKey(uid), JSON.stringify([...pending.values()])); } catch { reportSyncError(new Error('No se pudo guardar la cola de sincronización en este dispositivo.')); } }
function restorePending(uid: string) {
  pending.clear();
  try {
    const records = JSON.parse(localStorage.getItem(outboxKey(uid)) || '[]') as StorageMutation[];
    const allowedCollections = new Set<SyncCollection>(['transactions', 'savingsMovements', 'savingsGoals', 'monthConfigurations', 'categoryBudgets', 'userSettings']);
    for (const record of records) if (record && typeof record.sourceId === 'string' && allowedCollections.has(record.collection) && (record.operation === 'upsert' || record.operation === 'delete')) pending.set(record.collection + ':' + record.sourceId, record);
  } catch { pending.clear(); }
  restoreConflicts(uid);
}


const accountCollection = (collection: SyncCollection): AccountCollection | null => collection === 'userSettings' ? null : collection;

function sourceIdFor(collection: AccountCollection, record: Record<string, unknown>): string {
  if (collection === 'monthConfigurations') return String(record.monthKey || '');
  if (collection === 'categoryBudgets') return String(record.monthKey || '') + ':' + String(record.category || record.categoryName || '');
  return String(record.id || '');
}

function legacyRecord(collection: AccountCollection, record: AccountRecord): Record<string, unknown> {
  const sourceId = typeof record.localSourceId === 'string' ? record.localSourceId : record.id;
  const revision = cloudRevision(record);
  const syncMeta = { cloudDocumentId: record.id, ...(revision === null ? {} : { _cloudRevision: revision }) };
  const snapshot = record.legacySnapshot;
  if (collection === 'savingsGoals') {
    const saved = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : {};
    return { ...saved, id: sourceId, currentAmount: Number(record.legacyBalanceMinor || 0) / 100, ...syncMeta };
  }
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) return { ...(snapshot as Record<string, unknown>), id: sourceId, ...syncMeta };
  const amount = Number(record.amountMinor || 0) / 100;
  const kind = String(record.kind || '');
  const paymentLabels: Record<string, string> = { cash: 'Efectivo', debit_card: 'Tarjeta de Débito', credit_card: 'Tarjeta de Crédito', bank_transfer: 'Transferencia Bancaria', other: 'Otro' };
  if (collection === 'transactions') return { id: sourceId, monthKey: record.monthKey, type: kind === 'income' ? 'income' : 'expense', amount, category: String(record.categoryName || 'Sin categoría'), description: String(record.description || ''), date: String(record.occurredOn || ''), paymentMethod: paymentLabels[String(record.paymentMethod || 'other')] || 'Otro', createdAt: Date.now(), relatedSavingsMovementId: record.relatedSavingsMovementId, importedCandidateId: record.importedCandidateId, dedupeKey: record.dedupeKey, ...(typeof record.occurredAt === 'string' ? { occurredAt: record.occurredAt } : {}), ...(typeof record.notes === 'string' ? { notes: record.notes } : {}), ...(typeof record.bankName === 'string' ? { bankName: record.bankName } : {}), ...(typeof record.bankReferenceHash === 'string' ? { bankReferenceHash: record.bankReferenceHash } : {}), ...(typeof record.paymentInstrumentLastFour === 'string' ? { paymentInstrumentLastFour: record.paymentInstrumentLastFour } : {}), ...syncMeta };
  if (collection === 'savingsMovements') return { id: sourceId, monthKey: record.monthKey, type: kind === 'savings_contribution' ? 'deposit_from_month' : kind === 'savings_withdrawal' ? 'withdraw_to_month' : kind === 'savings_reallocation' ? 'goal_to_general' : 'direct_expense', amount, description: String(record.description || ''), category: record.categoryName, date: String(record.occurredOn || ''), createdAt: Date.now(), goalId: record.savingsGoalId, destinationType: record.savingsGoalId ? 'goal' : 'general', ...(record.balanceAffecting === false ? { balanceAffecting: false } : {}), ...syncMeta };
  if (collection === 'monthConfigurations') { const monthKey = String(record.monthKey || ''); const [year, month] = monthKey.split('-').map(Number); return { id: sourceId, monthKey, year, month, initialIncome: Number(record.initialIncomeMinor || 0) / 100, carryoverFromPrev: Number(record.openingCarryoverMinor || 0) / 100, autoRolloverEnabled: Boolean(record.autoRolloverEnabled), notes: String(record.notes || ''), isConfigured: record.isConfigured !== false, ...syncMeta }; }
  return { id: sourceId, monthKey: record.monthKey, category: String(record.categoryName || ''), amount: Number(record.assignedMinor || 0) / 100, ...syncMeta };
}

function reportSyncError(error: unknown) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mischeles:sync-error', { detail: { message: error instanceof Error ? error.message : 'Sync failed' } }));
}

function userSettingsPayload(uid: string) {
  const profile = storageService.getProfile();
  const theme = getScopedPreference('presucontrol_theme_v1') || 'light';
  const language = getScopedPreference('mischeles_language_v1') || 'es';
  const accentColor = getScopedPreference('mischeles_accent_v2') || '#012677';
  return { ownerUid: uid, schemaVersion: 1, updatedAt: serverTimestamp(), displayName: profile.name, preferredCurrency: currencyCodeFromDisplay(profile.currency), language, theme, accentColor };
}

function pushUserSettings(uid: string) {
  if (!firestore) return Promise.resolve();
  return setDoc(doc(firestore, 'users', uid), userSettingsPayload(uid), { merge: true });
}

async function pushMutation(uid: string, mutation: StorageMutation, generation: number) {
  const repository = firestore ? new AccountRepository(firestore) : null;
  const collection = accountCollection(mutation.collection);
  if (!repository || !collection) { await pushUserSettings(uid); return; }
  if (mutation.operation === 'delete') {
    const fallbackIds = [mutation.sourceId, migrationDocumentId(collection as LegacyCollection, mutation.sourceId)];
    try { await repository.removeBySourceId(uid, collection, mutation.sourceId, fallbackIds, mutation.expectedRevision ?? null); }
    catch (error) {
      if (!(error instanceof CloudRevisionConflictError)) throw error;
      const remote = await repository.findBySourceId(uid, collection, mutation.sourceId, fallbackIds);
      throw new SyncConflictError({ uid, collection, sourceId: mutation.sourceId, localRecord: mutation.deletedRecord || {}, remoteRecord: remote ? legacyRecord(collection, remote) : null });
    }
    return;
  }
  const preview = previewLegacyMigration(getScopedStorageReader(), { savingsGoalBalanceMode: 'opening' });
  const selected = preview.items.find((item) => item.collection === collection && item.sourceId === mutation.sourceId);
  const includedSamples = new Set<string>(JSON.parse(localStorage.getItem(INCLUDED_SAMPLES_KEY) || '[]'));
  const sample = includedSamples.has(collection + ':' + mutation.sourceId) ? preview.suspectedSamples.find((item) => item.collection === collection && item.sourceId === mutation.sourceId) : undefined;
  const item = selected || sample;
  if (!item) return;
  const existingDocumentId = typeof item.data.cloudDocumentId === 'string' ? item.data.cloudDocumentId : item.data.id;
  const existing = await repository.get(uid, collection, String(existingDocumentId));
  if (activeUid !== uid || syncGeneration !== generation) return;
  const expectedRevision = typeof item.data._cloudRevision === 'string' ? item.data._cloudRevision : null;
  if (isStaleCloudWrite(expectedRevision, existing)) {
    throw new SyncConflictError({ uid, collection, sourceId: mutation.sourceId, localRecord: item.data, remoteRecord: existing ? legacyRecord(collection, existing) : null });
  }
  const { cloudDocumentId: _cloudDocumentId, _cloudRevision: _localRevision, ...data } = item.data;
  const accountRecord = { ...data, id: existingDocumentId, origin: existing?.origin || 'manual', ownerUid: uid, schemaVersion: 1 as const } as AccountRecord;
  try {
    await repository.writeIfRevisionMatches(uid, collection, accountRecord, expectedRevision);
  } catch (error) {
    if (!(error instanceof CloudRevisionConflictError)) throw error;
    const latest = await repository.get(uid, collection, String(existingDocumentId));
    throw new SyncConflictError({ uid, collection, sourceId: mutation.sourceId, localRecord: item.data, remoteRecord: latest ? legacyRecord(collection, latest) : null });
  }
  const committed = await repository.get(uid, collection, String(existingDocumentId));
  if (activeUid !== uid || syncGeneration !== generation) return;
  storageService.setCloudRevision(mutation.collection, mutation.sourceId, cloudRevision(committed));
}

async function flushMutations(uid: string) {
  if (flushingUid || activeUid !== uid) return;
  const generation = syncGeneration;
  flushingUid = uid;
  try {
    for (const [key, mutation] of [...pending.entries()]) {
      if (activeUid !== uid || syncGeneration !== generation) return;
      if (blockedMutations.has(key)) continue;
      try {
        await pushMutation(uid, mutation, generation);
        if (activeUid !== uid || syncGeneration !== generation) return;
        if (pending.get(key) === mutation) pending.delete(key);
      } catch (error) {
        if (activeUid !== uid || syncGeneration !== generation) return;
        if (error instanceof SyncConflictError) reportConflict(error.conflict);
        else reportSyncError(error);
        break;
      }
    }
    if (activeUid === uid) persistPending(uid);
  } finally {
    flushingUid = null;
    const hasUnblockedMutations = [...pending.keys()].some((key) => !blockedMutations.has(key));
    if (activeUid === uid && hasUnblockedMutations && (typeof navigator === 'undefined' || navigator.onLine)) {
      if (flushTimer !== undefined) window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => { flushTimer = undefined; void flushMutations(uid); }, 5000);
    } else if (activeUid && activeUid !== uid && pending.size && (typeof navigator === 'undefined' || navigator.onLine)) {
      const nextUid = activeUid;
      flushTimer = window.setTimeout(() => { flushTimer = undefined; void flushMutations(nextUid); }, 0);
    }
  }
}

function queueMutation(event: Event) {
  const detail = (event as CustomEvent<StorageMutation>).detail;
  if (!detail || detail.origin === 'remote' || !activeUid) return;
  pending.set(detail.collection + ':' + detail.sourceId, detail);
  persistPending(activeUid);
  if (flushTimer !== undefined) window.clearTimeout(flushTimer);
  const uid = activeUid;
  flushTimer = window.setTimeout(() => { flushTimer = undefined; void flushMutations(uid); }, 350);
}

function stopActiveDataSync() {
  syncGeneration += 1;
  const cleanup = stopDataSync;
  const stoppedUid = activeUid;
  const hadActiveAccount = stoppedUid !== null;
  if (stoppedUid) persistPending(stoppedUid);
  stopDataSync = null; activeUid = null; pending.clear();
  if (flushTimer !== undefined) window.clearTimeout(flushTimer); flushTimer = undefined;
  cleanup?.();
  if (hadActiveAccount) setStorageScope(preferredUnauthenticatedScope());
}

function activateDataSync(uid: string) {
  if (!firestore || activeUid === uid) return;
  stopActiveDataSync(); activeUid = uid;
  const generation = syncGeneration;
  const current = () => activeUid === uid && syncGeneration === generation;
  const reportCurrentError = (error: unknown) => { if (current()) reportSyncError(error); };
  setStorageScope({ accountUid: uid });
  restorePending(uid);
  const repository = new AccountRepository(firestore);
  const previousIds = new Map<AccountCollection, Set<string>>();
  const unsubs = ACCOUNT_COLLECTIONS.map((collection) => repository.watch(uid, collection, (records) => {
    if (!current()) return;
    const legacy = records.map((record) => legacyRecord(collection, record));
    const ids = new Set(legacy.map((record) => sourceIdFor(collection, record)));
    const protectedIds = new Set([...pending.values()].filter((item) => item.collection === collection && item.operation === 'upsert').map((item) => item.sourceId));
    const deletedIds = new Set([...pending.values()].filter((item) => item.collection === collection && item.operation === 'delete').map((item) => item.sourceId));
    const visible = legacy.filter((record) => !deletedIds.has(sourceIdFor(collection, record)));
    storageService.applyCloudSnapshot(collection as SyncCollection, visible, previousIds.get(collection) || new Set(), protectedIds);
    previousIds.set(collection, ids);
  }, reportCurrentError));
  unsubs.push(onSnapshot(doc(firestore, 'users', uid), (snapshot) => {
    if (!current() || !snapshot.exists()) return;
    const settings = snapshot.data();
    if (settings.syncEnabled !== true) { stopActiveDataSync(); return; }
    storageService.applyCloudSnapshot('userSettings', [settings], new Set());
  }, reportCurrentError));
  const onOnline = () => void flushMutations(uid);
  window.addEventListener(storageMutationEvent, queueMutation);
  window.addEventListener('online', onOnline);
  stopDataSync = () => { for (const unsubscribe of unsubs) unsubscribe(); window.removeEventListener(storageMutationEvent, queueMutation); window.removeEventListener('online', onOnline); };
  if (typeof navigator === 'undefined' || navigator.onLine) void flushMutations(uid);
}

export const accountSyncService = {
  async enable(uid: string): Promise<void> {
    if (!firestore) throw new Error('Firebase is not configured.');
    const generation = authGeneration;
    const requireCurrentAccount = () => {
      if (firebaseAuth?.currentUser?.uid !== uid || authGeneration !== generation) {
        throw new Error('La sesión cambió. Inicia sesión de nuevo antes de activar la sincronización.');
      }
    };
    requireCurrentAccount();
    const initialSettings = userSettingsPayload(uid);
    const userRef = doc(firestore, 'users', uid);
    await runTransaction(firestore, async (transaction) => {
      const existing = await transaction.get(userRef);
      requireCurrentAccount();
      transaction.set(userRef, {
        ...(existing.exists() ? {} : initialSettings),
        ownerUid: uid, schemaVersion: 1, syncEnabled: true, updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    requireCurrentAccount();
    activateDataSync(uid);
  },
  initializeAuthObserver(): () => void {
    if (!firebaseAuth || !firestore || stopAuthObserver) return () => undefined;
    stopAuthObserver = onAuthStateChanged(firebaseAuth, (user) => {
      const observedGeneration = ++authGeneration;
      stopUserDocument?.(); stopUserDocument = null;
      if (!user) { stopActiveDataSync(); setStorageScope(preferredUnauthenticatedScope()); return; }
      if (activeUid && activeUid !== user.uid) stopActiveDataSync();
      const currentAuth = () => authGeneration === observedGeneration && firebaseAuth?.currentUser?.uid === user.uid;
      stopUserDocument = onSnapshot(doc(firestore!, 'users', user.uid), (snapshot) => {
        if (!currentAuth()) return;
        if (snapshot.exists() && snapshot.data().syncEnabled === true) activateDataSync(user.uid);
        else if (activeUid === user.uid) stopActiveDataSync();
      }, (error) => { if (currentAuth()) reportSyncError(error); });
    }, reportSyncError);
    return () => { authGeneration += 1; stopUserDocument?.(); stopUserDocument = null; stopAuthObserver?.(); stopAuthObserver = null; stopActiveDataSync(); };
  },
  getConflicts(uid: string): AccountSyncConflict[] {
    return activeUid === uid ? [...conflicts.values()].filter((conflict) => conflict.uid === uid) : [];
  },
  async resolveConflict(uid: string, collection: AccountCollection, sourceId: string, choice: 'keepLocal' | 'useCloud'): Promise<void> {
    if (activeUid !== uid) throw new Error('The account changed before the conflict was resolved.');
    const key = mutationKey(collection, sourceId);
    const conflict = conflicts.get(key);
    if (!conflict || conflict.uid !== uid) return;
    if (choice === 'useCloud') {
      pending.delete(key);
      storageService.applyCloudSnapshot(collection, conflict.remoteRecord ? [conflict.remoteRecord] : [], new Set([sourceId]));
    } else {
      const revision = conflict.remoteRecord ? cloudRevision(conflict.remoteRecord) : null;
      const mutation = pending.get(key);
      if (mutation?.operation === 'delete') pending.set(key, { ...mutation, expectedRevision: revision });
      else storageService.setCloudRevision(collection, sourceId, revision);
    }
    conflicts.delete(key);
    blockedMutations.delete(key);
    persistConflicts(uid);
    persistPending(uid);
    if (choice === 'keepLocal' && pending.has(key)) {
      if (flushTimer !== undefined) window.clearTimeout(flushTimer);
      flushTimer = window.setTimeout(() => { flushTimer = undefined; void flushMutations(uid); }, 0);
    }
  },
  stop: stopActiveDataSync,
};

import { verifyMigratedRecord } from '../../shared/migrationVerification';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, where, type Firestore } from 'firebase/firestore';
import { encodeFirestoreRecord } from '../../shared/firestoreCodec';
import { migrationDocumentId, type LegacyCollection, type LegacyMigrationItem, type MigrationTarget } from '../services/localMigrationService';

const paths: Record<LegacyCollection, string> = {
  transactions: 'transactions', savingsMovements: 'savingsMovements', savingsGoals: 'savingsGoals',
  monthConfigurations: 'monthConfigurations', categoryBudgets: 'categoryBudgets',
};

/** Firestore adapter for the explicit, preview-first local-to-account migration flow. */
export class FirestoreMigrationTarget implements MigrationTarget {
  constructor(private readonly db: Firestore) {}
  private records(uid: string, type: LegacyCollection) {
    return collection(this.db, 'users', uid, paths[type]);
  }
  async existingSourceIds(uid: string, type: LegacyCollection, sourceIds: string[]): Promise<Set<string>> {
    const reference = this.records(uid, type);
    const existing = new Set<string>();
    const chunkSize = 30;
    for (let offset = 0; offset < sourceIds.length; offset += chunkSize) {
      const chunk = [...new Set(sourceIds.slice(offset, offset + chunkSize))];
      if (!chunk.length) continue;
      const snapshot = await getDocs(query(reference, where('localSourceId', 'in', chunk)));
      for (const record of snapshot.docs) {
        existing.add(record.id);
        const localSourceId = record.data().localSourceId;
        if (typeof localSourceId === 'string') existing.add(localSourceId);
      }
    }
    // A record may occupy the deterministic destination ID without having the
    // migration marker. Detect it explicitly so a later write cannot replace it.
    for (const sourceId of new Set(sourceIds)) {
      const targetId = migrationDocumentId(type, sourceId);
      if ((await getDoc(doc(reference, targetId))).exists()) existing.add(targetId);
    }
    return existing;
  }
  async writeBatch(uid: string, items: LegacyMigrationItem[]): Promise<void> {
    const limit = 400;
    for (let offset = 0; offset < items.length; offset += limit) {
      const chunk = items.slice(offset, offset + limit);
      await runTransaction(this.db, async (transaction) => {
        const references = chunk.map((item) => doc(this.records(uid, item.collection), item.documentId));
        const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)));
        if (snapshots.some((snapshot) => snapshot.exists())) {
          throw new Error('Un destino de migración ya existe. Actualiza la vista previa; no se sobrescribió ningún registro.');
        }
        chunk.forEach((item, index) => {
          const safeData = encodeFirestoreRecord(item.data);
          transaction.set(references[index], {
            ...safeData, ownerUid: uid, schemaVersion: 1,
            createdAt: item.data.createdAt || serverTimestamp(), updatedAt: serverTimestamp(),
          });
        });
      });
    }
  }
  async verifiedSourceIds(uid: string, type: LegacyCollection, sourceIds: string[], expectedItems: LegacyMigrationItem[]): Promise<Set<string>> {
    const expectedById = new Map(expectedItems.map((item) => [item.documentId, item]));
    const verified = new Set<string>();
    const reference = this.records(uid, type);
    const chunkSize = 30;
    for (let offset = 0; offset < sourceIds.length; offset += chunkSize) {
      const chunk = [...new Set(sourceIds.slice(offset, offset + chunkSize))];
      if (!chunk.length) continue;
      const snapshot = await getDocs(query(reference, where('localSourceId', 'in', chunk)));
      for (const record of snapshot.docs) {
        const localSourceId = record.data().localSourceId;
        const expected = expectedById.get(record.id);
        if (expected && typeof localSourceId === 'string' && verifyMigratedRecord({
          uid, collection: type, sourceId: expected.sourceId, documentId: expected.documentId,
          actualDocumentId: record.id, expected: expected.data, actual: record.data(),
        })) verified.add(localSourceId);
      }
    }
    return verified;
  }
  async hasUserSettings(uid: string): Promise<boolean> {
    const snapshot = await getDoc(doc(this.db, 'users', uid));
    return snapshot.exists();
  }
  async writeUserSettings(uid: string, settings: Record<string, unknown>): Promise<void> {
    const reference = doc(this.db, 'users', uid);
    await runTransaction(this.db, async (transaction) => {
      const current = await transaction.get(reference);
      if (current.exists()) {
        throw new Error('El perfil de la cuenta ya existe. Actualiza la vista previa; sus preferencias se conservaron.');
      }
      transaction.set(reference, {
        ...settings, ownerUid: uid, schemaVersion: 1,
        settingsImportedFromLocal: true, updatedAt: serverTimestamp(),
      });
    });
  }
  async verifyUserSettings(uid: string, settings: Record<string, unknown>): Promise<boolean> {
    const snapshot = await getDoc(doc(this.db, 'users', uid));
    if (!snapshot.exists() || snapshot.data().ownerUid !== uid || snapshot.data().schemaVersion !== 1 || snapshot.data().settingsImportedFromLocal !== true) return false;
    return Object.entries(settings).every(([key, value]) => snapshot.data()[key] === value);
  }
}

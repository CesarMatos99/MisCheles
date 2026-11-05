import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where, writeBatch, type Firestore } from 'firebase/firestore';
import { CloudRevisionConflictError, isStaleCloudWrite, type RevisionToken } from './syncRevision';
import { decodeFirestoreRecord, encodeFirestoreRecord } from '../../shared/firestoreCodec';

export const ACCOUNT_COLLECTIONS = [
  'transactions', 'savingsMovements', 'savingsGoals', 'monthConfigurations', 'categoryBudgets',
] as const;
export type AccountCollection = (typeof ACCOUNT_COLLECTIONS)[number];
export type AccountRecord = Record<string, unknown> & { id: string; ownerUid: string; schemaVersion: 1 };

/** UID-scoped web repository shared with the Flutter collection layout. */
export class AccountRepository {
  constructor(private readonly db: Firestore) {}
  private records(uid: string, name: AccountCollection) {
    if (!uid.trim()) throw new Error('A signed-in UID is required.');
    return collection(this.db, 'users', uid, name);
  }
  async list(uid: string, name: AccountCollection): Promise<AccountRecord[]> {
    const snapshot = await getDocs(this.records(uid, name));
    return snapshot.docs.map((record) => decodeFirestoreRecord(record.id, record.data(), name) as AccountRecord);
  }
  watch(uid: string, name: AccountCollection, next: (items: AccountRecord[]) => void, error?: (reason: Error) => void) {
    return onSnapshot(this.records(uid, name), (snapshot) => {
      next(snapshot.docs.map((record) => decodeFirestoreRecord(record.id, record.data(), name) as AccountRecord));
    }, error);
  }
  async get(uid: string, name: AccountCollection, id: string): Promise<AccountRecord | null> {
    const snapshot = await getDoc(doc(this.records(uid, name), id));
    return snapshot.exists() ? (decodeFirestoreRecord(snapshot.id, snapshot.data(), name) as AccountRecord) : null;
  }
  async write(uid: string, name: AccountCollection, items: AccountRecord[]): Promise<void> {
    const limit = 400;
    for (let offset = 0; offset < items.length; offset += limit) {
      const batch = writeBatch(this.db);
      for (const item of items.slice(offset, offset + limit)) {
        if (!item.id || item.ownerUid !== uid || item.schemaVersion !== 1) {
          throw new Error('Record ownership or schema is invalid.');
        }
        batch.set(doc(this.records(uid, name), item.id), {
          ...encodeFirestoreRecord(item), updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }
  async writeIfRevisionMatches(uid: string, name: AccountCollection, item: AccountRecord, expectedRevision: RevisionToken | null): Promise<void> {
    if (!item.id || item.ownerUid !== uid || item.schemaVersion !== 1) throw new Error('Record ownership or schema is invalid.');
    const reference = doc(this.records(uid, name), item.id);
    await runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const remote = snapshot.exists() ? snapshot.data() : null;
      if (isStaleCloudWrite(expectedRevision, remote)) throw new CloudRevisionConflictError();
      transaction.set(reference, { ...encodeFirestoreRecord(item), updatedAt: serverTimestamp() });
    });
  }

  async removeBySourceId(uid: string, name: AccountCollection, sourceId: string, fallbackIds: string[], expectedRevision: RevisionToken | null): Promise<void> {
    const refs = new Map<string, ReturnType<typeof doc>>();
    const matches = await getDocs(query(this.records(uid, name), where('localSourceId', '==', sourceId)));
    for (const item of matches.docs) refs.set(item.id, doc(this.records(uid, name), item.id));
    for (const id of fallbackIds) {
      if (!id.trim()) continue;
      const reference = doc(this.records(uid, name), id);
      if ((await getDoc(reference)).exists()) refs.set(id, reference);
    }
    if (!refs.size) return;
    if (refs.size > 400) throw new Error('Too many duplicate cloud records to remove safely from this device.');
    const references = [...refs.values()];
    await runTransaction(this.db, async (transaction) => {
      const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)));
      for (const snapshot of snapshots) {
        if (!snapshot.exists()) continue;
        if (isStaleCloudWrite(expectedRevision, snapshot.data())) throw new CloudRevisionConflictError();
      }
      for (let index = 0; index < references.length; index += 1) {
        if (snapshots[index].exists()) transaction.delete(references[index]);
      }
    });
  }

  async findBySourceId(uid: string, name: AccountCollection, sourceId: string, fallbackIds: string[]): Promise<AccountRecord | null> {
    const matches = await getDocs(query(this.records(uid, name), where('localSourceId', '==', sourceId)));
    const first = matches.docs[0];
    if (first) return decodeFirestoreRecord(first.id, first.data(), name) as AccountRecord;
    for (const id of fallbackIds) {
      if (!id.trim()) continue;
      const record = await this.get(uid, name, id);
      if (record) return record;
    }
    return null;
  }
  async remove(uid: string, name: AccountCollection, id: string, expectedRevision: RevisionToken | null): Promise<void> {
    if (!id.trim()) throw new Error('A record ID is required.');
    const reference = doc(this.records(uid, name), id);
    await runTransaction(this.db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) return;
      if (isStaleCloudWrite(expectedRevision, snapshot.data())) throw new CloudRevisionConflictError();
      transaction.delete(reference);
    });
  }
}

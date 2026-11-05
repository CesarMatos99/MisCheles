import type { Firestore } from 'firebase-admin/firestore';
import type { EncryptedMailTokenEnvelope, PrivateMailTokenStore, StoredMailTokenRecord } from './encrypted_mail_token_vault';
import type { MailProvider } from './mail_import_contract';

/** Admin-only collection; the catch-all client Firestore rule denies access to this path. */
export class FirestorePrivateMailTokenStore implements PrivateMailTokenStore {
  private readonly db: Firestore;
  private readonly serverTimestamp: () => unknown;
  constructor(db: Firestore, serverTimestamp: () => unknown) { this.db = db; this.serverTimestamp = serverTimestamp; }
  private reference(uid: string, connectionId: string) {
    if (!uid.trim() || uid.includes('/') || !connectionId.trim() || connectionId.includes('/')) throw new Error('Invalid private token path.');
    return this.db.collection('privateMailTokens').doc(uid).collection('connections').doc(connectionId);
  }
  async read(uid: string, connectionId: string): Promise<StoredMailTokenRecord | null> {
    const snapshot = await this.reference(uid, connectionId).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data()!;
    if (data.ownerUid !== uid || data.connectionId !== connectionId || (data.provider !== 'gmail' && data.provider !== 'outlook')
      || !Number.isSafeInteger(data.revision) || data.revision < 1 || data.schemaVersion !== 1
      || !data.envelope || typeof data.envelope !== 'object') throw new Error('Private mail token record is malformed.');
    return { provider: data.provider as MailProvider, connectionId, revision: data.revision as number, envelope: data.envelope as EncryptedMailTokenEnvelope };
  }
  async compareAndSet(uid: string, connectionId: string, expectedRevision: number | null, next: StoredMailTokenRecord): Promise<boolean> {
    if (next.connectionId !== connectionId || next.revision !== (expectedRevision ?? 0) + 1) throw new Error('Private token revision is invalid.');
    const reference = this.reference(uid, connectionId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const currentRevision = snapshot.exists ? snapshot.data()?.revision : null;
      if (currentRevision !== expectedRevision) return false;
      const data = { ownerUid: uid, connectionId, provider: next.provider, schemaVersion: 1, revision: next.revision, envelope: next.envelope, updatedAt: this.serverTimestamp() };
      if (snapshot.exists) transaction.set(reference, data);
      else transaction.create(reference, data);
      return true;
    });
  }
  async deleteIfRevisionMatches(uid: string, connectionId: string, expectedRevision: number): Promise<boolean> {
    const reference = this.reference(uid, connectionId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists || snapshot.data()?.revision !== expectedRevision) return false;
      transaction.delete(reference);
      return true;
    });
  }
}

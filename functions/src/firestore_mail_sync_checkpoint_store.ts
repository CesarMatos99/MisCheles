import type { Firestore } from 'firebase-admin/firestore';
import type { MailSyncCheckpoint, MailSyncCheckpointStore } from './mail_sync_contract';
import type { MailProvider } from './mail_import_contract';

/** Stores opaque provider cursors alongside private mail credentials, inaccessible to client SDKs. */
export class FirestoreMailSyncCheckpointStore implements MailSyncCheckpointStore {
  private readonly db: Firestore;
  constructor(db: Firestore) { this.db = db; }

  private reference(uid: string, connectionId: string) {
    validatePath(uid, connectionId);
    return this.db.collection('privateMailTokens').doc(uid).collection('syncState').doc(connectionId);
  }

  async read(uid: string, connectionId: string): Promise<MailSyncCheckpoint | null> {
    const snapshot = await this.reference(uid, connectionId).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data();
    if (data?.schemaVersion !== 1) throw new Error('Stored mail sync checkpoint is malformed.');
    const checkpoint = {
      uid: data?.uid,
      connectionId: data?.connectionId,
      provider: data?.provider,
      revision: data?.revision,
      initialized: data?.initialized,
      cursor: data?.cursor,
      lastSyncAtMs: data?.lastSyncAtMs,
    } as MailSyncCheckpoint;
    validateCheckpoint(checkpoint);
    if (checkpoint.uid !== uid || checkpoint.connectionId !== connectionId) throw new Error('Mail sync checkpoint owner mismatch.');
    return checkpoint;
  }

  async compareAndSet(uid: string, connectionId: string, expectedRevision: number | null, next: MailSyncCheckpoint): Promise<boolean> {
    validatePath(uid, connectionId);
    validateCheckpoint(next);
    if (next.uid !== uid || next.connectionId !== connectionId || next.revision !== (expectedRevision ?? 0) + 1) throw new Error('Mail sync checkpoint revision or owner is invalid.');
    const reference = this.reference(uid, connectionId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const data = snapshot.exists ? snapshot.data() : undefined;
      if (snapshot.exists) {
        if (data?.schemaVersion !== 1) throw new Error('Stored mail sync checkpoint is malformed.');
        validateCheckpoint(data as MailSyncCheckpoint);
        if (data.uid !== uid || data.connectionId !== connectionId) throw new Error('Stored mail sync checkpoint owner mismatch.');
      }
      const currentRevision = snapshot.exists ? data?.revision : null;
      if (currentRevision !== expectedRevision) return false;
      transaction.set(reference, { ...next, schemaVersion: 1 });
      return true;
    });
  }
}

function validatePath(uid: string, connectionId: string): void {
  if (typeof uid !== 'string' || !uid.trim() || uid.length > 128 || uid.includes('/') || typeof connectionId !== 'string' || !connectionId.trim() || connectionId.length > 256 || connectionId.includes('/')) throw new Error('Mail sync checkpoint path is invalid.');
}

function validateCheckpoint(value: MailSyncCheckpoint): void {
  if (!value || typeof value.uid !== 'string' || !value.uid.trim() || value.uid.length > 128 || value.uid.includes('/')
    || typeof value.connectionId !== 'string' || !value.connectionId.trim() || value.connectionId.length > 256 || value.connectionId.includes('/')
    || (value.provider !== 'gmail' && value.provider !== 'outlook')
    || !Number.isSafeInteger(value.revision) || value.revision < 1
    || value.initialized !== true
    || !(value.cursor === null || (typeof value.cursor === 'string' && value.cursor.length <= 16_384 && !/[\u0000-\u001f]/.test(value.cursor)))
    || !Number.isSafeInteger(value.lastSyncAtMs) || value.lastSyncAtMs < 0) throw new Error('Mail sync checkpoint is invalid.');
}

import type { Firestore } from 'firebase-admin/firestore';
import { MAIL_OAUTH_STATE_TTL_MS, type MailOAuthStateStore, type PendingMailAuthorization } from './mail_oauth_flow';

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

/** Server-only, short-lived state store. Client Firestore Rules must never allow this collection. */
export class FirestoreMailOAuthStateStore implements MailOAuthStateStore {
  private readonly db: Firestore;

  constructor(db: Firestore) { this.db = db; }

  async create(record: PendingMailAuthorization): Promise<void> {
    validatePendingRecord(record);
    const reference = this.db.collection('privateMailOAuthStates').doc(record.stateHash);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) throw new Error('Authorization state collision. Restart the connection flow.');
      transaction.create(reference, { ...record, expiresAt: new Date(record.expiresAtMs), schemaVersion: 1 });
    });
  }

  async consume(stateHash: string, nowMs: number): Promise<PendingMailAuthorization | null> {
    if (!HASH_PATTERN.test(stateHash) || !Number.isSafeInteger(nowMs) || nowMs < 0) return null;
    const reference = this.db.collection('privateMailOAuthStates').doc(stateHash);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return null;
      // Delete before returning, including for malformed and expired records, to prevent replay.
      transaction.delete(reference);
      const data = snapshot.data();
      if (!data || data.schemaVersion !== 1 || data.stateHash !== stateHash || data.expiresAtMs <= nowMs) return null;
      const record = {
        stateHash: data.stateHash,
        connectionId: data.connectionId,
        uid: data.uid,
        provider: data.provider,
        codeVerifier: data.codeVerifier,
        redirectUri: data.redirectUri,
        scopes: data.scopes,
        createdAtMs: data.createdAtMs,
        expiresAtMs: data.expiresAtMs,
      } as PendingMailAuthorization;
      try { validatePendingRecord(record); } catch { return null; }
      if (record.expiresAtMs - record.createdAtMs !== MAIL_OAUTH_STATE_TTL_MS) return null;
      return record;
    });
  }
}

function validatePendingRecord(record: PendingMailAuthorization): void {
  if (!record || !HASH_PATTERN.test(record.stateHash)
    || typeof record.connectionId !== 'string' || !record.connectionId.trim() || record.connectionId.includes('/') || record.connectionId.length > 256
    || typeof record.uid !== 'string' || !record.uid.trim() || record.uid.length > 128 || record.uid.includes('/')
    || (record.provider !== 'gmail' && record.provider !== 'outlook')
    || typeof record.codeVerifier !== 'string' || !VERIFIER_PATTERN.test(record.codeVerifier)
    || typeof record.redirectUri !== 'string' || !record.redirectUri.startsWith('https://')
    || !Array.isArray(record.scopes) || record.scopes.length < 1 || record.scopes.length > 20
    || record.scopes.some((scope) => typeof scope !== 'string' || !scope.trim() || scope.length > 256)
    || !Number.isSafeInteger(record.createdAtMs) || !Number.isSafeInteger(record.expiresAtMs)
    || record.expiresAtMs - record.createdAtMs !== MAIL_OAUTH_STATE_TTL_MS) {
    throw new Error('OAuth authorization state record is invalid.');
  }
}

/** Removes every pending OAuth verifier belonging to a deleted account. */
export async function deletePendingMailOAuthStatesForUid(db: Firestore, uid: string): Promise<number> {
  if (typeof uid !== 'string' || !uid.trim() || uid.length > 128 || uid.includes('/')) throw new Error('A valid account UID is required.');
  let deleted = 0;
  while (true) {
    const page = await db.collection('privateMailOAuthStates').where('uid', '==', uid).limit(400).get();
    if (page.empty) return deleted;
    const batch = db.batch();
    for (const document of page.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += page.size;
  }
}

/** Prunes expired one-time OAuth records; run from a trusted scheduled Function. */
export async function deleteExpiredMailOAuthStates(db: Firestore, nowMs = Date.now()): Promise<number> {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('OAuth cleanup time is invalid.');
  let deleted = 0;
  while (true) {
    const page = await db.collection('privateMailOAuthStates').where('expiresAtMs', '<=', nowMs).limit(400).get();
    if (page.empty) return deleted;
    const batch = db.batch();
    for (const document of page.docs) batch.delete(document.ref);
    await batch.commit();
    deleted += page.size;
  }
}

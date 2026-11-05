import type { Firestore } from 'firebase-admin/firestore';
import type { MailConnectionAccessReader } from './encrypted_mail_token_vault';
import type { MailProvider } from './mail_import_contract';

export type MailConnectionStatus = 'active' | 'reauthorization_required' | 'disconnected';

export interface MailConnectionMetadataInput {
  provider: MailProvider;
  emailAddress: string;
  grantedScopes: string[];
  status: MailConnectionStatus;
  connectedAt: string;
  lastSyncAt?: string;
}

export interface MailConnectionMetadataDocument {
  id: string;
  ownerUid: string;
  schemaVersion: 1;
  provider: MailProvider;
  maskedAddress: string;
  grantedScopes: string[];
  status: MailConnectionStatus;
  connectedAt: string;
  lastSyncAt?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Masks the mailbox identity before any account metadata is persisted. */
export function maskMailAddress(address: string): string {
  const normalized = address.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 1 || at === normalized.length - 1 || normalized.length > 254 || /\s/.test(normalized)) {
    throw new Error('Provider mailbox address is invalid.');
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    throw new Error('Provider mailbox address is invalid.');
  }
  return local[0] + '***@' + domain;
}

function validIsoInstant(value: string): boolean {
  return value.length <= 64
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function mailConnectionMetadataDocument(
  id: string,
  ownerUid: string,
  input: MailConnectionMetadataInput,
  createdAt: unknown,
  updatedAt: unknown,
): MailConnectionMetadataDocument {
  if (!id.trim() || id.includes('/') || id.length > 256 || !ownerUid.trim() || ownerUid.includes('/') || ownerUid.length > 128) {
    throw new Error('Mail connection owner or ID is invalid.');
  }
  if (input.provider !== 'gmail' && input.provider !== 'outlook') {
    throw new Error('Mail provider is invalid.');
  }
  if (input.status !== 'active' && input.status !== 'reauthorization_required' && input.status !== 'disconnected') {
    throw new Error('Mail connection status is invalid.');
  }
  if (!validIsoInstant(input.connectedAt) || (input.lastSyncAt !== undefined && !validIsoInstant(input.lastSyncAt))) {
    throw new Error('Mail connection timestamps are invalid.');
  }
  if (!Array.isArray(input.grantedScopes) || input.grantedScopes.length > 20 || input.grantedScopes.some((scope) => typeof scope !== 'string' || !scope.trim() || scope.length > 256)) {
    throw new Error('Mail permission scope metadata is invalid.');
  }
  const uniqueScopes = [...new Set(input.grantedScopes.map((scope) => scope.trim()))].sort();
  return {
    id,
    ownerUid,
    schemaVersion: 1,
    provider: input.provider,
    maskedAddress: maskMailAddress(input.emailAddress),
    grantedScopes: uniqueScopes,
    status: input.status,
    connectedAt: input.connectedAt,
    ...(input.lastSyncAt ? { lastSyncAt: input.lastSyncAt } : {}),
    createdAt,
    updatedAt,
  };
}

/** Admin SDK writer for sanitized metadata. OAuth tokens/cursors are never accepted as input. */
export class FirestoreMailConnectionMetadataStore implements MailConnectionAccessReader {
  private readonly db: Firestore;
  private readonly serverTimestamp: () => unknown;

  constructor(db: Firestore, serverTimestamp: () => unknown) {
    this.db = db;
    this.serverTimestamp = serverTimestamp;
  }

  async upsert(uid: string, connectionId: string, input: MailConnectionMetadataInput): Promise<void> {
    if (!uid.trim() || uid.includes('/') || !connectionId.trim() || connectionId.includes('/')) {
      throw new Error('Mail connection owner or ID is invalid.');
    }
    const reference = this.db.collection('users').doc(uid).collection('mailConnections').doc(connectionId);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.exists ? snapshot.data() : undefined;
      const createdAt = current?.ownerUid === uid && current?.id === connectionId && current.createdAt !== undefined
        ? current.createdAt
        : this.serverTimestamp();
      const document = mailConnectionMetadataDocument(connectionId, uid, input, createdAt, this.serverTimestamp());
      transaction.set(reference, document);
    });
  }

  async isActive(uid: string, connectionId: string, provider: MailProvider): Promise<boolean> {
    if (!uid.trim() || uid.includes('/') || !connectionId.trim() || connectionId.includes('/')) return false;
    const reference = this.db.collection('users').doc(uid).collection('mailConnections').doc(connectionId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return false;
    const data = snapshot.data();
    return data?.ownerUid === uid && data?.id === connectionId && data?.provider === provider && data?.status === 'active';
  }

  async delete(uid: string, connectionId: string): Promise<void> {
    if (!uid.trim() || uid.includes('/') || !connectionId.trim() || connectionId.includes('/')) {
      throw new Error('Mail connection owner or ID is invalid.');
    }
    await this.db.collection('users').doc(uid).collection('mailConnections').doc(connectionId).delete();
  }
}

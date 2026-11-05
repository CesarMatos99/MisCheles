import type { MailAuthContext, MailProvider, MailTokenVault, ProviderMessageRef } from './mail_import_contract';

export interface MailSyncCheckpoint {
  uid: string;
  connectionId: string;
  provider: MailProvider;
  revision: number;
  initialized: boolean;
  cursor: string | null;
  lastSyncAtMs: number;
}

export interface MailSyncCheckpointStore {
  read(uid: string, connectionId: string): Promise<MailSyncCheckpoint | null>;
  compareAndSet(uid: string, connectionId: string, expectedRevision: number | null, next: MailSyncCheckpoint): Promise<boolean>;
}

export interface MailProviderDeltaSource {
  fetchPage(input: { uid: string; connectionId: string; provider: MailProvider; accessToken: string; initialized: boolean; cursor: string | null; }): Promise<{ messages: ProviderMessageRef[]; initialized: boolean; nextCursor: string | null; hasMore: boolean }>;
}

export interface MailSyncResult {
  provider: MailProvider;
  connectionId: string;
  pages: number;
  messages: number;
  candidatesCreated: number;
  duplicates: number;
  ignored: number;
  complete: boolean;
  checkpointRevision: number;
}

export class MailSyncConflictError extends Error {
  constructor() { super('Mail synchronization changed concurrently. Retry using the latest checkpoint.'); }
}

/** Processes bounded provider pages. The cursor advances only after each page is durably reviewed/idempotently staged. */
export async function syncMailConnection(input: {
  auth: MailAuthContext | null;
  connectionId: string;
  provider: MailProvider;
  checkpointStore: MailSyncCheckpointStore;
  source: MailProviderDeltaSource;
  tokenVault: MailTokenVault;
  processMessage: (message: ProviderMessageRef, auth: MailAuthContext, now: Date, accessToken: string) => Promise<'duplicate' | 'ignored' | 'candidate_created'>;
  now?: () => number;
  maxPages?: number;
}): Promise<MailSyncResult> {
  const uid = input.auth?.uid;
  if (!uid || input.auth?.token?.email_verified !== true || uid.length > 128 || uid.includes('/')) throw new Error('A verified account is required to synchronize mail.');
  if ((input.provider !== 'gmail' && input.provider !== 'outlook') || !input.connectionId.trim() || input.connectionId.length > 256 || input.connectionId.includes('/')) throw new Error('Mail connection is invalid.');
  const maxPages = input.maxPages ?? 3;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10) throw new Error('Mail synchronization page limit is invalid.');
  const now = input.now ?? Date.now;
  let checkpoint = await input.checkpointStore.read(uid, input.connectionId);
  if (checkpoint && (checkpoint.uid !== uid || checkpoint.connectionId !== input.connectionId || checkpoint.provider !== input.provider)) throw new Error('Mail sync checkpoint ownership or provider mismatch.');
  let cursor = checkpoint?.cursor ?? null;
  let initialized = checkpoint?.initialized ?? false;
  let revision = checkpoint?.revision ?? null;
  const result: MailSyncResult = { provider: input.provider, connectionId: input.connectionId, pages: 0, messages: 0, candidatesCreated: 0, duplicates: 0, ignored: 0, complete: true, checkpointRevision: revision ?? 0 };
  const auth: MailAuthContext = { uid, token: { email_verified: true } };

  while (result.pages < maxPages) {
    const accessToken = await input.tokenVault.getValidAccessToken(uid, input.connectionId, input.provider);
    const page = await input.source.fetchPage({ uid, connectionId: input.connectionId, provider: input.provider, accessToken, initialized, cursor });
    validatePage(input.provider, page, cursor);
    for (const message of page.messages) {
      const outcome = await input.processMessage(message, auth, new Date(now()), accessToken);
      result.messages += 1;
      if (outcome === 'candidate_created') result.candidatesCreated += 1;
      else if (outcome === 'duplicate') result.duplicates += 1;
      else result.ignored += 1;
    }
    const timestamp = now();
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error('Mail sync time is invalid.');
    const next: MailSyncCheckpoint = {
      uid, connectionId: input.connectionId, provider: input.provider,
      revision: (revision ?? 0) + 1, initialized: page.initialized,
      cursor: page.nextCursor, lastSyncAtMs: timestamp,
    };
    if (!await input.checkpointStore.compareAndSet(uid, input.connectionId, revision, next)) throw new MailSyncConflictError();
    checkpoint = next;
    revision = next.revision;
    initialized = next.initialized;
    cursor = next.cursor;
    result.pages += 1;
    result.checkpointRevision = next.revision;
    if (!page.hasMore) return result;
  }
  result.complete = false;
  return result;
}

function validatePage(provider: MailProvider, page: Awaited<ReturnType<MailProviderDeltaSource['fetchPage']>>, cursor: string | null): void {
  if (!page || !Array.isArray(page.messages) || page.messages.length > 50 || page.initialized !== true || typeof page.hasMore !== 'boolean') throw new Error('Mail provider returned an invalid page.');
  if (page.hasMore && (!page.initialized || typeof page.nextCursor !== 'string' || !page.nextCursor.trim() || page.nextCursor.length > 16_384 || /[\u0000-\u001f]/.test(page.nextCursor) || page.nextCursor === cursor)) throw new Error('Mail provider pagination cursor is invalid.');
  if (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || page.nextCursor.length > 16_384 || /[\u0000-\u001f]/.test(page.nextCursor))) throw new Error('Mail provider checkpoint is invalid.');
  const ids = new Set<string>();
  for (const message of page.messages) {
    if (message.provider !== provider || typeof message.providerMessageId !== 'string' || !message.providerMessageId.trim() || message.providerMessageId.length > 4096 || ids.has(message.providerMessageId) || !Number.isFinite(Date.parse(message.receivedAt))) throw new Error('Mail provider message reference is invalid.');
    ids.add(message.providerMessageId);
  }
}

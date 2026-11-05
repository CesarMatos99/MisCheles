import { createHash } from 'node:crypto';

export type MailProvider = 'gmail' | 'outlook';
export type CandidateStatus = 'pending_review' | 'possible_duplicate' | 'confirmed' | 'ignored';

export interface MailAuthContext {
  uid: string;
  token: { email_verified?: unknown };
}

export interface ProviderMessageRef {
  provider: MailProvider;
  providerMessageId: string;
  receivedAt: string;
}

export interface ParsedBankNotice {
  transactionType: 'income' | 'expense';
  occurredOn: string;
  occurredAt?: string;
  amountMinor: number;
  currency: string;
  merchant: string;
  bankName?: string;
  /** Raw reference is transient; only its SHA-256 is returned to persistence. */
  bankReference?: string;
  paymentInstrumentLastFour?: string;
  description: string;
  paymentHint?: 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other';
}

export interface ImportedCandidateDocument extends Omit<ParsedBankNotice, 'bankReference'> {
  bankReferenceHash?: string;
  id: string;
  ownerUid: string;
  schemaVersion: 1;
  provider: MailProvider;
  providerMessageId: string;
  connectionId: string;
  messageFingerprint: string;
  dedupeKey: string;
  receivedAt: string;
  reviewStatus: CandidateStatus;
  possibleDuplicateTransactionIds: string[];
  confirmedMovementId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Backend-only ports. Implementations must never return access/refresh tokens to a client. */
export interface MailTokenVault {
  /** Must verify that this UID owns the active connection for this provider. */
  getValidAccessToken(uid: string, connectionId: string, provider: MailProvider): Promise<string>;
  revoke(uid: string, connectionId: string, provider: MailProvider): Promise<void>;
}

export interface CandidatePersistence {
  hasMessage(uid: string, provider: MailProvider, connectionId: string, providerMessageId: string): Promise<boolean>;
  findPossibleDuplicateTransactions(uid: string, parsed: ParsedBankNotice): Promise<string[]>;
  /** Atomically create by the candidate ID; return false when another delivery already created it. */
  saveCandidateIfAbsent(candidate: ImportedCandidateDocument): Promise<boolean>;
}

export interface SafeMessageReader {
  readProviderNotice(token: string, message: ProviderMessageRef): Promise<ParsedBankNotice | null>;
}

function requireVerifiedMailOwner(auth: MailAuthContext | null): string {
  if (!auth || typeof auth.uid !== 'string' || !auth.uid.trim() || auth.token?.email_verified !== true) {
    throw new Error('A verified signed-in owner and mail connection are required.');
  }
  return auth.uid;
}

export async function processBankNotice(input: {
  auth: MailAuthContext | null;
  connectionId: string;
  message: ProviderMessageRef;
  tokenVault: MailTokenVault;
  reader: SafeMessageReader;
  persistence: CandidatePersistence;
  /** Server-internal token already validated for the current bounded sync page. */
  providerAccessToken?: string;
  now?: Date;
}): Promise<'duplicate' | 'ignored' | 'candidate_created'> {
  const uid = requireVerifiedMailOwner(input.auth);
  if (!input.connectionId.trim()) throw new Error('A verified signed-in owner and mail connection are required.');
  if (!isValidMessageRef(input.message) || uid.length > 128 || input.connectionId.length > 256 || input.connectionId.includes('/')) throw new Error('Invalid provider message reference.');
  if (await input.persistence.hasMessage(uid, input.message.provider, input.connectionId, input.message.providerMessageId)) return 'duplicate';
  const token = input.providerAccessToken ?? await input.tokenVault.getValidAccessToken(uid, input.connectionId, input.message.provider);
  if (typeof token !== 'string' || !token.trim() || token.length > 16_384) throw new Error('A valid provider access token is required.');
  const parsed = await input.reader.readProviderNotice(token, input.message);
  if (!parsed || !isValidNotice(parsed)) return 'ignored';
  const possibleDuplicateTransactionIds = (await input.persistence.findPossibleDuplicateTransactions(uid, parsed))
    .filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 1500)
    .slice(0, 20);
  const bankReferenceHash = parsed.bankReference?.trim() ? hashBankReference(parsed.bankReference, parsed.bankName) : undefined;
  const dedupeInput = bankReferenceHash
    ? JSON.stringify([parsed.transactionType, bankReferenceHash])
    : JSON.stringify([parsed.transactionType, parsed.occurredOn, parsed.amountMinor, parsed.currency, parsed.merchant.trim().toLocaleLowerCase('en-US')]);
  const id = importedCandidateId(input.message.provider, input.connectionId, input.message.providerMessageId);
  const messageFingerprintInput = JSON.stringify([input.message.provider, input.connectionId, input.message.providerMessageId]);
  const now = (input.now || new Date()).toISOString();
  const candidate: ImportedCandidateDocument = {
    transactionType: parsed.transactionType,
    occurredOn: parsed.occurredOn,
    ...(parsed.occurredAt ? { occurredAt: new Date(parsed.occurredAt).toISOString() } : {}),
    amountMinor: parsed.amountMinor,
    currency: parsed.currency,
    merchant: parsed.merchant.trim().slice(0, 160),
    ...(parsed.bankName?.trim() ? { bankName: parsed.bankName.trim().slice(0, 120) } : {}),
    ...(bankReferenceHash ? { bankReferenceHash } : {}),
    ...(parsed.paymentInstrumentLastFour ? { paymentInstrumentLastFour: parsed.paymentInstrumentLastFour } : {}),
    description: parsed.description.trim().slice(0, 500),
    ...(isPaymentHint(parsed.paymentHint) ? { paymentHint: parsed.paymentHint } : {}),
    id,
    ownerUid: uid,
    schemaVersion: 1,
    provider: input.message.provider,
    providerMessageId: input.message.providerMessageId,
    connectionId: input.connectionId,
    messageFingerprint: stableHash(messageFingerprintInput),
    dedupeKey: stableHash(dedupeInput),
    receivedAt: input.message.receivedAt,
    reviewStatus: possibleDuplicateTransactionIds.length ? 'possible_duplicate' : 'pending_review',
    possibleDuplicateTransactionIds,
    createdAt: now,
    updatedAt: now,
  };
  const wasCreated = await input.persistence.saveCandidateIfAbsent(candidate);
  return wasCreated ? 'candidate_created' : 'duplicate';
}

function isValidMessageRef(message: ProviderMessageRef): boolean {
  return (message.provider === 'gmail' || message.provider === 'outlook')
    && typeof message.providerMessageId === 'string'
    && message.providerMessageId.trim().length > 0
    && message.providerMessageId.length <= 4096
    && !/[\u0000-\u001f]/.test(message.providerMessageId)
    && typeof message.receivedAt === 'string'
    && message.receivedAt.length <= 64
    && Number.isFinite(Date.parse(message.receivedAt));
}

function isValidNotice(parsed: ParsedBankNotice): boolean {
  if (parsed.transactionType !== 'income' && parsed.transactionType !== 'expense') return false;
  if (!Number.isSafeInteger(parsed.amountMinor) || parsed.amountMinor <= 0) return false;
  if (typeof parsed.currency !== 'string' || !/^[A-Z]{3}$/.test(parsed.currency)) return false;
  if (typeof parsed.merchant !== 'string' || !parsed.merchant.trim() || parsed.merchant.length > 1000) return false;
  if (parsed.bankName !== undefined && (typeof parsed.bankName !== 'string' || parsed.bankName.length > 500 || /[\u0000-\u001f]/.test(parsed.bankName))) return false;
  if (parsed.bankReference !== undefined && (typeof parsed.bankReference !== 'string' || parsed.bankReference.trim().length > 1000 || /[\u0000-\u001f]/.test(parsed.bankReference))) return false;
  if (parsed.paymentInstrumentLastFour !== undefined && (typeof parsed.paymentInstrumentLastFour !== 'string' || !/^\d{4}$/.test(parsed.paymentInstrumentLastFour))) return false;
  if (parsed.occurredAt !== undefined && (typeof parsed.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(parsed.occurredAt) || !Number.isFinite(Date.parse(parsed.occurredAt)))) return false;
  if (typeof parsed.description !== 'string' || parsed.description.length > 10000) return false;
  if (typeof parsed.occurredOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.occurredOn)) return false;
  const date = new Date(parsed.occurredOn + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === parsed.occurredOn;
}

export function hashBankReference(reference: string, bankName?: string): string {
  const normalizedBank = bankName?.normalize('NFKC').trim().toLocaleUpperCase('en-US') || '';
  const normalizedReference = reference.normalize('NFKC').trim().toLocaleUpperCase('en-US');
  return stableHash(JSON.stringify(['bank-reference', normalizedBank, normalizedReference]));
}

function isPaymentHint(value: unknown): value is NonNullable<ParsedBankNotice['paymentHint']> {
  return value === 'cash' || value === 'debit_card' || value === 'credit_card' || value === 'bank_transfer' || value === 'other';
}

/** Stable Firestore document ID so webhook retries can read without a collection query. */
export function importedCandidateId(provider: MailProvider, connectionId: string, providerMessageId: string): string {
  return 'mail_' + stableHash(JSON.stringify([provider, connectionId, providerMessageId]));
}

// A SHA-256 hash creates deterministic identifiers without storing full message bodies.
function stableHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}


export interface ExistingTransactionForMatch {
  id: string;
  transactionType: 'income' | 'expense';
  occurredOn: string;
  amountMinor: number;
  currency: string;
  origin: 'manual' | 'email_import' | 'local_migration';
  bankReferenceHash?: string;
}

/** Exact financial attributes produce review suggestions only; never auto-merges transactions. */
export function findPossibleDuplicateTransactions(
  parsed: ParsedBankNotice,
  transactions: readonly ExistingTransactionForMatch[],
  limit = 20,
): string[] {
  if (!Number.isSafeInteger(limit) || limit < 1) return [];
  return [...new Set(transactions
    .filter((item) => item.id.trim()
      && (item.origin === 'manual' || item.origin === 'email_import')
      && item.transactionType === parsed.transactionType
      && (parsed.bankReference
        ? item.bankReferenceHash === hashBankReference(parsed.bankReference, parsed.bankName)
        : item.occurredOn === parsed.occurredOn
          && item.amountMinor === parsed.amountMinor
          && item.currency === parsed.currency))
    .map((item) => item.id))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, Math.min(limit, 20));
}

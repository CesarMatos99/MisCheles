import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { httpsCallable, type Functions } from 'firebase/functions';

export type MailReviewStatus = 'pending_review' | 'possible_duplicate';
export interface MailReviewCandidate {
  id: string;
  ownerUid: string;
  provider: 'gmail' | 'outlook';
  reviewStatus: MailReviewStatus;
  transactionType: 'income' | 'expense';
  occurredOn: string;
  amountMinor: number;
  currency: string;
  merchant: string;
  description: string;
  possibleDuplicateTransactionIds: string[];
  paymentHint?: 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other';
}
export interface ConfirmMailCandidateInput {
  candidateId: string;
  categoryName: string;
  categoryId?: string;
  description?: string;
  paymentMethod?: 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other';
  confirmPossibleDuplicate?: boolean;
}

export function watchMailReviewCandidates(
  db: Firestore, uid: string, next: (items: MailReviewCandidate[]) => void, error: (reason: Error) => void,
): Unsubscribe {
  if (!uid.trim() || uid.includes('/')) throw new Error('A signed-in UID is required.');
  const candidates = collection(db, 'users', uid, 'importedCandidates');
  return onSnapshot(query(candidates, orderBy('receivedAt', 'desc')), (snapshot) => {
    const items = snapshot.docs.flatMap((record) => {
      const data = record.data();
      if (data.ownerUid !== uid || (data.reviewStatus !== 'pending_review' && data.reviewStatus !== 'possible_duplicate')) return [];
      if ((data.provider !== 'gmail' && data.provider !== 'outlook')
        || (data.transactionType !== 'income' && data.transactionType !== 'expense')
        || !Number.isSafeInteger(data.amountMinor) || data.amountMinor <= 0
        || typeof data.occurredOn !== 'string' || typeof data.currency !== 'string'
        || typeof data.merchant !== 'string' || typeof data.description !== 'string'
        || !Array.isArray(data.possibleDuplicateTransactionIds)) return [];
      return [{
        id: record.id, ownerUid: uid, provider: data.provider, reviewStatus: data.reviewStatus,
        transactionType: data.transactionType, occurredOn: data.occurredOn,
        amountMinor: data.amountMinor, currency: data.currency, merchant: data.merchant,
        description: data.description, possibleDuplicateTransactionIds: data.possibleDuplicateTransactionIds,
        ...(isPaymentHint(data.paymentHint) ? { paymentHint: data.paymentHint } : {}),
      } as MailReviewCandidate];
    });
    next(items);
  }, error);
}

export async function ignoreMailReviewCandidate(db: Firestore, uid: string, candidateId: string): Promise<void> {
  if (!uid.trim() || uid.includes('/') || !/^mail_[a-f0-9]{64}$/.test(candidateId)) throw new Error('Invalid account or candidate.');
  const reference = doc(db, 'users', uid, 'importedCandidates', candidateId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    if (data.ownerUid !== uid) throw new Error('This candidate belongs to another account.');
    if (data.reviewStatus === 'ignored') return;
    if (data.reviewStatus !== 'pending_review' && data.reviewStatus !== 'possible_duplicate') throw new Error('This candidate is no longer available.');
    transaction.update(reference, { reviewStatus: 'ignored', updatedAt: serverTimestamp() });
  });
}

export async function confirmMailReviewCandidate(functions: Functions, input: ConfirmMailCandidateInput): Promise<{ movementId: string; alreadyConfirmed: boolean }> {
  if (!/^mail_[a-f0-9]{64}$/.test(input.candidateId) || !input.categoryName.trim()) throw new Error('Choose a category before registering this movement.');
  const confirm = httpsCallable<ConfirmMailCandidateInput, { movementId: string; alreadyConfirmed: boolean }>(functions, 'confirmImportedCandidate');
  const result = await confirm(input);
  if (!result.data || typeof result.data.movementId !== 'string' || typeof result.data.alreadyConfirmed !== 'boolean') throw new Error('The server returned an invalid confirmation.');
  return result.data;
}

function isPaymentHint(value: unknown): value is NonNullable<MailReviewCandidate['paymentHint']> {
  return value === 'cash' || value === 'debit_card' || value === 'credit_card' || value === 'bank_transfer' || value === 'other';
}


export interface MailConnectionSummary {
  id: string;
  provider: 'gmail' | 'outlook';
  maskedAddress: string;
  status: 'active' | 'reauthorization_required' | 'disconnected';
}

export function watchMailConnections(db: Firestore, uid: string, next: (items: MailConnectionSummary[]) => void, error: (reason: Error) => void): Unsubscribe {
  if (!uid.trim() || uid.includes('/')) throw new Error('A signed-in UID is required.');
  return onSnapshot(collection(db, 'users', uid, 'mailConnections'), (snapshot) => {
    const items = snapshot.docs.flatMap((document) => {
      const data = document.data();
      if (data.ownerUid !== uid || data.id !== document.id
        || (data.provider !== 'gmail' && data.provider !== 'outlook')
        || typeof data.maskedAddress !== 'string'
        || (data.status !== 'active' && data.status !== 'reauthorization_required' && data.status !== 'disconnected')) return [];
      return [{ id: document.id, provider: data.provider, maskedAddress: data.maskedAddress, status: data.status } as MailConnectionSummary];
    });
    next(items);
  }, error);
}

export async function beginMailOAuth(functions: Functions, provider: 'gmail' | 'outlook'): Promise<{ authorizationUrl: string; connectionId: string; expiresAtMs: number }> {
  const call = httpsCallable<{ provider: 'gmail' | 'outlook' }, { authorizationUrl: string; connectionId: string; expiresAtMs: number }>(functions, 'beginMailOAuth');
  const result = await call({ provider });
  const data = result.data;
  if (typeof data?.authorizationUrl !== 'string' || typeof data.connectionId !== 'string' || !Number.isSafeInteger(data.expiresAtMs)) throw new Error('Mail authorization response is invalid.');
  const url = new URL(data.authorizationUrl);
  const allowed = provider === 'gmail'
    ? url.protocol === 'https:' && url.hostname === 'accounts.google.com' && url.pathname === '/o/oauth2/v2/auth'
    : url.protocol === 'https:' && url.hostname === 'login.microsoftonline.com' && /^\/[a-zA-Z0-9._-]+\/oauth2\/v2\.0\/authorize$/.test(url.pathname);
  if (!allowed || !/^[-a-f0-9]{36}$/i.test(data.connectionId) || data.expiresAtMs <= Date.now()) throw new Error('Mail authorization response is invalid.');
  return data;
}

export async function disconnectMail(functions: Functions, connectionId: string, provider: 'gmail' | 'outlook'): Promise<void> {
  if (!/^[-a-f0-9]{36}$/i.test(connectionId)) throw new Error('Invalid mail connection.');
  const call = httpsCallable<{ connectionId: string; provider: 'gmail' | 'outlook' }, { disconnected: boolean }>(functions, 'disconnectMail');
  const result = await call({ connectionId, provider });
  if (result.data?.disconnected !== true) throw new Error('Mail connection could not be disconnected.');
}

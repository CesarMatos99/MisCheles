type PaymentClassifier = 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other';

export type ImportedCandidateForConfirmation = {
  id: string;
  ownerUid: string;
  transactionType: 'income' | 'expense';
  occurredOn: string;
  occurredAt?: string;
  amountMinor: number;
  currency: string;
  merchant: string;
  description: string;
  bankName?: string;
  bankReferenceHash?: string;
  paymentInstrumentLastFour?: string;
  paymentHint?: PaymentClassifier;
  dedupeKey: string;
  reviewStatus: 'pending_review' | 'possible_duplicate' | 'confirmed' | 'ignored';
  confirmedMovementId?: string;
};

export type ImportedMovementConfirmation = {
  candidateId: string;
  categoryId?: string;
  categoryName: string;
  description?: string;
  paymentMethod?: PaymentClassifier;
  confirmPossibleDuplicate?: boolean;
};

export class ImportedCandidateReviewError extends Error {
  readonly code: 'invalid-argument' | 'permission-denied' | 'failed-precondition' | 'not-found';
  constructor(code: 'invalid-argument' | 'permission-denied' | 'failed-precondition' | 'not-found', message: string) { super(message); this.code = code; }
}

const PAYMENT_METHODS = new Set<PaymentClassifier>(['cash', 'debit_card', 'credit_card', 'bank_transfer', 'other']);

/** Build exactly the transaction fields accepted by Firestore Rules from a reviewed candidate. */
export function buildImportedMovement(
  uid: string,
  candidate: ImportedCandidateForConfirmation,
  input: ImportedMovementConfirmation,
): Record<string, unknown> {
  if (!uid.trim() || candidate.ownerUid !== uid) throw new ImportedCandidateReviewError('permission-denied', 'This candidate does not belong to the signed-in user.');
  if (candidate.id !== input.candidateId || !/^mail_[a-f0-9]{64}$/.test(candidate.id)) throw new ImportedCandidateReviewError('invalid-argument', 'The candidate ID is invalid.');
  if (candidate.reviewStatus === 'ignored') throw new ImportedCandidateReviewError('failed-precondition', 'An ignored candidate cannot be registered.');
  if (candidate.reviewStatus === 'confirmed') throw new ImportedCandidateReviewError('failed-precondition', 'This candidate is already confirmed.');
  if (candidate.reviewStatus !== 'pending_review' && candidate.reviewStatus !== 'possible_duplicate') throw new ImportedCandidateReviewError('failed-precondition', 'This candidate is not available for review.');
  if (candidate.reviewStatus === 'possible_duplicate' && input.confirmPossibleDuplicate !== true) {
    throw new ImportedCandidateReviewError('failed-precondition', 'Confirm that you want to create this possible duplicate as a new movement.');
  }
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(candidate.occurredOn) ? new Date(candidate.occurredOn + 'T00:00:00.000Z') : new Date(Number.NaN);
  if (!candidate.dedupeKey || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== candidate.occurredOn
      || !Number.isSafeInteger(candidate.amountMinor) || candidate.amountMinor <= 0
      || !/^[A-Z]{3}$/.test(candidate.currency)
      || !candidate.merchant.trim()
      || (candidate.bankReferenceHash !== undefined && !/^[a-f0-9]{64}$/.test(candidate.bankReferenceHash))
      || (candidate.paymentInstrumentLastFour !== undefined && !/^\d{4}$/.test(candidate.paymentInstrumentLastFour))) throw new ImportedCandidateReviewError('failed-precondition', 'The imported financial data is invalid.');
  const categoryName = input.categoryName.trim();
  if (!categoryName || categoryName.length > 120) throw new ImportedCandidateReviewError('invalid-argument', 'Choose a valid category before registering this movement.');
  const paymentMethod = input.paymentMethod ?? candidate.paymentHint ?? 'other';
  if (!PAYMENT_METHODS.has(paymentMethod)) throw new ImportedCandidateReviewError('invalid-argument', 'The payment method is invalid.');
  const description = (input.description?.trim() || candidate.description.trim() || candidate.merchant.trim()).slice(0, 500);
  const movementId = 'email_' + candidate.id.slice('mail_'.length);
  return {
    id: movementId,
    ownerUid: uid,
    schemaVersion: 1,
    kind: candidate.transactionType,
    amountMinor: candidate.amountMinor,
    currency: candidate.currency,
    occurredOn: candidate.occurredOn,
    ...(candidate.occurredAt ? { occurredAt: candidate.occurredAt } : {}),
    monthKey: candidate.occurredOn.slice(0, 7),
    ...(input.categoryId?.trim() ? { categoryId: input.categoryId.trim().slice(0, 120) } : {}),
    categoryName,
    description,
    ...(candidate.bankName ? { bankName: candidate.bankName.slice(0, 120) } : {}),
    ...(candidate.bankReferenceHash ? { bankReferenceHash: candidate.bankReferenceHash } : {}),
    ...(candidate.paymentInstrumentLastFour ? { paymentInstrumentLastFour: candidate.paymentInstrumentLastFour } : {}),
    paymentMethod,
    origin: 'email_import',
    importedCandidateId: candidate.id,
    dedupeKey: candidate.dedupeKey,
  };
}

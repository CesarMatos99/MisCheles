/** Cross-platform domain contract for React, Flutter and Firestore documents. */
export type IsoDate = string; // Calendar date YYYY-MM-DD; never parse as a local timestamp.
export type MonthKey = string; // YYYY-MM
/** Firestore writes native Timestamp values; local migration may preserve ISO instants. */
export type FirestoreInstant = string | number | { seconds: number; nanoseconds: number };
export type MovementKind = 'income' | 'expense' | 'savings_contribution' | 'savings_withdrawal' | 'savings_direct_expense' | 'savings_reallocation' | 'transfer';
export type EntryOrigin = 'manual' | 'email_import' | 'local_migration';
export type PaymentClassifier = 'cash' | 'debit_card' | 'credit_card' | 'bank_transfer' | 'other';

export interface OwnedDocument {
  id: string;
  ownerUid: string;
  schemaVersion: 1;
  createdAt: FirestoreInstant;
  updatedAt: FirestoreInstant;
}

export interface FinancialMovement extends OwnedDocument {
  kind: MovementKind;
  amountMinor: number; // Integer minor units avoids floating-point money arithmetic.
  currency: string; // ISO-4217, e.g. DOP; classifier only, not an account balance.
  occurredOn: IsoDate;
  /** Optional UTC ISO instant when known; occurredOn remains the local calendar date. */
  occurredAt?: string;
  monthKey: MonthKey;
  categoryId?: string;
  categoryName: string;
  description: string;
  notes?: string;
  bankName?: string;
  /** SHA-256 of the bank reference for matching; raw references are never synchronized. */
  bankReferenceHash?: string;
  /** Last four digits only, never a complete card number. */
  paymentInstrumentLastFour?: string;
  paymentMethod: PaymentClassifier;
  origin: EntryOrigin;
  savingsGoalId?: string;
  /** Defaults to true; false preserves closed-goal history without affecting current balances. */
  balanceAffecting?: boolean;
  importedCandidateId?: string;
  dedupeKey?: string;
  localSourceId?: string;
  transferGroupId?: string;
}

export interface MonthConfiguration extends OwnedDocument {
  monthKey: MonthKey;
  openingCarryoverMinor: number;
  initialIncomeMinor: number; // Mis Cheles decision: initial month amount is period income.
  autoRolloverEnabled: boolean;
}

export interface CategoryBudget extends OwnedDocument {
  monthKey: MonthKey;
  categoryId: string;
  categoryName: string;
  assignedMinor: number;
  currency: string;
}

export interface SavingsGoal extends OwnedDocument {
  title: string;
  targetMinor: number;
  targetDate?: IsoDate;
  currency: string;
  // Balance is derived from immutable movements, not a separately editable source of truth.
}

export type ImportReviewStatus = 'pending_review' | 'possible_duplicate' | 'confirmed' | 'ignored';
export interface ImportedTransactionCandidate extends OwnedDocument {
  provider: 'gmail' | 'outlook';
  transactionType: 'income' | 'expense';
  providerMessageId: string;
  connectionId: string;
  messageFingerprint: string;
  dedupeKey: string;
  receivedAt: string;
  occurredOn: IsoDate;
  occurredAt?: string;
  amountMinor: number;
  currency: string;
  merchant: string;
  bankName?: string;
  /** SHA-256 of an optional bank reference; the reference itself stays transient in backend. */
  bankReferenceHash?: string;
  paymentInstrumentLastFour?: string;
  description: string;
  paymentHint?: PaymentClassifier;
  reviewStatus: ImportReviewStatus;
  possibleDuplicateTransactionIds: string[];
  confirmedMovementId?: string;
}

/** User-readable, sanitized connection metadata; OAuth credentials stay in backend storage. */
export interface MailConnectionMetadata extends OwnedDocument {
  provider: 'gmail' | 'outlook';
  maskedAddress: string;
  grantedScopes: string[];
  status: 'active' | 'reauthorization_required' | 'disconnected';
  connectedAt: string;
  lastSyncAt?: string;
}

export interface LocalMigrationPlan {
  id: string;
  sourceDeviceId: string;
  sourceSchemaVersion: number;
  createdAt: string;
  recordCount: number;
  checksum: string;
  /** Duplicate mappings and skips are previewed before any upload. */
  duplicateLocalIds: string[];
  acceptedLocalIds: string[];
  phase: 'preview' | 'uploading' | 'verifying' | 'complete' | 'failed';
}

import { cloudRevision } from './syncRevision';

/** Converts Firestore timestamps to the same stable representation on every client. */
export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

export type FirestoreRecord = Record<string, unknown> & { id: string; _cloudRevision?: string };

function isTimestamp(value: unknown): value is FirestoreTimestampLike {
  if (!value || typeof value !== 'object') return false;
  const timestamp = value as Partial<FirestoreTimestampLike>;
  return Number.isInteger(timestamp.seconds) && Number.isInteger(timestamp.nanoseconds);
}

function isoInstant(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (isTimestamp(value)) {
    const date = value.toDate?.() ?? new Date(value.seconds * 1000 + value.nanoseconds / 1e6);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  return undefined;
}

/** Preserve calendar dates and server precision used for conflict detection. */
export function decodeFirestoreRecord(
  id: string,
  raw: Record<string, unknown>,
  collectionName?: string,
): FirestoreRecord {
  const record: FirestoreRecord = { ...raw, id };
  // Recover records from older migrations that stored a savings mirror with the
  // savings movement kind inside the transactions collection. Its link/label
  // lets the financial summary count it as a transfer exactly once.
  if (collectionName === 'transactions' && record.kind === 'savings_contribution') {
    record.kind = 'expense';
  }
  for (const field of ['createdAt', 'updatedAt'] as const) {
    const normalized = isoInstant(record[field]);
    if (normalized !== undefined) record[field] = normalized;
  }
  const updatedAt = raw.updatedAt;
  if (isTimestamp(updatedAt)) {
    record._cloudRevision = 'time:' + updatedAt.seconds + ':' + updatedAt.nanoseconds;
  } else {
    const revision = cloudRevision({ ...raw, id });
    if (revision !== null) record._cloudRevision = revision;
  }
  return record;
}

/** Remove client-only metadata before writing a document governed by Firestore Rules. */
export function encodeFirestoreRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { _cloudRevision: _revision, cloudDocumentId: _documentId, ...persisted } = record;
  return persisted;
}

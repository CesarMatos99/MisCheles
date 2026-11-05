import type { Firestore } from 'firebase-admin/firestore';
import {
  findPossibleDuplicateTransactions,
  hashBankReference,
  importedCandidateId,
  type CandidatePersistence,
  type ExistingTransactionForMatch,
  type ImportedCandidateDocument,
  type MailProvider,
  type ParsedBankNotice,
} from './mail_import_contract';

const CANDIDATE_FIELDS = [
  'id', 'ownerUid', 'schemaVersion', 'provider', 'providerMessageId', 'connectionId',
  'messageFingerprint', 'dedupeKey', 'transactionType', 'occurredOn', 'occurredAt',
  'amountMinor', 'currency', 'merchant', 'bankName', 'bankReferenceHash',
  'paymentInstrumentLastFour', 'description', 'paymentHint', 'receivedAt',
  'reviewStatus', 'possibleDuplicateTransactionIds', 'confirmedMovementId', 'createdAt', 'updatedAt',
] as const;

/** Whitelist writes so parser additions can never accidentally persist message bodies or OAuth data. */
export function candidateDocumentData(candidate: ImportedCandidateDocument): Record<string, unknown> {
  const raw = candidate as unknown as Record<string, unknown>;
  return Object.fromEntries(CANDIDATE_FIELDS.filter((field) => raw[field] !== undefined).map((field) => [field, raw[field]]));
}

/** Firestore-backed mail candidate persistence. All reads/writes are scoped below one UID. */
export class FirestoreCandidatePersistence implements CandidatePersistence {
  private readonly db: Firestore;
  constructor(db: Firestore) { this.db = db; }

  private candidateRef(uid: string, id: string) {
    if (!uid.trim() || uid.includes('/') || !id) throw new Error('Invalid owner or candidate ID.');
    return this.db.collection('users').doc(uid).collection('importedCandidates').doc(id);
  }

  private transactionCollection(uid: string) {
    if (!uid.trim() || uid.includes('/')) throw new Error('Invalid owner UID.');
    return this.db.collection('users').doc(uid).collection('transactions');
  }

  async hasMessage(uid: string, provider: MailProvider, connectionId: string, providerMessageId: string): Promise<boolean> {
    const id = importedCandidateId(provider, connectionId, providerMessageId);
    return (await this.candidateRef(uid, id).get()).exists;
  }

  async findPossibleDuplicateTransactions(uid: string, parsed: ParsedBankNotice): Promise<string[]> {
    let matches = this.transactionCollection(uid)
      .where('kind', '==', parsed.transactionType)
      .where('origin', 'in', ['manual', 'email_import']);
    if (parsed.bankReference?.trim()) {
      matches = matches.where('bankReferenceHash', '==', hashBankReference(parsed.bankReference, parsed.bankName));
    } else {
      matches = matches.where('occurredOn', '==', parsed.occurredOn)
        .where('amountMinor', '==', parsed.amountMinor)
        .where('currency', '==', parsed.currency);
    }
    const snapshot = await matches.limit(100).get();
    const transactions = snapshot.docs.map((record) => {
      const data = record.data();
      return {
        id: record.id,
        transactionType: data.kind,
        occurredOn: data.occurredOn,
        amountMinor: data.amountMinor,
        currency: data.currency,
        origin: data.origin,
        bankReferenceHash: data.bankReferenceHash,
      } as ExistingTransactionForMatch;
    });
    return findPossibleDuplicateTransactions(parsed, transactions);
  }

  async saveCandidateIfAbsent(candidate: ImportedCandidateDocument): Promise<boolean> {
    if (!candidate.ownerUid || candidate.id !== importedCandidateId(candidate.provider, candidate.connectionId, candidate.providerMessageId)) {
      throw new Error('Candidate owner or deterministic ID is invalid.');
    }
    const reference = this.candidateRef(candidate.ownerUid, candidate.id);
    return this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (existing.exists) return false;
      transaction.create(reference, candidateDocumentData(candidate));
      return true;
    });
  }
}

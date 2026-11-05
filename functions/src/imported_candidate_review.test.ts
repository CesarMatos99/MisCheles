import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImportedMovement, ImportedCandidateReviewError, type ImportedCandidateForConfirmation } from './imported_candidate_review.ts';

const candidate: ImportedCandidateForConfirmation = {
  id: 'mail_' + 'a'.repeat(64), ownerUid: 'uid-1', transactionType: 'expense',
  occurredOn: '2026-10-30', occurredAt: '2026-10-30T15:10:00.000Z', amountMinor: 9500,
  currency: 'DOP', merchant: 'Farmacia', description: 'Compra con tarjeta', bankName: 'Banco Ejemplo',
  bankReferenceHash: 'f'.repeat(64), paymentInstrumentLastFour: '1234', paymentHint: 'debit_card',
  dedupeKey: 'd'.repeat(64), reviewStatus: 'pending_review',
};

test('builds a UID-scoped, idempotently identified movement from reviewed candidate data', () => {
  const movement = buildImportedMovement('uid-1', candidate, {candidateId:candidate.id, categoryId:'health', categoryName:'Salud'});
  assert.equal(movement.id, 'email_' + 'a'.repeat(64));
  assert.equal(movement.ownerUid, 'uid-1');
  assert.equal(movement.kind, 'expense');
  assert.equal(movement.monthKey, '2026-10');
  assert.equal(movement.paymentMethod, 'debit_card');
  assert.equal(movement.origin, 'email_import');
  assert.equal(movement.importedCandidateId, candidate.id);
  assert.equal(movement.bankReferenceHash, 'f'.repeat(64));
  assert.equal('providerMessageId' in movement, false);
  assert.equal('body' in movement, false);
});

test('possible duplicates require explicit confirmation and never auto-register', () => {
  const possible = {...candidate, reviewStatus:'possible_duplicate' as const};
  assert.throws(()=>buildImportedMovement('uid-1', possible, {candidateId:candidate.id,categoryName:'Salud'}), (e: unknown)=>e instanceof ImportedCandidateReviewError && e.code==='failed-precondition');
  assert.doesNotThrow(()=>buildImportedMovement('uid-1', possible, {candidateId:candidate.id,categoryName:'Salud',confirmPossibleDuplicate:true}));
});

test('requires owner, category, active review state and valid money fields', () => {
  assert.throws(()=>buildImportedMovement('other-uid',candidate,{candidateId:candidate.id,categoryName:'Salud'}), (e: unknown)=>e instanceof ImportedCandidateReviewError && e.code==='permission-denied');
  assert.throws(()=>buildImportedMovement('uid-1',candidate,{candidateId:candidate.id,categoryName:' '}), /Choose a valid category/);
  assert.throws(()=>buildImportedMovement('uid-1',{...candidate,reviewStatus:'ignored'},{candidateId:candidate.id,categoryName:'Salud'}), /ignored candidate/);
  assert.throws(()=>buildImportedMovement('uid-1',{...candidate,amountMinor:0},{candidateId:candidate.id,categoryName:'Salud'}), /financial data is invalid/);
  assert.throws(()=>buildImportedMovement('uid-1',{...candidate,occurredOn:'2026-02-30'},{candidateId:candidate.id,categoryName:'Salud'}), /financial data is invalid/);
});

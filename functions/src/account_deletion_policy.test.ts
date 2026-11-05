import assert from 'node:assert/strict';
import test from 'node:test';
import { AccountDeletionPolicyError, requireEligibleAccountDeletion, requireExplicitDeletionConfirmation } from './account_deletion_policy.ts';

test('allows a verified user with a recent sign-in', () => {
  assert.equal(requireEligibleAccountDeletion({ uid: 'user-1', token: { email_verified: true, auth_time: 1000 } }, 1100), 'user-1');
});
test('rejects a missing user', () => {
  assert.throws(() => requireEligibleAccountDeletion(null, 1100), (error: unknown) => error instanceof AccountDeletionPolicyError && error.code === 'unauthenticated');
});
test('requires a verified email', () => {
  assert.throws(() => requireEligibleAccountDeletion({ uid: 'user-1', token: { email_verified: false, auth_time: 1000 } }, 1100), (error: unknown) => error instanceof AccountDeletionPolicyError && error.code === 'permission-denied');
});
test('requires fresh authentication and rejects future auth times', () => {
  for (const authTime of [700, 1200]) {
    assert.throws(() => requireEligibleAccountDeletion({ uid: 'user-1', token: { email_verified: true, auth_time: authTime } }, 1100), (error: unknown) => error instanceof AccountDeletionPolicyError && error.code === 'failed-precondition');
  }
});

test('requires the explicit server confirmation literal', () => {
  requireExplicitDeletionConfirmation('DELETE');
  assert.throws(() => requireExplicitDeletionConfirmation('delete'), (error: unknown) => error instanceof AccountDeletionPolicyError && error.code === 'failed-precondition');
});

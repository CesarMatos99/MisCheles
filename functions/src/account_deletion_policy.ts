export type AccountDeletionAuth = {
  uid?: unknown;
  token?: { email_verified?: unknown; auth_time?: unknown } | null;
} | null;

export type AccountDeletionFailure = 'unauthenticated' | 'permission-denied' | 'failed-precondition';

export class AccountDeletionPolicyError extends Error {
  readonly code: AccountDeletionFailure;
  constructor(code: AccountDeletionFailure, message: string) { super(message); this.code = code; }
}

/** Validate that deletion was requested by this verified user after a recent sign-in. */
export function requireEligibleAccountDeletion(auth: AccountDeletionAuth, nowSeconds: number): string {
  if (!auth || typeof auth.uid !== 'string' || auth.uid.length === 0) {
    throw new AccountDeletionPolicyError('unauthenticated', 'Sign in before deleting this account.');
  }
  if (auth.token?.email_verified !== true) {
    throw new AccountDeletionPolicyError('permission-denied', 'Verify the account email before deletion.');
  }
  const authTime = auth.token.auth_time;
  if (typeof authTime !== 'number' || !Number.isFinite(authTime) || nowSeconds - authTime > 5 * 60 || authTime > nowSeconds + 60) {
    throw new AccountDeletionPolicyError('failed-precondition', 'Reauthenticate before deleting this account.');
  }
  return auth.uid;
}

export function requireExplicitDeletionConfirmation(value: unknown): void {
  if (value !== 'DELETE') {
    throw new AccountDeletionPolicyError('failed-precondition', 'Explicit account deletion confirmation is required.');
  }
}

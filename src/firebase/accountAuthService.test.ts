import assert from 'node:assert/strict';
import test from 'node:test';
import type { User } from 'firebase/auth';
import { createAccountAuthService, type AccountAuthAdapter } from './accountAuthService.ts';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'test-user', displayName: 'Test User', email: 'test@example.com', emailVerified: false,
    providerData: [{ providerId: 'password' }], ...overrides,
  } as User;
}

function createAdapter(user = makeUser()) {
  const calls: Array<[string, ...unknown[]]> = [];
  let validPassword = true;
  const adapter: AccountAuthAdapter = {
    observe: () => () => undefined,
    completeRedirect: async () => { calls.push(['completeRedirect']); },
    validatePassword: async (password) => { calls.push(['validatePassword', password]); return validPassword; },
    createUser: async (email, password) => { calls.push(['createUser', email, password]); return user; },
    updateDisplayName: async (_user, name) => { calls.push(['updateDisplayName', name]); },
    sendVerification: async () => { calls.push(['sendVerification']); },
    signIn: async (email, password) => { calls.push(['signIn', email, password]); return user; },
    signInWithGoogle: async () => { calls.push(['signInWithGoogle']); return user; },
    sendPasswordReset: async (email) => { calls.push(['sendPasswordReset', email]); },
    refreshUser: async () => { calls.push(['refreshUser']); user.emailVerified = true; },
    changePassword: async (_user, current, next) => { calls.push(['changePassword', current, next]); },
    deleteAccount: async (_user, password) => { calls.push(['deleteAccount', password]); },
    signOut: async () => { calls.push(['signOut']); },
  };
  return { adapter, calls, user, rejectPassword: () => { validPassword = false; } };
}

test('registration validates the configured password policy, normalizes inputs and sends email verification', async () => {
  const { adapter, calls, user } = createAdapter();
  const auth = createAccountAuthService(adapter);
  assert.equal(await auth.create('  Ana Pérez  ', ' ana@example.com ', 'Strong-password-1'), user);
  assert.deepEqual(calls, [
    ['validatePassword', 'Strong-password-1'],
    ['createUser', 'ana@example.com', 'Strong-password-1'],
    ['updateDisplayName', 'Ana Pérez'],
    ['sendVerification'],
  ]);
});

test('registration rejects malformed values and passwords outside the remote Firebase policy', async () => {
  const setup = createAdapter();
  const auth = createAccountAuthService(setup.adapter);
  await assert.rejects(auth.create('', 'user@example.com', 'password'), /INVALID_NAME/);
  await assert.rejects(auth.create('Name', 'invalid', 'password'), /INVALID_EMAIL/);
  setup.rejectPassword();
  await assert.rejects(auth.create('Name', 'user@example.com', 'password'), /PASSWORD_POLICY_INVALID/);
  assert.equal(setup.calls.some(([name]) => name === 'createUser'), false);
});

test('an unverified user can sign in and continue using local features', async () => {
  const { adapter, calls, user } = createAdapter();
  const auth = createAccountAuthService(adapter);
  assert.equal(await auth.signIn(' user@example.com ', 'password'), user);
  assert.deepEqual(calls, [['signIn', 'user@example.com', 'password']]);
});

test('restoring auth state completes the pending Google redirect and observes Firebase session changes', async () => {
  const setup = createAdapter();
  const restoredUser = makeUser({ uid: 'restored-user' });
  setup.adapter.observe = (listener) => {
    listener(restoredUser);
    return () => undefined;
  };
  const auth = createAccountAuthService(setup.adapter);
  let observed: User | null = null;
  const stop = auth.observe((nextUser) => { observed = nextUser; });
  assert.equal(observed, restoredUser);
  await auth.completeRedirect();
  assert.deepEqual(setup.calls, [['completeRedirect']]);
  stop();
});

test('sign-in errors propagate to the neutral error translator', async () => {
  const setup = createAdapter();
  setup.adapter.signIn = async () => { throw Object.assign(new Error('bad credentials'), { code: 'auth/invalid-credential' }); };
  const auth = createAccountAuthService(setup.adapter);
  await assert.rejects(auth.signIn('user@example.com', 'wrong'), /bad credentials/);
});

test('Google auth delegates to the configured provider flow without automatic account linking', async () => {
  const { adapter, calls, user } = createAdapter();
  const auth = createAccountAuthService(adapter);
  assert.equal(await auth.signInWithGoogle(), user);
  assert.deepEqual(calls, [['signInWithGoogle']]);
});

test('password recovery normalizes the email and exposes no account lookup result', async () => {
  const { adapter, calls } = createAdapter();
  const auth = createAccountAuthService(adapter);
  await auth.sendPasswordReset(' user@example.com ');
  assert.deepEqual(calls, [['sendPasswordReset', 'user@example.com']]);
  await assert.rejects(auth.sendPasswordReset('not-an-email'), /INVALID_EMAIL/);
});

test('verification resend has a per-account cooldown and refresh reads Firebase state', async () => {
  const { adapter, calls, user } = createAdapter();
  let time = 1_000;
  const auth = createAccountAuthService(adapter, () => time);
  await auth.resendVerification(user);
  await assert.rejects(auth.resendVerification(user), /VERIFICATION_RESEND_COOLDOWN/);
  time += 60_000;
  await auth.resendVerification(user);
  assert.equal(await auth.refreshVerification(user), true);
  assert.deepEqual(calls.filter(([name]) => name === 'sendVerification').length, 2);
  assert.deepEqual(calls.filter(([name]) => name === 'refreshUser').length, 1);
});

test('password change confirms the new password and delegates reauthentication to the adapter', async () => {
  const { adapter, calls, user, rejectPassword } = createAdapter();
  const auth = createAccountAuthService(adapter);
  await assert.rejects(auth.changePassword(user, 'old', 'new', 'different'), /PASSWORD_CONFIRMATION_MISMATCH/);
  rejectPassword();
  await assert.rejects(auth.changePassword(user, 'old', 'new', 'new'), /PASSWORD_POLICY_INVALID/);
  assert.equal(calls.some(([name]) => name === 'changePassword'), false);
});

test('account deletion requires explicit typed confirmation and leaves storage outside the auth service', async () => {
  const { adapter, calls, user } = createAdapter();
  const auth = createAccountAuthService(adapter);
  await assert.rejects(auth.deleteAccount(user, 'current', 'no'), /DELETE_CONFIRMATION_REQUIRED/);
  await auth.deleteAccount(user, 'current', 'ELIMINAR');
  await auth.signOut();
  assert.deepEqual(calls, [['deleteAccount', 'current'], ['signOut']]);
});

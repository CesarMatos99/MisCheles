import assert from 'node:assert/strict';
import test from 'node:test';
import { accountAuthMessage, accountAuthMessageKey } from './accountAuthErrors.ts';

test('authentication errors are translated without exposing account existence', () => {
  assert.equal(accountAuthMessageKey({ code: 'auth/invalid-credential' }), 'credentials');
  assert.equal(accountAuthMessageKey({ code: 'auth/email-already-in-use' }), 'credentials');
  assert.equal(accountAuthMessageKey({ code: 'auth/account-exists-with-different-credential' }), 'providerConflict');
  assert.equal(accountAuthMessageKey('Firebase: Error (auth/network-request-failed).'), 'network');
  assert.equal(accountAuthMessageKey({ code: 'auth/too-many-requests' }), 'rateLimited');
  const neutral = accountAuthMessage(new Error('generic'), 'es');
  assert.doesNotMatch(neutral, /registrad[oa]|existe/i);
});

test('authorization setup, password and deletion errors have clear messages', () => {
  assert.equal(accountAuthMessageKey(new Error('FIREBASE_NOT_CONFIGURED')), 'notConfigured');
  assert.equal(accountAuthMessageKey(new Error('PASSWORD_POLICY_INVALID')), 'passwordPolicy');
  assert.equal(accountAuthMessageKey(new Error('DELETE_CONFIRMATION_REQUIRED')), 'deleteConfirmation');
  assert.equal(accountAuthMessageKey({ code: 'auth/requires-recent-login' }), 'recentLogin');
});

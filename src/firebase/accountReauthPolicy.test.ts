import assert from 'node:assert/strict';
import test from 'node:test';
import { accountDeletionReauthMethod } from './accountReauthPolicy.ts';

test('account deletion chooses a supported recent-login challenge and never links providers', () => {
  assert.equal(accountDeletionReauthMethod(['password', 'google.com']), 'password');
  assert.equal(accountDeletionReauthMethod(['google.com']), 'google');
  assert.equal(accountDeletionReauthMethod(['unknown']), 'unsupported');
});

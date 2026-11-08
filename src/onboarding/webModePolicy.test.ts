import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLegacyLocalFinancialData, resolveWebAccessState } from './webModePolicy.ts';

test('web access stays private until authentication or an explicit demo choice', () => {
  assert.equal(resolveWebAccessState(false, null, false), 'restoring');
  assert.equal(resolveWebAccessState(true, null, false), 'visitor');
  assert.equal(resolveWebAccessState(true, null, true), 'demo');
  assert.equal(resolveWebAccessState(true, { emailVerified: true, providerData: [{ providerId: 'password' }] }, false), 'account');
});

test('password accounts require verified email while Google identity does not require a second verification flow', () => {
  assert.equal(resolveWebAccessState(true, { emailVerified: false, providerData: [{ providerId: 'password' }] }, false), 'verification');
  assert.equal(resolveWebAccessState(true, { emailVerified: false, providerData: [{ providerId: 'google.com' }, { providerId: 'password' }] }, false), 'verification');
  assert.equal(resolveWebAccessState(true, { emailVerified: true, providerData: [{ providerId: 'password' }] }, false), 'account');
  assert.equal(resolveWebAccessState(true, { emailVerified: false, providerData: [{ providerId: 'google.com' }] }, false), 'account');
});

test('legacy local data detection checks only unscoped financial keys', () => {
  const values = new Map<string, string>([['mischeles_transactions_v3', '[private data]']]);
  assert.equal(hasLegacyLocalFinancialData({ getItem: (key) => values.get(key) ?? null }), true);
  assert.equal(hasLegacyLocalFinancialData({ getItem: (key) => key === 'mischeles_demo_mischeles_transactions_v3' ? '[]' : null }), true);
  assert.equal(hasLegacyLocalFinancialData({ getItem: () => null }), false);
  assert.equal(hasLegacyLocalFinancialData({ getItem: () => { throw new Error('storage unavailable'); } }), false);
});

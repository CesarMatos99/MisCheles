import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const ruleBlock = (name: string) => {
  const start = rules.indexOf('match /' + name + '/');
  const end = start < 0 ? -1 : rules.indexOf('\n      }', start);
  return start < 0 || end < 0 ? '' : rules.slice(start, end);
};

test('keeps transaction and savings movement kinds in separate Firestore collections', () => {
  const validation = rules.match(/function validMovement\([\s\S]*?\n    }/)?.[0] ?? '';
  assert.match(validation, /savingsOnly\s*\?\s*\['savings_contribution', 'savings_withdrawal', 'savings_direct_expense', 'savings_reallocation'\]/);
  assert.match(validation, /:\s*\['income', 'expense', 'transfer'\]/);
  const transactions = ruleBlock('transactions');
  const savings = ruleBlock('savingsMovements');
  assert.match(transactions, /validMovement\(uid, recordId, false\)/);
  assert.match(savings, /validMovement\(uid, recordId, true\)/);
  assert.doesNotMatch(transactions, /savings_contribution|savings_withdrawal|savings_direct_expense|savings_reallocation/);
});

test('requires a verified matching UID for private data access and writes', () => {
  const signedInAs = rules.match(/function signedInAs\(uid\) \{([\s\S]*?)\n    }/)?.[1] ?? '';
  const validOwnedWrite = rules.match(/function validOwnedWrite\(uid\) \{([\s\S]*?)\n    }/)?.[1] ?? '';
  assert.match(signedInAs, /request\.auth\.uid == uid/);
  assert.match(signedInAs, /request\.auth\.token\.email_verified == true/);
  assert.match(validOwnedWrite, /request\.resource\.data\.ownerUid == uid/);
  assert.match(validOwnedWrite, /request\.resource\.data\.schemaVersion == 1/);
});

test('keeps OAuth metadata client read-only and all unlisted paths denied', () => {
  const mailConnections = ruleBlock('mailConnections');
  assert.match(mailConnections, /allow read: if signedInAs\(uid\)[\s\S]*allow write: if false/);
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;'));
});

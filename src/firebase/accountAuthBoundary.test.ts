import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

test('the authentication path does not initialize sync, migration, Firestore, or Functions', () => {
  const provider = source('./AccountAuthProvider.tsx');
  const profile = source('./AccountSettingsSection.tsx');
  const adapter = source('./firebaseAuthAdapter.ts');
  const service = source('./accountAuthService.ts');
  const app = source('../App.tsx');

  assert.doesNotMatch(provider, /accountSyncService|initializeAuthObserver/);
  assert.match(provider, /accountAuth\.observe/);
  assert.match(provider, /accountAuth\.completeRedirect\(\)/);
  assert.match(provider, /setStorageScope\(observedUser \? \{ accountUid: observedUser\.uid \}/);
  assert.doesNotMatch(profile, /accountSyncService|localMigrationService|FirestoreMigrationTarget|MailImportReview|from ['"]\.\/client['"]/);
  assert.doesNotMatch(app, /SyncConflictResolver/);
  assert.match(app, /setIsLocked\(financeApplication\.isAppLocked\(\)\)/);
  assert.doesNotMatch(adapter, /firebase\/firestore|firebase\/functions|httpsCallable/);
  assert.doesNotMatch(service, /Firestore|Functions|clearAccountScope|localStorage/);
});

test('sign-out and account deletion leave all local financial data in place', () => {
  const adapter = source('./firebaseAuthAdapter.ts');
  const service = source('./accountAuthService.ts');
  const profile = source('./AccountSettingsSection.tsx');

  assert.match(adapter, /await deleteUser\(user\)/);
  assert.doesNotMatch(adapter + service, /clearAccountScope|resetAllData|localStorage\.clear/);
  assert.match(profile, /Los datos financieros locales/);
  assert.match(profile, /not automatically deleted or uploaded/);
});

test('email and password fields are browser-autocomplete aware and accessible on small screens', () => {
  const profile = source('./AccountSettingsSection.tsx');
  const onboarding = source('../onboarding/WebModeGate.tsx');
  assert.match(profile, /autoComplete='email'/);
  assert.match(profile, /autoComplete='new-password'/);
  assert.match(profile, /min-h-11 w-full/);
  assert.match(onboarding, /autoComplete='email'/);
  assert.match(onboarding, /Confirm password/);
});

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
  assert.match(provider, /setStorageScope\(acceptedUser \? \{ accountUid: acceptedUser\.uid \}/);
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
  assert.match(profile, /autoComplete='current-password'/);
  assert.match(profile, /autoComplete='new-password'/);
  assert.match(profile, /min-h-11 w-full/);
  assert.match(onboarding, /autoComplete='email'/);
  assert.match(onboarding, /Confirm password \(minimum 12 characters\)/);
  assert.match(onboarding, /minLength=\{authView === 'create' \? 12 : undefined\}/);
});

test('web startup gates private routes and restores only an explicit demo or verified account', () => {
  const onboarding = source('../onboarding/WebModeGate.tsx');
  const policy = source('../onboarding/webModePolicy.ts');
  assert.match(onboarding, /resolveWebAccessState\(ready, user, demoActive\)/);
  assert.match(onboarding, /if \(access === 'account'\) return <\>\{legacyNotice\}\{children\}<\/>/);
  assert.match(onboarding, /if \(access === 'demo'\)/);
  assert.doesNotMatch(onboarding, /mode === 'local'|mode === 'legacyLocal'/);
  assert.match(onboarding, /removeItem\('mischeles_web_mode_v1'\)/);
  assert.match(onboarding, /disabled=\{!configured \|\| busy\}/);
  assert.match(onboarding, /onClick=\{chooseDemo\}/);
  assert.match(onboarding, /firebaseUnavailable/);
  assert.match(policy, /providerId === 'password'\) && !user\.emailVerified/);
  assert.match(onboarding, /navigateHome\(\)/);
});

test('sign-out hides the current workspace before Firebase completes and does not clear local records', () => {
  const provider = source('./AccountAuthProvider.tsx');
  const adapter = source('./firebaseAuthAdapter.ts');
  assert.ok(provider.indexOf('setUser(null);\n      setReady(false);') < provider.indexOf('await accountAuth.signOut();'));
  assert.doesNotMatch(provider + adapter, /localStorage\.clear|resetAllData|clearAccountScope/);
  assert.match(adapter, /await signOut\(requireAuth\(auth\)\)/);
});

test('profile uses the active Firebase identity, exposes sign-out, and keeps guest auth forms outside Profile', () => {
  const profile = source('../features/profile/ProfileView.tsx');
  const account = source('./AccountSettingsSection.tsx');
  const adapter = source('./firebaseAuthAdapter.ts');
  assert.match(profile, /useAccountAuth\(\)/);
  assert.match(profile, /user\?\.displayName/);
  assert.match(profile, /onClick=\{\(\) => void handleSignOut\(\)\}/);
  assert.doesNotMatch(account, /submitAuth|signInWithGoogle|createAccount/);
  assert.match(adapter, /linkWithCredential\(user/);
  assert.match(adapter, /linkWithPopup\(user/);
});

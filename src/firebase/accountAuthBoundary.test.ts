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
  assert.match(onboarding, /if \(access === 'account'\) return <WebAccessProvider mode='account'/);
  assert.match(onboarding, /if \(access === 'demo'\)/);
  assert.doesNotMatch(onboarding, /mode === 'local'|mode === 'legacyLocal'/);
  assert.doesNotMatch(onboarding, /legacyNotice|hasLegacyLocalFinancialData|mischeles_web_mode_v1/);
  assert.doesNotMatch(onboarding, /Tus registros financieros permanecen|recuperación o importación/);
  assert.match(onboarding, /disabled=\{!configured \|\| busy\}/);
  assert.match(onboarding, /onClick=\{chooseDemo\}/);
  assert.match(onboarding, /mode='demo' exitDemo=\{exitDemo\}/);
  assert.match(onboarding, /firebaseUnavailable/);
  assert.match(policy, /providerId === 'password'\) && !user\.emailVerified/);
  assert.match(onboarding, /navigateHome\(\)/);
});

test('welcome uses the original transparent MisCheles symbol and existing favicon asset', () => {
  const onboarding = source('../onboarding/WebModeGate.tsx');
  const index = source('../../index.html');
  assert.match(onboarding, /src='\/app-icon\.png'/);
  assert.doesNotMatch(onboarding, /WalletCards/);
  assert.match(index, /href="\/favicon\.png"/);
});

test('financial amounts stay editable and monthly income remains configured from the existing dashboard flow', () => {
  const profile = source('../features/profile/ProfileView.tsx');
  const dashboard = source('../features/dashboard/DashboardView.tsx');
  const monthSetup = source('../components/modals/MonthSetupModal.tsx');
  const moneyField = source('../components/ui/MoneyField.tsx');
  const amountField = source('../components/ui/FormattedAmountInput.tsx');
  assert.doesNotMatch(profile, /Ingreso base mensual/);
  assert.match(dashboard, /onOpenMonthSetup/);
  assert.match(monthSetup, /profile\.monthlyTargetIncome/);
  assert.match(moneyField, /FormattedAmountInput/);
  assert.match(amountField, /type="text"/);
  assert.match(amountField, /normalizeMoneyInput/);
  assert.match(amountField, /validate\(event\.currentTarget, raw\)/);
});

test('sign-out hides the current workspace before Firebase completes and does not clear local records', () => {
  const provider = source('./AccountAuthProvider.tsx');
  const adapter = source('./firebaseAuthAdapter.ts');
  assert.ok(provider.indexOf('setUser(null);\n      setReady(false);') < provider.indexOf('await accountAuth.signOut();'));
  assert.doesNotMatch(provider + adapter, /localStorage\.clear|resetAllData|clearAccountScope/);
  assert.match(adapter, /await signOut\(requireAuth\(auth\)\)/);
});

test('profile combines personal identity and account access under My account', () => {
  const profile = source('../features/profile/ProfileView.tsx');
  const header = source('../components/layout/Header.tsx');
  const dashboard = source('../features/dashboard/DashboardView.tsx');
  const account = source('./AccountSettingsSection.tsx');
  const adapter = source('./firebaseAuthAdapter.ts');
  assert.match(profile, /useAccountAuth\(\)/);
  assert.match(profile, /resolveVisibleIdentity/);
  assert.match(profile, /'Mi cuenta'/);
  assert.match(profile, /AccountSettingsSection\s*\/>/);
  assert.match(profile, /identityPhoto/);
  assert.match(profile, /identity\.accountEmail/);
  assert.match(profile, /user\.emailVerified/);
  assert.match(profile, /saveVisibleName/);
  assert.match(profile, /updateCurrency/);
  assert.match(profile, /financeApplication\.saveProfile\(updated\)/);
  assert.match(profile, /onProfileUpdated\(updated\)/);
  assert.doesNotMatch(profile, /updateProfile\(|updateDisplayName\(/);
  assert.doesNotMatch(profile, /Datos personales|section === 'profile'|setSection\('profile'\)/);
  assert.doesNotMatch(profile, /Ingreso base mensual/);
  assert.match(profile, /max-w-5xl/);
  assert.doesNotMatch(profile, /handleSignOut|LogOut|<LogOut/);
  const homeSection = profile.match(/\{section === 'home' && \([\s\S]*?\{section === 'appearance'/)?.[0] || '';
  assert.doesNotMatch(homeSection, /onLockApp|signOut|Cerrar sesión/);
  for (const section of ['account', 'appearance', 'security']) assert.match(profile, new RegExp(`setSection\\('${section}'\\)`));
  assert.match(profile, /onOpenInstall/);
  assert.match(header, /aria-haspopup="menu"/);
  assert.match(header, /role="menu"/);
  assert.match(header, /document.addEventListener\('pointerdown'/);
  assert.match(header, /event.key === 'Escape'/);
  assert.match(header, /onClick=\{\(\) => void handleSignOut\(\)\}/);
  assert.match(header, /Salir de la demostración|Salir de la demo/);
  assert.match(header, /onOpenSettings/);
  assert.doesNotMatch(header, /Nuevo registro|New record/);
  assert.match(dashboard, /resolveVisibleIdentity/);
  assert.doesNotMatch(account, /VisibleIdentity|identity\.photoUrl|identity\.name/);
  assert.doesNotMatch(account, /rounded-2xl border border-slate-200 bg-white/);
  assert.doesNotMatch(account, /user\.displayName/);
  assert.doesNotMatch(account, /submitAuth|signInWithGoogle|createAccount/);
  assert.match(adapter, /linkWithCredential\(user/);
  assert.match(adapter, /linkWithPopup\(user/);
});

test('profile security confirms a local PIN before enabling the lock and keeps PBKDF2 storage', () => {
  const profile = source('../features/profile/ProfileView.tsx');
  const credential = source('../services/localLockCredential.ts');
  assert.match(profile, /role="switch"/);
  assert.match(profile, /disabled=\{pinStatusLoading \|\| \(!hasLocalPin && !draft\.pinLockEnabled\)\}/);
  assert.match(profile, /confirmPin/);
  assert.match(profile, /newPin !== confirmPin/);
  assert.match(profile, /localLockCredential\.hasPin\(\)/);
  assert.match(profile, /localLockCredential\.setPin\(newPin\)/);
  assert.match(profile, /onClick=\{onLockApp\}/);
  assert.match(credential, /PBKDF2/);
});

test('welcome and sign-in keep one compact hierarchy with sign-in as the primary action', () => {
  const onboarding = source('../onboarding/WebModeGate.tsx');
  assert.match(onboarding, /title: 'Tu dinero, más claro\.'/);
  assert.match(onboarding, /copy\.signIn[\s\S]*?bg-primary/);
  assert.match(onboarding, /copy\.google/);
  assert.match(onboarding, /¿Todavía no tienes cuenta\?/);
  assert.match(onboarding, /copy\.demo/);
  assert.doesNotMatch(onboarding, /<Cloud/);
});

test('public welcome and auth forms share a centered 500px responsive card with vertical overflow', () => {
  const onboarding = source('../onboarding/WebModeGate.tsx');
  assert.match(onboarding, /min-h-\[100svh\].*overflow-y-auto/);
  assert.match(onboarding, /max-w-\[500px\]/);
  assert.match(onboarding, /place-items-center/);
  assert.match(onboarding, /p-5.*sm:p-8/);
  assert.match(onboarding, /min-h-\[3\.25rem\] w-full/);
  assert.match(onboarding, /h-12 w-12.*sm:h-14 sm:w-14/);
  assert.equal((onboarding.match(/max-w-\[500px\]/g) || []).length, 1);
});

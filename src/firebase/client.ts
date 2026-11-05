import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { shouldEnableWebAppCheck } from './appCheckPolicy';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

const env = import.meta.env;
const useEmulators = env.VITE_FIREBASE_USE_EMULATORS === 'true';
const projectId = env.VITE_FIREBASE_PROJECT_ID?.trim() || '';
const apiKey = env.VITE_FIREBASE_API_KEY?.trim() || '';
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '';
const appId = env.VITE_FIREBASE_APP_ID?.trim() || '';
const appCheckSiteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim() || '';
const appCheckEnabled = shouldEnableWebAppCheck({
  enabled: env.VITE_FIREBASE_APPCHECK_ENABLED === 'true',
  productionBuild: env.PROD,
  usingEmulators: useEmulators,
  siteKey: appCheckSiteKey,
});

/** Public Firebase web config is required; no SDK or network connection is created otherwise. */
export const firebaseConfigured = Boolean(
  projectId && apiKey && authDomain && appId && (useEmulators || projectId !== 'demo-mischeles'),
);

const app = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp({ apiKey, authDomain, projectId, appId })
  : null;

// App Check stays opt-in until the Firebase app and reCAPTCHA key are registered.
// Initialize it before Auth/Firestore, and never use the production provider in the emulator.
if (app && appCheckEnabled) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const firebaseAuth: Auth | null = app ? getAuth(app) : null;
export const firestore: Firestore | null = app ? getFirestore(app) : null;
export const firebaseFunctions: Functions | null = app ? getFunctions(app) : null;

if (app && useEmulators) {
  const host = env.VITE_FIREBASE_EMULATOR_HOST?.trim() || '127.0.0.1';
  if (firebaseAuth) connectAuthEmulator(firebaseAuth, 'http://' + host + ':9099', { disableWarnings: true });
  if (firestore) connectFirestoreEmulator(firestore, host, 8080);
  if (firebaseFunctions) connectFunctionsEmulator(firebaseFunctions, host, 5001);
}

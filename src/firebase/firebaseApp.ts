import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { shouldEnableWebAppCheck } from './appCheckPolicy';
import { hasFirebaseWebConfig } from './firebaseConfigPolicy';

const env = import.meta.env;
export const firebaseUseEmulators = env.VITE_FIREBASE_USE_EMULATORS === 'true';
export const firebaseEmulatorHost = env.VITE_FIREBASE_EMULATOR_HOST?.trim() || '127.0.0.1';
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY?.trim() || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID?.trim() || '',
  appId: env.VITE_FIREBASE_APP_ID?.trim() || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || '',
};

export const firebaseConfigured = hasFirebaseWebConfig(config, firebaseUseEmulators);
export const firebaseApp = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(config)
  : null;

const appCheckSiteKey = env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim() || '';
const appCheckEnabled = shouldEnableWebAppCheck({
  enabled: env.VITE_FIREBASE_APPCHECK_ENABLED === 'true',
  productionBuild: env.PROD,
  usingEmulators: firebaseUseEmulators,
  siteKey: appCheckSiteKey,
});

if (firebaseApp && appCheckEnabled) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

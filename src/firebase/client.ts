import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { firebaseAuth } from './authClient';
import { firebaseApp, firebaseEmulatorHost, firebaseUseEmulators } from './firebaseApp';

export { firebaseConfigured } from './firebaseApp';
export { firebaseAuth };

// Cloud SDK instances are initialized only when a cloud-specific module imports this file.
export const firestore: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const firebaseFunctions: Functions | null = firebaseApp ? getFunctions(firebaseApp) : null;

if (firebaseApp && firebaseUseEmulators) {
  if (firestore) connectFirestoreEmulator(firestore, firebaseEmulatorHost, 8080);
  if (firebaseFunctions) connectFunctionsEmulator(firebaseFunctions, firebaseEmulatorHost, 5001);
}

import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { firebaseApp, firebaseEmulatorHost, firebaseUseEmulators } from './firebaseApp';

/** Authentication-only client. Firestore and Functions are initialized by client.ts on demand. */
export const firebaseAuth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

if (firebaseAuth && firebaseUseEmulators) {
  connectAuthEmulator(firebaseAuth, 'http://' + firebaseEmulatorHost + ':9099', { disableWarnings: true });
}

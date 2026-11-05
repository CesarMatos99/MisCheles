import {
  browserSessionPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebaseAuth, firebaseFunctions, firestore } from './client';
import { clearAccountScope } from '../services/storage';

async function ensureUserDocument(user: User, db: NonNullable<typeof firestore>) {
  const userRef = doc(db, 'users', user.uid);
  const userSnapshot = await getDoc(userRef);
  const existing = userSnapshot.data() || {};
  await setDoc(userRef, {
    ownerUid: user.uid,
    schemaVersion: 1,
    createdAt: existing.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    displayName: user.displayName || existing.displayName || '',
    preferredCurrency: existing.preferredCurrency || 'DOP',
    // Preserve the device choice on first sign-in; an existing account setting wins.
    language: existing.language === 'en' || existing.language === 'es'
      ? existing.language
      : readDeviceLanguage(),
    theme: ['light', 'dark', 'system'].includes(String(existing.theme)) ? existing.theme : 'system',
    accentColor: existing.accentColor || '#012677',
    syncEnabled: true,
  }, { merge: true });
}

function readDeviceLanguage(): 'es' | 'en' {
  try {
    return localStorage.getItem('mischeles_language_v1') === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function requireServices() {
  if (!firebaseAuth || !firestore) {
    throw new Error('La cuenta en la nube no está configurada. El modo local sigue disponible.');
  }
  return { auth: firebaseAuth, db: firestore };
}

/** Account identity is separate from the optional bank-email OAuth connection. */
export const accountAuth = {
  observe(listener: (user: User | null) => void, onError?: (error: Error) => void) {
    if (!firebaseAuth) {
      listener(null);
      return () => undefined;
    }
    return onAuthStateChanged(firebaseAuth, listener, onError);
  },

  async create(displayName: string, email: string, password: string): Promise<User> {
    const { auth } = requireServices();
    await setPersistence(auth, browserSessionPersistence);
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const name = displayName.trim();
    await updateProfile(credential.user, { displayName: name });
    await sendEmailVerification(credential.user);
    await signOut(auth);
    return credential.user;
  },

  async signIn(email: string, password: string): Promise<User> {
    const { auth, db } = requireServices();
    await setPersistence(auth, browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user);
      await signOut(auth);
      throw new Error('EMAIL_NOT_VERIFIED');
    }
    await ensureUserDocument(credential.user, db);
    return credential.user;
  },

  async signInWithGoogle(): Promise<User> {
    const { auth, db } = requireServices();
    await setPersistence(auth, browserSessionPersistence);
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureUserDocument(credential.user, db);
    return credential.user;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const { auth } = requireServices();
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('ACCOUNT_REQUIRED');
    if (!user.providerData.some((provider) => provider.providerId === 'password')) {
      throw new Error('PASSWORD_PROVIDER_REQUIRED');
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  },

  async deleteAccount(currentPassword: string, confirmation: string): Promise<void> {
    const { auth } = requireServices();
    const user = auth.currentUser;
    if (!user) throw new Error('ACCOUNT_REQUIRED');
    if (!['ELIMINAR', 'DELETE'].includes(confirmation.trim().toUpperCase())) throw new Error('DELETE_CONFIRMATION_REQUIRED');
    if (!firebaseFunctions) throw new Error('ACCOUNT_DELETION_UNAVAILABLE');
    if (user.providerData.some((provider) => provider.providerId === 'password')) {
      if (!user.email || !currentPassword) throw new Error('CURRENT_PASSWORD_REQUIRED');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
    } else if (user.providerData.some((provider) => provider.providerId === 'google.com')) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } else {
      throw new Error('RECENT_LOGIN_REQUIRED');
    }
    const deleteMyAccount = httpsCallable(firebaseFunctions, 'deleteMyAccount');
    await deleteMyAccount({ confirmation: 'DELETE' });
    clearAccountScope(user.uid);
    await signOut(auth);
  },

  async sendPasswordReset(email: string): Promise<void> {
    const { auth } = requireServices();
    await sendPasswordResetEmail(auth, email.trim());
  },

  async signOut(): Promise<void> {
    const { auth } = requireServices();
    await signOut(auth);
  },
};

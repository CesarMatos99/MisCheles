import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  linkWithRedirect,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile,
  validatePassword,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { firebaseAuth } from './authClient';
import { googleSignInStrategy } from './googleSignInStrategy';
import { accountDeletionReauthMethod } from './accountReauthPolicy';

export interface FirebaseAuthAdapter {
  observe(listener: (user: User | null) => void, onError?: (error: Error) => void): () => void;
  currentUser(): User | null;
  validateSession(user: User): Promise<void>;
  completeRedirect(): Promise<void>;
  validatePassword(password: string): Promise<boolean>;
  createUser(email: string, password: string): Promise<User>;
  updateDisplayName(user: User, displayName: string): Promise<void>;
  sendVerification(user: User): Promise<void>;
  signIn(email: string, password: string): Promise<User>;
  signInWithGoogle(): Promise<User | null>;
  sendPasswordReset(email: string): Promise<void>;
  refreshUser(user: User): Promise<void>;
  changePassword(user: User, currentPassword: string, newPassword: string): Promise<void>;
  deleteAccount(user: User, currentPassword: string): Promise<void>;
  linkPassword(user: User, email: string, password: string): Promise<User>;
  linkGoogle(user: User): Promise<User | null>;
  signOut(): Promise<void>;
}

function requireAuth(auth: Auth | null): Auth {
  if (!auth) throw new Error('FIREBASE_NOT_CONFIGURED');
  return auth;
}

function requireCurrentUser(auth: Auth, user: User): void {
  if (auth.currentUser?.uid !== user.uid) throw new Error('AUTH_SESSION_MISMATCH');
}

export function createFirebaseAuthAdapter(auth: Auth | null = firebaseAuth): FirebaseAuthAdapter {
  return {
    observe(listener, onError) {
      if (!auth) { listener(null); return () => undefined; }
      return onAuthStateChanged(auth, listener, onError);
    },
    currentUser() { return auth?.currentUser || null; },
    async validateSession(user) {
      const activeAuth = requireAuth(auth);
      requireCurrentUser(activeAuth, user);
      await user.getIdToken(true);
    },
    async completeRedirect() {
      const activeAuth = requireAuth(auth);
      await getRedirectResult(activeAuth);
    },
    async validatePassword(password) {
      const status = await validatePassword(requireAuth(auth), password);
      return status.isValid;
    },
    async createUser(email, password) {
      const activeAuth = requireAuth(auth);
      await setPersistence(activeAuth, browserSessionPersistence);
      return (await createUserWithEmailAndPassword(activeAuth, email, password)).user;
    },
    async updateDisplayName(user, displayName) {
      await updateProfile(user, { displayName });
    },
    async sendVerification(user) {
      await sendEmailVerification(user);
    },
    async signIn(email, password) {
      const activeAuth = requireAuth(auth);
      await setPersistence(activeAuth, browserSessionPersistence);
      return (await signInWithEmailAndPassword(activeAuth, email, password)).user;
    },
    async signInWithGoogle() {
      const activeAuth = requireAuth(auth);
      await setPersistence(activeAuth, browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      if (typeof window !== 'undefined' && googleSignInStrategy(window.innerWidth) === 'redirect') {
        await signInWithRedirect(activeAuth, provider);
        return null;
      }
      return (await signInWithPopup(activeAuth, provider)).user;
    },
    async sendPasswordReset(email) {
      const activeAuth = requireAuth(auth);
      try {
        await sendPasswordResetEmail(activeAuth, email);
      } catch (error) {
        if ((error as { code?: string })?.code === 'auth/user-not-found') return;
        throw error;
      }
    },
    async refreshUser(user) {
      await reload(user);
    },
    async changePassword(user, currentPassword, newPassword) {
      if (!user.email || !user.providerData.some((provider) => provider.providerId === 'password')) {
        throw new Error('PASSWORD_PROVIDER_REQUIRED');
      }
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(user, newPassword);
    },
    async deleteAccount(user, currentPassword) {
      const providers = user.providerData.map((provider) => provider.providerId);
      const reauthMethod = accountDeletionReauthMethod(providers);
      if (reauthMethod === 'password') {
        if (!user.email || !currentPassword) throw new Error('CURRENT_PASSWORD_REQUIRED');
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      } else if (reauthMethod === 'google') {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else {
        throw new Error('RECENT_LOGIN_REQUIRED');
      }
      await deleteUser(user);
    },
    async linkPassword(user, email, password) {
      const activeAuth = requireAuth(auth);
      requireCurrentUser(activeAuth, user);
      const result = await linkWithCredential(user, EmailAuthProvider.credential(email, password));
      return result.user;
    },
    async linkGoogle(user) {
      const activeAuth = requireAuth(auth);
      requireCurrentUser(activeAuth, user);
      await setPersistence(activeAuth, browserSessionPersistence);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      if (typeof window !== 'undefined' && googleSignInStrategy(window.innerWidth) === 'redirect') {
        await linkWithRedirect(user, provider);
        return null;
      }
      return (await linkWithPopup(user, provider)).user;
    },
    async signOut() {
      await signOut(requireAuth(auth));
    },
  };
}

export const firebaseAuthAdapter = createFirebaseAuthAdapter();

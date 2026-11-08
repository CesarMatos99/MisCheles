import type { User } from 'firebase/auth';

export interface AccountAuthAdapter {
  observe(listener: (user: User | null) => void, onError?: (error: Error) => void): () => void;
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
  signOut(): Promise<void>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_RESEND_INTERVAL_MS = 60_000;

export function createAccountAuthService(
  adapter: AccountAuthAdapter,
  now: () => number = Date.now,
) {
  const verificationSentAt = new Map<string, number>();

  return {
    observe: adapter.observe,
    completeRedirect: adapter.completeRedirect,

    async create(displayName: string, email: string, password: string): Promise<User> {
      const name = displayName.trim();
      const normalizedEmail = email.trim();
      if (!name || name.length > 80) throw new Error('INVALID_NAME');
      if (!EMAIL_PATTERN.test(normalizedEmail)) throw new Error('INVALID_EMAIL');
      if (!await adapter.validatePassword(password)) throw new Error('PASSWORD_POLICY_INVALID');
      const user = await adapter.createUser(normalizedEmail, password);
      await adapter.updateDisplayName(user, name);
      await adapter.sendVerification(user);
      return user;
    },

    async signIn(email: string, password: string): Promise<User> {
      const normalizedEmail = email.trim();
      if (!EMAIL_PATTERN.test(normalizedEmail)) throw new Error('INVALID_EMAIL');
      // An unverified address may still use every local feature. Cloud services remain disabled.
      return adapter.signIn(normalizedEmail, password);
    },

    signInWithGoogle: adapter.signInWithGoogle,

    async sendPasswordReset(email: string): Promise<void> {
      const normalizedEmail = email.trim();
      if (!EMAIL_PATTERN.test(normalizedEmail)) throw new Error('INVALID_EMAIL');
      await adapter.sendPasswordReset(normalizedEmail);
    },

    async resendVerification(user: User): Promise<void> {
      if (user.emailVerified) throw new Error('EMAIL_ALREADY_VERIFIED');
      const lastSent = verificationSentAt.get(user.uid);
      if (lastSent !== undefined && now() - lastSent < VERIFICATION_RESEND_INTERVAL_MS) {
        throw new Error('VERIFICATION_RESEND_COOLDOWN');
      }
      await adapter.sendVerification(user);
      verificationSentAt.set(user.uid, now());
    },

    async refreshVerification(user: User): Promise<boolean> {
      await adapter.refreshUser(user);
      return user.emailVerified;
    },

    async changePassword(user: User, currentPassword: string, newPassword: string, confirmation: string): Promise<void> {
      if (newPassword !== confirmation) throw new Error('PASSWORD_CONFIRMATION_MISMATCH');
      if (!await adapter.validatePassword(newPassword)) throw new Error('PASSWORD_POLICY_INVALID');
      await adapter.changePassword(user, currentPassword, newPassword);
    },

    async deleteAccount(user: User, currentPassword: string, confirmation: string): Promise<void> {
      if (!['ELIMINAR', 'DELETE'].includes(confirmation.trim().toUpperCase())) {
        throw new Error('DELETE_CONFIRMATION_REQUIRED');
      }
      // The adapter deletes only the Firebase Authentication identity; local data is untouched.
      await adapter.deleteAccount(user, currentPassword);
    },

    signOut: adapter.signOut,
  };
}

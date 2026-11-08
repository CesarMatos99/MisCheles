import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { accountAuth } from './accountAuth';
import { firebaseConfigured } from './firebaseApp';
import { preferredUnauthenticatedScope, setStorageScope, stageLegacyPinBeforeScopeChange } from '../services/storage';

interface AccountState {
  configured: boolean;
  ready: boolean;
  user: User | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  createAccount: (displayName: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string, confirmation: string) => Promise<void>;
  deleteAccount: (currentPassword: string, confirmation: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AccountContext = createContext<AccountState | null>(null);

export const AccountAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!firebaseConfigured) {
      setStorageScope(preferredUnauthenticatedScope());
      setReady(true);
      return undefined;
    }
    let observedUser: User | null = null;
    let observerReady = false;
    let redirectReady = false;
    let redirectError: string | null = null;
    const publishSession = () => {
      if (!active || !observerReady || !redirectReady) return;
      // Select the identity namespace before exposing the restored account session.
      stageLegacyPinBeforeScopeChange();
      setStorageScope(observedUser ? { accountUid: observedUser.uid } : preferredUnauthenticatedScope());
      setUser(observedUser);
      setReady(true);
      setError(redirectError);
    };
    const stopAccountAuthObserver = accountAuth.observe(
      (nextUser) => {
        observedUser = nextUser;
        observerReady = true;
        publishSession();
      },
      (reason) => {
        redirectError = reason.message;
        observerReady = true;
        publishSession();
      },
    );
    void accountAuth.completeRedirect().catch((reason: unknown) => {
      redirectError = reason instanceof Error ? reason.message : 'AUTH_REDIRECT_FAILED';
    }).finally(() => {
      redirectReady = true;
      publishSession();
    });
    return () => {
      active = false;
      stopAccountAuthObserver();
    };
  }, []);

  const value = useMemo<AccountState>(() => ({
    configured: firebaseConfigured, ready, user, error,
    signIn: async (email, password) => { setError(null); await accountAuth.signIn(email, password); },
    signInWithGoogle: async () => { setError(null); await accountAuth.signInWithGoogle(); },
    createAccount: async (displayName, email, password) => { setError(null); await accountAuth.create(displayName, email, password); },
    sendPasswordReset: async (email) => { setError(null); await accountAuth.sendPasswordReset(email); },
    resendVerificationEmail: async () => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      await accountAuth.resendVerification(user);
    },
    refreshEmailVerification: async () => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      return accountAuth.refreshVerification(user);
    },
    changePassword: async (currentPassword, newPassword, confirmation) => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      await accountAuth.changePassword(user, currentPassword, newPassword, confirmation);
    },
    deleteAccount: async (currentPassword, confirmation) => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      await accountAuth.deleteAccount(user, currentPassword, confirmation);
    },
    signOut: async () => { setError(null); await accountAuth.signOut(); },
  }), [ready, user, error]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export function useAccountAuth() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccountAuth must be used inside AccountAuthProvider');
  return value;
};

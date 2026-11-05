import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { accountAuth } from './accountAuth';
import { firebaseConfigured } from './client';
import { accountSyncService } from './accountSyncService';
import { preferredUnauthenticatedScope, setStorageScope } from '../services/storage';

interface AccountState {
  configured: boolean;
  ready: boolean;
  user: User | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  createAccount: (displayName: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (currentPassword: string, confirmation: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AccountContext = createContext<AccountState | null>(null);

export const AccountAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stopSyncAuthObserver = accountSyncService.initializeAuthObserver();
    if (!firebaseConfigured) return stopSyncAuthObserver;
    const stopAccountAuthObserver = accountAuth.observe(
      (nextUser) => {
        // Switch data namespaces before rendering the authenticated tree, so the first
        // frame after sign-in/out cannot expose the previous local or account ledger.
        setStorageScope(nextUser ? { accountUid: nextUser.uid } : preferredUnauthenticatedScope());
        setUser(nextUser); setReady(true); setError(null);
      },
      (reason) => { setError(reason.message); setReady(true); },
    );
    return () => {
      stopAccountAuthObserver();
      stopSyncAuthObserver();
    };
  }, []);

  const value = useMemo<AccountState>(() => ({
    configured: firebaseConfigured, ready, user, error,
    signIn: async (email, password) => { setError(null); await accountAuth.signIn(email, password); },
    signInWithGoogle: async () => { setError(null); await accountAuth.signInWithGoogle(); },
    createAccount: async (displayName, email, password) => { setError(null); await accountAuth.create(displayName, email, password); },
    sendPasswordReset: async (email) => { setError(null); await accountAuth.sendPasswordReset(email); },
    changePassword: async (currentPassword, newPassword) => { setError(null); await accountAuth.changePassword(currentPassword, newPassword); },
    deleteAccount: async (currentPassword, confirmation) => { setError(null); await accountAuth.deleteAccount(currentPassword, confirmation); },
    signOut: async () => { setError(null); await accountAuth.signOut(); },
  }), [ready, user, error]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export function useAccountAuth() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccountAuth must be used inside AccountAuthProvider');
  return value;
};

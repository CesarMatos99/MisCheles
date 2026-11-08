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
  retrySession: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string, confirmation: string) => Promise<void>;
  linkPassword: (password: string, confirmation: string) => Promise<void>;
  linkGoogle: () => Promise<void>;
  deleteAccount: (currentPassword: string, confirmation: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AccountContext = createContext<AccountState | null>(null);

export const AccountAuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!firebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);

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
    let publication = 0;
    const publishSession = () => {
      if (!active || !observerReady || !redirectReady) return;
      const version = ++publication;
      const candidate = observedUser;
      // Keep the financial workspace unmounted while a restored/new identity is checked.
      setUser(null);
      setReady(false);
      setError(null);
      void (async () => {
        let acceptedUser = candidate;
        let nextError = redirectError;
        if (candidate) {
          try { await accountAuth.validateSession(candidate); }
          catch { acceptedUser = null; nextError = 'AUTH_SESSION_UNAVAILABLE'; }
        }
        if (!active || version !== publication) return;
        // Select the verified UID namespace before exposing the account to the app.
        stageLegacyPinBeforeScopeChange();
        setStorageScope(acceptedUser ? { accountUid: acceptedUser.uid } : preferredUnauthenticatedScope());
        setUser(acceptedUser);
        setReady(true);
        setError(nextError);
      })();
    };
    const stopAccountAuthObserver = accountAuth.observe(
      (nextUser) => {
        observedUser = nextUser;
        observerReady = true;
        publishSession();
      },
      (reason) => {
        redirectError = reason.message;
        observedUser = null;
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
      publication++;
      stopAccountAuthObserver();
    };
  }, []);

  const value = useMemo<AccountState>(() => ({
    configured: firebaseConfigured, ready, user, error,
    signIn: async (email, password) => { setError(null); await accountAuth.signIn(email, password); },
    signInWithGoogle: async () => { setError(null); await accountAuth.signInWithGoogle(); },
    createAccount: async (displayName, email, password) => { setError(null); await accountAuth.create(displayName, email, password); },
    sendPasswordReset: async (email) => { setError(null); await accountAuth.sendPasswordReset(email); },
    retrySession: async () => {
      const candidate = accountAuth.currentUser();
      setError(null);
      if (!candidate) {
        setUser(null);
        setStorageScope(preferredUnauthenticatedScope());
        setReady(true);
        return;
      }
      setUser(null);
      setReady(false);
      try {
        await accountAuth.validateSession(candidate);
        stageLegacyPinBeforeScopeChange();
        setStorageScope({ accountUid: candidate.uid });
        setUser(candidate);
        setSessionRevision((revision) => revision + 1);
        setReady(true);
      } catch {
        setStorageScope(preferredUnauthenticatedScope());
        setError('AUTH_SESSION_UNAVAILABLE');
        setReady(true);
      }
    },
    resendVerificationEmail: async () => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      await accountAuth.resendVerification(user);
    },
    refreshEmailVerification: async () => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      const verified = await accountAuth.refreshVerification(user);
      setSessionRevision((revision) => revision + 1);
      return verified;
    },
    changePassword: async (currentPassword, newPassword, confirmation) => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      await accountAuth.changePassword(user, currentPassword, newPassword, confirmation);
    },
    linkPassword: async (password, confirmation) => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      const linkedUser = await accountAuth.linkPassword(user, password, confirmation);
      setUser(linkedUser);
      setSessionRevision((revision) => revision + 1);
    },
    linkGoogle: async () => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      const linkedUser = await accountAuth.linkGoogle(user);
      if (linkedUser) {
        setUser(linkedUser);
        setSessionRevision((revision) => revision + 1);
      }
    },
    deleteAccount: async (currentPassword, confirmation) => {
      if (!user) throw new Error('ACCOUNT_REQUIRED');
      setError(null);
      await accountAuth.deleteAccount(user, currentPassword, confirmation);
    },
    signOut: async () => {
      // Hide the current workspace before Firebase processes the sign-out observer.
      setUser(null);
      setReady(false);
      setError(null);
      try {
        await accountAuth.signOut();
      } catch (signOutError) {
        const currentUser = accountAuth.currentUser();
        if (currentUser) {
          try {
            await accountAuth.validateSession(currentUser);
            stageLegacyPinBeforeScopeChange();
            setStorageScope({ accountUid: currentUser.uid });
            setUser(currentUser);
          } catch {
            setStorageScope(preferredUnauthenticatedScope());
            setUser(null);
          }
        } else {
          setStorageScope(preferredUnauthenticatedScope());
          setUser(null);
        }
        setReady(true);
        throw signOutError;
      }
    },
  }), [ready, user, error, sessionRevision]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export function useAccountAuth() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccountAuth must be used inside AccountAuthProvider');
  return value;
};

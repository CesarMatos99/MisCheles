import type { UserProfile } from '../types';

export interface AuthIdentity {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export interface VisibleIdentity {
  name: string;
  firstName: string;
  accountEmail: string;
  contactEmail: string;
  photoUrl: string;
  isDemo: boolean;
}

export const DEMO_IDENTITY_NAME = 'Usuario de demostración';

export function resolveVisibleIdentity(profile: UserProfile, authUser: AuthIdentity | null, isDemo: boolean): VisibleIdentity {
  if (isDemo) return {
    name: DEMO_IDENTITY_NAME,
    firstName: 'Demo',
    accountEmail: '',
    contactEmail: '',
    photoUrl: '',
    isDemo: true,
  };

  const savedName = profile.name.trim();
  const customName = savedName && savedName.toLocaleLowerCase('es') !== 'usuario' ? savedName : '';
  const firebaseName = authUser?.displayName?.trim() || '';
  const name = customName || firebaseName || 'Usuario';
  return {
    name,
    firstName: customName || firebaseName ? name.trim().split(/\s+/)[0] || '' : '',
    accountEmail: authUser?.email?.trim() || '',
    contactEmail: profile.email.trim(),
    photoUrl: profile.photoUrl.trim() || authUser?.photoURL?.trim() || '',
    isDemo: false,
  };
}

export interface WebAccessUser {
  emailVerified: boolean;
  providerData: readonly { providerId: string }[];
}

export type WebAccessState = 'restoring' | 'visitor' | 'demo' | 'verification' | 'account';

export function requiresEmailVerification(user: WebAccessUser): boolean {
  return user.providerData.some(({ providerId }) => providerId === 'password') && !user.emailVerified;
}

export function resolveWebAccessState(ready: boolean, user: WebAccessUser | null, demoActive: boolean): WebAccessState {
  if (!ready) return 'restoring';
  if (user) return requiresEmailVerification(user) ? 'verification' : 'account';
  return demoActive ? 'demo' : 'visitor';
}

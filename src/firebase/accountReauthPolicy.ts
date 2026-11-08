export function accountDeletionReauthMethod(providerIds: readonly string[]): 'password' | 'google' | 'unsupported' {
  if (providerIds.includes('password')) return 'password';
  if (providerIds.includes('google.com')) return 'google';
  return 'unsupported';
}

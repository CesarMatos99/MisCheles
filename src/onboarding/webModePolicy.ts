export interface WebAccessUser {
  emailVerified: boolean;
  providerData: readonly { providerId: string }[];
}

export type WebAccessState = 'restoring' | 'visitor' | 'demo' | 'verification' | 'account';

const LEGACY_FINANCIAL_KEYS = [
  'mischeles_transactions_v3',
  'mischeles_savings_movements_v3',
  'mischeles_savings_goals_v3',
  'mischeles_month_configs_v2',
  'mischeles_category_budgets_v1',
  'mischeles_demo_mischeles_transactions_v3',
  'mischeles_demo_mischeles_savings_movements_v3',
  'mischeles_demo_mischeles_savings_goals_v3',
  'mischeles_demo_mischeles_month_configs_v2',
  'mischeles_demo_mischeles_category_budgets_v1',
] as const;

export function requiresEmailVerification(user: WebAccessUser): boolean {
  return user.providerData.some(({ providerId }) => providerId === 'password') && !user.emailVerified;
}

export function resolveWebAccessState(ready: boolean, user: WebAccessUser | null, demoActive: boolean): WebAccessState {
  if (!ready) return 'restoring';
  if (user) return requiresEmailVerification(user) ? 'verification' : 'account';
  return demoActive ? 'demo' : 'visitor';
}

/** Checks only whether legacy guest financial records exist; it never inspects their contents. */
export function hasLegacyLocalFinancialData(storage: Pick<Storage, 'getItem'>): boolean {
  try { return LEGACY_FINANCIAL_KEYS.some((key) => storage.getItem(key) !== null); }
  catch { return false; }
}

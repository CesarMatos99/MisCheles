import type { MonthConfig } from '../types';

export type EffectiveRolloverAction = 'rollover_to_month' | 'transfer_to_savings_general' | 'transfer_to_goal';

/** Legacy `none` values are normalized to an explicit destination when a month is edited. */
export function normalizeRolloverAction(action: MonthConfig['rolloverAction'] | undefined): EffectiveRolloverAction {
  if (action === 'transfer_to_savings_general' || action === 'transfer_to_goal') return action;
  return 'rollover_to_month';
}

export function resolveStartingBudget(initialIncome: number, previousBalance: number, action: EffectiveRolloverAction) {
  const safeIncome = Number.isFinite(initialIncome) && initialIncome > 0 ? initialIncome : 0;
  const safePrevious = Number.isFinite(previousBalance) && previousBalance > 0 ? previousBalance : 0;
  const carryover = action === 'rollover_to_month' ? safePrevious : 0;
  return { initialIncome: safeIncome, carryover, available: safeIncome + carryover };
}

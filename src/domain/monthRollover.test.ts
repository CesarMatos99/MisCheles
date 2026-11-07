import { describe, expect, test } from 'bun:test';
import { normalizeRolloverAction, resolveStartingBudget } from './monthRollover';

describe('month rollover contract', () => {
  test('normalizes legacy no-destination values to the next month', () => {
    expect(normalizeRolloverAction('none')).toBe('rollover_to_month');
    expect(normalizeRolloverAction(undefined)).toBe('rollover_to_month');
    expect(normalizeRolloverAction('transfer_to_goal')).toBe('transfer_to_goal');
  });

  test('adds a remanent to available starting budget only when assigned to the month', () => {
    expect(resolveStartingBudget(70000, 15000, 'rollover_to_month')).toEqual({ initialIncome: 70000, carryover: 15000, available: 85000 });
    expect(resolveStartingBudget(70000, 15000, 'transfer_to_savings_general')).toEqual({ initialIncome: 70000, carryover: 0, available: 70000 });
  });
});

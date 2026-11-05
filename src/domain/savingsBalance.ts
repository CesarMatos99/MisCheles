import type { SavingsGoal, SavingsMovement } from '../types';

/** Net ledger delta for a goal; closed-goal history marked non-affecting is excluded. */
export function savingsGoalMovementNet(goalId: string, movements: SavingsMovement[]): number {
  return movements.filter((movement) => movement.goalId === goalId && movement.balanceAffecting !== false)
    .reduce((balance, movement) => balance + (movement.type === 'deposit_from_month' ? movement.amount : -movement.amount), 0);
}

/** Cloud goal documents retain an opening balance; the visible balance is opening + ledger delta. */
export function deriveSavingsGoalBalance(goal: SavingsGoal, movements: SavingsMovement[]): number {
  return Math.max(0, (Number(goal.currentAmount) || 0) + savingsGoalMovementNet(goal.id, movements));
}

/** Converts a displayed balance back to its persisted opening balance for legacy web records. */
export function savingsGoalOpeningBalance(goal: SavingsGoal, displayedBalance: number, movements: SavingsMovement[]): SavingsGoal {
  return { ...goal, currentAmount: Math.max(0, (Number(displayedBalance) || 0) - savingsGoalMovementNet(goal.id, movements)) };
}

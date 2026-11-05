import type { FinancialSummary, SavingsGoal, SavingsMovement, Transaction } from '../types';
import { isSavingsContributionTransaction } from './financialClassification.ts';

export interface FinancialSummaryInput {
  monthKey: string;
  initialIncome: number;
  carryover: number;
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  totalSavingsVault: number;
}

const amount = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;
const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values());

/** Legacy savings contributions may exist only as expenses in the old ledger.
 * Count those as transfers unless their linked savings deposit is present.
 */
export function unmatchedSavingsContributionAmount(
  transactions: Transaction[],
  savingsMovements: SavingsMovement[],
): number {
  const savingsById = new Map(uniqueById(savingsMovements).map((movement) => [movement.id, movement]));
  return uniqueById(transactions)
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => {
      const linkedMovement = transaction.relatedSavingsMovementId
        ? savingsById.get(transaction.relatedSavingsMovementId)
        : undefined;
      if (linkedMovement?.type === 'deposit_from_month') return sum;
      if (isSavingsContributionTransaction(transaction)) {
        return sum + amount(transaction.amount);
      }
      return sum;
    }, 0);
}

/**
 * Derives the savings vault from goal balances, general-fund movements and
 * unmatched legacy contribution entries. Linked mirrors are excluded by the
 * unmatched-contribution selector so they are counted exactly once.
 */
export function calculateSavingsVaultBalance(goals: SavingsGoal[], savingsMovements: SavingsMovement[], transactions: Transaction[]): number {
  const goalsTotal = goals.reduce((sum, goal) => sum + Math.max(0, Number(goal.currentAmount) || 0), 0);
  const generalBalance = savingsMovements
    .filter((movement) => !movement.goalId && movement.balanceAffecting !== false)
    .reduce((balance, movement) => balance + (movement.type === 'deposit_from_month' || movement.type === 'goal_to_general' ? movement.amount : -movement.amount), 0);
  return Math.max(0, goalsTotal + generalBalance + unmatchedSavingsContributionAmount(transactions, savingsMovements));
}

/**
 * Applies the accounting contract used by every client:
 * - the monthly initial amount is income;
 * - carryover and savings withdrawals affect available cash, not income;
 * - savings deposits reduce cash once but are not consumption;
 * - direct expenses from savings count as consumption, not monthly cash outflow.
 */
export function calculateAvailableBalance(input: { carryover: number; totalIncome: number; savingsWithdrawals: number; regularExpenses: number; savingsContributions: number }): number {
  return input.carryover + input.totalIncome + input.savingsWithdrawals - input.regularExpenses - input.savingsContributions;
}

export function calculateFinancialSummary(input: FinancialSummaryInput): FinancialSummary {
  const transactions = uniqueById(input.transactions)
    .filter((transaction) => transaction.monthKey === input.monthKey);
  const savingsMovements = uniqueById(input.savingsMovements)
    .filter((movement) => movement.monthKey === input.monthKey);
  const savingsById = new Map(savingsMovements.map((movement) => [movement.id, movement]));

  const initialIncome = amount(input.initialIncome);
  const carryover = amount(input.carryover);
  const totalAdditionalIncome = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + amount(transaction.amount), 0);
  const totalIncome = initialIncome + totalAdditionalIncome;

  const savingsTransfersToFromMovements = savingsMovements
    .filter((movement) => movement.type === 'deposit_from_month')
    .reduce((sum, movement) => sum + amount(movement.amount), 0);
  const savingsTransfersFrom = savingsMovements
    .filter((movement) => movement.type === 'withdraw_to_month')
    .reduce((sum, movement) => sum + amount(movement.amount), 0);
  const savingsDirectExpenses = savingsMovements
    .filter((movement) => movement.type === 'direct_expense')
    .reduce((sum, movement) => sum + amount(movement.amount), 0);
  const unmatchedSavingsContributions = unmatchedSavingsContributionAmount(transactions, savingsMovements);

  let regularExpenses = 0;
  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    const transactionAmount = amount(transaction.amount);
    const linkedMovement = transaction.relatedSavingsMovementId
      ? savingsById.get(transaction.relatedSavingsMovementId)
      : undefined;

    if (linkedMovement?.type === 'deposit_from_month') continue;
    if (isSavingsContributionTransaction(transaction)) continue;
    regularExpenses += transactionAmount;
  }

  const savingsTransfersTo = savingsTransfersToFromMovements + unmatchedSavingsContributions;
  const totalExpenses = regularExpenses + savingsDirectExpenses;
  const availableBalance = calculateAvailableBalance({ carryover, totalIncome, savingsWithdrawals: savingsTransfersFrom, regularExpenses, savingsContributions: savingsTransfersTo });

  return {
    initialIncome,
    carryover,
    totalAdditionalIncome,
    totalIncome,
    regularExpenses,
    totalExpenses,
    savingsTransfersTo,
    savingsTransfersFrom,
    availableBalance,
    totalSavingsVault: amount(input.totalSavingsVault),
    savingsDirectExpenses,
  };
}

import type { Transaction, SavingsMovement } from '../types';
import { isSavingsContributionTransaction } from './financialClassification.ts';
export type AnalyticsMovementType = 'all' | 'income' | 'expense' | 'savings';
export function filterAnalyticsMovements(transactions: Transaction[], savingsMovements: SavingsMovement[], type: AnalyticsMovementType) {
  const isMirror = isSavingsContributionTransaction;
  return {
    transactions: transactions.filter(tx => type === 'all' || (type === 'income' && tx.type === 'income') ||
      (type === 'expense' && tx.type === 'expense' && !isMirror(tx)) || (type === 'savings' && isMirror(tx))),
    savingsMovements: savingsMovements.filter(sm => type === 'all' ||
      (type === 'expense' && sm.type === 'direct_expense') || (type === 'savings' && sm.type !== 'direct_expense')),
    includeInitialIncome: type === 'all' || type === 'income',
    completeLedger: type === 'all',
  };
}

import type { Transaction } from '../types';
import { isSavingsCategory, isSavingsContributionTransaction } from './financialClassification.ts';

export function transactionTypeLabel(transaction: Pick<Transaction, 'type' | 'category' | 'relatedSavingsMovementId' | 'paymentMethod'>): string {
  if (transaction.type === 'income') return 'Ingreso';
  if (isSavingsContributionTransaction(transaction)) return 'Aporte a ahorro (transferencia interna)';
  return 'Gasto';
}

export const isSavingsBudgetCategory = isSavingsCategory;
export { isSavingsContributionTransaction };

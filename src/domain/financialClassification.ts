import type { Transaction } from '../types';

export const normalizeFinancialCategory = (value: string | null | undefined): string =>
  (value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-DO');

const SAVINGS_CATEGORIES = new Set(['ahorro', 'ahorros', 'aporte al ahorro']);
const SAVINGS_TRANSFER_METHOD = normalizeFinancialCategory('Transferencia a Ahorro');

export function isSavingsCategory(category: string): boolean {
  return SAVINGS_CATEGORIES.has(normalizeFinancialCategory(category));
}

export function isSavingsContributionTransaction(
  transaction: Pick<Transaction, 'type' | 'category' | 'relatedSavingsMovementId' | 'paymentMethod'>,
): boolean {
  return transaction.type === 'expense' && (
    Boolean(transaction.relatedSavingsMovementId)
    || isSavingsCategory(transaction.category)
    || normalizeFinancialCategory(transaction.paymentMethod) === SAVINGS_TRANSFER_METHOD
  );
}

export function isConsumptionExpenseTransaction(
  transaction: Pick<Transaction, 'type' | 'category' | 'relatedSavingsMovementId' | 'paymentMethod'>,
): boolean {
  return transaction.type === 'expense' && !isSavingsContributionTransaction(transaction);
}

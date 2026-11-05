import assert from 'node:assert/strict';
import test from 'node:test';
import { isConsumptionExpenseTransaction, isSavingsContributionTransaction } from './financialClassification.ts';
import type { Transaction } from '../types';
const transaction = (category: string, relatedSavingsMovementId?: string, paymentMethod = 'Efectivo'): Transaction => ({
  id: category, monthKey: '2026-10', type: 'expense', category, amount: 10, description: '', date: '2026-10-01', createdAt: 1, paymentMethod, relatedSavingsMovementId,
});
test('classifies category-based and linked savings contributions as internal transfers', () => {
  for (const item of [transaction('Ahorros'), transaction('Aporte al Ahorro'), transaction('Otros', 'sm-1'), transaction('Otros', undefined, 'Transferencia a Ahorro')]) {
    assert.equal(isSavingsContributionTransaction(item), true);
    assert.equal(isConsumptionExpenseTransaction(item), false);
  }
});
test('keeps ordinary purchases and savings-funded consumption separate', () => {
  assert.equal(isConsumptionExpenseTransaction(transaction('Internet')), true);
  assert.equal(isConsumptionExpenseTransaction({ ...transaction('Salud'), type: 'income' }), false);
});

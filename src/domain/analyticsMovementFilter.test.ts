import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAnalyticsMovements } from './analyticsMovementFilter.ts';
import type { Transaction, SavingsMovement } from '../types';
test('type filters keep savings mirrors separate from consumption and preserve originals', () => {
  const tx = [
    { id: 'income', type: 'income', category: 'Sueldo' },
    { id: 'expense', type: 'expense', category: 'Comida' },
    { id: 'mirror', type: 'expense', category: 'Aporte al Ahorro', relatedSavingsMovementId: 'deposit' },
  ] as Transaction[];
  const sm = [{ id: 'deposit', type: 'deposit_from_month' }, { id: 'withdrawal', type: 'withdraw_to_month' }, { id: 'direct', type: 'direct_expense' }] as SavingsMovement[];
  const expense = filterAnalyticsMovements(tx, sm, 'expense');
  assert.deepEqual(expense.transactions.map(t => t.id), ['expense']);
  assert.deepEqual(expense.savingsMovements.map(t => t.id), ['direct']);
  assert.equal(expense.includeInitialIncome, false);
  assert.equal(expense.completeLedger, false);
  const savings = filterAnalyticsMovements(tx, sm, 'savings');
  assert.deepEqual(savings.transactions.map(t => t.id), ['mirror']);
  assert.deepEqual(savings.savingsMovements.map(t => t.id), ['deposit', 'withdrawal']);
  const income = filterAnalyticsMovements(tx, sm, 'income');
  assert.deepEqual(income.transactions.map(t => t.id), ['income']);
  assert.equal(income.savingsMovements.length, 0);
  assert.equal(income.includeInitialIncome, true);
  assert.equal(filterAnalyticsMovements(tx, sm, 'all').completeLedger, true);
  assert.equal(tx.length, 3); assert.equal(sm.length, 3);
});

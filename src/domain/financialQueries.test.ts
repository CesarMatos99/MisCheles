import assert from 'node:assert/strict';
import test from 'node:test';
import { categorySpendingReport, projectCategoryBudget, spendingByCategory } from './financialQueries';
import type { SavingsMovement, Transaction } from '../types';
const tx = (id: string, category: string, amount: number, type: 'income' | 'expense' = 'expense'): Transaction => ({ id, monthKey: '2026-11', type, amount, category, description: category, date: '2026-11-02', paymentMethod: 'Efectivo', createdAt: 1 });
const movement: SavingsMovement = { id: 'sm1', monthKey: '2026-11', type: 'direct_expense', amount: 30, description: 'Farmacia', category: 'Salud', date: '2026-11-02', createdAt: 1 };
test('category spending excludes savings contributions and combines direct savings expenses', () => {
  const savingsMirror = { ...tx('mirror', 'Aporte al Ahorro', 50), relatedSavingsMovementId: 'sm-contribution', paymentMethod: 'Transferencia a Ahorro' };
  const result = spendingByCategory([tx('food', 'Alimentación', 70), savingsMirror], [movement]);
  assert.equal(result.get('alimentacion')?.amount, 70);
  assert.equal(result.get('salud')?.amount, 30);
  assert.equal(result.size, 2);
});
test('category report ranks spending and compares assigned budget with actuals', () => {
  const rows = categorySpendingReport({ transactions: [tx('food', 'Alimentación', 90), tx('transport', 'Transporte', 20)], savingsMovements: [], budgets: [{ category: 'Alimentación', amount: 100 }, { category: 'Internet', amount: 50 }], totalExpenses: 110 });
  assert.deepEqual(rows.map((row) => row.category), ['Alimentación', 'Transporte', 'Internet']);
  assert.equal(rows[0].remaining, 10);
  assert.equal(rows[0].share, 90 / 110 * 100);
  assert.equal(rows[2].amount, 0);
});
test('budget projection replaces edited expense and detects only a new crossing', () => {
  const transactions = [tx('a', 'Internet', 50), tx('b', 'Internet', 20)];
  assert.deepEqual(projectCategoryBudget({ transactions, category: 'Internet', amount: 25, editingId: 'a', budget: 100 }), { previous: 70, projected: 45, thresholdCrossed: false, exceeded: false });
  assert.deepEqual(projectCategoryBudget({ transactions, category: 'Internet', amount: 10, budget: 100 }), { previous: 70, projected: 80, thresholdCrossed: true, exceeded: false });
});

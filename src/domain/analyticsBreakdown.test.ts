import assert from 'node:assert/strict';
import test from 'node:test';
import { focusedBreakdown } from './analyticsBreakdown.ts';
import type { Transaction, SavingsMovement } from '../types';
test('income and contribution rankings exclude consumption and withdrawals', () => {
  const income = focusedBreakdown('income', [{ type: 'income', category: 'Sueldo', amount: 300 }, { type: 'income', category: 'Venta', amount: 100 }, { type: 'expense', category: 'Comida', amount: 200 }] as Transaction[], []);
  assert.deepEqual(income.map(row => [row.name, row.amount, row.share]), [['Sueldo', 300, 75], ['Venta', 100, 25]]);
  const savings = focusedBreakdown('savings', [], [{ type: 'deposit_from_month', amount: 100 }, { type: 'deposit_from_month', goalId: 'goal', goalTitle: 'Viaje', amount: 300 }, { type: 'withdraw_to_month', amount: 50 }] as SavingsMovement[]);
  assert.deepEqual(savings.map(row => [row.name, row.amount, row.share]), [['Viaje', 300, 75], ['Ahorro general', 100, 25]]);
});

test('same-name goals remain separate destinations by stable ID', () => {
  const rows = focusedBreakdown('savings', [], [
    { type: 'deposit_from_month', goalId: 'a', goalTitle: 'Viaje', amount: 100 },
    { type: 'deposit_from_month', goalId: 'b', goalTitle: 'Viaje', amount: 200 },
    { type: 'deposit_from_month', goalId: 'a', goalTitle: 'Viaje', amount: 50 },
  ] as SavingsMovement[]);
  assert.deepEqual(rows.map(row => [row.id, row.amount]), [['goal:b', 200], ['goal:a', 150]]);
});

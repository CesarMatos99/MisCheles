import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { SavingsMovement, Transaction } from '../types';
import { calculateFinancialSummary, calculateSavingsVaultBalance, unmatchedSavingsContributionAmount } from './financialSummary.ts';

const tx = (values: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amount' | 'category'>): Transaction => ({
  id: values.id,
  monthKey: values.monthKey || '2026-10',
  type: values.type,
  amount: values.amount,
  category: values.category,
  description: values.description || '',
  date: values.date || '2026-10-10',
  paymentMethod: values.paymentMethod || 'Efectivo',
  createdAt: values.createdAt || 1,
  relatedSavingsMovementId: values.relatedSavingsMovementId,
});

const movement = (values: Partial<SavingsMovement> & Pick<SavingsMovement, 'id' | 'type' | 'amount'>): SavingsMovement => ({
  id: values.id,
  monthKey: values.monthKey || '2026-10',
  type: values.type,
  amount: values.amount,
  description: values.description || '',
  date: values.date || '2026-10-10',
  createdAt: values.createdAt || 1,
  category: values.category,
  destinationType: values.destinationType,
  goalId: values.goalId,
  goalTitle: values.goalTitle,
});

test('separa ingresos, arrastre y transferencias y descuenta el aporte una sola vez', () => {
  const result = calculateFinancialSummary({
    monthKey: '2026-10',
    initialIncome: 1000,
    carryover: 100,
    totalSavingsVault: 1200,
    transactions: [
      tx({ id: 'income-1', type: 'income', amount: 300, category: 'Trabajo' }),
      tx({ id: 'rent', type: 'expense', amount: 400, category: 'Vivienda' }),
      tx({ id: 'deposit-mirror', type: 'expense', amount: 200, category: 'Aporte al Ahorro', relatedSavingsMovementId: 'deposit-1' }),
    ],
    savingsMovements: [
      movement({ id: 'deposit-1', type: 'deposit_from_month', amount: 200 }),
      movement({ id: 'withdraw-1', type: 'withdraw_to_month', amount: 50 }),
      movement({ id: 'direct-1', type: 'direct_expense', amount: 80, category: 'Salud' }),
    ],
  });

  assert.equal(result.totalIncome, 1300);
  assert.equal(result.carryover, 100);
  assert.equal(result.regularExpenses, 400);
  assert.equal(result.totalExpenses, 480);
  assert.equal(result.savingsTransfersTo, 200);
  assert.equal(result.savingsTransfersFrom, 50);
  assert.equal(result.availableBalance, 850);
  assert.equal(result.totalSavingsVault, 1200);
});

test('conserva aportes antiguos sin movimiento enlazado y mantiene el efectivo', () => {
  const result = calculateFinancialSummary({
    monthKey: '2026-10',
    initialIncome: 1000,
    carryover: 500,
    totalSavingsVault: 125,
    transactions: [
      tx({ id: 'food', type: 'expense', amount: 100, category: 'Alimentación' }),
      tx({ id: 'legacy-deposit', type: 'expense', amount: 125, category: ' Aporte al Ahorro ' }),
    ],
    savingsMovements: [],
  });

  assert.equal(result.regularExpenses, 100);
  assert.equal(result.totalExpenses, 100);
  assert.equal(result.savingsTransfersTo, 125);
  assert.equal(result.availableBalance, 1275);
});

test('ignora movimientos de otros períodos y deduplica IDs repetidos', () => {
  const result = calculateFinancialSummary({
    monthKey: '2026-10',
    initialIncome: 0,
    carryover: 0,
    totalSavingsVault: 0,
    transactions: [
      tx({ id: 'food', type: 'expense', amount: 50, category: 'Alimentación' }),
      tx({ id: 'food', type: 'expense', amount: 50, category: 'Alimentación' }),
      tx({ id: 'old', monthKey: '2026-09', type: 'expense', amount: 500, category: 'Vivienda' }),
    ],
    savingsMovements: [],
  });

  assert.equal(result.totalExpenses, 50);
  assert.equal(result.availableBalance, -50);
});

test('un pago directo desde ahorros cuenta como consumo y no reduce el mes', () => {
  const result = calculateFinancialSummary({
    monthKey: '2026-10',
    initialIncome: 900,
    carryover: 0,
    totalSavingsVault: 40,
    transactions: [],
    savingsMovements: [movement({ id: 'direct-1', type: 'direct_expense', amount: 40, category: 'Salud' })],
  });

  assert.equal(result.totalExpenses, 40);
  assert.equal(result.regularExpenses, 0);
  assert.equal(result.availableBalance, 900);
});


test('counts legacy, orphan, and wrongly linked savings contributions once', () => {
  const contributions = unmatchedSavingsContributionAmount([
    tx({ id: 'mirror', type: 'expense', amount: 150, category: 'Aporte al Ahorro', relatedSavingsMovementId: 'deposit' }),
    tx({ id: 'legacy', type: 'expense', amount: 40, category: ' Aporte al Ahorro ' }),
    tx({ id: 'legacy', type: 'expense', amount: 44, category: ' Aporte al Ahorro ' }),
    tx({ id: 'orphan', type: 'expense', amount: 25, category: 'Comida', relatedSavingsMovementId: 'missing' }),
    tx({ id: 'wrong-link', type: 'expense', amount: 10, category: 'Comida', relatedSavingsMovementId: 'withdrawal' }),
    tx({ id: 'ordinary', type: 'expense', amount: 60, category: 'Comida' }),
  ], [
    movement({ id: 'deposit', type: 'deposit_from_month', amount: 150 }),
    movement({ id: 'withdrawal', type: 'withdraw_to_month', amount: 10 }),
  ]);
  assert.equal(contributions, 79);
});

test('matches the shared React and Flutter financial contract vectors', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../shared/financial_summary_vectors.json', import.meta.url), 'utf8'));
  for (const scenario of fixture.cases) {
    const transactions = scenario.records.filter((item: any) => item.source === 'transaction').map((item: any) => tx({
      id: item.id, monthKey: item.monthKey, type: item.kind, amount: item.amountMinor / 100,
      category: item.categoryName, relatedSavingsMovementId: item.relatedSavingsMovementId,
    }));
    const savingsMovements = scenario.records.filter((item: any) => item.source === 'savingsMovement').map((item: any) => movement({
      id: item.id, monthKey: item.monthKey, type: item.kind === 'savings_contribution' ? 'deposit_from_month' : item.kind === 'savings_withdrawal' ? 'withdraw_to_month' : 'direct_expense',
      amount: item.amountMinor / 100, category: item.categoryName,
    }));
    const result = calculateFinancialSummary({ monthKey: scenario.monthKey, initialIncome: scenario.initialIncomeMinor / 100, carryover: scenario.carryoverMinor / 100, transactions, savingsMovements, totalSavingsVault: 0 });
    const actual = {
      initialIncomeMinor: Math.round(result.initialIncome * 100), carryoverMinor: Math.round(result.carryover * 100),
      additionalIncomeMinor: Math.round(result.totalAdditionalIncome * 100), totalIncomeMinor: Math.round(result.totalIncome * 100),
      regularExpensesMinor: Math.round(result.regularExpenses * 100), totalExpensesMinor: Math.round(result.totalExpenses * 100),
      savingsContributionsMinor: Math.round(result.savingsTransfersTo * 100), savingsWithdrawalsMinor: Math.round(result.savingsTransfersFrom * 100),
      directSavingsExpensesMinor: Math.round(result.savingsDirectExpenses * 100), availableMinor: Math.round(result.availableBalance * 100),
    };
    assert.deepEqual(actual, scenario.expected, scenario.name);
  }
});

test('conciliates aportes espejo y antiguos de Ahorros sin inflar consumo ni duplicar el disponible', () => {
  const result = calculateFinancialSummary({
    monthKey: '2026-10', initialIncome: 70000, carryover: 0, totalSavingsVault: 124600,
    transactions: [
      tx({ id: 'market', type: 'expense', amount: 27000, category: 'Alimentación' }),
      tx({ id: 'linked-deposit', type: 'expense', amount: 100000, category: 'Aporte al Ahorro', relatedSavingsMovementId: 'deposit-100k' }),
      tx({ id: 'legacy-savings', type: 'expense', amount: 24600, category: 'Ahorros' }),
    ],
    savingsMovements: [movement({ id: 'deposit-100k', type: 'deposit_from_month', amount: 100000 })],
  });
  assert.equal(result.totalIncome, 70000);
  assert.equal(result.regularExpenses, 27000);
  assert.equal(result.totalExpenses, 27000);
  assert.equal(result.savingsTransfersTo, 124600);
  assert.equal(result.availableBalance, -81600);
  assert.equal(calculateSavingsVaultBalance([], [movement({ id: 'deposit-100k', type: 'deposit_from_month', amount: 100000 })], [
    tx({ id: 'linked-deposit', type: 'expense', amount: 100000, category: 'Aporte al Ahorro', relatedSavingsMovementId: 'deposit-100k' }),
    tx({ id: 'legacy-savings', type: 'expense', amount: 24600, category: 'Ahorros' }),
  ]), 124600);
});

test('retiros y gastos directos disminuyen el fondo y los aportes espejo no lo duplican', () => {
  const movements = [
    movement({ id: 'deposit', type: 'deposit_from_month', amount: 1000 }),
    movement({ id: 'withdraw', type: 'withdraw_to_month', amount: 200 }),
    movement({ id: 'direct', type: 'direct_expense', amount: 100 }),
  ];
  const linkedMirror = tx({ id: 'mirror-1000', type: 'expense', amount: 1000, category: 'Aporte al Ahorro', relatedSavingsMovementId: 'deposit' });
  assert.equal(calculateSavingsVaultBalance([], movements, [linkedMirror]), 700);
});

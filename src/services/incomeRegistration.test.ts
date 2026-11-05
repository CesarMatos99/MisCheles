import assert from 'node:assert/strict';
import test from 'node:test';
import { focusedBreakdown } from '../domain/analyticsBreakdown.ts';
import { filterAnalyticsMovements } from '../domain/analyticsMovementFilter.ts';
import { DEFAULT_TRANSACTION_FILTERS, filterTransactionRecords, readTransactionFilters } from '../domain/transactionFilters.ts';
import { INCOME_CATEGORIES } from '../constants/categories.ts';
import { setStorageScope, storageService } from './storage.ts';
import type { SavingsMovement, Transaction } from '../types.ts';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

test('an additional income is persistent, visible, counted once, and stays consistent through monthly operations', () => {
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');

  const monthKey = '2026-11';
  storageService.saveMonthConfig({ monthKey, year: 2026, month: 11, initialIncome: 1000, carryoverFromPrev: 0, autoRolloverEnabled: false, isConfigured: true });
  const income = storageService.addTransaction({
    monthKey,
    type: 'income',
    amount: 200_000,
    category: 'Trabajo extra',
    description: 'Proyecto profesional',
    date: '2026-11-02',
    paymentMethod: 'Transferencia Bancaria',
  });

  assert.equal(income.type, 'income');
  assert.equal(income.amount, 200_000);
  assert.equal(income.category, 'Trabajo extra');
  assert.equal(income.description, 'Proyecto profesional');
  assert.equal(income.date, '2026-11-02');
  assert.equal(income.paymentMethod, 'Transferencia Bancaria');
  assert.deepEqual(storageService.getTransactionsByMonth(monthKey).map((item) => item.id), [income.id]);
  assert.equal(storageService.getFinancialSummary(monthKey).availableBalance, 201_000);

  // Storage is read back from the persistent layer, as on a page refresh.
  assert.equal(storageService.getTransactions()[0].id, income.id);
  assert.equal(storageService.getFinancialSummary(monthKey).availableBalance, 201_000);
  assert.deepEqual(storageService.getTransactionsByMonth('2026-12'), []);

  const allFilters = { ...DEFAULT_TRANSACTION_FILTERS };
  assert.deepEqual(filterTransactionRecords(storageService.getTransactionsByMonth(monthKey), allFilters, '', () => false).map((item) => item.id), [income.id]);
  assert.deepEqual(filterTransactionRecords(storageService.getTransactionsByMonth(monthKey), { ...allFilters, type: 'income', category: 'Trabajo extra', from: '2026-11-02', to: '2026-11-02' }, '', () => false).map((item) => item.id), [income.id]);
  assert.deepEqual(filterTransactionRecords(storageService.getTransactionsByMonth(monthKey), { ...allFilters, type: 'income', from: '2026-11-03', to: '' }, '', () => false), []);
  const persistedSavingsFilter = readTransactionFilters(JSON.stringify({ ...allFilters, type: 'savings' }));
  assert.deepEqual(filterTransactionRecords(storageService.getTransactionsByMonth(monthKey), persistedSavingsFilter, '', () => false), []);

  const transactionSource = storageService.getTransactions();
  const incomeMovements = filterAnalyticsMovements(transactionSource, [], 'income');
  assert.deepEqual(incomeMovements.transactions.map((item) => item.id), [income.id]);
  assert.equal(focusedBreakdown('income', incomeMovements.transactions, []).reduce((sum, row) => sum + row.amount, 0), 200_000);

  storageService.addTransaction({ monthKey, type: 'expense', amount: 40_000, category: 'Servicios', description: 'Gasto posterior', date: '2026-11-03', paymentMethod: 'Efectivo' });
  storageService.addSavingsMovement({ monthKey, type: 'deposit_from_month', amount: 50_000, description: 'Ahorro general', date: '2026-11-04', destinationType: 'general' });
  storageService.saveSavingsGoals([{ id: 'income-goal-test', title: 'Meta aislada', targetAmount: 50_000, currentAmount: 0 }]);
  storageService.addSavingsMovement({ monthKey, type: 'deposit_from_month', amount: 30_000, description: 'Aporte a meta', date: '2026-11-05', destinationType: 'goal', goalId: 'income-goal-test', goalTitle: 'Meta aislada' });
  storageService.addSavingsMovement({ monthKey, type: 'withdraw_to_month', amount: 10_000, description: 'Retiro parcial', date: '2026-11-06', destinationType: 'general' });

  const finalSummary = storageService.getFinancialSummary(monthKey);
  const finalTransactions: Transaction[] = storageService.getTransactionsByMonth(monthKey);
  const finalSavings: SavingsMovement[] = storageService.getSavingsMovements().filter((item) => item.monthKey === monthKey);
  assert.equal(finalSummary.availableBalance, 91_000);
  assert.equal(finalSummary.totalIncome, 201_000);
  assert.equal(finalSummary.totalAdditionalIncome, 200_000);
  assert.equal(finalSummary.regularExpenses, 40_000);
  assert.equal(finalSummary.totalExpenses, 40_000);
  assert.equal(finalSummary.savingsTransfersTo, 80_000);
  assert.equal(finalSummary.savingsTransfersFrom, 10_000);
  assert.equal(finalSummary.totalSavingsVault, 70_000);
  assert.equal(finalTransactions.filter((item) => item.type === 'income' && item.amount === 200_000).length, 1);
  assert.equal(finalTransactions.filter((item) => item.relatedSavingsMovementId).length, 2);
  assert.equal(filterAnalyticsMovements(finalTransactions, finalSavings, 'income').transactions.filter((item) => item.id === income.id).length, 1);
});

test('every standard and custom income category remains a single income in movements, balance and statistics', () => {
  const memory = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
  setStorageScope('local');

  const monthKey = '2026-11';
  const date = '2026-11-02';
  storageService.saveMonthConfig({ monthKey, year: 2026, month: 11, initialIncome: 1000, carryoverFromPrev: 0, autoRolloverEnabled: false, isConfigured: true });
  const categories = [...INCOME_CATEGORIES.map(category => category.name), 'Ingreso personalizado'];
  const transactions = categories.map((category, index) => storageService.addTransaction({
    monthKey,
    type: 'income',
    amount: category === 'Trabajo Extra / Negocio' ? 200_000 : index === categories.length - 1 ? 700 : 1000,
    category,
    description: `Ingreso de ${category}`,
    date,
    paymentMethod: 'Transferencia Bancaria',
  }));
  const rows = storageService.getTransactionsByMonth(monthKey);
  const analytics = filterAnalyticsMovements(storageService.getTransactions(), [], 'income');
  const summary = storageService.getFinancialSummary(monthKey);

  assert.equal(rows.length, categories.length);
  assert.equal(new Set(rows.map(row => row.id)).size, categories.length);
  assert.ok(rows.every(row => row.type === 'income' && row.date === date && row.paymentMethod === 'Transferencia Bancaria'));
  assert.equal(rows.find(row => row.category === 'Trabajo Extra / Negocio')?.amount, 200_000);
  assert.equal(filterTransactionRecords(rows, { ...DEFAULT_TRANSACTION_FILTERS, type: 'income' }, '', () => false).length, categories.length);
  assert.deepEqual(analytics.transactions.map(row => row.id).sort(), transactions.map(row => row.id).sort());
  assert.equal(focusedBreakdown('income', analytics.transactions, []).reduce((total, row) => total + row.amount, 0), 205_700);
  assert.equal(summary.totalAdditionalIncome, 205_700);
  assert.equal(summary.availableBalance, 206_700);
  assert.equal(storageService.getSavingsMovements().length, 0);
  assert.equal(summary.totalSavingsVault, 0);
});

import { test, expect } from 'bun:test';
import { buildConfiguredReport, configuredExportRange } from './configuredReport';
import type { MonthConfig, SavingsMovement, Transaction } from '../types';

const tx: Transaction[] = [
  { id: 'income', monthKey: '2026-11', type: 'income', amount: 1000, category: 'Salario', description: 'Pago', date: '2026-11-02', paymentMethod: 'Transferencia', createdAt: 1 },
  { id: 'expense', monthKey: '2026-11', type: 'expense', amount: 300, category: 'Alimentos', description: 'Compra', date: '2026-11-03', paymentMethod: 'Efectivo', createdAt: 2 },
  { id: 'mirror', monthKey: '2026-11', type: 'expense', amount: 100, category: 'Ahorro', description: 'Aporte espejo', date: '2026-11-04', paymentMethod: 'Transferencia', createdAt: 3, relatedSavingsMovementId: 'deposit' },
];
const savings: SavingsMovement[] = [
  { id: 'deposit', monthKey: '2026-11', type: 'deposit_from_month', amount: 100, description: 'Aporte', date: '2026-11-04', createdAt: 4 },
  { id: 'withdraw', monthKey: '2026-11', type: 'withdraw_to_month', amount: 70, description: 'Retiro', date: '2026-11-05', createdAt: 5 },
  { id: 'direct', monthKey: '2026-11', type: 'direct_expense', amount: 50, category: 'Alimentos', description: 'Compra pagada de ahorro', date: '2026-11-06', createdAt: 6 },
];
const configs: Record<string, MonthConfig> = { '2026-11': { monthKey: '2026-11', year: 2026, month: 11, initialIncome: 10000, carryoverFromPrev: 0, autoRolloverEnabled: false, isConfigured: true } };
const base = { period: { mode: 'month' as const, year: 2026, month: 11, from: '', to: '' }, filters: { type: 'all' as const, category: 'all', paymentMethod: 'all', goalStatus: 'all' as const }, sections: ['summary','income','expenses','movements','savings'] as const, transactions: tx, savingsMovements: savings, monthConfigs: configs, budgetsByMonth: { '2026-11': [{ category: 'Alimentos', amount: 400 }] }, goals: [] };

test('configured report uses centralized financial totals and does not duplicate savings mirrors', () => {
  const report = buildConfiguredReport(base)!;
  expect(report.transactions.map(item => item.id)).toEqual(['income', 'expense']);
  expect(report.savingsMovements.map(item => item.id)).toEqual(['deposit', 'withdraw', 'direct']);
  expect(report.metrics.find(([label]) => label === 'Ingresos')?.[1]).toBe('11,000');
  expect(report.metrics.find(([label]) => label === 'Gastos de consumo')?.[1]).toBe('350');
  expect(report.metrics.find(([label]) => label === 'Aportes a ahorro')?.[1]).toBe('100');
  expect(report.metrics.find(([label]) => label === 'Disponible del período')?.[1]).toBe('10,670');
});

test('custom ranges, category and payment filters apply to real report rows', () => {
  const report = buildConfiguredReport({ ...base, period: { mode: 'range', year: 2026, month: 11, from: '2026-11-02', to: '2026-11-03' }, filters: { ...base.filters, type: 'expense', category: 'Alimentos', paymentMethod: 'Efectivo' }, sections: ['movements'] });
  expect(report?.transactions.map(item => item.id)).toEqual(['expense']);
  expect(report?.savingsMovements).toEqual([]);
  expect(report?.period).toBe('2026-11-02 – 2026-11-03');
});

test('statistics report carries one domain-derived expense breakdown and no automatic history', () => {
  const report = buildConfiguredReport({ ...base, sections: ['statistics'] })!;
  expect(report.reportScope).toBe('statistics');
  expect(report.financialSummary).toEqual({ income: 11000, expenses: 350, savingsContributions: 100, available: 10670 });
  expect(report.expenseBreakdown).toEqual([{ category: 'Alimentos', amount: 350, budget: 400, remaining: 50, share: 100 }]);
  expect(report.transactions).toEqual([]);
  expect(report.savingsMovements).toEqual([]);
  expect(report.tables?.map(table => table.title)).toEqual(['Categorías de gasto']);
});

test('statistics breakdown omits unused unbudgeted categories and keeps budget context', () => {
  const report = buildConfiguredReport({
    ...base,
    sections: ['statistics'],
    transactions: [tx[0]],
    savingsMovements: savings.filter(item => item.type !== 'direct_expense'),
    budgetsByMonth: { '2026-11': [{ category: 'Alimentos', amount: 400 }, { category: 'Transporte', amount: 250 }] },
  })!;
  expect(report.expenseBreakdown).toEqual([
    { category: 'Alimentos', amount: 0, budget: 400, remaining: 400, share: 0 },
    { category: 'Transporte', amount: 0, budget: 250, remaining: 250, share: 0 },
  ]);
});

test('statistics summary keeps movement-type filters separated', () => {
  const summarize = (type: 'income' | 'expense' | 'savings') => buildConfiguredReport({
    ...base,
    sections: ['statistics'],
    filters: { ...base.filters, type },
  })?.financialSummary;
  expect(summarize('income')).toEqual({ income: 11000, expenses: 0, savingsContributions: 0 });
  expect(summarize('expense')).toEqual({ income: 0, expenses: 350, savingsContributions: 0 });
  expect(summarize('savings')).toEqual({ income: 0, expenses: 0, savingsContributions: 100 });
});

test('invalid custom period does not generate a report', () => {
  expect(configuredExportRange({ mode: 'range', year: 2026, month: 11, from: '2026-11-20', to: '2026-11-01' })).toBeNull();
  expect(buildConfiguredReport({ ...base, period: { mode: 'range', year: 2026, month: 11, from: '', to: '' } })).toBeNull();
});

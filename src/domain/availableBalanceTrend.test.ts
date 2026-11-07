import { expect, test } from 'bun:test';
import { availableBalanceTrend } from './availableBalanceTrend';
import type { MonthConfig, SavingsMovement, Transaction } from '../types';

const monthConfig = (monthKey: string, month: number, initialIncome: number, carryoverFromPrev: number): MonthConfig => ({
  monthKey,
  year: 2026,
  month,
  initialIncome,
  carryoverFromPrev,
  autoRolloverEnabled: false,
  isConfigured: true,
});

test('available balance trend uses month openings and existing financial calculations across month boundaries', () => {
  const transactions: Transaction[] = [
    { id: 'income', type: 'income', amount: 1000, category: 'Trabajo Extra', description: 'Ingreso', monthKey: '2026-10', date: '2026-10-31', paymentMethod: 'Efectivo', createdAt: 1 },
    { id: 'expense', type: 'expense', amount: 300, category: 'Alimentos', description: 'Gasto', monthKey: '2026-10', date: '2026-10-31', paymentMethod: 'Efectivo', createdAt: 2 },
    { id: 'mirror', type: 'expense', amount: 400, category: 'Aporte al Ahorro', description: 'Aporte', monthKey: '2026-10', date: '2026-10-31', paymentMethod: 'Transferencia a Ahorro', createdAt: 3, relatedSavingsMovementId: 'deposit' },
  ];
  const savingsMovements: SavingsMovement[] = [
    { id: 'deposit', monthKey: '2026-10', type: 'deposit_from_month', amount: 400, description: 'Aporte', date: '2026-10-31', createdAt: 3 },
    { id: 'withdraw', monthKey: '2026-11', type: 'withdraw_to_month', amount: 200, description: 'Retiro', date: '2026-11-02', createdAt: 4 },
    { id: 'direct', monthKey: '2026-11', type: 'direct_expense', amount: 50, description: 'Pago desde ahorro', category: 'Salud', date: '2026-11-02', createdAt: 5 },
  ];

  expect(availableBalanceTrend({
    transactions,
    savingsMovements,
    monthConfigs: {
      '2026-10': monthConfig('2026-10', 10, 5000, 1000),
      '2026-11': monthConfig('2026-11', 11, 500, 6300),
    },
    endDate: new Date(2026, 10, 2),
    days: 3,
  })).toEqual([
    { date: '2026-10-31', available: 6300 },
    { date: '2026-11-01', available: 6800 },
    { date: '2026-11-02', available: 7000 },
  ]);
});

test('available balance trend is empty when the recorded opening for any displayed month is not configured', () => {
  expect(availableBalanceTrend({
    transactions: [],
    savingsMovements: [],
    monthConfigs: { '2026-11': monthConfig('2026-11', 11, 0, 0) },
    endDate: new Date(2026, 10, 2),
    days: 3,
  })).toEqual([]);
});

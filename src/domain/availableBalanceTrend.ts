import { analyticsRangeSummary } from './analyticsQueries';
import type { MonthConfig, SavingsMovement, Transaction } from '../types';

export interface AvailableBalancePoint {
  date: string;
  available: number;
  income: number;
  expenses: number;
  savingsTransfers: number;
  savingsWithdrawals: number;
}

const monthKeyFor = (date: Date) => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
const dayKeyFor = (date: Date) => monthKeyFor(date) + '-' + String(date.getDate()).padStart(2, '0');

/** Builds a real daily cash-balance series from configured month openings and recorded movements. */
export function availableBalanceTrend(input: {
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  monthConfigs: Record<string, MonthConfig>;
  endDate: Date;
  days?: number;
}): AvailableBalancePoint[] {
  const dayCount = input.days ?? 30;
  if (!Number.isInteger(dayCount) || dayCount < 2 || Number.isNaN(input.endDate.getTime())) return [];

  const endDate = new Date(input.endDate.getFullYear(), input.endDate.getMonth(), input.endDate.getDate());
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - dayCount + 1);

  const transactionsByMonth = new Map<string, Transaction[]>();
  const transactionsByDate = new Map<string, Transaction[]>();
  for (const transaction of input.transactions) {
    const key = transaction.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    const monthTransactions = transactionsByMonth.get(key) || [];
    monthTransactions.push(transaction);
    transactionsByMonth.set(key, monthTransactions);
    const dayTransactions = transactionsByDate.get(transaction.date) || [];
    dayTransactions.push(transaction);
    transactionsByDate.set(transaction.date, dayTransactions);
  }

  const savingsByMonth = new Map<string, SavingsMovement[]>();
  const savingsByDate = new Map<string, SavingsMovement[]>();
  for (const movement of input.savingsMovements) {
    const key = movement.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    const monthMovements = savingsByMonth.get(key) || [];
    monthMovements.push(movement);
    savingsByMonth.set(key, monthMovements);
    const dayMovements = savingsByDate.get(movement.date) || [];
    dayMovements.push(movement);
    savingsByDate.set(movement.date, dayMovements);
  }

  const points: AvailableBalancePoint[] = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    const monthKey = monthKeyFor(date);
    if (!input.monthConfigs[monthKey]?.isConfigured) return [];

    const summary = analyticsRangeSummary({
      transactions: transactionsByMonth.get(monthKey) || [],
      savingsMovements: savingsByMonth.get(monthKey) || [],
      monthConfigs: input.monthConfigs,
      range: { start: new Date(date.getFullYear(), date.getMonth(), 1), end: date },
      category: 'Todas',
      movementType: 'all',
      includeInitialIncome: true,
      elapsedDays: date.getDate(),
    });
    if (!Number.isFinite(summary.available)) return [];
    const dateKey = dayKeyFor(date);
    const dailySummary = analyticsRangeSummary({
      transactions: transactionsByDate.get(dateKey) || [],
      savingsMovements: savingsByDate.get(dateKey) || [],
      monthConfigs: input.monthConfigs,
      range: { start: date, end: date },
      category: 'Todas',
      movementType: 'all',
      includeInitialIncome: false,
      elapsedDays: 1,
    });
    points.push({
      date: dateKey,
      available: summary.available,
      income: dailySummary.totalIncome,
      expenses: dailySummary.totalExpenses,
      savingsTransfers: dailySummary.deposits,
      savingsWithdrawals: dailySummary.withdrawals,
    });
  }
  return points;
}

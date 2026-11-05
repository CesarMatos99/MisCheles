import type { MonthConfig, SavingsMovement, Transaction } from '../types';
import { isSavingsContributionTransaction } from './financialClassification';
import { calculateAvailableBalance, unmatchedSavingsContributionAmount } from './financialSummary';
import { spendingByCategory } from './financialQueries';
import { parseCalendarDay } from './calendarDay';

export interface AnalyticsRange { start: Date; end: Date }
export interface AnalyticsMonthStats { income: number; expenses: number; saved: number; cats: Map<string, number> }
const inRange = (date: Date, range: AnalyticsRange) => !Number.isNaN(date.getTime()) && date >= range.start && date <= range.end;
const monthStart = (year: number, month: number) => new Date(year, month - 1, 1);
const monthEnd = (year: number, month: number) => new Date(year, month, 0);

/** Shared query for month comparison and trend series in the statistics module. */
export function analyticsMonthStats(input: {
  monthKey: string; transactions: Transaction[]; savingsMovements: SavingsMovement[];
  monthConfigs: Record<string, MonthConfig>; category?: string; includeInitialIncome: boolean;
  range?: AnalyticsRange;
}): AnalyticsMonthStats {
  const [year, month] = input.monthKey.split('-').map(Number);
  const range = input.range || { start: monthStart(year, month), end: monthEnd(year, month) };
  const category = input.category || 'Todas';
  const rangeTransactions = input.transactions.filter((tx) => inRange(parseCalendarDay(tx.date), range) && (category === 'Todas' || tx.category === category));
  const transactions = rangeTransactions.filter((tx) => !isSavingsContributionTransaction(tx));
  const savingsMovements = input.savingsMovements.filter((item) => inRange(parseCalendarDay(item.date), range) && (category === 'Todas' || (item.type === 'direct_expense' && (item.category || 'Otros') === category)));
  const monthOpen = monthStart(year, month);
  const config = input.monthConfigs[input.monthKey];
  const initialIncome = category === 'Todas' && input.includeInitialIncome && config && monthOpen >= range.start && monthOpen <= range.end ? config.initialIncome : 0;
  const income = initialIncome + transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0) + savingsMovements.filter((item) => item.type === 'direct_expense').reduce((sum, item) => sum + item.amount, 0);
  const saved = savingsMovements.filter((item) => item.type === 'deposit_from_month').reduce((sum, item) => sum + item.amount, 0) + (category === 'Todas' ? unmatchedSavingsContributionAmount(rangeTransactions, savingsMovements) : 0);
  const cats = new Map<string, number>();
  transactions.filter((tx) => tx.type === 'expense').forEach((tx) => cats.set(tx.category, (cats.get(tx.category) || 0) + tx.amount));
  savingsMovements.filter((item) => item.type === 'direct_expense').forEach((item) => { const name = item.category || 'Otros'; cats.set(name, (cats.get(name) || 0) + item.amount); });
  return { income, expenses, saved, cats };
}

/** Derives period category rows once for the dashboard and analytical views. */
export function analyticsCategoryTotals(transactions: Transaction[], savingsMovements: SavingsMovement[]): Map<string, number> {
  return new Map([...spendingByCategory(transactions, savingsMovements)].map(([, row]) => [row.category, row.amount]));
}

export interface AnalyticsRangeSummary {
  selectedTx: Transaction[]; selectedSavings: SavingsMovement[]; visibleTx: Transaction[]; visibleSavings: SavingsMovement[];
  initialIncome: number; totalIncome: number; regularExpenses: number; directExpenses: number; totalExpenses: number;
  deposits: number; withdrawals: number; available: number; spentPercent: number | null; savedPercent: number | null;
  dailyAverage: number; movementCount: number;
}

/** Shared financial read model for the selected Statistics range and its filters. */
export function analyticsRangeSummary(input: {
  transactions: Transaction[]; savingsMovements: SavingsMovement[]; monthConfigs: Record<string, MonthConfig>;
  range: AnalyticsRange; category: string; movementType: 'all' | 'income' | 'expense' | 'savings';
  includeInitialIncome: boolean; elapsedDays: number;
}): AnalyticsRangeSummary {
  const { transactions, savingsMovements, range, category, monthConfigs, includeInitialIncome, movementType } = input;
  const selectedTx = transactions.filter((tx) => inRange(parseCalendarDay(tx.date), range));
  const selectedSavings = savingsMovements.filter((item) => inRange(parseCalendarDay(item.date), range));
  const visibleTx = selectedTx.filter((tx) => !isSavingsContributionTransaction(tx) && (category === 'Todas' || tx.category === category));
  const visibleSavings = selectedSavings.filter((item) => category === 'Todas' || (item.type === 'direct_expense' && (item.category || 'Otros') === category));
  const firstMonthKey = range.start.getFullYear() + '-' + String(range.start.getMonth() + 1).padStart(2, '0');
  const lastMonthKey = range.end.getFullYear() + '-' + String(range.end.getMonth() + 1).padStart(2, '0');
  const initialIncome = category === 'Todas' && includeInitialIncome ? Object.entries(monthConfigs).filter(([key]) => {
    if (key < firstMonthKey || key > lastMonthKey) return false;
    const [year, month] = key.split('-').map(Number);
    const opening = monthStart(year, month);
    return opening >= range.start && opening <= range.end;
  }).reduce((sum, [, config]) => sum + (Number(config.initialIncome) || 0), 0) : 0;
  const totalIncome = initialIncome + visibleTx.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const firstConfig = monthConfigs[firstMonthKey];
  const firstOpen = monthStart(range.start.getFullYear(), range.start.getMonth() + 1);
  const startsAtMonthOpen = range.start.getTime() === firstOpen.getTime();
  const preRangeTransactions = transactions.filter((tx) => { const date = parseCalendarDay(tx.date); return date >= firstOpen && date < range.start; });
  const preRangeSavings = savingsMovements.filter((item) => { const date = parseCalendarDay(item.date); return date >= firstOpen && date < range.start; });
  const preRangeExpenseTransactions = preRangeTransactions.filter((tx) => !isSavingsContributionTransaction(tx));
  const preRangeSavingsContributions = unmatchedSavingsContributionAmount(preRangeTransactions, preRangeSavings);
  const openingCash = category !== 'Todas' || movementType !== 'all' ? Number.NaN : startsAtMonthOpen
    ? Number(firstConfig?.carryoverFromPrev || 0)
    : calculateAvailableBalance({
      carryover: Number(firstConfig?.carryoverFromPrev || 0),
      totalIncome: Number(firstConfig?.initialIncome || 0) + preRangeExpenseTransactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0),
      savingsWithdrawals: preRangeSavings.filter((item) => item.type === 'withdraw_to_month').reduce((sum, item) => sum + item.amount, 0),
      regularExpenses: preRangeExpenseTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0),
      savingsContributions: preRangeSavings.filter((item) => item.type === 'deposit_from_month').reduce((sum, item) => sum + item.amount, 0) + preRangeSavingsContributions,
    });
  const regularExpenses = visibleTx.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const directExpenses = visibleSavings.filter((item) => item.type === 'direct_expense').reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = regularExpenses + directExpenses;
  const selectedLegacySavingsContributions = category === 'Todas' ? unmatchedSavingsContributionAmount(selectedTx, selectedSavings) : 0;
  const deposits = visibleSavings.filter((item) => item.type === 'deposit_from_month').reduce((sum, item) => sum + item.amount, 0) + selectedLegacySavingsContributions;
  const withdrawals = visibleSavings.filter((item) => item.type === 'withdraw_to_month').reduce((sum, item) => sum + item.amount, 0);
  const available = category === 'Todas' && movementType === 'all' ? calculateAvailableBalance({ carryover: openingCash, totalIncome, savingsWithdrawals: withdrawals, regularExpenses, savingsContributions: deposits }) : Number.NaN;
  return {
    selectedTx, selectedSavings, visibleTx, visibleSavings, initialIncome, totalIncome, regularExpenses, directExpenses, totalExpenses,
    deposits, withdrawals, available,
    spentPercent: movementType === 'all' && totalIncome ? totalExpenses / totalIncome * 100 : null,
    savedPercent: movementType === 'all' && totalIncome ? deposits / totalIncome * 100 : null,
    dailyAverage: totalExpenses / Math.max(1, input.elapsedDays),
    movementCount: visibleTx.length + visibleSavings.length,
  };
}

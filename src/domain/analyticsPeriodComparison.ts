import type { MonthConfig, SavingsMovement, Transaction } from '../types';
import { analyticsRangeSummary, type AnalyticsRange } from './analyticsQueries';
import { isSavingsCategory } from './financialClassification';
import { spendingByCategory } from './financialQueries';
import { parseCalendarDay } from './calendarDay';

export type ComparisonMetricKind = 'income' | 'expense' | 'savings';
export interface ComparisonMetric { difference: number; variationPercent: number | null; favorable: 'good' | 'bad' | 'neutral'; }
export interface PeriodAnalytics { income: number; expenses: number; savings: number; categories: Map<string, number>; days: number; }
export interface CategoryExpenseShare { category: string; amount: number; share: number; }
export function sortCategoryExpenses(rows: CategoryExpenseShare[], sort: 'high' | 'low' | 'name' = 'high'): CategoryExpenseShare[] {
  return [...rows].sort((a, b) => sort === 'high' ? b.amount - a.amount || a.category.localeCompare(b.category, 'es') : sort === 'low' ? a.amount - b.amount || a.category.localeCompare(b.category, 'es') : a.category.localeCompare(b.category, 'es'));
}
export function highestCategoryExpense(rows: CategoryExpenseShare[]): CategoryExpenseShare | undefined {
  return rows.reduce<CategoryExpenseShare | undefined>((highest, row) => !highest || row.amount > highest.amount ? row : highest, undefined);
}
export interface AnnualMonthRecord { key: string; label: string; income: number; expenses: number; saved: number; }
export function summarizeAnnualEvolution<T extends AnnualMonthRecord>(months: T[]): { activeMonths: T[]; averageMonthlyExpenses: number | null; highestExpenseMonth: T | undefined; lowestExpenseMonth: T | undefined; expenseTrend: number | null } {
  const activeMonths = months.filter(month => month.income > 0 || month.expenses > 0 || month.saved > 0);
  const spendingMonths = activeMonths.filter(month => month.expenses > 0);
  return { activeMonths, averageMonthlyExpenses: activeMonths.length ? activeMonths.reduce((sum, month) => sum + month.expenses, 0) / activeMonths.length : null,
    highestExpenseMonth: [...spendingMonths].sort((a, b) => b.expenses - a.expenses)[0], lowestExpenseMonth: [...spendingMonths].sort((a, b) => a.expenses - b.expenses)[0],
    expenseTrend: activeMonths.length > 1 ? activeMonths[activeMonths.length - 1].expenses - activeMonths[0].expenses : null };
}

export type CompareInputMode = 'months' | 'ranges';
export interface ComparisonInput { mode: CompareInputMode; monthA: string; monthB: string; rangeAFrom: string; rangeATo: string; rangeBFrom: string; rangeBTo: string; }
export function resolveComparisonRanges(input: ComparisonInput): { a: AnalyticsRange; b: AnalyticsRange } | null {
  if (input.mode === 'months') {
    const monthKey = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthKey.test(input.monthA) || !monthKey.test(input.monthB)) return null;
    const a = monthRangeForDate(parseCalendarDay(input.monthA + '-01'));
    const b = monthRangeForDate(parseCalendarDay(input.monthB + '-01'));
    return { a: { start: parseCalendarDay(a.from), end: parseCalendarDay(a.to) }, b: { start: parseCalendarDay(b.from), end: parseCalendarDay(b.to) } };
  }
  if (!isValidAnalyticsRange({ from: input.rangeAFrom, to: input.rangeATo }) || !isValidAnalyticsRange({ from: input.rangeBFrom, to: input.rangeBTo })) return null;
  return { a: { start: parseCalendarDay(input.rangeAFrom), end: parseCalendarDay(input.rangeATo) }, b: { start: parseCalendarDay(input.rangeBFrom), end: parseCalendarDay(input.rangeBTo) } };
}

export const calendarDayCount = (range: AnalyticsRange): number => Math.max(1, Math.floor((range.end.getTime() - range.start.getTime()) / 86400000) + 1);
export function isValidAnalyticsRange(range: { from: string; to: string }): boolean {
  const from = parseCalendarDay(range.from), to = parseCalendarDay(range.to);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to;
}
export function monthRangeForDate(date: Date, offset = 0): { from: string; to: string } {
  const month = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { from: dayKey(month), to: dayKey(last) };
}
export function previousCalendarMonth(range: { from: string; to: string }): { from: string; to: string } {
  const date = parseCalendarDay(range.from);
  return Number.isNaN(date.getTime()) ? monthRangeForDate(new Date(), -1) : monthRangeForDate(date, -1);
}
export function samePeriodPreviousYear(range: { from: string; to: string }): { from: string; to: string } {
  const from = parseCalendarDay(range.from), to = parseCalendarDay(range.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { from: '', to: '' };
  return { from: shiftYear(from, -1), to: shiftYear(to, -1) };
}
function shiftYear(date: Date, years: number): string {
  const day = new Date(date.getFullYear() + years, date.getMonth(), 1);
  const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
  day.setDate(Math.min(date.getDate(), lastDay));
  return dayKey(day);
}
function dayKey(date: Date): string { return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
export function isPeriodInProgress(range: AnalyticsRange, asOf = new Date()): boolean {
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  return range.start <= today && range.end >= today;
}
export function equivalentDayRanges(a: AnalyticsRange, b: AnalyticsRange, asOf = new Date()): { a: AnalyticsRange; b: AnalyticsRange; days: number; applied: boolean } {
  const aDays = calendarDayCount(a), bDays = calendarDayCount(b);
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const aCurrent = isPeriodInProgress(a, today), bCurrent = isPeriodInProgress(b, today);
  if (!aCurrent && !bCurrent) return { a, b, days: Math.min(aDays, bDays), applied: false };
  const elapsed = (range: AnalyticsRange, current: boolean) => current ? Math.max(1, calendarDayCount({ start: range.start, end: range.end < today ? range.end : today })) : calendarDayCount(range);
  const count = Math.min(aDays, bDays, elapsed(a, aCurrent), elapsed(b, bCurrent));
  return { a: { start: a.start, end: addDays(a.start, count - 1) }, b: { start: b.start, end: addDays(b.start, count - 1) }, days: count, applied: true };
}
export function comparePeriodMetric(a: number, b: number, kind: ComparisonMetricKind): ComparisonMetric {
  const difference = a - b;
  const variationPercent = b === 0 ? null : difference / Math.abs(b) * 100;
  const favorable: ComparisonMetric['favorable'] = difference === 0 ? 'neutral' : kind === 'expense' ? difference < 0 ? 'good' : 'bad' : difference > 0 ? 'good' : 'bad';
  return { difference, variationPercent, favorable };
}
export function expenseCategoryDistribution(transactions: Transaction[], savingsMovements: SavingsMovement[]): CategoryExpenseShare[] {
  const totals = spendingByCategory(transactions, savingsMovements);
  const included = [...totals.values()].filter(row => !isSavingsCategory(row.category) && Number.isFinite(row.amount) && row.amount > 0);
  const total = included.reduce((sum, row) => sum + row.amount, 0);
  return included.map(row => ({ category: row.category, amount: row.amount, share: total ? row.amount / total * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'es'));
}
export function summarizeAnalyticsPeriod(input: {
  transactions: Transaction[]; savingsMovements: SavingsMovement[]; monthConfigs: Record<string, MonthConfig>; range: AnalyticsRange;
  category: string; movementType: 'all' | 'income' | 'expense' | 'savings'; includeInitialIncome: boolean;
}): PeriodAnalytics {
  const summary = analyticsRangeSummary({ ...input, elapsedDays: calendarDayCount(input.range) });
  const categories = new Map(expenseCategoryDistribution(summary.visibleTx, summary.visibleSavings).map(row => [row.category, row.amount]));
  return { income: summary.totalIncome, expenses: summary.totalExpenses, savings: summary.deposits, categories, days: calendarDayCount(input.range) };
}

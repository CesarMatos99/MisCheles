import { parseCalendarDay } from './calendarDay.ts';
export interface AnalyticsFiltersValue {
  mode: 'month' | 'year' | '6m' | '12m' | 'custom'; year: number; month: number;
  from: string; to: string; category: string; movementType: 'all' | 'income' | 'expense' | 'savings';
  firstKey: string; secondKey: string;
}

export function validateAnalyticsFilters(value: AnalyticsFiltersValue, comparing: boolean): string | null {
  if (!Number.isInteger(value.year) || value.year < 1900 || value.year > 9999 || !Number.isInteger(value.month) || value.month < 1 || value.month > 12) return 'Revisa el mes y el año.';
  if (value.mode === 'custom' && (Number.isNaN(parseCalendarDay(value.from).getTime()) || Number.isNaN(parseCalendarDay(value.to).getTime()) || value.from > value.to)) return 'Revisa las fechas del rango.';
  const validMonth = (key: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key) && Number(key.slice(0,4)) >= 1900;
  if (comparing && (!validMonth(value.firstKey) || !validMonth(value.secondKey) || value.firstKey === value.secondKey)) return 'Selecciona dos meses válidos y distintos.';
  return null;
}
export function evolutionMonthCount(mode: AnalyticsFiltersValue['mode']): number {
  return mode === 'month' ? 1 : mode === '6m' ? 6 : 12;
}

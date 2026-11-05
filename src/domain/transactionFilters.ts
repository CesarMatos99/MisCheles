import type { Transaction } from '../types';
import { parseCalendarDay } from './calendarDay.ts';

export type TransactionFilterType = 'all' | 'expense' | 'income' | 'savings';
export interface TransactionFilterCriteria {
  type: TransactionFilterType;
  category: string;
  from: string;
  to: string;
}
export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterCriteria = { type: 'all', category: 'all', from: '', to: '' };

export function isTransactionFilterRangeValid(criteria: TransactionFilterCriteria): boolean {
  return (!criteria.from || !Number.isNaN(parseCalendarDay(criteria.from).getTime()))
    && (!criteria.to || !Number.isNaN(parseCalendarDay(criteria.to).getTime()))
    && (!criteria.from || !criteria.to || criteria.from <= criteria.to);
}

export function readTransactionFilters(serialized: string | null): TransactionFilterCriteria {
  if (!serialized) return { ...DEFAULT_TRANSACTION_FILTERS };
  try {
    const value = JSON.parse(serialized) as Partial<TransactionFilterCriteria>;
    const type = ['all', 'expense', 'income', 'savings'].includes(String(value.type)) ? value.type! : 'all';
    const category = typeof value.category === 'string' ? value.category : 'all';
    const from = typeof value.from === 'string' ? value.from : '';
    const to = typeof value.to === 'string' ? value.to : '';
    const result = { type, category, from, to } as TransactionFilterCriteria;
    return isTransactionFilterRangeValid(result) ? result : { ...DEFAULT_TRANSACTION_FILTERS };
  } catch {
    return { ...DEFAULT_TRANSACTION_FILTERS };
  }
}

export function filterTransactionRecords(
  records: Transaction[],
  criteria: TransactionFilterCriteria,
  search: string,
  isSavings: (record: Transaction) => boolean,
  localizedCategory: (category: string) => string = category => category,
): Transaction[] {
  const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-DO');
  const query = normalize(search);
  return records.filter(record => {
    const searchable = normalize(record.description).includes(query)
      || normalize(record.category).includes(query)
      || normalize(localizedCategory(record.category)).includes(query);
    const matchesType = criteria.type === 'all'
      || (criteria.type === 'expense' && record.type === 'expense' && !isSavings(record))
      || (criteria.type === 'income' && record.type === 'income')
      || (criteria.type === 'savings' && isSavings(record));
    const matchesCategory = criteria.category === 'all' || normalize(record.category) === normalize(criteria.category);
    const matchesFrom = !criteria.from || record.date >= criteria.from;
    const matchesTo = !criteria.to || record.date <= criteria.to;
    return searchable && matchesType && matchesCategory && matchesFrom && matchesTo;
  });
}

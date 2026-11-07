import { describe, expect, test } from 'bun:test';
import { paginate } from './transactionPagination';
import { filterTransactionRecords, DEFAULT_TRANSACTION_FILTERS } from './transactionFilters';
import type { Transaction } from '../types';

const records: Transaction[] = Array.from({ length: 27 }, (_, index) => ({
  id: 'tx-' + index,
  monthKey: '2026-01', type: index % 3 === 0 ? 'income' : 'expense', amount: index + 1,
  category: index % 2 ? 'Alimentación y Supermercado' : 'Vivienda y Alquiler', description: 'Movimiento ' + index,
  date: '2026-01-' + String((index % 9) + 1).padStart(2, '0'), paymentMethod: 'Efectivo', createdAt: index,
}));

describe('transaction pagination', () => {
  test('keeps order and exposes page metadata', () => {
    const first = paginate(records, 1, 10);
    const last = paginate(records, 3, 10);
    expect(first.items.map(item => item.id)).toEqual(records.slice(0, 10).map(item => item.id));
    expect(last.items).toHaveLength(7);
    expect(last.totalItems).toBe(27);
    expect(last.totalPages).toBe(3);
  });

  test('clamps invalid pages and works after filtering', () => {
    const filtered = filterTransactionRecords(records, { ...DEFAULT_TRANSACTION_FILTERS, type: 'income' }, '', () => false);
    const result = paginate(filtered, 99, 20);
    expect(filtered).toHaveLength(9);
    expect(result.page).toBe(1);
    expect(result.items).toHaveLength(9);
  });
});

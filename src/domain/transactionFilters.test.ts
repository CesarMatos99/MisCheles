import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTransactionRecords, isTransactionFilterRangeValid, readTransactionFilters, type TransactionFilterCriteria } from './transactionFilters.ts';
import type { Transaction } from '../types.ts';
const rows = [
  { id: '1', date: '2026-11-01', description: 'Compra del súper', category: 'Alimentación', type: 'expense', amount: 100, paymentMethod: 'Cash' },
  { id: '2', date: '2026-11-12', description: 'Pago mensual', category: 'Internet', type: 'expense', amount: 80, paymentMethod: 'Card' },
  { id: '3', date: '2026-11-14', description: 'Salario', category: 'Salario', type: 'income', amount: 500, paymentMethod: 'Bank' },
] as Transaction[];
const noSavings = () => false;
test('combines movement type, category, date range and search', () => {
  const criteria: TransactionFilterCriteria = { type: 'expense', category: 'Internet', from: '2026-11-10', to: '2026-11-30' };
  assert.deepEqual(filterTransactionRecords(rows, criteria, '', noSavings).map(row => row.id), ['2']);
  assert.deepEqual(filterTransactionRecords(rows, criteria, 'mensual', noSavings).map(row => row.id), ['2']);
  assert.deepEqual(filterTransactionRecords(rows, { ...criteria, type: 'income' }, '', noSavings), []);
});
test('rejects reversed date ranges and restores persisted session filters safely', () => {
  assert.equal(isTransactionFilterRangeValid({ type: 'all', category: 'all', from: '2026-11-20', to: '2026-11-01' }), false);
  assert.equal(isTransactionFilterRangeValid({ type: 'all', category: 'all', from: '2026-02-30', to: '' }), false);
  assert.deepEqual(readTransactionFilters('{"type":"expense","category":"Internet","from":"2026-11-01","to":"2026-11-30"}'), { type: 'expense', category: 'Internet', from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(readTransactionFilters('{broken'), { type: 'all', category: 'all', from: '', to: '' });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyticsFilterSummaryLabels } from './analyticsFilterLabels.ts';

test('Spanish filter summary uses natural agreement for all categories and all movements', () => {
  assert.deepEqual(analyticsFilterSummaryLabels('es', 'Todas', 'all'), { category: 'Todas', movementType: 'Todos' });
});

test('movement types use their natural Spanish labels', () => {
  assert.equal(analyticsFilterSummaryLabels('es', 'Todas', 'income').movementType, 'Ingresos');
  assert.equal(analyticsFilterSummaryLabels('es', 'Todas', 'expense').movementType, 'Gastos');
  assert.equal(analyticsFilterSummaryLabels('es', 'Todas', 'savings').movementType, 'Movimientos de ahorro');
});

test('English filter summaries use matching labels and localize standard categories', () => {
  assert.deepEqual(analyticsFilterSummaryLabels('en', 'Todas', 'all'), { category: 'All categories', movementType: 'All movements' });
  assert.deepEqual(analyticsFilterSummaryLabels('en', 'Alimentación y Supermercado', 'expense'), { category: 'Food and Groceries', movementType: 'Expenses' });
});

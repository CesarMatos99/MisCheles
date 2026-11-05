import assert from 'node:assert/strict';
import test from 'node:test';
import { transactionTypeLabel } from './transactionPresentation.ts';
test('reports distinguish savings mirrors from consumption without changing amounts', () => {
  assert.equal(transactionTypeLabel({ type: 'expense', category: 'Comida' }), 'Gasto');
  assert.equal(transactionTypeLabel({ type: 'income', category: 'Sueldo' }), 'Ingreso');
  assert.match(transactionTypeLabel({ type: 'expense', category: 'Aporte al Ahorro' }), /transferencia interna/);
  assert.match(transactionTypeLabel({ type: 'expense', category: 'Meta', relatedSavingsMovementId: 'saving' }), /transferencia interna/);
});

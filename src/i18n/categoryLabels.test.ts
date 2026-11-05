import assert from 'node:assert/strict';
import test from 'node:test';
import { localizeCategoryName } from './categoryLabels.ts';

test('localizes standard categories for display without changing Spanish or custom labels', () => {
  assert.equal(localizeCategoryName('en', 'Energía eléctrica'), 'Electricity');
  assert.equal(localizeCategoryName('en', 'Alimentación y Supermercado'), 'Food and Groceries');
  assert.equal(localizeCategoryName('es', 'Energía eléctrica'), 'Energía eléctrica');
  assert.equal(localizeCategoryName('en', 'Dentista local'), 'Dentista local');
  assert.equal(localizeCategoryName('en', 'constructor'), 'constructor');
  assert.equal(localizeCategoryName('en', 'toString'), 'toString');
});

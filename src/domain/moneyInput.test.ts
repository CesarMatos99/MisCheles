import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMoneyInput, normalizeMoneyInput } from './moneyInput.ts';

test('money input can be cleared and keeps decimal values without inserting zero', () => {
  assert.equal(normalizeMoneyInput(''), '');
  assert.equal(normalizeMoneyInput('0.'), '0');
  assert.equal(normalizeMoneyInput('10000.50'), '10000.50');
  assert.equal(normalizeMoneyInput('-5.25'), '-5.25');
});

test('money input normalizes pasted grouping and decimal separators', () => {
  assert.equal(normalizeMoneyInput('1,000.50'), '1000.50');
  assert.equal(normalizeMoneyInput('1.000,50'), '1000.50');
  assert.equal(normalizeMoneyInput('10,000'), '10000');
  assert.equal(normalizeMoneyInput('12,75'), '12.75');
});

test('blur formatting uses grouped thousands and two minimum decimal places', () => {
  assert.equal(formatMoneyInput('1000'), '1,000.00');
  assert.equal(formatMoneyInput('10000.5'), '10,000.50');
  assert.equal(formatMoneyInput('12345.67890123456789'), '12,345.67890123456789');
  assert.equal(formatMoneyInput(''), '');
});

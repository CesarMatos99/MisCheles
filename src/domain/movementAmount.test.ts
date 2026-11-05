import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMovementAmount } from './movementAmount.ts';
test('accepts cents and rejects partial, nonfinite, unsafe or subcent values', () => {
  assert.equal(parseMovementAmount(' 125.50 '), 125.5);
  assert.equal(parseMovementAmount('0.01'), 0.01);
  for (const value of ['', '0', '-1', 'Infinity', 'NaN', '12abc', '1e4', '0.001', '9007199254740991']) assert.equal(parseMovementAmount(value), null, value);
});

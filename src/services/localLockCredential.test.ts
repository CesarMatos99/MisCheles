import { describe, expect, test } from 'bun:test';
import { isValidLocalPin } from './localLockCredential';

describe('local privacy PIN', () => {
  test('accepts exactly four digits', () => {
    expect(isValidLocalPin('7391')).toBe(true);
    expect(isValidLocalPin('0000')).toBe(true);
  });
  test('rejects invalid values', () => {
    for (const value of ['', '123', '12345', '12a4', ' 123', '١٢٣٤']) expect(isValidLocalPin(value)).toBe(false);
  });
});

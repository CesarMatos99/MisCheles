import assert from 'node:assert/strict';
import test from 'node:test';
import { currencyCodeFromDisplay, currencyDisplayFromCode } from './currency.ts';

test('normalizes supported display currencies to ISO codes and back', () => {
  assert.equal(currencyCodeFromDisplay('RD$'), 'DOP');
  assert.equal(currencyCodeFromDisplay('$'), 'USD');
  assert.equal(currencyCodeFromDisplay('EUR'), 'EUR');
  assert.equal(currencyDisplayFromCode('DOP'), 'RD$');
  assert.equal(currencyDisplayFromCode('USD'), '$');
  assert.equal(currencyDisplayFromCode('unknown'), 'RD$');
});

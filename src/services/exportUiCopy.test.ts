import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('transaction indicators do not render the redundant savings explanation', () => {
  const source = readSource('../features/transactions/TransactionsView.tsx');
  assert.equal(source.includes('Ahorros transferidos:'), false);
  assert.equal(source.includes('no se mezclan con ingresos ni gastos'), false);
});

test('savings transfer modal keeps the form without redundant explanatory copy', () => {
  const source = readSource('../components/modals/TransferModal.tsx');
  assert.equal(source.includes('Se transferirá a'), false);
  assert.equal(source.includes('Clarity note'), false);
});

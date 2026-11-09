import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getUnformattedCaretPosition } from './FormattedAmountInput';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('shared money field contract', () => {
  test('maps formatted caret positions when grouping separators are removed on focus', () => {
    expect(getUnformattedCaretPosition('1,000.00', 2)).toBe(1);
    expect(getUnformattedCaretPosition('1,000.00', 6)).toBe(5);
    expect(getUnformattedCaretPosition('1,000.00', 8)).toBe(7);
    expect(getUnformattedCaretPosition('', 0)).toBe(0);
  });

  test('all financial amount editors use MoneyField and a text decimal input without native spinners', () => {
    const formFiles = [
      '../../features/transactions/TransactionModal.tsx',
      '../../features/savings/SavingsModal.tsx',
      '../../features/savings/SavingsView.tsx',
      '../../components/modals/TransferModal.tsx',
      '../../components/modals/MonthSetupModal.tsx',
      '../../components/modals/CategoryBudgetModal.tsx',
      '../../features/profile/ProfileModal.tsx',
    ];
    for (const file of formFiles) expect(source(file)).toContain('<MoneyField');

    const input = source('./FormattedAmountInput.tsx');
    expect(input).toContain('type="text"');
    expect(input).toContain('inputMode="decimal"');
    expect(input).toContain('normalizeMoneyInput');
  });
});

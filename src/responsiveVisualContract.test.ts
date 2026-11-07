import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

describe('responsive visual contract', () => {
  test('keeps the mobile baseline, safe areas and dark theme tokens', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('min-width: 320px');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain(':root.dark');
    expect(css).toContain('--app-primary: #012677');
    expect(css).toContain('--app-background: #f8f9fc');
  });

  test('switches to the sidebar shell at desktop width and keeps mobile sheets in the safe area', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(css).toContain('grid-template-columns: 15rem minmax(0, 1fr)');
    expect(css).toContain('max-width: 1023px');
    expect(css).toContain('app-modal-backdrop:has(.app-mobile-sheet)');
    expect(app).toContain('<DesktopSidebar');
    expect(app).toContain('<BottomNav');
  });

  test('adapts the existing finance forms to mobile sheets without replacing their modal shells', () => {
    const modalFiles = [
      'src/features/transactions/TransactionModal.tsx',
      'src/features/savings/SavingsModal.tsx',
      'src/components/modals/TransferModal.tsx',
      'src/components/modals/MonthSetupModal.tsx',
      'src/features/savings/SavingsView.tsx',
    ];
    for (const file of modalFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain('app-mobile-sheet');
    }
  });
});

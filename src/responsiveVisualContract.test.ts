import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ACCENT_COLORS, DEFAULT_ACCENT_COLOR, normalizeAccentColor } from './constants/accentColors';

describe('responsive visual contract', () => {
  test('keeps the mobile baseline, safe areas and dark theme tokens', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('min-width: 320px');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (max-width: 640px)');
    expect(css).toContain(':root.dark');
    expect(css).toContain('--app-primary: #012677');
    expect(css).toContain('--app-background: #f8f9fc');
    expect(css).toContain("grid-template-areas: 'categories recent' 'trend recent' 'unbudgeted recent'");
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

  test('Profile shares the application content width and goal form fields stay responsive', () => {
    const profile = readFileSync('src/features/profile/ProfileView.tsx', 'utf8');
    const savings = readFileSync('src/features/savings/SavingsView.tsx', 'utf8');
    expect(profile).toContain('app-profile mx-auto w-full max-w-none');
    expect(profile).not.toContain('max-w-5xl');
    expect(savings).toContain('sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]');
  });

  test('offers persistent accent choices independently of light and dark themes', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const css = readFileSync('src/index.css', 'utf8');
    expect(DEFAULT_ACCENT_COLOR).toBe('#012677');
    expect(ACCENT_COLORS.map(({ name }) => name)).toEqual([
      'Azul MisCheles', 'Verde esmeralda', 'Morado', 'Turquesa', 'Naranja', 'Rosa', 'Gris grafito',
    ]);
    for (const { value } of ACCENT_COLORS) expect(contrastRatio(value, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(normalizeAccentColor('#047857')).toBe('#047857');
    expect(normalizeAccentColor('#002991')).toBe(DEFAULT_ACCENT_COLOR);
    expect(app).toContain("setScopedPreference('mischeles_accent_v2', accentColor)");
    expect(app).toContain("normalizeAccentColor(getScopedPreference('mischeles_accent_v2'))");
    expect(css).toContain('--app-focus: color-mix(in srgb, var(--app-primary) 58%, white)');
    expect(css).toContain(':root.dark');
  });

  test('keeps the desktop statistics dashboard optional and the four analysis sections available', () => {
    const analytics = readFileSync('src/features/dashboard/AnalyticsView.tsx', 'utf8');
    expect(analytics).toContain("useState<'dashboard' | 'analysis'>('dashboard')");
    expect(analytics).toContain('aria-label="Vista de estadísticas"');
    expect(analytics).toContain('Dashboard');
    expect(analytics).toContain('Análisis');
    for (const label of ['Resumen', 'Categorías', 'Comparar', 'Evolución']) expect(analytics).toContain(`label: '${label}'`);
    expect(analytics).toContain("className={'analytics-tabs flex w-full min-w-0 gap-1 overflow-x-auto pb-1 ' + (isDesktopDashboard ? 'xl:hidden' : 'xl:flex')}");
  });

  test('shows actual daily financial movements in the available-balance tooltip', () => {
    const chart = readFileSync('src/features/dashboard/AvailableBalanceChart.tsx', 'utf8');
    const trend = readFileSync('src/domain/availableBalanceTrend.ts', 'utf8');
    expect(chart).toContain('Disponible al cierre');
    expect(chart).toContain('Gastos del día');
    expect(chart).toContain('Ingresos del día');
    expect(chart).toContain('Transferido a ahorro');
    expect(trend).toContain('expenses: dailySummary.totalExpenses');
    expect(trend).toContain('savingsTransfers: dailySummary.deposits');
  });

  test('keeps category management actions and over-budget information on the existing dashboard panel', () => {
    const dashboard = readFileSync('src/features/dashboard/DashboardView.tsx', 'utf8');
    expect(dashboard).toContain('dashboard-category-panel');
    expect(dashboard).toContain('onAddCategory');
    expect(dashboard).toContain('onManageBudgets');
    expect(dashboard).toContain('Excedido ');
    expect(dashboard).toContain('Restante ');
  });

  test('keeps the mobile FAB as the existing entry point for financial actions', () => {
    const floatingActions = readFileSync('src/components/layout/FloatingActions.tsx', 'utf8');
    const dashboard = readFileSync('src/features/dashboard/DashboardView.tsx', 'utf8');
    expect(floatingActions).toContain('fab-position lg:hidden');
    expect(floatingActions).toContain('Registrar gasto');
    expect(floatingActions).toContain('Registrar ingreso');
    expect(floatingActions).toContain('Registrar transferencia');
    expect(dashboard).toContain('resolveVisibleIdentity');
    expect(dashboard).toContain('identity.firstName');
  });

  test('uses tertiary visual controls without changing the month or export button semantics', () => {
    const period = readFileSync('src/components/layout/PeriodSelector.tsx', 'utf8');
    const exportButton = readFileSync('src/components/ui/ExportButton.tsx', 'utf8');
    expect(period).toContain('aria-label={language === \'es\' ? \'Elegir mes\'');
    expect(period).toContain('btn-tertiary');
    expect(period).not.toContain('rounded-full border border-slate-300 bg-white p-0.5');
    expect(exportButton).toContain('onClick={onClick}');
    expect(exportButton).toContain('btn-tertiary');
  });
});

function contrastRatio(first: string, second: string): number {
  const luminance = (color: string) => {
    const channel = (hex: string) => {
      const value = parseInt(hex, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.slice(1, 3)) + 0.7152 * channel(color.slice(3, 5)) + 0.0722 * channel(color.slice(5, 7));
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

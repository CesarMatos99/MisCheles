import { AnalyticsFilters, type AnalyticsFiltersValue } from './AnalyticsFilters';
import { focusedBreakdown } from '../../domain/analyticsBreakdown';
import { analyticsMonthStats, analyticsRangeSummary, analyticsCategoryTotals } from '../../domain/analyticsQueries';
import { comparePeriodMetric, equivalentDayRanges, expenseCategoryDistribution, isValidAnalyticsRange, monthRangeForDate, previousCalendarMonth, resolveComparisonRanges, samePeriodPreviousYear, summarizeAnalyticsPeriod, summarizeAnnualEvolution } from '../../domain/analyticsPeriodComparison';
import { CategoryAnalysis } from './CategoryAnalysis';
import { QuickExpenseChart } from './QuickExpenseChart';
import { buildFinancialInsights } from '../../domain/financialInsights';
import { filterAnalyticsMovements } from '../../domain/analyticsMovementFilter';
import { parseCalendarDay } from '../../domain/calendarDay';
import type { AnalyticsReport } from '../../domain/analyticsReport';
import React, { useMemo, useState } from 'react';
import { BarChart3, Lightbulb, SlidersHorizontal, TrendingDown, TrendingUp, Wallet, PiggyBank, ReceiptText, ArrowUpRight, List } from 'lucide-react';
import { MonthConfig, SavingsGoal, SavingsMovement, Transaction, UserProfile } from '../../types';
import { MONTH_NAMES_ES } from '../../constants/categories';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';
import { analyticsFilterSummaryLabels } from '../../i18n/analyticsFilterLabels';
import { PeriodSelector } from '../../components/layout/PeriodSelector';
import { ExportButton } from '../../components/ui/ExportButton';
import { PageHeader } from '../../components/layout/PageHeader';
import { isSavingsContributionTransaction, normalizeFinancialCategory } from '../../domain/financialClassification';
import { categorySpendingReport, spendingByCategory } from '../../domain/financialQueries';

type Mode = 'month' | 'year' | '6m' | '12m' | 'custom';
export type AnalyticsSection = 'summary' | 'categories' | 'compare' | 'evolution';
type Section = AnalyticsSection;
type Range = { start: Date; end: Date };
type CompareMode = 'months' | 'ranges';
type ActiveComparison = { a: Range; b: Range; equivalentDays: boolean };
type Budget = { category: string; amount: number };
interface Props {
  activeSection?: AnalyticsSection; onSectionChange?: (section: AnalyticsSection) => void;
  year: number; month: number; transactions: Transaction[]; savingsMovements: SavingsMovement[];
  savingsGoals: SavingsGoal[]; monthConfigs: Record<string, MonthConfig>;
  categoryBudgetsByMonth: Record<string, Budget[]>; profile: UserProfile; onOpenExportModal: (report: AnalyticsReport) => void;
}
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const keyFor = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const dayKey = (d: Date) => keyFor(d) + '-' + String(d.getDate()).padStart(2, '0');
const parseDay = parseCalendarDay;
const startMonth = (y: number, m: number) => new Date(y, m - 1, 1);
const endMonth = (y: number, m: number) => new Date(y, m, 0);
const moveMonth = (d: Date, amount: number) => new Date(d.getFullYear(), d.getMonth() + amount, 1);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const money = (n: number, currency: string) => Number.isFinite(n) ? currency + ' ' + Math.round(n).toLocaleString('es-DO') : '—';
const percent = (n: number | null) => n === null || !Number.isFinite(n) ? '—' : n.toLocaleString('es-DO', { maximumFractionDigits: 1 }) + '%';
const days = (r: Range) => Math.max(1, Math.floor((r.end.getTime() - r.start.getTime()) / 86400000) + 1);
const labelMonth = (key: string) => { const [y, m] = key.split('-').map(Number); return (MONTH_NAMES_ES[m - 1] || '') + ' ' + y; };
const labelDate = (d: Date) => d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const inRange = (d: Date, r: Range) => !Number.isNaN(d.getTime()) && d >= r.start && d <= r.end;
function buildRange(mode: Mode, year: number, month: number, from: string, to: string): Range {
  if (mode === 'custom') return { start: parseDay(from), end: parseDay(to) };
  if (mode === 'year') return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
  if (mode === '6m' || mode === '12m') return { start: startMonth(year, month - (mode === '6m' ? 5 : 11)), end: endMonth(year, month) };
  return { start: startMonth(year, month), end: endMonth(year, month) };
}

function Metric({ label, value, hint, icon: Icon, color = 'slate', featured = false }: { label: string; value: string; hint: string; icon?: React.ElementType; color?: string; featured?: boolean }) {
  const colors: Record<string, string> = { slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', blue: 'bg-primary/10 text-primary', green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', red: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' };
  return <div className={'analytics-metric ' + (featured ? 'sm:py-4' : '')}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>{Icon && <span className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-full ' + colors[color]}><Icon className="h-4 w-4" aria-hidden="true" /></span>}</div><p className={(featured ? 'mt-2 text-xl sm:text-2xl' : 'mt-1 text-base') + ' font-semibold tracking-tight text-app-foreground tabular-nums'}>{value}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p></div>;
}
function Heading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="app-section-heading"><div className="min-w-0"><h3 className="type-section-title text-app-foreground">{title}</h3>{detail && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>}</div>{action}</div>;
}

export const AnalyticsView: React.FC<Props> = ({ activeSection, onSectionChange, year, month, transactions: allTransactions, savingsMovements: allSavingsMovements, savingsGoals, monthConfigs, categoryBudgetsByMonth, profile, onOpenExportModal }) => {
  const { language } = useLanguage();
  const [movementType, setMovementType] = useState<'all' | 'income' | 'expense' | 'savings'>('all');
  const { transactions, savingsMovements, includeInitialIncome } = filterAnalyticsMovements(allTransactions, allSavingsMovements, movementType);
  const [mode, setMode] = useState<Mode>('month');
  const [y, setY] = useState(year);
  const [m, setM] = useState(month);
  const [from, setFrom] = useState(dayKey(startMonth(year, month)));
  const [to, setTo] = useState(dayKey(endMonth(year, month)));
  const [category, setCategory] = useState('Todas');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [localSection, setLocalSection] = useState<Section>('summary');
  const section = activeSection ?? localSection;
  const changeSection = (next: Section) => { setLocalSection(next); onSectionChange?.(next); };
  const [desktopView, setDesktopView] = useState<'dashboard' | 'analysis'>('dashboard');
  const isDesktopDashboard = desktopView === 'dashboard' && section === 'summary';
  const [categorySort, setCategorySort] = useState<'high' | 'low' | 'name'>('high');
  const [quickSort, setQuickSort] = useState<'high' | 'low' | 'name'>('high');
  const [quickView, setQuickView] = useState<'chart' | 'list'>('chart');
  const [compareMode, setCompareMode] = useState<CompareMode>('months');
  const [monthA, setMonthA] = useState(''); const [monthB, setMonthB] = useState('');
  const [rangeAFrom, setRangeAFrom] = useState(''); const [rangeATo, setRangeATo] = useState('');
  const [rangeBFrom, setRangeBFrom] = useState(''); const [rangeBTo, setRangeBTo] = useState('');
  const [compareEquivalentDays, setCompareEquivalentDays] = useState(false);
  const [activeComparison, setActiveComparison] = useState<ActiveComparison | null>(null);
  const [comparisonError, setComparisonError] = useState('');
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<string | null>(null);
  const [trendYear, setTrendYear] = useState(year);
  const [trendYearChosen, setTrendYearChosen] = useState(false);
  const filterSummary = analyticsFilterSummaryLabels(language, category, movementType);
  const fmt = (n: number) => money(n, profile.currency);
  const changeGeneralPeriod = (nextYear: number, nextMonth: number) => { setY(nextYear); setM(nextMonth); if (!trendYearChosen) setTrendYear(nextYear); };
  const range = useMemo(() => buildRange(mode, y, m, from, to), [mode, y, m, from, to]);
  const invalidRange = Number.isNaN(range.start.getTime()) || Number.isNaN(range.end.getTime()) || range.start > range.end;
  const safeRange = invalidRange ? { start: startMonth(y, m), end: endMonth(y, m) } : range;
  const firstMonth = keyFor(safeRange.start);
  const lastMonth = keyFor(safeRange.end);
  const elapsedEnd = safeRange.end > today() ? today() : safeRange.end;
  const elapsedDays = Math.max(1, Math.min(days(safeRange), days({ start: safeRange.start, end: elapsedEnd })));
  const { selectedTx, selectedSavings, visibleTx, visibleSavings, initialIncome, totalIncome, regularExpenses, directExpenses, totalExpenses, deposits, withdrawals, available, spentPercent, savedPercent, dailyAverage, movementCount } = analyticsRangeSummary({ transactions, savingsMovements, monthConfigs, range: safeRange, category, movementType, includeInitialIncome, elapsedDays });
  const noDuplicateTx = (tx: Transaction) => !isSavingsContributionTransaction(tx);
  const rangeLabel = mode === 'month' ? labelMonth(keyFor(safeRange.start)) : labelDate(safeRange.start) + ' – ' + labelDate(safeRange.end);
  const periodLabel = mode === 'month' ? labelMonth(keyFor(safeRange.start)) : mode === 'year' ? String(y) : mode === '6m' || mode === '12m' ? 'Últimos ' + (mode === '6m' ? '6' : '12') + ' meses hasta ' + (MONTH_NAMES_ES[m - 1] || '') + ' de ' + y : labelDate(safeRange.start) + ' – ' + labelDate(safeRange.end);
  const totals = analyticsCategoryTotals(visibleTx, visibleSavings);
  const categoryRows = Array.from(totals, ([name, amount]) => ({ name, amount, share: totalExpenses ? amount / totalExpenses * 100 : 0 }));
  const budgetByCategory = new Map<string, number>();
  Object.entries(categoryBudgetsByMonth).filter(([key]) => { const [yy, mm] = key.split('-').map(Number); return startMonth(yy, mm) >= safeRange.start && endMonth(yy, mm) <= safeRange.end; }).forEach(([, budgets]) => (budgets || []).forEach(b => budgetByCategory.set(b.category, (budgetByCategory.get(b.category) || 0) + b.amount)));
  const focusedRows = movementType === 'income' || movementType === 'savings' ? focusedBreakdown(movementType, visibleTx, visibleSavings) : [];
  const displayCategories = [...categoryRows];
  budgetByCategory.forEach((_, name) => { if ((category === 'Todas' || category === name) && !totals.has(name)) displayCategories.push({ name, amount: 0, share: 0 }); });
  displayCategories.sort((a, b) => categorySort === 'high' ? b.amount - a.amount : categorySort === 'low' ? a.amount - b.amount : a.name.localeCompare(b.name, 'es'));
  const topCategory = [...categoryRows].sort((a, b) => b.amount - a.amount)[0];
  const leastCategory = [...categoryRows].sort((a, b) => a.amount - b.amount)[0];

  const getMonthStats = (key: string, dayLimit?: number, selectedRange?: Range) => {
    const [yy, mm] = key.split('-').map(Number);
    const selected = selectedRange || { start: startMonth(yy, mm), end: dayLimit ? new Date(yy, mm - 1, Math.min(dayLimit, new Date(yy, mm, 0).getDate())) : endMonth(yy, mm) };
    return analyticsMonthStats({ monthKey: key, transactions, savingsMovements, monthConfigs, category, includeInitialIncome, range: selected });
  };
  const selectedComparisonRanges = activeComparison ? (activeComparison.equivalentDays ? equivalentDayRanges(activeComparison.a, activeComparison.b) : { a: activeComparison.a, b: activeComparison.b, days: Math.min(days(activeComparison.a), days(activeComparison.b)), applied: false }) : null;
  const comparisonA = activeComparison && selectedComparisonRanges ? summarizeAnalyticsPeriod({ transactions, savingsMovements, monthConfigs, range: selectedComparisonRanges.a, category, movementType, includeInitialIncome }) : null;
  const comparisonB = activeComparison && selectedComparisonRanges ? summarizeAnalyticsPeriod({ transactions, savingsMovements, monthConfigs, range: selectedComparisonRanges.b, category, movementType, includeInitialIncome }) : null;
  const comparisonLabelFor = (selected: Range, periodDays: number) => labelDate(selected.start) + ' – ' + labelDate(selected.end) + ' · ' + periodDays + ' días';
  const comparisonALabel = comparisonA && selectedComparisonRanges ? comparisonLabelFor(selectedComparisonRanges.a, comparisonA.days) : 'Período A';
  const comparisonBLabel = comparisonB && selectedComparisonRanges ? comparisonLabelFor(selectedComparisonRanges.b, comparisonB.days) : 'Período B';
  const compareCats = comparisonA && comparisonB ? Array.from(new Set([...comparisonA.categories.keys(), ...comparisonB.categories.keys()])).map(name => ({ name, a: comparisonA.categories.get(name) || 0, b: comparisonB.categories.get(name) || 0 })).sort((a, b) => Math.abs(b.a - b.b) - Math.abs(a.a - a.b)) : [];
  const comparisonInput = { mode: compareMode, monthA, monthB, rangeAFrom, rangeATo, rangeBFrom, rangeBTo } as const;
  const comparisonFormValid = resolveComparisonRanges(comparisonInput) !== null;
  const applyComparison = () => {
    const ranges = resolveComparisonRanges(comparisonInput);
    if (!ranges) { setComparisonError(compareMode === 'months' ? 'Selecciona un mes válido para A y otro para B.' : 'Completa los dos rangos con fechas válidas y un inicio anterior o igual al final.'); return; }
    setActiveComparison({ ...ranges, equivalentDays: compareEquivalentDays }); setComparisonError('');
  };
  const applyQuickComparison = (preset: 'previous' | 'year') => {
    const base = compareMode === 'months' ? monthA ? monthRangeForDate(parseDay(monthA + '-01')) : null : isValidAnalyticsRange({ from: rangeAFrom, to: rangeATo }) ? { from: rangeAFrom, to: rangeATo } : null;
    if (!base) { setComparisonError('Selecciona primero el período A para usar un acceso rápido.'); return; }
    const selected = preset === 'previous' ? previousCalendarMonth(base) : samePeriodPreviousYear(base);
    if (compareMode === 'months') setMonthB(selected.from.slice(0, 7)); else { setRangeBFrom(selected.from); setRangeBTo(selected.to); }
    setComparisonError('');
  };
  const resetComparison = () => { setActiveComparison(null); setComparisonError(''); setMonthA(''); setMonthB(''); setRangeAFrom(''); setRangeATo(''); setRangeBFrom(''); setRangeBTo(''); setCompareEquivalentDays(false); };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allTransactions.filter(tx => !isSavingsContributionTransaction(tx)).forEach(tx => { const parsed = Number(tx.date.slice(0, 4)); if (Number.isInteger(parsed)) years.add(parsed); });
    allSavingsMovements.forEach(movement => { const parsed = Number(movement.date.slice(0, 4)); if (Number.isInteger(parsed)) years.add(parsed); });
    Object.entries(monthConfigs).forEach(([key, config]) => { if ((Number(config.initialIncome) || 0) !== 0 || (Number(config.carryoverFromPrev) || 0) !== 0) years.add(Number(key.slice(0, 4))); });
    if (!years.size) years.add(y);
    years.add(trendYear);
    return Array.from(years).filter(Number.isFinite).sort((a, b) => b - a);
  }, [allTransactions, allSavingsMovements, monthConfigs, trendYear, y]);
  const annualMonthSeries = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1; const key = keyFor(startMonth(trendYear, monthNumber));
    return { key, label: startMonth(trendYear, monthNumber).toLocaleDateString('es-DO', { month: 'short' }).replace('.', ''), ...getMonthStats(key) };
  });
  const annualSummary = summarizeAnnualEvolution(annualMonthSeries);
  const monthSeries = annualSummary.activeMonths;
  const maxSeries = Math.max(1, ...monthSeries.map(item => Math.max(item.income, item.expenses, item.saved)));
  const avgExpense = annualSummary.averageMonthlyExpenses;
  const maxMonth = annualSummary.highestExpenseMonth;
  const minMonth = annualSummary.lowestExpenseMonth;
  const direction = annualSummary.expenseTrend;
  const categoryHistory = selectedCategoryDetail ? Array.from({ length: 12 }, (_, index) => {
    const date = moveMonth(startMonth(safeRange.end.getFullYear(), safeRange.end.getMonth() + 1), index - 11);
    const key = keyFor(date); const monthRange = { start: startMonth(date.getFullYear(), date.getMonth() + 1), end: endMonth(date.getFullYear(), date.getMonth() + 1) };
    const historyTransactions = transactions.filter(tx => inRange(parseDay(tx.date), monthRange) && (category === 'Todas' || tx.category === category));
    const historySavings = savingsMovements.filter(item => inRange(parseDay(item.date), monthRange) && (category === 'Todas' || (item.type === 'direct_expense' && (item.category || 'Otros') === category)));
    const total = spendingByCategory(historyTransactions, historySavings).get(normalizeFinancialCategory(selectedCategoryDetail))?.amount || 0;
    return { key, label: date.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' }).replace('.', ''), amount: total };
  }).filter(point => point.amount > 0) : [];
    const priorRange = { start: new Date(safeRange.start.getFullYear(), safeRange.start.getMonth(), safeRange.start.getDate() - days(safeRange)), end: new Date(safeRange.start.getFullYear(), safeRange.start.getMonth(), safeRange.start.getDate() - 1) };
  const priorTx = transactions.filter(tx => inRange(parseDay(tx.date), priorRange) && tx.type === 'expense' && noDuplicateTx(tx) && (category === 'Todas' || tx.category === category));
  const priorSm = savingsMovements.filter(sm => inRange(parseDay(sm.date), priorRange) && (category === 'Todas' || (sm.type === 'direct_expense' && (sm.category || 'Otros') === category)));
  const priorTotals = new Map<string, number>();
  priorTx.forEach(tx => priorTotals.set(tx.category, (priorTotals.get(tx.category) || 0) + tx.amount));
  priorSm.filter(sm => sm.type === 'direct_expense').forEach(sm => { const c = sm.category || 'Otros'; priorTotals.set(c, (priorTotals.get(c) || 0) + sm.amount); });
  const priorExpenses = priorTx.reduce((s, tx) => s + tx.amount, 0) + priorSm.filter(sm => sm.type === 'direct_expense').reduce((s, sm) => s + sm.amount, 0);
  const previousDeposits = priorSm.filter(sm => sm.type === 'deposit_from_month').reduce((sum, sm) => sum + sm.amount, 0);
  const insights = buildFinancialInsights({
    currentCategoryTotals: totals,
    previousCategoryTotals: priorTotals,
    categoryBudgets: budgetByCategory,
    totalExpenses,
    previousExpenses: priorExpenses,
    deposits,
    previousDeposits,
    trendExpenses: monthSeries.map(item => item.expenses),
    averageExpenses: avgExpense || 0,
    goals: savingsGoals,
    hasMovements: Boolean(selectedTx.length || selectedSavings.length),
  });
  const tips = insights.map((insight) => {
    const categoryLabel = insight.category ? localizeCategoryName(language, insight.category) : '';
    switch (insight.code) {
      case 'category_opportunity': return { title: 'Oportunidad de ahorro: ' + categoryLabel, detail: 'Es la categoría de mayor gasto y representa ' + percent(insight.share || 0) + ' de los gastos del período. Revisar sus movimientos ayuda a encontrar gastos que puedes reducir.', value: fmt(insight.amount || 0) + ' gastados', color: 'amber' };
      case 'expenses_increased': return { title: 'Tus gastos aumentaron', detail: 'Comparación con el período anterior, de la misma duración.', value: '+' + fmt(insight.amount || 0), color: 'red' };
      case 'expenses_reduced': return { title: 'Has reducido tus gastos', detail: 'Gastaste menos que en el período anterior comparable.', value: '-' + fmt(insight.amount || 0), color: 'green' };
      case 'category_increased': return { title: 'Subió el gasto en ' + categoryLabel, detail: 'El aumento supera el 25% y ' + fmt(500) + ' respecto al período comparable.', value: '+' + fmt(insight.amount || 0), color: 'amber' };
      case 'budget_exceeded': return { title: 'Presupuesto excedido: ' + categoryLabel, detail: 'El gasto superó el monto que asignaste.', value: fmt(insight.amount || 0), color: 'red' };
      case 'savings_increased': return { title: 'Estás aumentando tus ahorros', detail: 'Enviaste más dinero al ahorro que en el período comparable.', value: '+' + fmt(insight.amount || 0), color: 'green' };
      case 'sustained_high_expenses': return { title: 'Gasto elevado sostenido', detail: 'Los últimos tres meses están por encima del promedio del período.', color: 'amber' };
      case 'goal_near': return { title: 'Casi alcanzas «' + (insight.goal || '') + '»', detail: 'Ya alcanzaste al menos el 80% de tu meta.', value: 'Faltan ' + fmt(insight.amount || 0), color: 'blue' };
      default: return { title: 'Sin alertas destacadas', detail: 'Los registros actuales no muestran variaciones importantes.', color: 'blue' };
    }
  });

  const sections: { id: Section; label: string; icon: React.ElementType }[] = [
    { id: 'summary', label: 'Resumen', icon: Wallet }, { id: 'categories', label: 'Categorías', icon: BarChart3 },
    { id: 'compare', label: 'Comparar', icon: TrendingUp }, { id: 'evolution', label: 'Evolución', icon: TrendingDown },
  ];
  const modes: { id: Mode; label: string }[] = [{ id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' }, { id: '6m', label: '6 meses' }, { id: '12m', label: '12 meses' }, { id: 'custom', label: 'Rango' }];
  const borderSection = 'app-surface space-y-4';
  const sectionPanelClass = (target: Section, placement = '') => borderSection + ' ' + (section === target ? '' : 'hidden') + (isDesktopDashboard ? ' xl:block ' + placement : section === target ? ' xl:block' : ' xl:hidden');
  const generalCompareRows = expenseCategoryDistribution(visibleTx, visibleSavings);
  const includesToday = (fromValue: string, toValue: string) => isValidAnalyticsRange({ from: fromValue, to: toValue }) && parseDay(fromValue) <= today() && parseDay(toValue) >= today();
  const comparisonHasCurrentDate = compareMode === 'months' ? monthA === keyFor(today()) || monthB === keyFor(today()) : includesToday(rangeAFrom, rangeATo) || includesToday(rangeBFrom, rangeBTo);

  const makeReport = (): AnalyticsReport => {
    const report: AnalyticsReport = {
        reportScope: 'statistics',
        query: { mode, year: y, month: m, from: dayKey(safeRange.start), to: dayKey(safeRange.end), category, movementType },
        financialSummary: {
          income: totalIncome,
          expenses: totalExpenses,
          savingsContributions: deposits,
          ...(Number.isFinite(available) ? { available } : {}),
        },
        ...(movementType === 'all' || movementType === 'expense' ? {
          expenseBreakdown: categorySpendingReport({
            transactions: visibleTx,
            savingsMovements: visibleSavings,
            budgets: Array.from(budgetByCategory, ([category, amount]) => ({ category, amount })),
            totalExpenses,
          }),
        } : {}),
        breakdown: { title: movementType === 'income' ? 'Ingresos registrados por categoría' : movementType === 'savings' ? 'Destinos de aportes' : 'Gastos por categoría',
          rows: (movementType === 'income' || movementType === 'savings' ? focusedRows : displayCategories).map(row => [row.name, fmt(row.amount), percent(row.share)] as [string, string, string]) },
        period: rangeLabel + ' · ' + filterSummary.movementType, category: filterSummary.category, transactions: visibleTx, savingsMovements: visibleSavings,
        metrics: [['Ingresos', fmt(totalIncome)], ['Gastos de consumo', fmt(totalExpenses)],
          ['Destinado a ahorro', fmt(deposits)], ['Disponible', fmt(available)],
          ['Gastos respecto a ingresos', percent(spentPercent)], ['Ingresos enviados a ahorro', percent(savedPercent)],
          ['Promedio diario', fmt(dailyAverage)], ['Movimientos', String(movementCount)]],
      };
    if (section === 'compare' && activeComparison && comparisonA && comparisonB) {
      report.period = comparisonALabel + ' frente a ' + comparisonBLabel;
      report.metrics = [['Período A', comparisonALabel], ['Período B', comparisonBLabel]];
      report.financialSummary = undefined; report.expenseBreakdown = undefined;
      report.breakdown = undefined; report.transactions = []; report.savingsMovements = [];
      report.tables = [{
        title: 'Comparación de indicadores',
        headers: ['Indicador', 'A', 'B', 'Diferencia A − B', 'Variación vs. B'],
        rows: comparisonA && comparisonB ? [['Ingresos', comparisonA.income, comparisonB.income, 'income'], ['Gastos', comparisonA.expenses, comparisonB.expenses, 'expense'], ['Aportes', comparisonA.savings, comparisonB.savings, 'savings']].map(([name, first, second, kind]) => {
          const metric = comparePeriodMetric(Number(first), Number(second), kind as 'income' | 'expense' | 'savings');
          return [String(name), fmt(Number(first)), fmt(Number(second)), (metric.difference > 0 ? '+' : '') + fmt(metric.difference), metric.variationPercent === null ? 'Sin base en B' : (metric.variationPercent > 0 ? '+' : '') + percent(metric.variationPercent)];
        }) : [],
      }, { title: 'Gastos por categoría', headers: ['Categoría', 'A', 'B', 'Diferencia A − B'], rows: compareCats.map(row => [row.name, fmt(row.a), fmt(row.b), (row.a - row.b > 0 ? '+' : '') + fmt(row.a - row.b)]) }];
    } else if (section === 'evolution') {
      report.period = monthSeries.length ? labelMonth(monthSeries[0].key) + ' – ' + labelMonth(monthSeries[monthSeries.length - 1].key) : rangeLabel;
      report.metrics = []; report.financialSummary = undefined; report.expenseBreakdown = undefined;
      report.breakdown = undefined; report.transactions = []; report.savingsMovements = [];
      report.tables = [{ title: 'Evolución financiera', headers: ['Mes', 'Ingresos', 'Gastos', 'Aportes'], rows: monthSeries.map(row => [labelMonth(row.key), fmt(row.income), fmt(row.expenses), fmt(row.saved)]) }];
    }
    return report;
  };

  return <div className="mx-auto w-full min-w-0 max-w-none animate-in fade-in duration-200">
    <PageHeader title="Tus estadísticas" period={mode === 'custom' ? <span className="type-secondary">{labelDate(safeRange.start)} – {labelDate(safeRange.end)}</span> : mode === 'year' ? <span className="px-2 text-sm font-semibold">{y}</span> : <PeriodSelector compact year={y} month={m} onMonthChange={changeGeneralPeriod} />} actions={<><button type="button" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} className="btn-secondary inline-flex items-center gap-1.5 text-xs"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />Filtros</button><ExportButton disabled={invalidRange || (section === 'compare' && !activeComparison)} onClick={() => onOpenExportModal(makeReport())} /></>} />
    {filtersOpen && <AnalyticsFilters value={{ mode, year: y, month: m, from, to, category, movementType }}
      defaults={{ mode: 'month', year, month, from: dayKey(startMonth(year, month)), to: dayKey(endMonth(year, month)), category: 'Todas', movementType: 'all' }}
      categoriesByType={{ all: [...new Set([...allTransactions.filter(tx => !isSavingsContributionTransaction(tx)).map(tx => tx.category), ...allSavingsMovements.filter(sm => sm.type === 'direct_expense').map(sm => sm.category || 'Otros')])].sort(), income: [...new Set(allTransactions.filter(tx => tx.type === 'income' && !isSavingsContributionTransaction(tx)).map(tx => tx.category))].sort(), expense: [...new Set([...allTransactions.filter(tx => tx.type === 'expense' && !isSavingsContributionTransaction(tx)).map(tx => tx.category), ...allSavingsMovements.filter(sm => sm.type === 'direct_expense').map(sm => sm.category || 'Otros')])].sort(), savings: [] }}
      onClose={() => setFiltersOpen(false)}
      onApply={(filters: AnalyticsFiltersValue) => { setMode(filters.mode); setY(filters.year); setM(filters.month); if (!trendYearChosen) setTrendYear(filters.year); setFrom(filters.from); setTo(filters.to); setCategory(filters.category); setMovementType(filters.movementType); setFiltersOpen(false); }} />}
    <div className="hidden justify-end pt-3 xl:flex">
      <div role="group" aria-label="Vista de estadísticas" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        <button type="button" aria-pressed={isDesktopDashboard} onClick={() => { setDesktopView('dashboard'); changeSection('summary'); }} className={'min-h-10 rounded-lg px-3 text-sm font-medium ' + (isDesktopDashboard ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>Dashboard</button>
        <button type="button" aria-pressed={!isDesktopDashboard} onClick={() => { setDesktopView('analysis'); if (section === 'summary') changeSection('categories'); }} className={'min-h-10 rounded-lg px-3 text-sm font-medium ' + (!isDesktopDashboard ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>Análisis</button>
      </div>
    </div>
    <nav className={'analytics-tabs flex w-full min-w-0 gap-1 overflow-x-auto pb-1 ' + (isDesktopDashboard ? 'xl:hidden' : 'xl:flex')} aria-label="Apartados">{sections.map(s => { const Icon = s.icon; return <button key={s.id} onClick={() => changeSection(s.id)} aria-current={section === s.id ? "page" : undefined} className={"inline-flex min-h-11 min-w-[76px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-full px-2 text-[11px] leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-w-fit sm:flex-row sm:gap-1.5 sm:px-3 sm:text-xs " + (section === s.id ? "font-semibold" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800")}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="whitespace-nowrap">{s.label}</span></button>; })}</nav>

    <div className={'analytics-grid grid min-w-0 gap-4 pt-4 xl:items-start ' + (isDesktopDashboard ? 'xl:grid-cols-2' : 'xl:grid-cols-1')}>
      {invalidRange && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300 xl:col-span-2">Introduce fechas válidas y una fecha final igual o posterior al inicio para consultar y exportar resultados.</p>}
      {!invalidRange && <section aria-label="Resumen financiero" className={'app-surface grid grid-cols-2 gap-x-5 sm:grid-cols-4 ' + (section === 'summary' ? '' : 'hidden') + (isDesktopDashboard ? ' xl:col-span-2 xl:row-start-1' : '')}>
          <Metric featured label="Ingresos" value={fmt(totalIncome)} hint="Dinero inicial del período + ingresos registrados" icon={ArrowUpRight} color="blue" />
          <Metric featured label="Gastos" value={fmt(totalExpenses)} hint="Incluye pagos reales hechos desde ahorros" icon={ReceiptText} color="red" />
          <Metric featured label="Destinado a ahorro" value={category === 'Todas' ? fmt(deposits) : '—'} hint="Aportes internos; no se cuentan como gasto" icon={PiggyBank} color="green" />
          <Metric featured label="Dinero disponible" value={fmt(available)} hint="Saldo inicial + entradas − gastos del mes − aportes" icon={Wallet} color={available < 0 ? 'red' : 'slate'} />
      </section>}
      {!invalidRange && section === 'summary' && <section aria-label="Indicadores complementarios" className="app-surface grid grid-cols-2 gap-x-4 sm:grid-cols-4 xl:hidden">
          <Metric label="Gastos respecto a ingresos" value={percent(spentPercent)} hint="Parte de tus ingresos destinada a gastos" />
          <Metric label="Ingresos enviados a ahorro" value={category === 'Todas' ? percent(savedPercent) : '—'} hint="Parte de tus ingresos destinada al ahorro" />
          <Metric label="Promedio diario" value={fmt(dailyAverage)} hint={elapsedDays + ' días contabilizados'} />
          <Metric label="Movimientos" value={movementCount.toLocaleString('es-DO')} hint="Ingresos, gastos y acciones de ahorro" />
      </section>}
      {!invalidRange && section === 'summary' && category !== 'Todas' && <p className="border-b border-slate-200/80 pb-3 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400 xl:hidden">El saldo inicial y las transferencias sin categoría no se atribuyen a este filtro.</p>}
      {!invalidRange && <section aria-label="Consejos de MisCheles" className={sectionPanelClass('summary', 'xl:col-start-2 xl:row-start-3')}>
          <Heading title="Consejos de MisCheles" detail="Recomendaciones generadas con tus movimientos y presupuestos reales." />
          {movementType !== 'all' || category !== 'Todas' ? <p className="py-3 text-xs text-slate-500">Selecciona todos los tipos y categorías para recibir consejos sobre el período completo.</p> : !tips.length ? <p className="py-3 text-xs text-slate-500 dark:text-slate-400">Aún no hay suficientes movimientos para identificar oportunidades.</p> : <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">{tips.slice(0, 4).map((tip, i) => <article key={i} className="flex gap-3 py-3"><span className={'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ' + (tip.color === 'red' ? 'bg-rose-500/10 text-rose-600' : tip.color === 'amber' ? 'bg-amber-500/10 text-amber-600' : tip.color === 'green' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary')}><Lightbulb className="h-4 w-4" /></span><div className="min-w-0"><h4 className="text-sm font-semibold">{tip.title}</h4><p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{tip.detail}</p>{tip.value && <p className="mt-1 text-xs font-semibold">{tip.value}</p>}</div></article>)}</div>}
      </section>}
      {!invalidRange && section === 'summary' && <section className={borderSection + (isDesktopDashboard ? ' xl:hidden' : ' xl:block')} aria-label="Lectura rápida de gastos por categoría">
          <Heading title="Lectura rápida" detail={'Gastos por categoría · ' + rangeLabel} />
          <QuickExpenseChart rows={expenseCategoryDistribution(visibleTx, visibleSavings)} view={quickView} onViewChange={setQuickView} sort={quickSort} onSort={setQuickSort} fmt={fmt} localize={name => localizeCategoryName(language, name)} />
      </section>}
      {!invalidRange && (movementType === 'all' || movementType === 'expense') && (() => {
        const previousRange = { start: new Date(safeRange.start.getFullYear(), safeRange.start.getMonth(), safeRange.start.getDate() - days(safeRange)), end: new Date(safeRange.start.getFullYear(), safeRange.start.getMonth(), safeRange.start.getDate() - 1) };
        const previousRows = expenseCategoryDistribution(
          transactions.filter(tx => inRange(parseDay(tx.date), previousRange)),
          savingsMovements.filter(sm => inRange(parseDay(sm.date), previousRange)),
        );
        const budgets = Array.from(budgetByCategory, ([category, amount]) => ({ category, amount }));
        return <section className={sectionPanelClass('categories', 'xl:col-start-1 xl:row-start-2')}><Heading title="Gastos por categoría" detail="Distribución, variación y presupuesto frente al gasto real." />
          <CategoryAnalysis rows={expenseCategoryDistribution(visibleTx, visibleSavings)} previousRows={previousRows} history={categoryHistory} budgets={budgets} transactions={visibleTx} savingsMovements={visibleSavings} sort={categorySort} onSort={setCategorySort} selectedCategory={selectedCategoryDetail} onSelect={setSelectedCategoryDetail} fmt={fmt} localize={name => localizeCategoryName(language, name)} periodLabel={rangeLabel} />
        </section>;
      })()}

      {!invalidRange && (movementType === 'income' || movementType === 'savings') && <section className={sectionPanelClass('categories', 'xl:col-start-1 xl:row-start-2')}>
        <Heading title={movementType === 'income' ? 'Ingresos registrados por categoría' : 'Destinos de los aportes'}
          detail={movementType === 'income' ? 'Incluye ingresos registrados con categoría; el monto inicial se consulta en Resumen.' : 'Incluye aportes a ahorro general y metas. Los retiros no se restan de este ranking de aportes.'} />
        {!focusedRows.length ? <p className="py-4 text-sm text-slate-500">No hay movimientos de este tipo para los filtros seleccionados.</p> :
          <div className="divide-y divide-slate-200 dark:divide-slate-800">{focusedRows.map((row, index) => <article key={row.id} className="space-y-2 py-3">
            <div className="flex justify-between gap-3"><p className="text-sm font-semibold">{index + 1}. {row.name}</p><p className="text-sm font-semibold">{fmt(row.amount)}</p></div>
            <p className="text-xs text-slate-500">{percent(row.share)} del total {movementType === 'income' ? 'registrado' : 'aportado'}</p>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{ width: row.share + '%' }} /></div>
          </article>)}</div>}
      </section>}
      {!invalidRange && <section className={sectionPanelClass('compare', 'xl:col-start-1 xl:row-start-3')}>
        <Heading title="Comparar períodos" detail="Elige A y B y aplica para iniciar la comparación." />
        <div className="mt-3 space-y-3">
          <div role="group" aria-label="Modalidad de comparación" className="grid w-full max-w-sm grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
            <button type="button" aria-pressed={compareMode === 'months'} onClick={() => { setCompareMode('months'); setComparisonError(''); }} className={'min-h-10 rounded-lg px-2 text-sm font-medium ' + (compareMode === 'months' ? 'bg-white text-primary shadow-sm dark:bg-slate-800' : 'text-slate-500')}>Meses</button>
            <button type="button" aria-pressed={compareMode === 'ranges'} onClick={() => { setCompareMode('ranges'); setComparisonError(''); }} className={'min-h-10 rounded-lg px-2 text-sm font-medium ' + (compareMode === 'ranges' ? 'bg-white text-primary shadow-sm dark:bg-slate-800' : 'text-slate-500')}>Rangos de fechas</button>
          </div>
          {compareMode === 'months' ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-xs font-medium">Período A<input aria-label="Mes del período A" className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700" type="month" value={monthA} onChange={event => { setMonthA(event.target.value); setComparisonError(''); }} /></label>
            <label className="min-w-0 text-xs font-medium">Período B<input aria-label="Mes del período B" className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700" type="month" value={monthB} onChange={event => { setMonthB(event.target.value); setComparisonError(''); }} /></label>
          </div> : <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <fieldset className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"><legend className="px-1 text-xs font-semibold">Período A</legend><label className="block text-xs">Desde<input aria-label="Período A desde" className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-2 text-sm dark:border-slate-700" type="date" value={rangeAFrom} onChange={event => { setRangeAFrom(event.target.value); setComparisonError(''); }} /></label><label className="block text-xs">Hasta<input aria-label="Período A hasta" className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-2 text-sm dark:border-slate-700" type="date" value={rangeATo} onChange={event => { setRangeATo(event.target.value); setComparisonError(''); }} /></label></fieldset>
            <fieldset className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"><legend className="px-1 text-xs font-semibold">Período B</legend><label className="block text-xs">Desde<input aria-label="Período B desde" className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-2 text-sm dark:border-slate-700" type="date" value={rangeBFrom} onChange={event => { setRangeBFrom(event.target.value); setComparisonError(''); }} /></label><label className="block text-xs">Hasta<input aria-label="Período B hasta" className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-transparent px-2 text-sm dark:border-slate-700" type="date" value={rangeBTo} onChange={event => { setRangeBTo(event.target.value); setComparisonError(''); }} /></label></fieldset>
          </div>}
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => applyQuickComparison('previous')} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-primary hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Usar mes anterior</button><button type="button" onClick={() => applyQuickComparison('year')} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-primary hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Mismo período del año anterior</button></div>
          {comparisonHasCurrentDate && <label className="flex min-h-10 items-start gap-2 text-xs"><input type="checkbox" checked={compareEquivalentDays} onChange={event => setCompareEquivalentDays(event.target.checked)} className="mt-0.5 accent-primary" /><span>Comparar los mismos días transcurridos<span className="mt-0.5 block text-[11px] text-slate-500">Solo ajusta el cálculo cuando un rango incluye hoy; no cambia las fechas seleccionadas.</span></span></label>}
          {comparisonError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{comparisonError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800"><button type="button" onClick={resetComparison} className="min-h-10 rounded-lg px-3 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Limpiar selección</button><button type="button" onClick={applyComparison} className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Aplicar comparación</button></div>
        </div>
        {activeComparison && comparisonA && comparisonB && selectedComparisonRanges ? <>
          <div className="grid gap-2 border-y border-slate-200 py-3 text-xs sm:grid-cols-2 dark:border-slate-800"><p><strong>A:</strong> {comparisonALabel}</p><p><strong>B:</strong> {comparisonBLabel}</p></div>
          {selectedComparisonRanges.applied && <p className="text-xs text-slate-500">Se comparan los primeros {selectedComparisonRanges.days} días de cada período en curso.</p>}
          {dayKey(activeComparison.a.start) === dayKey(activeComparison.b.start) && dayKey(activeComparison.a.end) === dayKey(activeComparison.b.end) && <p className="text-xs text-amber-700 dark:text-amber-300">A y B cubren las mismas fechas; los resultados serán iguales.</p>}
          <div className="divide-y divide-slate-200 dark:divide-slate-800">{[{ label: 'Ingresos', a: comparisonA.income, b: comparisonB.income, kind: 'income' as const }, { label: 'Gastos reales', a: comparisonA.expenses, b: comparisonB.expenses, kind: 'expense' as const }, { label: 'Aportes a ahorro', a: comparisonA.savings, b: comparisonB.savings, kind: 'savings' as const }].map(metric => { const change = comparePeriodMetric(metric.a, metric.b, metric.kind); const color = change.favorable === 'good' ? 'text-emerald-700 dark:text-emerald-400' : change.favorable === 'bad' ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500'; return <div key={metric.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-3"><div className="min-w-0"><p className="text-xs font-semibold">{metric.label}</p><p className="mt-1 text-[11px] text-slate-500">A {fmt(metric.a)} <span className="px-1">·</span> B {fmt(metric.b)}</p></div><div className="text-right"><p className={'text-xs font-semibold tabular-nums ' + color}>{change.difference > 0 ? '+' : ''}{fmt(change.difference)}</p><p className={'mt-1 text-[10px] ' + color}>{change.variationPercent === null ? 'Sin base en B' : (change.variationPercent > 0 ? '+' : '') + percent(change.variationPercent) + ' vs. B'}</p></div></div>; })}</div>
        </> : <p className="text-xs text-slate-500">La comparación no está activa. Las categorías de abajo corresponden a los filtros generales de {rangeLabel}; selecciona A y B y pulsa «Aplicar comparación» para comparar.</p>}
        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800"><h4 className="text-sm font-semibold">Categorías</h4><p className="text-[11px] text-slate-500">{activeComparison ? 'Gasto real por categoría en A y B.' : 'Gastos reales del período general · ' + rangeLabel}</p>
          {(activeComparison ? compareCats : generalCompareRows.map(row => ({ name: row.category, a: row.amount, b: 0 }))).length ? <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">{(activeComparison ? compareCats : generalCompareRows.map(row => ({ name: row.category, a: row.amount, b: 0 }))).map(row => { const metric = activeComparison ? comparePeriodMetric(row.a, row.b, 'expense') : null; return <div key={row.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 py-2.5 text-xs"><button type="button" onClick={() => { setSelectedCategoryDetail(row.name); changeSection('categories'); }} className="min-w-0 truncate text-left font-medium text-primary hover:underline" title={localizeCategoryName(language, row.name)}>{localizeCategoryName(language, row.name)}</button>{activeComparison ? <div className="min-w-0 text-right"><p className="font-semibold tabular-nums">A {fmt(row.a)} · B {fmt(row.b)}</p><p className={'mt-0.5 text-[10px] tabular-nums ' + (metric?.favorable === 'good' ? 'text-emerald-700 dark:text-emerald-400' : metric?.favorable === 'bad' ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500')}>A−B {metric && metric.difference > 0 ? '+' : ''}{fmt(metric?.difference || 0)} · {metric?.variationPercent === null ? 'Sin base en B' : (metric && metric.variationPercent > 0 ? '+' : '') + percent(metric?.variationPercent || 0)}</p></div> : <div className="text-right"><p className="font-semibold tabular-nums">{fmt(row.a)}</p><p className="text-[10px] text-slate-500">{generalCompareRows.find(item => item.category === row.name)?.share.toLocaleString('es-DO', { maximumFractionDigits: 1 })}% del total</p></div>}</div>; })}</div> : <p className="py-4 text-xs text-slate-500">No hay gastos reales por categoría en este período.</p>}
        </div>
      </section>}

      {!invalidRange && <section className={sectionPanelClass('evolution', 'xl:col-start-2 xl:row-start-2')}>
        <Heading title="Evolución financiera" detail={'Ingresos, gastos reales y aportes a ahorro · ' + trendYear} action={<label className="flex items-center gap-2 text-xs text-slate-500">Año<select aria-label="Año de evolución" value={trendYear} onChange={event => { setTrendYear(Number(event.target.value)); setTrendYearChosen(true); }} className="min-h-9 max-w-28 rounded-lg border border-slate-200 bg-transparent px-2 text-sm font-semibold text-app-foreground dark:border-slate-700">{availableYears.map(value => <option key={value} value={value}>{value}</option>)}</select></label>} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span><span className="text-primary">●</span> Ingresos</span><span><span className="text-rose-500">●</span> Gastos</span><span><span className="text-emerald-600">●</span> Ahorro</span></div>
        {!monthSeries.length ? <p className="py-5 text-sm text-slate-500">No hay movimientos financieros registrados para {trendYear} con estos filtros.</p> : <>
          {monthSeries.length === 1 && <p className="text-xs text-slate-500">Hay información de un solo mes; aún no se puede determinar una tendencia.</p>}
          <div className="grid min-w-0 grid-cols-3 items-end gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12" aria-label={'Evolución mensual de ' + trendYear} role="list">{monthSeries.map(item => <div key={item.key} role="listitem" title={labelMonth(item.key) + ': ingresos ' + fmt(item.income) + ', gastos ' + fmt(item.expenses) + ', ahorro ' + fmt(item.saved)} className="min-w-0"><div className="flex h-24 items-end justify-center gap-1 border-b border-slate-200 dark:border-slate-800">{[[item.income, 'bg-primary'], [item.expenses, 'bg-rose-400'], [item.saved, 'bg-emerald-500']].map(([amount, color], index) => <div key={index} className={'w-3 max-w-full rounded-t-sm ' + color} style={{ height: Number(amount) ? Math.max(4, Number(amount) / maxSeries * 100) + '%' : '0%' }} />)}</div><p className="mt-1 truncate text-center text-[10px] text-slate-500">{item.label}</p></div>)}</div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 dark:border-slate-800 sm:grid-cols-4"><div><p className="text-[11px] text-slate-500">Promedio mensual de gastos</p><p className="mt-1 text-sm font-semibold">{avgExpense === null ? 'Sin datos' : fmt(avgExpense)}</p><p className="text-[10px] text-slate-500">{monthSeries.length} {monthSeries.length === 1 ? 'mes con movimientos' : 'meses con movimientos'}</p></div><div><p className="text-[11px] text-slate-500">Mayor gasto</p><p className="mt-1 text-sm font-semibold">{maxMonth ? labelMonth(maxMonth.key) + ' · ' + fmt(maxMonth.expenses) : 'Sin gastos'}</p></div><div><p className="text-[11px] text-slate-500">Menor gasto con movimientos</p><p className="mt-1 text-sm font-semibold">{minMonth ? labelMonth(minMonth.key) + ' · ' + fmt(minMonth.expenses) : 'Sin gastos'}</p></div><div><p className="text-[11px] text-slate-500">Tendencia entre meses activos</p><p className={'mt-1 text-sm font-semibold ' + (direction === null ? 'text-slate-500' : direction > 0 ? 'text-rose-600' : direction < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500')}>{direction === null ? 'Datos insuficientes' : direction > 0 ? 'Subió ' + fmt(direction) : direction < 0 ? 'Bajó ' + fmt(Math.abs(direction)) : 'Sin variación'}</p></div></div>
        </>}
      </section>}


    </div>
  </div>;
};

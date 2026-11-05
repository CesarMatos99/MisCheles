import { evolutionMonthCount } from '../../domain/analyticsFilterContract';
import { AnalyticsFilters, type AnalyticsFiltersValue } from './AnalyticsFilters';
import { focusedBreakdown } from '../../domain/analyticsBreakdown';
import { analyticsMonthStats, analyticsRangeSummary, analyticsCategoryTotals } from '../../domain/analyticsQueries';
import { buildFinancialInsights } from '../../domain/financialInsights';
import { filterAnalyticsMovements } from '../../domain/analyticsMovementFilter';
import { parseCalendarDay } from '../../domain/calendarDay';
import type { AnalyticsReport } from '../../domain/analyticsReport';
import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Lightbulb, SlidersHorizontal, TrendingDown, TrendingUp, Wallet, PiggyBank, ReceiptText, ArrowUpRight } from 'lucide-react';
import { MonthConfig, SavingsGoal, SavingsMovement, Transaction, UserProfile } from '../../types';
import { MONTH_NAMES_ES } from '../../constants/categories';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';
import { analyticsFilterSummaryLabels } from '../../i18n/analyticsFilterLabels';
import { PageHeader } from '../../components/layout/PageHeader';
import { PeriodSelector } from '../../components/layout/PeriodSelector';
import { ExportButton } from '../../components/ui/ExportButton';
import { isSavingsContributionTransaction } from '../../domain/financialClassification';

type Mode = 'month' | 'year' | '6m' | '12m' | 'custom';
type Section = 'summary' | 'categories' | 'compare' | 'evolution';
type Range = { start: Date; end: Date };
type Budget = { category: string; amount: number };
interface Props {
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
  return <div className={'min-w-0 border-b border-slate-200/80 dark:border-slate-800/80 ' + (featured ? 'py-4 sm:py-5' : 'py-2.5 sm:py-3')}><div className="flex items-center justify-between gap-2"><span className={featured ? 'text-xs font-medium text-slate-500 dark:text-slate-400' : 'text-[11px] text-slate-500 dark:text-slate-400'}>{label}</span>{Icon && <span className={'flex h-7 w-7 items-center justify-center rounded-full ' + colors[color]}><Icon className="h-4 w-4" /></span>}</div><p className={(featured ? 'mt-1.5 text-2xl sm:text-[1.7rem]' : 'mt-1 text-sm sm:text-base') + ' font-bold tracking-tight text-app-foreground'}>{value}</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{hint}</p></div>;
}
function Heading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="flex items-end justify-between gap-3 border-b border-slate-200/80 pb-3 dark:border-slate-800/80"><div><h3 className="text-base font-semibold text-app-foreground">{title}</h3>{detail && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}</div>{action}</div>;
}

export const AnalyticsView: React.FC<Props> = ({ year, month, transactions: allTransactions, savingsMovements: allSavingsMovements, savingsGoals, monthConfigs, categoryBudgetsByMonth, profile, onOpenExportModal }) => {
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
  const [section, setSection] = useState<Section>('summary');
  const [sort, setSort] = useState<'high' | 'low' | 'name'>('high');
  const [firstKey, setFirstKey] = useState(keyFor(startMonth(year, month)));
  const [secondKey, setSecondKey] = useState(keyFor(startMonth(year, month - 1)));
  const [trendMonths, setTrendMonths] = useState<6 | 12>(6);
  const filterSummary = analyticsFilterSummaryLabels(language, category, movementType);
  const fmt = (n: number) => money(n, profile.currency);
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
  const comparisonLabel = 'Comparado con ' + labelMonth(secondKey).toLocaleLowerCase('es-DO').replace(/^(\p{L}+) (\d{4})$/u, '$1 de $2');

  const compareYears = useMemo(() => {
    const years = new Set([...Object.keys(monthConfigs).map(key => Number(key.slice(0, 4))), ...transactions.map(tx => Number(tx.date.slice(0, 4))), ...savingsMovements.map(sm => Number(sm.date.slice(0, 4))), y]);
    const currentYear = new Date().getFullYear();
    for (let offset = -10; offset <= 3; offset++) years.add(currentYear + offset);
    return Array.from(years).filter(Number.isFinite).sort((a, b) => b - a);
  }, [monthConfigs, transactions, savingsMovements, y]);
  const [firstYearPart, firstMonthPart] = firstKey.split('-').map(Number);
  const [secondYearPart, secondMonthPart] = secondKey.split('-').map(Number);

  const totals = analyticsCategoryTotals(visibleTx, visibleSavings);
  const categoryRows = Array.from(totals, ([name, amount]) => ({ name, amount, share: totalExpenses ? amount / totalExpenses * 100 : 0 }));
  const budgetByCategory = new Map<string, number>();
  Object.entries(categoryBudgetsByMonth).filter(([key]) => { const [yy, mm] = key.split('-').map(Number); return startMonth(yy, mm) >= safeRange.start && endMonth(yy, mm) <= safeRange.end; }).forEach(([, budgets]) => (budgets || []).forEach(b => budgetByCategory.set(b.category, (budgetByCategory.get(b.category) || 0) + b.amount)));
  const focusedRows = movementType === 'income' || movementType === 'savings' ? focusedBreakdown(movementType, visibleTx, visibleSavings) : [];
  const displayCategories = [...categoryRows];
  budgetByCategory.forEach((_, name) => { if ((category === 'Todas' || category === name) && !totals.has(name)) displayCategories.push({ name, amount: 0, share: 0 }); });
  displayCategories.sort((a, b) => sort === 'high' ? b.amount - a.amount : sort === 'low' ? a.amount - b.amount : a.name.localeCompare(b.name, 'es'));
  const topCategory = [...categoryRows].sort((a, b) => b.amount - a.amount)[0];
  const leastCategory = [...categoryRows].sort((a, b) => a.amount - b.amount)[0];

  const getMonthStats = (key: string, dayLimit?: number, selectedRange?: Range) => {
    const [yy, mm] = key.split('-').map(Number);
    const selected = selectedRange || { start: startMonth(yy, mm), end: dayLimit ? new Date(yy, mm - 1, Math.min(dayLimit, new Date(yy, mm, 0).getDate())) : endMonth(yy, mm) };
    return analyticsMonthStats({ monthKey: key, transactions, savingsMovements, monthConfigs, category, includeInitialIncome, range: selected });
  };
  const comparisonIsPartial = firstKey === keyFor(today()) || secondKey === keyFor(today());
  const comparisonDay = comparisonIsPartial ? today().getDate() : undefined;
  const aStats = getMonthStats(firstKey, comparisonDay);
  const bStats = getMonthStats(secondKey, comparisonDay);
  const difference = bStats.expenses - aStats.expenses;
  const change = aStats.expenses ? difference / aStats.expenses * 100 : null;
  const compareCats = Array.from(new Set([...aStats.cats.keys(), ...bStats.cats.keys()])).map(name => ({ name, a: aStats.cats.get(name) || 0, b: bStats.cats.get(name) || 0 })).sort((a, b) => Math.abs(b.b - b.a) - Math.abs(a.b - a.a));

  const effectiveTrendMonths = evolutionMonthCount(mode);
  const evolutionKeys = mode === 'year'
    ? Array.from({ length: 12 }, (_, index) => keyFor(startMonth(y, index + 1)))
    : mode === 'custom'
      ? Array.from({ length: Math.max(1, (safeRange.end.getFullYear() - safeRange.start.getFullYear()) * 12 + safeRange.end.getMonth() - safeRange.start.getMonth() + 1) }, (_, index) => keyFor(moveMonth(startMonth(safeRange.start.getFullYear(), safeRange.start.getMonth() + 1), index)))
      : Array.from({ length: effectiveTrendMonths }, (_, index) => keyFor(moveMonth(startMonth(y, m), index - effectiveTrendMonths + 1)));
  const monthSeries = evolutionKeys.map(key => {
    const [seriesYear, seriesMonth] = key.split('-').map(Number);
    const clip = mode === 'custom' ? { start: safeRange.start > startMonth(seriesYear, seriesMonth) ? safeRange.start : startMonth(seriesYear, seriesMonth), end: safeRange.end < endMonth(seriesYear, seriesMonth) ? safeRange.end : endMonth(seriesYear, seriesMonth) } : undefined;
    return { key, label: (MONTH_NAMES_ES[seriesMonth - 1] || '').slice(0, 3), ...getMonthStats(key, undefined, clip) };
  });
  const maxSeries = Math.max(1, ...monthSeries.map(i => Math.max(i.income, i.expenses, i.saved)));
  const avgExpense = monthSeries.reduce((s, i) => s + i.expenses, 0) / Math.max(1, monthSeries.length);
  const maxMonth = [...monthSeries].sort((a, b) => b.expenses - a.expenses)[0];
  const minMonth = [...monthSeries].filter(i => i.expenses > 0).sort((a, b) => a.expenses - b.expenses)[0];
  const direction = monthSeries.length > 1 ? monthSeries[monthSeries.length - 1].expenses - monthSeries[0].expenses : 0;

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
    averageExpenses: avgExpense,
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
  const borderSection = 'space-y-4 border-b border-slate-200/80 pb-5 dark:border-slate-800/80';

  const makeReport = (): AnalyticsReport => {
    const report: AnalyticsReport = {
        breakdown: { title: movementType === 'income' ? 'Ingresos registrados por categoría' : movementType === 'savings' ? 'Destinos de aportes' : 'Gastos por categoría',
          rows: (movementType === 'income' || movementType === 'savings' ? focusedRows : displayCategories).map(row => [row.name, fmt(row.amount), percent(row.share)] as [string, string, string]) },
        period: rangeLabel + ' · ' + filterSummary.movementType, category: filterSummary.category, transactions: visibleTx, savingsMovements: visibleSavings,
        metrics: [['Ingresos', fmt(totalIncome)], ['Gastos de consumo', fmt(totalExpenses)],
          ['Destinado a ahorro', fmt(deposits)], ['Disponible', fmt(available)],
          ['Gastos respecto a ingresos', percent(spentPercent)], ['Ingresos enviados a ahorro', percent(savedPercent)],
          ['Promedio diario', fmt(dailyAverage)], ['Movimientos', String(movementCount)]],
      };
    if (section === 'compare') {
      report.period = labelMonth(firstKey) + ' frente a ' + labelMonth(secondKey) + (comparisonDay ? ' · hasta el día ' + comparisonDay : '');
      report.metrics = [['Período A', labelMonth(firstKey)], ['Período B', labelMonth(secondKey)]];
      report.breakdown = undefined; report.transactions = []; report.savingsMovements = [];
      report.tables = [{
        title: 'Comparación de indicadores',
        headers: ['Indicador', 'A', 'B', 'Diferencia B − A', 'Variación'],
        rows: [['Ingresos', aStats.income, bStats.income], ['Gastos', aStats.expenses, bStats.expenses], ['Aportes', aStats.saved, bStats.saved]].map(([name, first, second]) => {
          const firstValue = Number(first), secondValue = Number(second);
          return [String(name), fmt(firstValue), fmt(secondValue), fmt(secondValue - firstValue), firstValue ? percent((secondValue - firstValue) / firstValue * 100) : 'No disponible'];
        }),
      }, { title: 'Gastos por categoría', headers: ['Categoría', 'A', 'B', 'Diferencia B − A'], rows: compareCats.map(row => [row.name, fmt(row.a), fmt(row.b), fmt(row.b - row.a)]) }];
    } else if (section === 'evolution') {
      report.period = monthSeries.length ? labelMonth(monthSeries[0].key) + ' – ' + labelMonth(monthSeries[monthSeries.length - 1].key) : rangeLabel;
      report.metrics = []; report.breakdown = undefined; report.transactions = []; report.savingsMovements = [];
      report.tables = [{ title: 'Evolución financiera', headers: ['Mes', 'Ingresos', 'Gastos', 'Aportes'], rows: monthSeries.map(row => [labelMonth(row.key), fmt(row.income), fmt(row.expenses), fmt(row.saved)]) }];
    }
    return report;
  };

  return <div className="mx-auto w-full max-w-5xl animate-in fade-in duration-200">
    <PageHeader title="Tus estadísticas" period={section === 'compare' ? <span className="type-secondary whitespace-nowrap">{labelMonth(firstKey)} vs {labelMonth(secondKey)}</span> : mode === 'custom' ? <span className="type-secondary whitespace-nowrap">{labelDate(safeRange.start)} – {labelDate(safeRange.end)}</span> : mode === 'year' ? <span className="min-h-11 px-3 text-sm font-semibold">{y}</span> : <PeriodSelector year={y} month={m} onMonthChange={(nextYear, nextMonth) => { setY(nextYear); setM(nextMonth); }} />} actions={<ExportButton disabled={invalidRange || (section === 'compare' && firstKey === secondKey)} onClick={() => onOpenExportModal(makeReport())} />} />
    <section className="flex items-center gap-3 border-b border-slate-200/80 py-3 dark:border-slate-800/80">
      <button type="button" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:hover:bg-slate-800"><SlidersHorizontal className="h-4 w-4" />Filtros</button>
    </section>
    {filtersOpen && <AnalyticsFilters value={{ mode, year: y, month: m, from, to, category, movementType, firstKey, secondKey }}
      defaults={{ mode: 'month', year, month, from: dayKey(startMonth(year, month)), to: dayKey(endMonth(year, month)), category: 'Todas', movementType: 'all', firstKey: keyFor(startMonth(year, month)), secondKey: keyFor(startMonth(year, month - 1)) }}
      categoriesByType={{ all: [...new Set([...allTransactions.filter(tx => !isSavingsContributionTransaction(tx)).map(tx => tx.category), ...allSavingsMovements.filter(sm => sm.type === 'direct_expense').map(sm => sm.category || 'Otros')])].sort(), income: [...new Set(allTransactions.filter(tx => tx.type === 'income' && !isSavingsContributionTransaction(tx)).map(tx => tx.category))].sort(), expense: [...new Set([...allTransactions.filter(tx => tx.type === 'expense' && !isSavingsContributionTransaction(tx)).map(tx => tx.category), ...allSavingsMovements.filter(sm => sm.type === 'direct_expense').map(sm => sm.category || 'Otros')])].sort(), savings: [] }}
      comparing={section === 'compare'} onClose={() => setFiltersOpen(false)}
      onApply={(filters: AnalyticsFiltersValue) => { setMode(filters.mode); setY(filters.year); setM(filters.month); setFrom(filters.from); setTo(filters.to); setCategory(filters.category); setMovementType(filters.movementType); setFirstKey(filters.firstKey); setSecondKey(filters.secondKey); setFiltersOpen(false); }} />}
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200/80 py-2 dark:border-slate-800/80" aria-label="Apartados">{sections.map(s => { const Icon = s.icon; return <button key={s.id} onClick={() => setSection(s.id)} aria-current={section === s.id ? 'page' : undefined} className={'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ' + (section === s.id ? 'bg-primary/10 font-semibold text-primary' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800')}><Icon className="h-4 w-4" />{s.label}</button>; })}</nav>

    <div className="space-y-5 pt-4">
      {invalidRange && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">Introduce fechas válidas y una fecha final igual o posterior al inicio para consultar y exportar resultados.</p>}
      {!invalidRange && section === 'summary' && <>
        <section aria-label="Resumen financiero" className="grid grid-cols-2 gap-x-5 sm:grid-cols-4">
          <Metric featured label="Ingresos" value={fmt(totalIncome)} hint="Dinero inicial del período + ingresos registrados" icon={ArrowUpRight} color="blue" />
          <Metric featured label="Gastos" value={fmt(totalExpenses)} hint="Incluye pagos reales hechos desde ahorros" icon={ReceiptText} color="red" />
          <Metric featured label="Destinado a ahorro" value={category === 'Todas' ? fmt(deposits) : '—'} hint="Aportes internos; no se cuentan como gasto" icon={PiggyBank} color="green" />
          <Metric featured label="Dinero disponible" value={fmt(available)} hint="Saldo inicial + entradas − gastos del mes − aportes" icon={Wallet} color={available < 0 ? 'red' : 'slate'} />
        </section>
        <section aria-label="Indicadores complementarios" className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
          <Metric label="Gastos respecto a ingresos" value={percent(spentPercent)} hint="Gastos reales ÷ ingresos del período" />
          <Metric label="Ingresos enviados a ahorro" value={category === 'Todas' ? percent(savedPercent) : '—'} hint="Aportes ÷ ingresos del período" />
          <Metric label="Promedio diario" value={fmt(dailyAverage)} hint={elapsedDays + ' días contabilizados'} />
          <Metric label="Movimientos" value={movementCount.toLocaleString('es-DO')} hint="Ingresos, gastos y acciones de ahorro" />
        </section>
        {category !== 'Todas' && <p className="border-b border-slate-200/80 pb-3 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">El saldo inicial y las transferencias sin categoría no se atribuyen a este filtro.</p>}
        <section aria-label="Consejos de MisCheles" className={borderSection}>
          <Heading title="Consejos de MisCheles" detail="Recomendaciones generadas con tus movimientos y presupuestos reales." />
          {movementType !== 'all' || category !== 'Todas' ? <p className="py-3 text-xs text-slate-500">Selecciona todos los tipos y categorías para recibir consejos sobre el período completo.</p> : !tips.length ? <p className="py-3 text-xs text-slate-500 dark:text-slate-400">Aún no hay suficientes movimientos para identificar oportunidades.</p> : <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">{tips.slice(0, 4).map((tip, i) => <article key={i} className="flex gap-3 py-3"><span className={'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ' + (tip.color === 'red' ? 'bg-rose-500/10 text-rose-600' : tip.color === 'amber' ? 'bg-amber-500/10 text-amber-600' : tip.color === 'green' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary')}><Lightbulb className="h-4 w-4" /></span><div className="min-w-0"><h4 className="text-sm font-semibold">{tip.title}</h4><p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{tip.detail}</p>{tip.value && <p className="mt-1 text-xs font-semibold">{tip.value}</p>}</div></article>)}</div>}
        </section>
        <section className={borderSection}><Heading title="Lectura rápida" detail={'Gastos por categoría · ' + rangeLabel} /><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-slate-500">Mayor gasto</p><p className="mt-1 text-sm font-semibold">{topCategory ? localizeCategoryName(language, topCategory.name) + ' · ' + fmt(topCategory.amount) : 'Aún no hay gastos registrados'}</p></div><div><p className="text-xs text-slate-500">Menor gasto con movimientos</p><p className="mt-1 text-sm font-semibold">{leastCategory ? localizeCategoryName(language, leastCategory.name) + ' · ' + fmt(leastCategory.amount) : 'Aún no hay gastos registrados'}</p></div></div></section>
      </>}
      {!invalidRange && section === 'categories' && (movementType === 'all' || movementType === 'expense') && <section className={borderSection}><Heading title="Gastos por categoría" detail={mode === 'custom' ? 'Los presupuestos se comparan cuando el período incluye el mes completo.' : 'Gasto real frente al presupuesto asignado.'} action={<select aria-label="Ordenar categorías" value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="h-9 rounded-lg border border-slate-200 bg-transparent px-2 text-xs dark:border-slate-700"><option value="high">Mayor gasto</option><option value="low">Menor gasto</option><option value="name">Nombre</option></select>} />{!displayCategories.length ? <p className="py-8 text-center text-sm text-slate-500">No hay gastos ni presupuestos en este período.</p> : <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">{displayCategories.map((c, rank) => { const budget = budgetByCategory.get(c.name) || 0; const remain = budget - c.amount; return <div key={c.name} className="space-y-2 py-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-semibold"><span className="mr-1.5 text-xs tabular-nums text-slate-400">{rank + 1}.</span>{localizeCategoryName(language, c.name)}</p><p className="mt-1 text-xs text-slate-500">{fmt(c.amount)} gastados · {percent(c.share)} del total</p></div><div className="text-right"><p className={'text-sm font-semibold ' + (budget && remain < 0 ? 'text-rose-600' : '')}>{budget ? remain < 0 ? 'Excedido ' + fmt(-remain) : 'Restan ' + fmt(remain) : fmt(c.amount)}</p><p className="mt-1 text-[11px] text-slate-500">{budget ? fmt(budget) + ' asignados' : 'Sin monto asignado'}</p></div></div><div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className={'h-full rounded-full ' + (budget && c.amount > budget ? 'bg-rose-500' : 'bg-primary')} style={{ width: clamp(budget ? c.amount / budget * 100 : c.share, 2, 100) + '%' }} /></div></div>; })}</div>}</section>}

      {!invalidRange && section === 'categories' && (movementType === 'income' || movementType === 'savings') && <section className={borderSection}>
        <Heading title={movementType === 'income' ? 'Ingresos registrados por categoría' : 'Destinos de los aportes'}
          detail={movementType === 'income' ? 'Incluye ingresos registrados con categoría; el monto inicial se consulta en Resumen.' : 'Incluye aportes a ahorro general y metas. Los retiros no se restan de este ranking de aportes.'} />
        {!focusedRows.length ? <p className="py-4 text-sm text-slate-500">No hay movimientos de este tipo para los filtros seleccionados.</p> :
          <div className="divide-y divide-slate-200 dark:divide-slate-800">{focusedRows.map((row, index) => <article key={row.id} className="space-y-2 py-3">
            <div className="flex justify-between gap-3"><p className="text-sm font-semibold">{index + 1}. {row.name}</p><p className="text-sm font-semibold">{fmt(row.amount)}</p></div>
            <p className="text-xs text-slate-500">{percent(row.share)} del total {movementType === 'income' ? 'registrado' : 'aportado'}</p>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{ width: row.share + '%' }} /></div>
          </article>)}</div>}
      </section>}
      {!invalidRange && section === 'compare' && <section className={borderSection}><Heading title="Comparar períodos" detail="Compara gastos, ingresos, ahorro y categorías entre meses." />{firstKey === secondKey ? <p className="text-xs text-amber-700">Elige meses distintos.</p> : <><div className="space-y-3 border-y border-slate-200 py-4 dark:border-slate-800">{[{ label: 'Gastos', a: aStats.expenses, b: bStats.expenses, favorable: 'down' }, { label: 'Ingresos', a: aStats.income, b: bStats.income, favorable: 'up' }, { label: 'Ahorro', a: aStats.saved, b: bStats.saved, favorable: 'up' }].map(metric => { const delta = metric.b - metric.a; const variation = metric.a ? delta / metric.a * 100 : null; const positive = metric.favorable === 'up' ? delta > 0 : delta < 0; return <div key={metric.label} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold">{metric.label}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{labelMonth(firstKey)} {fmt(metric.a)} <span className="px-1">→</span> {labelMonth(secondKey)} {fmt(metric.b)}</p></div><div className="shrink-0 text-right"><p className={'text-xs font-semibold ' + (delta ? positive ? 'text-emerald-600' : 'text-rose-600' : 'text-slate-500')}>{delta > 0 ? '+' : ''}{fmt(delta)}</p><p className="mt-0.5 text-[10px] text-slate-500">{variation === null ? 'Variación no disponible' : (delta > 0 ? '+' : '') + percent(variation)}</p></div></div>; })}</div><p className="text-xs text-slate-500">Comparación de gastos por categoría</p>{comparisonIsPartial && <p className="text-xs text-amber-700 dark:text-amber-300">Un período está en curso. Ambos meses se comparan hasta el día {comparisonDay} para usar el mismo número de días.</p>}<div className="space-y-3">{compareCats.length ? compareCats.map(c => { const max = Math.max(c.a, c.b, 1); const diff = c.b - c.a; return <div key={c.name}><div className="flex justify-between gap-2 text-xs"><span className="truncate font-medium">{localizeCategoryName(language, c.name)}</span><span className={diff > 0 ? 'text-rose-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-500'}>{diff ? (diff > 0 ? '+' : '') + fmt(diff) : 'Sin cambio'}</span></div><div className="mt-2 grid gap-2"><div className="grid grid-cols-[1.5rem_1fr] items-center gap-2"><span className="text-[10px] text-slate-500">A</span><div title={labelMonth(firstKey) + ' · ' + fmt(c.a)} className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-slate-400 dark:bg-slate-500" style={{ width: (c.a ? clamp(c.a / max * 100, 2, 100) : 0) + '%' }} /></div></div><div className="grid grid-cols-[1.5rem_1fr] items-center gap-2"><span className="text-[10px] text-slate-500">B</span><div title={labelMonth(secondKey) + ' · ' + fmt(c.b)} className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{ width: (c.b ? clamp(c.b / max * 100, 2, 100) : 0) + '%' }} /></div></div></div><div className="flex justify-between text-[10px] text-slate-500"><span>{fmt(c.a)}</span><span>{fmt(c.b)}</span></div></div>; }) : <p className="py-5 text-center text-xs text-slate-500">No hay gastos en los meses elegidos.</p>}</div><p className="text-[11px] text-slate-500">Barras: {labelMonth(firstKey)} (gris) · {labelMonth(secondKey)} (color principal)</p></>}</section>}

      {!invalidRange && section === 'evolution' && <section className={borderSection}><Heading title="Evolución financiera" detail="Ingresos, gastos y aportes a ahorro por mes." action={undefined} /><div className="flex gap-4 text-[11px] text-slate-500"><span>● Ingresos</span><span className="text-rose-500">● Gastos</span><span className="text-emerald-600">● Ahorro</span></div><div className="flex h-44 items-end gap-1 border-b border-slate-200 pb-6 dark:border-slate-800 sm:gap-2">{monthSeries.map(i => <div key={i.key} title={labelMonth(i.key) + ': ingresos ' + fmt(i.income) + ', gastos ' + fmt(i.expenses) + ', ahorro ' + fmt(i.saved)} className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">{[[i.income, 'bg-primary'], [i.expenses, 'bg-rose-400'], [i.saved, 'bg-emerald-500']].map(([value, color], idx) => <div key={idx} className={'w-full max-w-4 rounded-t-sm ' + color} style={{ height: Math.max(Number(value) ? 3 : 0, Number(value) / maxSeries * 100) + '%' }} />)}<span className="absolute -bottom-5 text-[9px] text-slate-500">{i.label}</span></div>)}</div><div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4"><div><p className="text-[11px] text-slate-500">Promedio mensual de gastos</p><p className="mt-1 text-sm font-semibold">{fmt(avgExpense)}</p></div><div><p className="text-[11px] text-slate-500">Mayor gasto</p><p className="mt-1 text-sm font-semibold">{maxMonth?.expenses ? labelMonth(maxMonth.key) + ' · ' + fmt(maxMonth.expenses) : 'Sin datos'}</p></div><div><p className="text-[11px] text-slate-500">Menor gasto con movimientos</p><p className="mt-1 text-sm font-semibold">{minMonth ? labelMonth(minMonth.key) + ' · ' + fmt(minMonth.expenses) : 'Sin datos'}</p></div><div><p className="text-[11px] text-slate-500">Tendencia</p><p className={'mt-1 text-sm font-semibold ' + (direction > 0 ? 'text-rose-600' : direction < 0 ? 'text-emerald-600' : '')}>{direction > 0 ? 'Subió ' : direction < 0 ? 'Bajó ' : 'Estable '}{fmt(Math.abs(direction))}</p></div></div></section>}


    </div>
  </div>;
};

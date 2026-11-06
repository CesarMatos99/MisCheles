import { ModalShell } from '../ui/ModalShell';
import { ModalSurface } from '../ui/ModalSurface';
import type { AnalyticsReport } from '../../domain/analyticsReport';
import { buildConfiguredReport, type ExportPeriod, type ExportFilters, type ExportSection } from '../../domain/configuredReport';
import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import type { CategoryBudget, MonthConfig, SavingsGoal, SavingsMovement, Transaction, UserProfile } from '../../types';
import { exportService } from '../../services/exportService';

interface ExportModalProps {
  analyticsReport?: AnalyticsReport;
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  allTransactions: Transaction[];
  allSavingsMovements: SavingsMovement[];
  monthConfigs: Record<string, MonthConfig>;
  budgetsByMonth: Record<string, CategoryBudget[]>;
  savingsGoals: SavingsGoal[];
  profile: UserProfile;
}
const SECTION_OPTIONS: Array<{ id: ExportSection; label: string }> = [
  { id: 'summary', label: 'Resumen financiero' },
  { id: 'income', label: 'Ingresos' },
  { id: 'expenses', label: 'Gastos y categorías' },
  { id: 'movements', label: 'Movimientos' },
  { id: 'savings', label: 'Ahorros' },
  { id: 'goals', label: 'Metas' },
  { id: 'budgets', label: 'Presupuestos' },
  { id: 'statistics', label: 'Estadísticas del período' },
];
const DEFAULT_SECTIONS: ExportSection[] = ['summary', 'income', 'expenses', 'movements', 'savings', 'goals', 'budgets'];
const dateKey = (year: number, month: number, day: number) => year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');

export const ExportModal: React.FC<ExportModalProps> = ({ analyticsReport, isOpen, onClose, year, month, allTransactions, allSavingsMovements, monthConfigs, budgetsByMonth, savingsGoals, profile }) => {
  const [exportError, setExportError] = useState('');
  const [format, setFormat] = useState<'excel' | 'pdf'>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [periodMode, setPeriodMode] = useState<'month' | 'year' | 'range'>('month');
  const [periodYear, setPeriodYear] = useState(year);
  const [periodMonth, setPeriodMonth] = useState(month);
  const [from, setFrom] = useState(dateKey(year, month, 1));
  const [to, setTo] = useState(dateKey(year, month, new Date(year, month, 0).getDate()));
  const [filters, setFilters] = useState<ExportFilters>({ type: 'all', category: 'all', paymentMethod: 'all', goalStatus: 'all' });
  const [sections, setSections] = useState<ExportSection[]>(DEFAULT_SECTIONS);
  const years = useMemo(() => {
    const values = new Set([year, ...Object.keys(monthConfigs).map(key => Number(key.slice(0, 4))), ...allTransactions.map(item => Number(item.date.slice(0, 4))), ...allSavingsMovements.map(item => Number(item.date.slice(0, 4)))]);
    return [...values].filter(Number.isFinite).sort((a, b) => b - a);
  }, [year, monthConfigs, allTransactions, allSavingsMovements]);
  const categories = useMemo(() => [...new Set([...allTransactions.map(item => item.category), ...allSavingsMovements.filter(item => item.type === 'direct_expense').map(item => item.category || 'Otros')])].sort((a, b) => a.localeCompare(b, 'es')), [allTransactions, allSavingsMovements]);
  const paymentMethods = useMemo(() => [...new Set(allTransactions.map(item => item.paymentMethod).filter(Boolean))].sort(), [allTransactions]);

  useEffect(() => {
    if (!isOpen) return;
    setExportError('');
    const query = analyticsReport?.query;
    const mode = query?.mode;
    setPeriodMode(mode === 'month' ? 'month' : mode === 'year' ? 'year' : query ? 'range' : 'month');
    setPeriodYear(query?.year ?? year);
    setPeriodMonth(query?.month ?? month);
    setFrom(query?.from || dateKey(year, month, 1));
    setTo(query?.to || dateKey(year, month, new Date(year, month, 0).getDate()));
    setFilters({ type: query?.movementType || 'all', category: query?.category && query.category !== 'Todas' ? query.category : 'all', paymentMethod: 'all', goalStatus: 'all' });
    setSections(analyticsReport ? ['statistics'] : DEFAULT_SECTIONS);
  }, [isOpen, analyticsReport, year, month]);

  if (!isOpen) return null;
  const period: ExportPeriod = { mode: periodMode, year: periodYear, month: periodMonth, from, to };
  const selectedReport = buildConfiguredReport({ period, filters, sections, transactions: allTransactions, savingsMovements: allSavingsMovements, monthConfigs, budgetsByMonth, goals: savingsGoals });
  const periodLabel = selectedReport?.period || 'Revisa las fechas seleccionadas';
  const movementCount = (selectedReport?.transactions.length || 0) + (selectedReport?.savingsMovements.length || 0);
  const toggleSection = (section: ExportSection) => setSections(current => current.includes(section) ? current.filter(item => item !== section) : [...current, section]);
  const selectFullReport = () => setSections(SECTION_OPTIONS.map(item => item.id));
  const handleExport = () => {
    if (isExporting) return;
    if (!selectedReport) { setExportError('Selecciona un período válido y al menos una sección.'); return; }
    setExportError('');
    setIsExporting(true);
    try { exportService.exportAnalytics(selectedReport, format, profile); onClose(); }
    catch (error) { setExportError(error instanceof Error ? error.message : 'No se pudo generar el reporte. Inténtalo de nuevo.'); }
    finally { setIsExporting(false); }
  };
  return <ModalShell title="Generar reporte" onClose={onClose} size="lg">
    <ModalSurface scroll="auto">
      <div className="space-y-5 p-4 sm:p-5">
        <section className="space-y-3" aria-labelledby="report-period-title">
          <h3 id="report-period-title" className="text-sm font-semibold">Período</h3>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Seleccionar período">
            {([{ id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' }, { id: 'range', label: 'Rango' }] as const).map(item => <button key={item.id} type="button" aria-pressed={periodMode === item.id} onClick={() => setPeriodMode(item.id)} className={'min-h-10 rounded-lg px-3 text-sm font-medium ' + (periodMode === item.id ? 'bg-primary text-white' : 'border border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200')}>{item.label}</button>)}
          </div>
          {periodMode === 'month' && <div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Mes<select value={periodMonth} onChange={event => setPeriodMonth(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700">{Array.from({ length: 12 }, (_, i) => i + 1).map(value => <option key={value} value={value}>{new Intl.DateTimeFormat('es-DO', { month: 'long' }).format(new Date(2020, value - 1, 1))}</option>)}</select></label><label className="text-xs font-medium">Año<select value={periodYear} onChange={event => setPeriodYear(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700">{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>}
          {periodMode === 'year' && <label className="block text-xs font-medium">Año<select value={periodYear} onChange={event => setPeriodYear(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700">{years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}
          {periodMode === 'range' && <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="sr-only">Fechas del reporte</legend><label className="text-xs font-medium">Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700" /></label><label className="text-xs font-medium">Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700" /></label></fieldset>}
        </section>
        <section className="space-y-3" aria-labelledby="report-sections-title">
          <div className="flex items-center justify-between gap-3"><h3 id="report-sections-title" className="text-sm font-semibold">Información del reporte</h3><button type="button" onClick={selectFullReport} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/5">Reporte completo</button></div>
          <div className="grid gap-2 sm:grid-cols-2">{SECTION_OPTIONS.map(item => <label key={item.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700"><input type="checkbox" checked={sections.includes(item.id)} onChange={() => toggleSection(item.id)} className="h-4 w-4 accent-primary" />{item.label}</label>)}</div>
        </section>
        <section className="space-y-3" aria-labelledby="report-filters-title">
          <h3 id="report-filters-title" className="text-sm font-semibold">Filtros</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium">Tipo de movimiento<select value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value as ExportFilters['type'] }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700"><option value="all">Todos</option><option value="income">Ingresos</option><option value="expense">Gastos</option><option value="savings">Ahorros</option></select></label>
            {filters.type !== 'savings' && <label className="text-xs font-medium">Categoría<select value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700"><option value="all">Todas</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}
            {(filters.type === 'all' || filters.type === 'income' || filters.type === 'expense') && <label className="text-xs font-medium">Método de pago<select value={filters.paymentMethod} onChange={event => setFilters(current => ({ ...current, paymentMethod: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700"><option value="all">Todos</option>{paymentMethods.map(item => <option key={item} value={item}>{item}</option>)}</select></label>}
            {sections.includes('goals') && !sections.includes('statistics') && <label className="text-xs font-medium">Estado de las metas<select value={filters.goalStatus} onChange={event => setFilters(current => ({ ...current, goalStatus: event.target.value as ExportFilters['goalStatus'] }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm dark:border-slate-700"><option value="all">Todos los estados</option><option value="active">En progreso</option><option value="completed">Completadas</option><option value="overdue">Vencidas</option></select></label>}
          </div>
        </section>
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm" aria-live="polite"><p className="font-semibold">Vista previa</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{periodLabel} · {sections.includes('statistics') ? 'Reporte completo' : sections.length + ' sección(es)'} · {movementCount} movimientos incluidos en detalle</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">El archivo se genera en este dispositivo. No se envían tus datos financieros a servicios externos.</p></section>
        <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setFormat('pdf')} aria-pressed={format === 'pdf'} className={'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ' + (format === 'pdf' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700')}><FileText className="h-4 w-4" />PDF</button><button type="button" onClick={() => setFormat('excel')} aria-pressed={format === 'excel'} className={'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ' + (format === 'excel' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700')}><FileSpreadsheet className="h-4 w-4" />Excel</button></div>
        {exportError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{exportError}</p>}
        <button type="button" disabled={!selectedReport || isExporting} onClick={handleExport} className="btn-primary flex w-full items-center justify-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />{isExporting ? 'Generando…' : 'Descargar reporte'}</button>
      </div>
    </ModalSurface>
  </ModalShell>;
};

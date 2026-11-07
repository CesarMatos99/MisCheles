import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  Receipt,
  X,
  PiggyBank,
} from 'lucide-react';
import { SavingsMovement, Transaction, UserProfile } from '../../types';
import { PeriodSelector } from '../../components/layout/PeriodSelector';
import { PageHeader } from '../../components/layout/PageHeader';
import { ExportButton } from '../../components/ui/ExportButton';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';
import { FilterPanel } from '../../components/ui/FilterPanel';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
import { DEFAULT_TRANSACTION_FILTERS, filterTransactionRecords, isTransactionFilterRangeValid, readTransactionFilters, type TransactionFilterCriteria } from '../../domain/transactionFilters';
import { isSavingsContributionTransaction } from '../../domain/financialClassification';
import { paginate, TRANSACTION_PAGE_SIZES } from '../../domain/transactionPagination';

interface TransactionsViewProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  profile: UserProfile;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenExportModal: () => void;
  initialCategoryFilter?: string | null;
  onCategoryFilterChange?: (category: string | null) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  year,
  month,
  onMonthChange,
  transactions,
  savingsMovements,
  profile,
  onEditTransaction,
  onDeleteTransaction,
  onOpenExportModal,
  initialCategoryFilter = null,
  onCategoryFilterChange,
}) => {
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filters, setFilters] = useState<TransactionFilterCriteria>(() => { try { return readTransactionFilters(sessionStorage.getItem('mischeles_transaction_filters_v1')); } catch { return { ...DEFAULT_TRANSACTION_FILTERS }; } });
  const [draftFilters, setDraftFilters] = useState<TransactionFilterCriteria>(filters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sort, setSort] = useState<{ key: 'date' | 'category' | 'description' | 'type' | 'amount'; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

  useEffect(() => {
    if (initialCategoryFilter) setFilters(current => ({ ...current, category: initialCategoryFilter }));
  }, [initialCategoryFilter]);

  const clearAppliedFilters = () => {
    const defaults = { ...DEFAULT_TRANSACTION_FILTERS };
    setFilters(defaults);
    setDraftFilters(defaults);
    setSearchTerm('');
    setFilterError('');
    onCategoryFilterChange?.(null);
  };

  const updateQuickFilter = (key: 'type' | 'category', value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
    setDraftFilters(current => ({ ...current, [key]: value }));
    if (key === 'category') onCategoryFilterChange?.(value === 'all' ? null : value);
  };

  const activeFilterLabels = [
    filters.type !== 'all' ? 'Tipo: ' + (filters.type === 'income' ? 'Ingresos' : filters.type === 'expense' ? 'Gastos' : 'Ahorros') : '',
    filters.category !== 'all' ? 'Categoría: ' + localizeCategoryName(language, filters.category) : '',
    filters.from ? 'Desde: ' + filters.from : '',
    filters.to ? 'Hasta: ' + filters.to : '',
    searchTerm.trim() ? 'Búsqueda: ' + searchTerm.trim() : '',
  ].filter(Boolean);
  const hasActiveFilters = activeFilterLabels.length > 0;

  const isSavingsTx = isSavingsContributionTransaction;

  const filtered = useMemo(
    () => filterTransactionRecords(transactions, filters, searchTerm, isSavingsTx, category => localizeCategoryName(language, category)),
    [transactions, filters, searchTerm, language],
  );
  const sortedTransactions = useMemo(() => {
    const records = [...filtered];
    const direction = sort.direction === 'asc' ? 1 : -1;
    records.sort((left, right) => {
      let comparison = 0;
      if (sort.key === 'amount') comparison = left.amount - right.amount;
      else if (sort.key === 'category') comparison = localizeCategoryName(language, left.category).localeCompare(localizeCategoryName(language, right.category), language);
      else if (sort.key === 'description') comparison = left.description.localeCompare(right.description, language);
      else if (sort.key === 'type') comparison = left.type.localeCompare(right.type, language);
      else comparison = left.date.localeCompare(right.date);
      if (comparison === 0) comparison = right.createdAt - left.createdAt || left.id.localeCompare(right.id);
      return comparison * direction;
    });
    return records;
  }, [filtered, language, sort]);

  const totalExpenses = filtered
    .filter((t) => t.type === 'expense' && !isSavingsTx(t))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncomes = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const selectedMonthKey = year + '-' + String(month).padStart(2, '0');
  const savingsLedger = useMemo(() => {
    const savingsMovementIds = new Set(savingsMovements.map((movement) => movement.id));
    const legacySavingsTransactions = filtered.filter((transaction) =>
      isSavingsTx(transaction) && (!transaction.relatedSavingsMovementId || !savingsMovementIds.has(transaction.relatedSavingsMovementId)),
    );
    return filters.type === 'savings' ? [
    ...savingsMovements.filter((movement) => {
      if (movement.monthKey !== selectedMonthKey) return false;
      const category = movement.category || 'Aporte al Ahorro';
      const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-DO');
      const query = normalize(searchTerm);
      const matchesSearch = !query || [movement.description, movement.goalTitle || '', category].some((value) => normalize(value).includes(query));
      const matchesCategory = filters.category === 'all' || normalize(category) === normalize(filters.category);
      return matchesSearch && matchesCategory && (!filters.from || movement.date >= filters.from) && (!filters.to || movement.date <= filters.to);
    }).map((movement) => ({
      id: movement.id,
      date: movement.date,
      description: movement.description,
      category: movement.category || (movement.type === 'deposit_from_month' ? 'Aporte al Ahorro' : movement.type === 'direct_expense' ? 'Gasto desde ahorro' : 'Ahorros'),
      amount: movement.amount,
      type: movement.type,
      goalTitle: movement.goalTitle,
      method: movement.type === 'deposit_from_month' ? 'Aporte' : movement.type === 'withdraw_to_month' ? 'Retiro' : movement.type === 'direct_expense' ? 'Gasto desde ahorro' : 'Reasignación interna',
    })),
    ...legacySavingsTransactions.map((transaction) => ({ id: 'legacy-' + transaction.id, date: transaction.date, description: transaction.description, category: transaction.category, amount: transaction.amount, type: 'deposit_from_month' as const, goalTitle: undefined, method: 'Aporte importado' })),
    ].sort((a, b) => b.date.localeCompare(a.date)) : [];
  }, [filtered, filters, isSavingsTx, searchTerm, savingsMovements, selectedMonthKey]);
  const totalSavingsFiltered = filters.type === 'savings'
    ? savingsLedger.filter((movement) => movement.type === 'deposit_from_month').reduce((sum, movement) => sum + movement.amount, 0)
    : filtered.filter(isSavingsTx).reduce((sum, transaction) => sum + transaction.amount, 0);

  // Available categories for the current month, including the real savings-ledger categories.
  const monthCategories = Array.from(new Set([
    ...transactions.map((transaction) => transaction.category),
    ...savingsMovements.filter((movement) => movement.monthKey === selectedMonthKey).map((movement) => movement.category || 'Aporte al Ahorro'),
  ]));
  const savingsPagination = paginate(savingsLedger, page, pageSize);
  const transactionPagination = paginate(sortedTransactions, page, pageSize);
  const pagination = filters.type === 'savings' ? savingsPagination : transactionPagination;
  const visibleCount = pagination.totalItems;
  useEffect(() => { setPage(1); }, [filters.type, filters.category, filters.from, filters.to, searchTerm, pageSize, selectedMonthKey, sort]);
  useEffect(() => { setPage(current => Math.min(current, pagination.totalPages)); }, [pagination.totalPages]);
  useEffect(() => { try { sessionStorage.setItem('mischeles_transaction_filters_v1', JSON.stringify(filters)); } catch { /* Optional session persistence. */ } }, [filters]);

  const sortColumn = (key: typeof sort.key, label: string, align: 'left' | 'right' = 'left') => {
    const active = sort.key === key;
    return <th key={key} scope="col" aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={'px-3 py-3 font-semibold ' + (align === 'right' ? 'text-right' : 'text-left')}>
      <button type="button" onClick={() => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))} className={'min-h-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + (align === 'right' ? 'text-right' : 'text-left')}>
        {label}{active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
      </button>
    </th>;
  };

  return (
    <div className="app-page mx-auto max-w-none pb-4 animate-in fade-in duration-200">
      <PageHeader title="Tus movimientos" period={<PeriodSelector year={year} month={month} onMonthChange={onMonthChange} />} actions={<ExportButton onClick={onOpenExportModal} />} />

      {/* Seamless Continuous Container divided by clean lines */}
      <div className="app-surface space-y-4">
        {/* Row 1: Search and Filters */}
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por concepto o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Buscar movimientos"
                className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-100 py-2 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>


            <button type="button" onClick={() => { setDraftFilters(filters); setFilterError(''); setFiltersOpen(true); }} aria-expanded={filtersOpen} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 sm:gap-2 sm:px-4"><Filter className="h-4 w-4" />Filtros</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <label className="min-w-0 text-xs font-medium text-slate-500">
              <span className="sr-only">Filtrar por tipo</span>
              <select aria-label="Filtrar por tipo" value={filters.type} onChange={event => updateQuickFilter('type', event.target.value)} className="app-field min-h-11 w-full py-2 text-sm sm:w-auto sm:min-w-36">
                <option value="all">Todos los tipos</option><option value="expense">Gastos</option><option value="income">Ingresos</option><option value="savings">Ahorros</option>
              </select>
            </label>
            <label className="min-w-0 text-xs font-medium text-slate-500">
              <span className="sr-only">Filtrar por categoría</span>
              <select aria-label="Filtrar por categoría" value={filters.category} onChange={event => updateQuickFilter('category', event.target.value)} className="app-field min-h-11 w-full truncate py-2 text-sm sm:w-auto sm:min-w-44">
                <option value="all">Todas las categorías</option>{monthCategories.map(category => <option key={category} value={category}>{localizeCategoryName(language, category)}</option>)}
              </select>
            </label>
          </div>
          {hasActiveFilters && <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between"><p className="min-w-0"><span className="font-semibold text-slate-800 dark:text-slate-100">Filtros activos:</span> {activeFilterLabels.join(' · ')}</p><button type="button" onClick={clearAppliedFilters} className="min-h-9 shrink-0 self-start rounded-lg px-2.5 font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto">Limpiar filtros</button></div>}
          {filtersOpen && <FilterPanel title="Filtros de movimientos" onClose={() => setFiltersOpen(false)} onCancel={() => setFiltersOpen(false)} onClear={() => { setDraftFilters({ ...DEFAULT_TRANSACTION_FILTERS }); setFilterError(''); }} onApply={() => { if (!isTransactionFilterRangeValid(draftFilters)) { setFilterError('Revisa el rango de fechas: la fecha inicial debe ser anterior o igual a la fecha final.'); return; } setFilters(draftFilters); onCategoryFilterChange?.(draftFilters.category === 'all' ? null : draftFilters.category); setFilterError(''); setFiltersOpen(false); }} size="md">
            <div className="space-y-4">
              <label className="block text-sm font-medium">Tipo de movimiento<select value={draftFilters.type} onChange={event => setDraftFilters(current => ({ ...current, type: event.target.value as TransactionFilterCriteria['type'] }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-app-background px-3 text-sm dark:border-slate-700"><option value="all">Todos</option><option value="expense">Gastos</option><option value="income">Ingresos</option><option value="savings">Ahorros</option></select></label>
              <label className="block text-sm font-medium">Categoría<select value={draftFilters.category} onChange={event => setDraftFilters(current => ({ ...current, category: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-app-background px-3 text-sm dark:border-slate-700"><option value="all">Todas las categorías</option>{monthCategories.map(category => <option key={category} value={category}>{localizeCategoryName(language, category)}</option>)}</select></label>
              <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-medium">Rango de fechas</legend><label className="text-sm">Desde<input type="date" value={draftFilters.from} onChange={event => setDraftFilters(current => ({ ...current, from: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-app-background px-3 text-sm dark:border-slate-700" /></label><label className="text-sm">Hasta<input type="date" value={draftFilters.to} onChange={event => setDraftFilters(current => ({ ...current, to: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-app-background px-3 text-sm dark:border-slate-700" /></label></fieldset>
              {filterError && <p role="alert" className="text-sm text-rose-600">{filterError}</p>}
            </div>
          </FilterPanel>}
        </div>

        {/* Row 2: Financial summary for the complete filtered set (not only the visible page). */}
        <div className="grid grid-flow-col auto-cols-[minmax(132px,1fr)] gap-2 overflow-x-auto border-b border-slate-200 pb-3 dark:border-slate-800 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:overflow-visible">
          <div className="min-w-0 rounded-xl bg-rose-50/70 px-3 py-2.5 dark:bg-rose-950/20">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700/80 dark:text-rose-300/80">Gastos del período</p>
            <p className="mt-0.5 text-base font-extrabold tracking-tight text-rose-700 dark:text-rose-300">{profile.currency} {totalExpenses.toLocaleString()}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-emerald-50/70 px-3 py-2.5 dark:bg-emerald-950/20">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Ingresos del período</p>
            <p className="mt-0.5 text-base font-extrabold tracking-tight text-emerald-700 dark:text-emerald-300">{profile.currency} {totalIncomes.toLocaleString()}</p>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-100/80 px-3 py-2.5 dark:bg-slate-800/70">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Movimientos filtrados</p>
            <p className="mt-0.5 text-base font-extrabold tracking-tight text-slate-800 dark:text-slate-100">{visibleCount}</p>
          </div>
        </div>

        {/* Row 3: Continuous Movements List divided by lines */}
        <div>
          {visibleCount === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No se encontraron movimientos con los filtros seleccionados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filters.type === 'savings' ? savingsPagination.items.map((item) => {
                const positive = item.type === 'deposit_from_month';
                const neutral = item.type === 'goal_to_general';
                return <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-3"><div className="rounded-2xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"><PiggyBank className="h-4 w-4" aria-hidden="true" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.description}</p><div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span>{item.method}</span><span>·</span><span>{localizeCategoryName(language, item.category)}</span>{item.goalTitle && <><span>·</span><span>Meta: {item.goalTitle}</span></>}<span>·</span><span>{item.date}</span></div></div></div>
                  <span className={'shrink-0 text-sm font-bold ' + (positive ? 'text-emerald-700 dark:text-emerald-300' : neutral ? 'text-slate-500 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100')}>{positive ? '+' : neutral ? '' : '−'}{profile.currency} {item.amount.toLocaleString()}</span>
                </div>;
              }) : <>
                <div role="list" aria-label="Tus movimientos" className="lg:hidden">
                  {transactionPagination.items.map(tx => {
                    const isSavings = isSavingsTx(tx);
                    return <div role="listitem" key={tx.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b border-slate-200 px-1 py-3 dark:border-slate-800">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CategoryIcon category={tx.category} />
                        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{tx.description}</p><p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{localizeCategoryName(language, tx.category)} · {tx.date}</p></div>
                      </div>
                      <div className="min-w-0 text-right">
                        <span className={'block whitespace-nowrap text-sm font-semibold tabular-nums ' + (isSavings ? 'text-teal-600 dark:text-teal-400' : tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-primary')}>{tx.type === 'expense' ? '−' : '+'}{profile.currency} {tx.amount.toLocaleString()}</span>
                        <p className="text-xs text-slate-400">{isSavings ? 'Ahorro' : tx.type === 'income' ? 'Ingreso' : 'Gasto'}</p>
                      </div>
                      <div className="col-span-2 flex items-center justify-between pl-12 text-xs text-slate-500 dark:text-slate-400"><span className="truncate">{tx.paymentMethod}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => onEditTransaction(tx)} aria-label={'Editar ' + tx.description} className="btn-icon min-h-11 min-w-11 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700" title="Editar"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => onDeleteTransaction(tx.id)} aria-label={'Eliminar ' + tx.description} className="btn-icon min-h-11 min-w-11 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/60" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[760px] table-fixed text-sm" aria-label="Tus movimientos">
                    <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700">
                      <tr>{sortColumn('date', 'Fecha')}{sortColumn('category', 'Categoría')}{sortColumn('description', 'Concepto')}{sortColumn('type', 'Tipo')}{sortColumn('amount', 'Monto', 'right')}<th scope="col" className="px-3 py-2 text-right font-semibold">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactionPagination.items.map(tx => {
                        const isSavings = isSavingsTx(tx);
                        return <tr key={tx.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">{tx.date}</td>
                          <td className="px-3 py-3"><div className="flex min-w-0 items-center gap-2"><CategoryIcon category={tx.category} /><span className="truncate text-sm text-slate-700 dark:text-slate-200">{localizeCategoryName(language, tx.category)}</span></div></td>
                          <td className="px-3 py-3"><p className="truncate font-medium text-slate-900 dark:text-white" title={tx.description}>{tx.description}</p><p className="truncate text-xs text-slate-400">{tx.paymentMethod}</p></td>
                          <td className="px-3 py-3"><span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{isSavings ? 'Ahorro' : tx.type === 'income' ? 'Ingreso' : 'Gasto'}</span></td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums"><span className={isSavings ? 'text-teal-600 dark:text-teal-400' : tx.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-primary'}>{tx.type === 'expense' ? '−' : '+'}{profile.currency} {tx.amount.toLocaleString()}</span></td>
                          <td className="px-2 py-2"><div className="flex items-center justify-end gap-1"><button onClick={() => onEditTransaction(tx)} aria-label={'Editar ' + tx.description} className="btn-icon min-h-11 min-w-11 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700" title="Editar"><Edit2 className="h-4 w-4" /></button><button onClick={() => onDeleteTransaction(tx.id)} aria-label={'Eliminar ' + tx.description} className="btn-icon min-h-11 min-w-11 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/60" title="Eliminar"><Trash2 className="h-4 w-4" /></button></div></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </>}
            </div>
          )}
        </div>
        {visibleCount > 0 && <div className="transactions-pagination flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-11 items-center gap-2 text-xs text-slate-500">
            Mostrar
            <select aria-label="Movimientos por página" value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="app-field h-11 w-auto py-1 text-xs">
              {TRANSACTION_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            por página
          </label>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="text-xs font-medium text-slate-500" aria-live="polite">Página {pagination.page} de {pagination.totalPages}</span>
            <button type="button" className="btn-secondary min-h-11 px-3 text-xs" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={pagination.page === 1} aria-label="Página anterior">Anterior</button>
            <button type="button" className="btn-secondary min-h-11 px-3 text-xs" onClick={() => setPage(current => Math.min(pagination.totalPages, current + 1))} disabled={pagination.page === pagination.totalPages} aria-label="Página siguiente">Siguiente</button>
          </div>
        </div>}
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  Receipt,
  X,
  PiggyBank,
  Minus,
  Plus,
} from 'lucide-react';
import { SavingsMovement, Transaction, UserProfile } from '../../types';
import { PeriodSelector } from '../../components/layout/PeriodSelector';
import { PageHeader } from '../../components/layout/PageHeader';
import { ExportButton } from '../../components/ui/ExportButton';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';
import { FilterPanel } from '../../components/ui/FilterPanel';
import { DEFAULT_TRANSACTION_FILTERS, filterTransactionRecords, isTransactionFilterRangeValid, readTransactionFilters, type TransactionFilterCriteria } from '../../domain/transactionFilters';
import { isSavingsContributionTransaction } from '../../domain/financialClassification';

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

  const activeFilterLabels = [
    filters.type !== 'all' ? 'Tipo: ' + (filters.type === 'income' ? 'Ingresos' : filters.type === 'expense' ? 'Gastos' : 'Ahorros') : '',
    filters.category !== 'all' ? 'Categoría: ' + localizeCategoryName(language, filters.category) : '',
    filters.from ? 'Desde: ' + filters.from : '',
    filters.to ? 'Hasta: ' + filters.to : '',
    searchTerm.trim() ? 'Búsqueda: ' + searchTerm.trim() : '',
  ].filter(Boolean);
  const hasActiveFilters = activeFilterLabels.length > 0;

  const isSavingsTx = (transaction: Transaction) => isSavingsContributionTransaction(transaction);

  const filtered = filterTransactionRecords(transactions, filters, searchTerm, isSavingsTx, category => localizeCategoryName(language, category));

  const totalExpenses = filtered
    .filter((t) => t.type === 'expense' && !isSavingsTx(t))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncomes = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const selectedMonthKey = year + '-' + String(month).padStart(2, '0');
  const savingsMovementIds = new Set(savingsMovements.map((movement) => movement.id));
  const legacySavingsTransactions = filtered.filter((transaction) =>
    isSavingsTx(transaction) && (!transaction.relatedSavingsMovementId || !savingsMovementIds.has(transaction.relatedSavingsMovementId)),
  );
  const savingsLedger = filters.type === 'savings' ? [
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
  const totalSavingsFiltered = filters.type === 'savings'
    ? savingsLedger.filter((movement) => movement.type === 'deposit_from_month').reduce((sum, movement) => sum + movement.amount, 0)
    : filtered.filter(isSavingsTx).reduce((sum, transaction) => sum + transaction.amount, 0);

  // Available categories for the current month, including the real savings-ledger categories.
  const monthCategories = Array.from(new Set([
    ...transactions.map((transaction) => transaction.category),
    ...savingsMovements.filter((movement) => movement.monthKey === selectedMonthKey).map((movement) => movement.category || 'Aporte al Ahorro'),
  ]));
  useEffect(() => { try { sessionStorage.setItem('mischeles_transaction_filters_v1', JSON.stringify(filters)); } catch { /* Optional session persistence. */ } }, [filters]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-4 animate-in fade-in duration-200">
      <PageHeader title="Tus movimientos" period={<PeriodSelector year={year} month={month} onMonthChange={onMonthChange} />} actions={<ExportButton onClick={onOpenExportModal} />} />

      {/* Seamless Continuous Container divided by clean lines */}
      <div className="space-y-4">
        {/* Row 1: Search and Filters */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por concepto o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
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


            <button type="button" onClick={() => { setDraftFilters(filters); setFilterError(''); setFiltersOpen(true); }} aria-expanded={filtersOpen} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Filter className="h-4 w-4" />Filtros</button>
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

        {/* Row 2: Sub-Summary separated by thin line */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 py-3 text-xs text-slate-500 dark:border-slate-800">
          <div className="flex flex-wrap gap-4">
            {filters.type !== 'income' && filters.type !== 'savings' && (
              <span>
                Gastos:{' '}
                <strong className="text-rose-500 font-bold">
                  {profile.currency} {totalExpenses.toLocaleString()}
                </strong>
              </span>
            )}
            {filters.type !== 'expense' && filters.type !== 'savings' && (
              <span>
                Ingresos:{' '}
                <strong className="text-emerald-500 font-bold">
                  {profile.currency} {totalIncomes.toLocaleString()}
                </strong>
              </span>
            )}
            {(filters.type === 'all' || filters.type === 'savings') && totalSavingsFiltered > 0 && (
              <span>
                Ahorros transferidos:{' '}
                <strong className="text-teal-600 dark:text-teal-400 font-bold">
                  {profile.currency} {totalSavingsFiltered.toLocaleString()}
                </strong>
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            {filters.type === 'savings' ? savingsLedger.length : filtered.length} registro(s)
          </span>
        </div>

        {/* Row 3: Continuous Movements List divided by lines */}
        <div>
          {(filters.type === 'savings' ? savingsLedger.length : filtered.length) === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No se encontraron movimientos con los filtros seleccionados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filters.type === 'savings' ? savingsLedger.map((item) => {
                const positive = item.type === 'deposit_from_month';
                const neutral = item.type === 'goal_to_general';
                return <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 dark:border-slate-800">
                  <div className="flex min-w-0 items-center gap-3"><div className="rounded-2xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"><PiggyBank className="h-4 w-4" aria-hidden="true" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.description}</p><div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><span>{item.method}</span><span>·</span><span>{localizeCategoryName(language, item.category)}</span>{item.goalTitle && <><span>·</span><span>Meta: {item.goalTitle}</span></>}<span>·</span><span>{item.date}</span></div></div></div>
                  <span className={'shrink-0 text-sm font-bold ' + (positive ? 'text-emerald-700 dark:text-emerald-300' : neutral ? 'text-slate-500 dark:text-slate-300' : 'text-slate-800 dark:text-slate-100')}>{positive ? '+' : neutral ? '' : '−'}{profile.currency} {item.amount.toLocaleString()}</span>
                </div>;
              }) : filtered.map((tx) => {
                const isSavings = isSavingsTx(tx);
                return (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-3 group border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <div
                      className="flex items-center gap-3 min-w-0 flex-1"
                      onClick={() => onEditTransaction(tx)}
                    >
                      <div
                        className={`p-2.5 rounded-2xl shrink-0 ${
                          isSavings
                            ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'
                            : tx.type === 'expense'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-primary'
                        }`}
                      >
                        {isSavings ? (
                          <PiggyBank className="w-4 h-4" />
                        ) : tx.type === 'expense' ? (
                          <Minus className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {localizeCategoryName(language, tx.category)}
                          </span>
                          <span>•</span>
                          <span>{tx.date}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right" onClick={() => onEditTransaction(tx)}>
                        <span
                          className={`text-sm font-extrabold ${
                            isSavings
                              ? 'text-teal-600 dark:text-teal-400'
                              : tx.type === 'expense'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-primary'
                          }`}
                        >
                          {tx.type === 'expense' ? '-' : '+'}
                          {profile.currency} {tx.amount.toLocaleString()}
                        </span>
                        <p className="text-xs text-slate-400">{tx.paymentMethod}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTransaction(tx);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 transition"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTransaction(tx.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-500 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

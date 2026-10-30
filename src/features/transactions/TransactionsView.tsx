import React, { useState } from 'react';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  Receipt,
  X,
  CreditCard,
  Download,
  PiggyBank,
  Minus,
  Plus,
} from 'lucide-react';
import { Transaction, UserProfile } from '../../types';
import { MONTH_NAMES_ES } from '../../constants/categories';

interface TransactionsViewProps {
  year: number;
  month: number;
  transactions: Transaction[];
  profile: UserProfile;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenExportModal: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  year,
  month,
  transactions,
  profile,
  onEditTransaction,
  onDeleteTransaction,
  onOpenExportModal,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'savings'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const monthName = MONTH_NAMES_ES[month - 1];

  const isSavingsTx = (t: Transaction) =>
    t.category === 'Aporte al Ahorro' ||
    t.paymentMethod === 'Transferencia a Ahorro' ||
    !!t.relatedSavingsMovementId ||
    t.category.toLowerCase().includes('ahorro');

  // Filtered transactions
  const filtered = transactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesType = true;
    if (typeFilter === 'expense') {
      matchesType = t.type === 'expense' && !isSavingsTx(t);
    } else if (typeFilter === 'income') {
      matchesType = t.type === 'income';
    } else if (typeFilter === 'savings') {
      matchesType = isSavingsTx(t);
    }

    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const totalExpenses = filtered
    .filter((t) => t.type === 'expense' && !isSavingsTx(t))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncomes = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSavingsFiltered = filtered
    .filter(isSavingsTx)
    .reduce((sum, t) => sum + t.amount, 0);

  // Unique categories in this month for filter dropdown
  const monthCategories = Array.from(new Set(transactions.map((t) => t.category)));

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-4 animate-in fade-in duration-200">
      <header className="flex items-end justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div><p className="text-sm text-slate-500">{monthName} {year}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Movimientos</h1></div>
        <button onClick={onOpenExportModal} className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"><Download className="mr-1 inline h-4 w-4" />Exportar</button>
      </header>

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
                className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

            {/* Type Filter Pills */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl shrink-0">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  typeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setTypeFilter('expense')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  typeFilter === 'expense'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Gastos
              </button>
              <button
                onClick={() => setTypeFilter('income')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  typeFilter === 'income'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Ingresos
              </button>
              <button
                onClick={() => setTypeFilter('savings')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1 ${
                  typeFilter === 'savings'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <PiggyBank className="w-3.5 h-3.5" />
                <span>Ahorros</span>
              </button>
            </div>

            {/* Category Dropdown Filter */}
            {monthCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Todas las categorías</option>
                {monthCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Row 2: Sub-Summary separated by thin line */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 py-3 text-xs text-slate-500 dark:border-slate-800">
          <div className="flex flex-wrap gap-4">
            {typeFilter !== 'income' && typeFilter !== 'savings' && (
              <span>
                Gastos:{' '}
                <strong className="text-rose-500 font-bold">
                  {profile.currency} {totalExpenses.toLocaleString()}
                </strong>
              </span>
            )}
            {typeFilter !== 'expense' && typeFilter !== 'savings' && (
              <span>
                Ingresos:{' '}
                <strong className="text-emerald-500 font-bold">
                  {profile.currency} {totalIncomes.toLocaleString()}
                </strong>
              </span>
            )}
            {(typeFilter === 'all' || typeFilter === 'savings') && totalSavingsFiltered > 0 && (
              <span>
                Ahorros transferidos:{' '}
                <strong className="text-teal-600 dark:text-teal-400 font-bold">
                  {profile.currency} {totalSavingsFiltered.toLocaleString()}
                </strong>
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            {filtered.length} registro(s)
          </span>
        </div>

        {/* Row 3: Continuous Movements List divided by lines */}
        <div>
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No se encontraron movimientos con los filtros seleccionados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((tx) => {
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
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
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
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {tx.category}
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
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {tx.type === 'expense' ? '-' : '+'}
                          {profile.currency} {tx.amount.toLocaleString()}
                        </span>
                        <p className="text-[10px] text-slate-400">{tx.paymentMethod}</p>
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

import React from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Wallet, Sparkles, SlidersHorizontal } from 'lucide-react';
import { FinancialSummary, MonthConfig, Transaction, UserProfile, SavingsMovementType } from '../../types';
import { MONTH_NAMES_ES } from '../../constants/categories';
import { PeriodSelector } from '../../components/layout/PeriodSelector';

interface DashboardViewProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  monthConfig: MonthConfig | null;
  summary: FinancialSummary;
  transactions: Transaction[];
  profile: UserProfile;
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  onOpenMonthSetup: () => void;
  onOpenTransactionModal: (type: 'expense' | 'income') => void;
  onOpenTransferModal: () => void;
  onOpenSavingsModal: (mode: SavingsMovementType) => void;
  onOpenExportModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onViewAllTransactions: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  year, month, onMonthChange, monthConfig, summary, transactions, profile, onOpenMonthSetup,
  onEditTransaction, onViewAllTransactions,
}) => {
  const monthName = MONTH_NAMES_ES[month - 1];
  const recentTransactions = transactions.slice(0, 5);
  const percentUsed = summary.totalIncome > 0
    ? Math.min(100, Math.round((summary.totalExpenses / summary.totalIncome) * 100))
    : 0;
  const money = (value: number) => `${profile.currency} ${value.toLocaleString('es-DO')}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-8 animate-in fade-in duration-200">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="type-screen-title text-slate-900 dark:text-white">Así va tu dinero</h1>
        <div className="flex shrink-0 items-center gap-1">
          <PeriodSelector year={year} month={month} onMonthChange={onMonthChange} />
          <button type="button" onClick={onOpenMonthSetup} aria-label="Configurar presupuesto del mes" title="Configurar presupuesto" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>
      {(!monthConfig || !monthConfig.isConfigured) && (
        <button onClick={onOpenMonthSetup} className="flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-4 text-left text-sm text-primary dark:border-primary/30 dark:bg-primary-soft dark:text-primary">
          <Sparkles className="h-5 w-5 shrink-0" />
          <span className="flex-1">Configura tu presupuesto de {monthName}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <section className="border-b border-slate-200 py-5 dark:border-slate-800">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Disponible</p>
        <p className="mt-1 type-display type-money text-slate-900 dark:text-white sm:text-5xl">{money(summary.availableBalance)}</p>
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Presupuesto utilizado</span><span>{percentUsed}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className={`h-full rounded-full ${percentUsed >= 90 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${percentUsed}%` }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400">Presupuesto</p>
            <p className="font-semibold text-slate-900 dark:text-white">{money(summary.totalIncome)}</p>
          </div>
        </div>
      </section>

      <section className="flex items-center gap-6 border-b border-slate-200 py-3 dark:border-slate-800">
        <div><p className="text-xs text-slate-500 dark:text-slate-400">Gastos del mes</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{money(summary.totalExpenses)}</p></div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
        <div><p className="text-xs text-slate-500 dark:text-slate-400">Ahorro acumulado</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{money(summary.totalSavingsVault)}</p></div>
      </section>

      <section className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 py-4 dark:border-slate-800">
          <div><h2 className="font-bold text-slate-900 dark:text-white">Movimientos recientes</h2><p className="mt-0.5 text-xs text-slate-500">{monthName} {year}</p></div>
          <button onClick={onViewAllTransactions} className="flex items-center gap-1 text-sm font-semibold text-primary dark:text-primary">Ver todos <ArrowRight className="h-4 w-4" /></button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="px-5 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"><Wallet className="h-5 w-5 text-slate-500" /></div><p className="mt-3 font-medium text-slate-800 dark:text-slate-200">Aún no hay movimientos</p><p className="mt-1 text-sm text-slate-500">Agrega un gasto o ingreso para comenzar.</p></div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTransactions.map((tx) => (
              <button key={tx.id} onClick={() => onEditTransaction(tx)} className="flex w-full items-center gap-3 border-b border-slate-100 py-3.5 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tx.type === 'expense' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'}`}>{tx.type === 'expense' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{tx.description}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{tx.category} · {tx.date}</span></span>
                <span className={`shrink-0 text-sm font-bold ${tx.type === 'expense' ? 'text-slate-900 dark:text-white' : 'text-primary dark:text-primary'}`}>{tx.type === 'expense' ? '−' : '+'}{money(tx.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

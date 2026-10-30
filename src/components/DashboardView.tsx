import React from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Wallet, Sparkles } from 'lucide-react';
import { FinancialSummary, MonthConfig, Transaction, UserProfile, SavingsMovementType } from '../types';
import { MONTH_NAMES_ES } from '../constants/categories';

interface DashboardViewProps {
  year: number;
  month: number;
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
  year, month, monthConfig, summary, transactions, profile, onOpenMonthSetup,
  onEditTransaction, onViewAllTransactions,
}) => {
  const monthName = MONTH_NAMES_ES[month - 1];
  const recentTransactions = transactions.slice(0, 5);
  const percentUsed = summary.totalIncome > 0
    ? Math.min(100, Math.round((summary.totalExpenses / summary.totalIncome) * 100))
    : 0;
  const money = (value: number) => `${profile.currency} ${value.toLocaleString('es-DO')}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-4 animate-in fade-in duration-200">
      {(!monthConfig || !monthConfig.isConfigured) && (
        <button onClick={onOpenMonthSetup} className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <Sparkles className="h-5 w-5 shrink-0" />
          <span className="flex-1">Configura tu presupuesto de {monthName}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm sm:p-7">
        <p className="text-sm font-medium text-slate-300">Disponible en {monthName}</p>
        <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{money(summary.availableBalance)}</p>
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex justify-between text-xs text-slate-300">
              <span>Presupuesto utilizado</span><span>{percentUsed}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full rounded-full ${percentUsed >= 90 ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${percentUsed}%` }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-300">Presupuesto</p>
            <p className="font-semibold">{money(summary.totalIncome)}</p>
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
          <button onClick={onViewAllTransactions} className="flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Ver todos <ArrowRight className="h-4 w-4" /></button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="px-5 py-10 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"><Wallet className="h-5 w-5 text-slate-500" /></div><p className="mt-3 font-medium text-slate-800 dark:text-slate-200">Aún no hay movimientos</p><p className="mt-1 text-sm text-slate-500">Agrega un gasto o ingreso para comenzar.</p></div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentTransactions.map((tx) => (
              <button key={tx.id} onClick={() => onEditTransaction(tx)} className="flex w-full items-center gap-3 border-b border-slate-100 py-3.5 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tx.type === 'expense' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'}`}>{tx.type === 'expense' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{tx.description}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{tx.category} · {tx.date}</span></span>
                <span className={`shrink-0 text-sm font-bold ${tx.type === 'expense' ? 'text-slate-900 dark:text-white' : 'text-emerald-700 dark:text-emerald-400'}`}>{tx.type === 'expense' ? '−' : '+'}{money(tx.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

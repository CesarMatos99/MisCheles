import React from 'react';
import {
  BarChart2,
  PieChart,
  TrendingDown,
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { FinancialSummary, Transaction, UserProfile } from '../../types';
import { MONTH_NAMES_ES, EXPENSE_CATEGORIES } from '../../constants/categories';
import { CategoryChart } from './CategoryChart';

interface AnalyticsViewProps {
  year: number;
  month: number;
  summary: FinancialSummary;
  transactions: Transaction[];
  profile: UserProfile;
  onOpenExportModal: () => void;
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  year,
  month,
  summary,
  transactions,
  profile,
  onOpenExportModal,
  selectedCategory,
  onSelectCategory,
}) => {
  const monthName = MONTH_NAMES_ES[month - 1];
  const expenses = transactions.filter((t) => t.type === 'expense');
  const incomes = transactions.filter((t) => t.type === 'income');

  const totalExpense = summary.totalExpenses;
  const avgDailyExpense = totalExpense > 0 ? totalExpense / 30 : 0;
  const savingsRate = summary.totalIncome > 0 ? (summary.savingsTransfersTo / summary.totalIncome) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Análisis Gráfico y Rendimiento
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Métricas clave y distribución de gastos para {monthName} {year}
          </p>
        </div>

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition active:scale-95 shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Exportar PDF / Excel</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Gasto Promedio Diario
          </span>
          <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {profile.currency} {Math.round(avgDailyExpense).toLocaleString()}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Estimado sobre período de 30 días</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Tasa de Ahorro del Mes
          </span>
          <h3 className="text-2xl font-extrabold text-primary">
            {savingsRate.toFixed(1)}%
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {profile.currency} {summary.savingsTransfersTo.toLocaleString()} enviados al módulo de ahorro
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Margen Libre Restante
          </span>
          <h3 className={`text-2xl font-extrabold ${summary.availableBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {profile.currency} {summary.availableBalance.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {summary.availableBalance >= 0 ? 'Superávit que se sumará al siguiente mes' : 'Déficit en este mes'}
          </p>
        </div>
      </div>

      {/* Main Interactive Category Chart */}
      <CategoryChart
        transactions={transactions}
        profile={profile}
        summary={summary}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
      />
    </div>
  );
};

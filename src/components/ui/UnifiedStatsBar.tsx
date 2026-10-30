import React from 'react';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  Plus,
  Minus,
  ArrowRightLeft,
  Sliders,
  Download,
} from 'lucide-react';
import { FinancialSummary, UserProfile } from '../../types';

interface UnifiedStatsBarProps {
  summary: FinancialSummary;
  profile: UserProfile;
  monthName: string;
  showActions?: boolean;
  onOpenTransactionModal?: (type: 'expense' | 'income') => void;
  onOpenTransferModal?: () => void;
  onOpenMonthSetup?: () => void;
  onOpenExportModal?: () => void;
}

export const UnifiedStatsBar: React.FC<UnifiedStatsBarProps> = ({
  summary,
  profile,
  monthName,
  showActions = false,
  onOpenTransactionModal,
  onOpenTransferModal,
  onOpenMonthSetup,
  onOpenExportModal,
}) => {
  const budgetUsagePercent =
    summary.totalIncome > 0
      ? Math.min(100, (summary.totalExpenses / summary.totalIncome) * 100)
      : 0;

  return (
    <div className="space-y-3">
      {/* Continuous Single Div divided by clean lines */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm py-3 px-4">
        <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 text-left">
          {/* Col 1: Balance Disponible */}
          <div className="pr-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Balance Disponible
              </span>
              <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {profile.currency} {summary.availableBalance.toLocaleString()}
              </h3>
            </div>
            <p className="text-xs text-primary font-medium mt-0.5 truncate">
              Disponible {monthName}
            </p>
          </div>

          {/* Col 2: Total Fondo Mes */}
          <div className="px-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Total Fondo Mes
              </span>
              <h3 className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {profile.currency} {summary.totalIncome.toLocaleString()}
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {summary.carryover > 0 ? (
                <span className="text-primary font-semibold">
                  +{profile.currency}{summary.carryover.toLocaleString()} sobrante
                </span>
              ) : (
                'Cobro base inicial'
              )}
            </p>
          </div>

          {/* Col 3: Gastos del Mes */}
          <div className="pl-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Gastos del Mes
              </span>
              <h3 className="text-lg sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
                {profile.currency} {summary.totalExpenses.toLocaleString()}
              </h3>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetUsagePercent > 90 ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${budgetUsagePercent}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 shrink-0 font-medium">
                {budgetUsagePercent.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons: Only shown if showActions === true (kept solely in Registro) */}
      {showActions && onOpenTransactionModal && onOpenTransferModal && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => onOpenTransactionModal('expense')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm transition shrink-0"
            title="Registrar Gasto"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Gasto</span>
          </button>

          <button
            onClick={() => onOpenTransactionModal('income')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-bold shadow-sm transition shrink-0"
            title="Registrar Ingreso"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ingreso</span>
          </button>

          <button
            onClick={onOpenTransferModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold shadow-sm transition shrink-0"
            title="Transferir a Ahorro"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Transferir</span>
          </button>

          {onOpenMonthSetup && (
            <button
              onClick={onOpenMonthSetup}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-bold transition shrink-0"
              title="Configurar Mes"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-500" />
              <span>Configurar</span>
            </button>
          )}

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 text-xs font-bold transition shrink-0"
              title="Exportar Reporte"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Exportar</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

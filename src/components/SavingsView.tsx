import React, { useState } from 'react';
import {
  PiggyBank,
  ArrowDownRight,
  ArrowUpRight,
  ShoppingBag,
  Plus,
  Trash2,
  Calendar,
  Target,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { FinancialSummary, SavingsGoal, SavingsMovementType, UserProfile } from '../types';
import { storageService } from '../services/storage';

interface SavingsViewProps {
  summary: FinancialSummary;
  profile: UserProfile;
  monthKey: string;
  year: number;
  month: number;
  onOpenSavingsModal: (mode: SavingsMovementType) => void;
  onRefresh: () => void;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  summary,
  profile,
  monthKey,
  onOpenSavingsModal,
  onRefresh,
}) => {
  const [goals, setGoals] = useState<SavingsGoal[]>(() => storageService.getSavingsGoals());
  const [isAddingGoal, setIsAddingGoal] = useState<boolean>(false);
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [newGoalTarget, setNewGoalTarget] = useState<string>('');
  const [newGoalDate, setNewGoalDate] = useState<string>('');

  const movements = storageService.getSavingsMovements();

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(newGoalTarget);
    if (!newGoalTitle || !target) return;

    const newGoal: SavingsGoal = {
      id: 'goal-' + Date.now(),
      title: newGoalTitle,
      targetAmount: target,
      currentAmount: 0,
      targetDate: newGoalDate || undefined,
      color: '#10b981',
    };

    const updated = [...goals, newGoal];
    setGoals(updated);
    storageService.saveSavingsGoals(updated);
    setIsAddingGoal(false);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setNewGoalDate('');
  };

  const handleDeleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    storageService.saveSavingsGoals(updated);
  };

  const handleDeleteMovement = (id: string) => {
    if (confirm('¿Deseas eliminar este registro de movimiento de ahorro?')) {
      storageService.deleteSavingsMovement(id);
      onRefresh();
    }
  };

  const totalAssignedToGoals = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalFreeSavings = Math.max(0, summary.totalSavingsVault - totalAssignedToGoals);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Vault Hero - Fondo de Ahorro */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white p-5 sm:p-6 shadow-md">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-200 text-xs font-semibold">
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Fondo de Ahorro / Bóveda</span>
            </div>
            <p className="text-xs text-emerald-100 font-medium">Saldo Total Acumulado</p>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {profile.currency} {summary.totalSavingsVault.toLocaleString()}
            </h1>
            <p className="text-xs text-emerald-200/90 max-w-xl">
              Fondo acumulado para tus metas, imprevistos o emergencias.
            </p>
          </div>

          {/* Action buttons: Transferir al Mes (Registro) + Gestionar */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
            {/* Opción de transferir de ahorro a dinero del mes (registro) */}
            <button
              onClick={() => onOpenSavingsModal('withdraw_to_month')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-2xl shadow-md transition"
              title="Transferir fondos del ahorro al dinero del mes (Registro)"
            >
              <ArrowUpRight className="w-4 h-4 text-slate-950" />
              <span>Transferir a Dinero del Mes (Registro)</span>
            </button>

            {/* Gestionar button */}
            <button
              onClick={() => onOpenSavingsModal('deposit_from_month')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 active:scale-95 text-white font-bold text-xs rounded-2xl border border-white/20 transition"
              title="Gestionar acciones de ahorro"
            >
              <SlidersHorizontal className="w-4 h-4 text-emerald-300" />
              <span>Gestionar</span>
            </button>
          </div>
        </div>

        {/* Breakdown sub-stats divided cleanly by lines */}
        <div className="relative z-10 grid grid-cols-3 divide-x divide-white/15 mt-5 pt-4 border-t border-white/15 text-left">
          <div className="pr-3">
            <span className="text-[10px] text-emerald-200 block font-medium">Asignado a Metas</span>
            <span className="text-sm sm:text-lg font-bold text-white">
              {profile.currency} {totalAssignedToGoals.toLocaleString()}
            </span>
          </div>
          <div className="px-3">
            <span className="text-[10px] text-emerald-200 block font-medium">Ahorro General Libre</span>
            <span className="text-sm sm:text-lg font-bold text-white">
              {profile.currency} {totalFreeSavings.toLocaleString()}
            </span>
          </div>
          <div className="pl-3">
            <span className="text-[10px] text-emerald-200 block font-medium">Aportes este mes</span>
            <span className="text-sm sm:text-lg font-bold text-emerald-300">
              +{profile.currency} {summary.savingsTransfersTo.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Seamless Continuous View for Goals and Vault History divided by lines */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {/* Metas de Ahorro Section */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Metas de Ahorro
              </h3>
            </div>
            <button
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Meta</span>
            </button>
          </div>

          {/* Inline Create Goal Form */}
          {isAddingGoal && (
            <form
              onSubmit={handleCreateGoal}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                Crear Nueva Meta
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Nombre (ej. Vacaciones, Laptop)"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  required
                  min="1"
                  placeholder={`Monto Meta (${profile.currency})`}
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="date"
                  value={newGoalDate}
                  onChange={(e) => setNewGoalDate(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGoal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
                >
                  Guardar Meta
                </button>
              </div>
            </form>
          )}

          {/* Goals List divided cleanly */}
          {goals.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
              No tienes metas de ahorro activas. Crea una para organizar tus ahorros por objetivos.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {goals.map((goal) => {
                const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                return (
                  <div
                    key={goal.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 relative group hover:border-emerald-500/40 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {goal.title}
                        </h4>
                        {goal.targetDate && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            Límite: {goal.targetDate}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition"
                        title="Eliminar Meta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {profile.currency} {goal.currentAmount.toLocaleString()}
                        </span>
                        <span className="text-slate-400">
                          Meta: {profile.currency} {goal.targetAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Historial de Movimientos de la Bóveda */}
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Historial de Movimientos de Ahorro
            </h3>
            <span className="text-xs text-slate-400">
              {movements.length} registro(s)
            </span>
          </div>

          {movements.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              Aún no has realizado movimientos en el fondo de ahorro.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {movements.map((mov) => {
                let icon = <ArrowDownRight className="w-4 h-4" />;
                let badgeColor = 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400';
                let typeText = 'Aporte desde el mes';
                let amountSign = '+';
                let amountColor = 'text-emerald-600 dark:text-emerald-400';

                if (mov.type === 'withdraw_to_month') {
                  icon = <ArrowUpRight className="w-4 h-4" />;
                  badgeColor = 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400';
                  typeText = 'Transferencia hacia el mes';
                  amountSign = '-';
                  amountColor = 'text-blue-600 dark:text-blue-400';
                } else if (mov.type === 'direct_expense') {
                  icon = <ShoppingBag className="w-4 h-4" />;
                  badgeColor = 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400';
                  typeText = 'Pago directo de ahorro';
                  amountSign = '-';
                  amountColor = 'text-rose-600 dark:text-rose-400';
                }

                return (
                  <div key={mov.id} className="py-2.5 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${badgeColor}`}>
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {mov.description}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium">{typeText}</span>
                          <span>•</span>
                          <span>{mov.date}</span>
                          {mov.category && (
                            <>
                              <span>•</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                                {mov.category}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs sm:text-sm font-extrabold ${amountColor}`}>
                        {amountSign}{profile.currency} {mov.amount.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleDeleteMovement(mov.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition"
                        title="Eliminar movimiento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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

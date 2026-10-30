import React, { useEffect, useState } from 'react';
import {
  PiggyBank,
  ArrowLeft,
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
import { FinancialSummary, SavingsGoal, SavingsMovement, SavingsMovementType, UserProfile } from '../../types';
import { storageService } from '../../services/storage';
import { PeriodSelector } from '../../components/layout/PeriodSelector';

type GoalDeleteResolution = 'general' | 'month' | 'fictional';

interface SavingsViewProps {
  summary: FinancialSummary;
  profile: UserProfile;
  monthKey: string;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onOpenSavingsModal: (mode: SavingsMovementType, goalId?: string) => void;
  onRefresh: () => void;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  summary,
  profile,
  monthKey,
  year,
  month,
  onMonthChange,
  onOpenSavingsModal,
  onRefresh,
}) => {
  const [goals, setGoals] = useState<SavingsGoal[]>(() => storageService.getSavingsGoals());
  const [isAddingGoal, setIsAddingGoal] = useState<boolean>(false);
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [newGoalTarget, setNewGoalTarget] = useState<string>('');
  const [newGoalDate, setNewGoalDate] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalPendingDeletion, setGoalPendingDeletion] = useState<SavingsGoal | null>(null);
  const [goalDeleteResolution, setGoalDeleteResolution] = useState<GoalDeleteResolution>('general');

  const movements = storageService.getSavingsMovements();
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) || null;
  const selectedGoalMovements = selectedGoal
    ? movements.filter((movement) => movement.goalId === selectedGoal.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  useEffect(() => {
    setGoals(storageService.getSavingsGoals());
  }, [summary.totalSavingsVault]);

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
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;
    setGoalDeleteResolution('general');
    setGoalPendingDeletion(goal);
  };

  const handleConfirmGoalDeletion = () => {
    if (!goalPendingDeletion) return;
    storageService.deleteSavingsGoal(goalPendingDeletion.id, goalDeleteResolution, monthKey);
    setGoals(storageService.getSavingsGoals());
    setSelectedGoalId(null);
    setGoalPendingDeletion(null);
    onRefresh();
  };

  const handleDeleteMovement = (id: string) => {
    if (confirm('¿Deseas eliminar este registro de movimiento de ahorro?')) {
      storageService.deleteSavingsMovement(id);
      setGoals(storageService.getSavingsGoals());
      onRefresh();
    }
  };

  const totalAssignedToGoals = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalFreeSavings = Math.max(0, summary.totalSavingsVault - totalAssignedToGoals);

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-200">
      {/* Vault Hero - Fondo de Ahorro */}
      <section className="border-b border-slate-200 py-5 dark:border-slate-800 sm:py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="type-screen-title text-slate-900 dark:text-white">Ahorro</h1>
          <PeriodSelector year={year} month={month} onMonthChange={onMonthChange} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-primary text-xs font-semibold">
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Fondo de ahorro</span>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Saldo total acumulado</p>
            <h2 className="type-display type-money font-extrabold tracking-tight text-slate-900 dark:text-white">
              {profile.currency} {summary.totalSavingsVault.toLocaleString()}
            </h2>
            <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
              Fondo acumulado para tus metas, imprevistos o emergencias.
            </p>
          </div>

          {/* Action buttons: Transferir al Mes (Registro) + Gestionar */}
          <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
            {/* Opción de transferir de ahorro a dinero del mes (registro) */}
            <button
              onClick={() => onOpenSavingsModal('withdraw_to_month')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover active:scale-[0.98]"
              title="Transferir fondos del ahorro al dinero del mes (Registro)"
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Pasar al mes</span>
            </button>

            {/* Gestionar button */}
            <button
              onClick={() => onOpenSavingsModal('deposit_from_month')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Gestionar acciones de ahorro"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Gestionar</span>
            </button>
          </div>
        </div>

        {/* Breakdown sub-stats divided cleanly by lines */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 pt-4 text-left dark:divide-slate-800">
          <div className="pr-3">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Asignado a Metas</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white sm:text-sm">
              {profile.currency} {totalAssignedToGoals.toLocaleString()}
            </span>
          </div>
          <div className="px-3">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Ahorro General Libre</span>
            <span className="text-xs font-semibold text-slate-900 dark:text-white sm:text-sm">
              {profile.currency} {totalFreeSavings.toLocaleString()}
            </span>
          </div>
          <div className="pl-3">
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Aportes este mes</span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 sm:text-sm">
              +{profile.currency} {summary.savingsTransfersTo.toLocaleString()}
            </span>
          </div>
        </div>
      </section>

      {/* Goals and savings history share one continuous list surface. */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {/* Metas de Ahorro Section */}
        {!selectedGoal && (
        <div className="py-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Metas de Ahorro
              </h3>
            </div>
            <button
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-soft dark:bg-primary-soft text-primary text-xs font-bold hover:bg-primary-soft transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Meta</span>
            </button>
          </div>

          {/* Inline Create Goal Form */}
          {isAddingGoal && (
            <form
              onSubmit={handleCreateGoal}
              className="space-y-3 border-y border-slate-200 py-4 animate-in fade-in dark:border-slate-800"
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
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="number"
                  required
                  min="1"
                  placeholder={`Monto Meta (${profile.currency})`}
                  value={newGoalTarget}
                  onChange={(e) => setNewGoalTarget(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="date"
                  value={newGoalDate}
                  onChange={(e) => setNewGoalDate(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover"
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
            <div className="grid gap-3 sm:grid-cols-2">
              {goals.map((goal) => {
                const pct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                return (
                  <button key={goal.id} type="button" onClick={() => setSelectedGoalId(goal.id)} aria-pressed={selectedGoalId === goal.id}
                    className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-primary/40 hover:bg-primary-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-800 dark:hover:bg-primary/10">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="truncate text-sm font-bold text-slate-900 dark:text-white">{goal.title}</h4>
                        {goal.targetDate && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Calendar className="h-3 w-3" />Fecha objetivo: {goal.targetDate}</p>}
                      </div>
                      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900 dark:text-white">{profile.currency} {goal.currentAmount.toLocaleString()}</span>
                      <span className="text-slate-500 dark:text-slate-400">de {profile.currency} {goal.targetAmount.toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}
        {selectedGoal && (
            <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800" aria-labelledby="goal-detail-title">
              <button type="button" onClick={() => setSelectedGoalId(null)} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary"><ArrowLeft className="h-4 w-4" />Volver a todas las metas</button>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3"><div><h3 id="goal-detail-title" className="text-lg font-bold text-slate-900 dark:text-white">{selectedGoal.title}</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Saldo asignado a esta meta</p></div>{selectedGoal.targetDate && <span className="text-right text-xs text-slate-500 dark:text-slate-400">Objetivo<br />{selectedGoal.targetDate}</span>}</div>
                <div className="flex items-end justify-between gap-3"><p className="type-money text-2xl font-extrabold text-primary">{profile.currency} {selectedGoal.currentAmount.toLocaleString()}</p><p className="pb-1 text-xs text-slate-500 dark:text-slate-400">Meta: {profile.currency} {selectedGoal.targetAmount.toLocaleString()}</p></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (selectedGoal.currentAmount / selectedGoal.targetAmount) * 100)}%` }} /></div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onOpenSavingsModal('deposit_from_month', selectedGoal.id)} className="min-h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover">Registrar aporte</button>
                  <button type="button" onClick={() => onOpenSavingsModal('withdraw_to_month', selectedGoal.id)} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Retirar de la meta</button>
                  <button type="button" onClick={() => handleDeleteGoal(selectedGoal.id)} className="ml-auto flex min-h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" aria-label="Eliminar meta"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-sm font-bold text-slate-900 dark:text-white">Historial de esta meta</h4><span className="text-xs text-slate-500 dark:text-slate-400">{selectedGoalMovements.length} movimiento(s)</span></div>
                {selectedGoalMovements.length === 0 ? <p className="py-4 text-sm text-slate-500 dark:text-slate-400">Aún no hay aportes o retiros vinculados a esta meta.</p> : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedGoalMovements.map((movement: SavingsMovement) => {
                      const isDeposit = movement.type === 'deposit_from_month';
                      const label = isDeposit ? 'Aporte' : movement.type === 'withdraw_to_month' ? 'Retiro al mes' : 'Pago desde la meta';
                      return <div key={movement.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-start gap-3"><div className={`mt-0.5 rounded-full p-2 ${isDeposit ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'}`}>{isDeposit ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div>
                          <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{movement.description}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label} · {movement.date}{movement.category ? ` · ${movement.category}` : ''}</p></div>
                        </div><span className={`shrink-0 text-sm font-bold ${isDeposit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{isDeposit ? '+' : '−'}{profile.currency} {movement.amount.toLocaleString()}</span>
                      </div>;
                    })}
                  </div>
                )}
              </div>
            </section>
          )}


      </div>
      {goalPendingDeletion && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-goal-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 id="delete-goal-title" className="text-lg font-bold text-slate-900 dark:text-white">Eliminar «{goalPendingDeletion.title}»</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Esta meta tiene <strong>{profile.currency} {goalPendingDeletion.currentAmount.toLocaleString()}</strong>. Elige qué hacer con ese saldo antes de eliminarla.</p>
            <div className="mt-4 space-y-2" role="radiogroup" aria-label="Destino del saldo de la meta">
              <button type="button" role="radio" aria-checked={goalDeleteResolution === 'general'} onClick={() => setGoalDeleteResolution('general')} className={goalDeleteResolution === 'general' ? 'w-full rounded-xl border border-primary bg-primary-soft/50 p-3 text-left' : 'w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Mover a Ahorro General</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Conserva el dinero y el historial; el saldo queda sin asignar a una meta.</span>
              </button>
              <button type="button" role="radio" aria-checked={goalDeleteResolution === 'month'} onClick={() => setGoalDeleteResolution('month')} className={goalDeleteResolution === 'month' ? 'w-full rounded-xl border border-primary bg-primary-soft/50 p-3 text-left' : 'w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Pasar al presupuesto de este mes</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">El saldo se agrega al dinero disponible del mes y deja de contar como ahorro.</span>
              </button>
              <button type="button" role="radio" aria-checked={goalDeleteResolution === 'fictional'} onClick={() => setGoalDeleteResolution('fictional')} className={goalDeleteResolution === 'fictional' ? 'w-full rounded-xl border border-rose-300 bg-rose-50 p-3 text-left dark:border-rose-900 dark:bg-rose-950/30' : 'w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}>
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">El saldo era ficticio</span><span className="mt-1 block text-xs text-rose-700 dark:text-rose-300">Solo elige esto si nunca ahorraste ese dinero. Se eliminarán el saldo y los movimientos asociados.</span>
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setGoalPendingDeletion(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
              <button type="button" onClick={handleConfirmGoalDeletion} className={goalDeleteResolution === 'fictional' ? 'min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700' : 'min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover'}>Confirmar y eliminar</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

import { parseMovementAmount } from '../../domain/movementAmount';
import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Trash2,
  Calendar,
  Target,
  Clock3,
  Check,
  AlertCircle,
} from 'lucide-react';
import { FinancialSummary, SavingsDestinationType, SavingsGoal, SavingsMovement, SavingsMovementType, UserProfile } from '../../types';
import { financeApplication } from '../../application/financeApplication';
import { PeriodSelector } from '../../components/layout/PeriodSelector';
import { PageHeader } from '../../components/layout/PageHeader';
import { ExportButton } from '../../components/ui/ExportButton';
import { MoneyField } from '../../components/ui/MoneyField';
import { ModalShell } from '../../components/ui/ModalShell';
import { ModalSurface } from '../../components/ui/ModalSurface';

type GoalDeleteResolution = 'general' | 'month' | 'fictional';

interface SavingsViewProps {
  summary: FinancialSummary;
  profile: UserProfile;
  monthKey: string;
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  onOpenSavingsModal: (mode: SavingsMovementType, goalId?: string, destinationType?: SavingsDestinationType) => void;
  onRefresh: () => void;
  onOpenExport: () => void;
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
  onOpenExport,
}) => {
  const [goals, setGoals] = useState<SavingsGoal[]>(() => financeApplication.getSavingsGoals());
  const [isAddingGoal, setIsAddingGoal] = useState<boolean>(false);
  const [movementError, setMovementError] = useState('');
  const [goalError, setGoalError] = useState('');
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');
  const [newGoalTarget, setNewGoalTarget] = useState<string>('');
  const [newGoalDate, setNewGoalDate] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [goalPendingDeletion, setGoalPendingDeletion] = useState<SavingsGoal | null>(null);
  const [goalDeleteResolution, setGoalDeleteResolution] = useState<GoalDeleteResolution>('general');

  const movements = financeApplication.getSavingsMovements();
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) || null;
  const selectedGoalMovements = selectedGoal
    ? movements.filter((movement) => movement.goalId === selectedGoal.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  useEffect(() => {
    setGoals(financeApplication.getSavingsGoals());
  }, [summary.totalSavingsVault]);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseMovementAmount(newGoalTarget);
    if (!newGoalTitle.trim() || target === null) {
      setGoalError('Introduce un nombre y un monto objetivo válido mayor que cero, con hasta dos decimales.');
      return;
    }
    setGoalError('');

    const newGoal: SavingsGoal = {
      id: 'goal-' + Date.now(),
      title: newGoalTitle.trim(),
      targetAmount: target,
      currentAmount: 0,
      targetDate: newGoalDate || undefined,
      color: '#10b981',
    };

    const updated = [...goals, newGoal];
    setGoals(updated);
    financeApplication.saveSavingsGoals(updated);
    setIsAddingGoal(false);
    setNewGoalTitle('');
    setNewGoalTarget('');
    setNewGoalDate('');
    onRefresh();
  };

  const handleDeleteGoal = (id: string) => {
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;
    setGoalDeleteResolution('general');
    setGoalPendingDeletion(goal);
  };

  const handleConfirmGoalDeletion = () => {
    if (!goalPendingDeletion) return;
    financeApplication.deleteSavingsGoal(goalPendingDeletion.id, goalDeleteResolution, monthKey);
    setGoals(financeApplication.getSavingsGoals());
    setSelectedGoalId(null);
    setGoalPendingDeletion(null);
    onRefresh();
  };

  const handleDeleteMovement = (id: string) => {
    if (confirm('¿Deseas eliminar este registro de movimiento de ahorro?')) {
      try { financeApplication.deleteSavingsMovement(id); setMovementError(''); setGoals(financeApplication.getSavingsGoals()); onRefresh(); }
      catch (error) { setMovementError(error instanceof Error ? error.message : 'No se pudo eliminar el movimiento.'); }
    }
  };

  const totalAssignedToGoals = goals.reduce((s, g) => s + g.currentAmount, 0);
  const totalFreeSavings = Math.max(0, summary.totalSavingsVault - totalAssignedToGoals);
  const formatNaturalDate = (date: string) => {
    const parsed = new Date(date + 'T00:00:00');
    return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed);
  };
  const getGoalStatus = (goal: SavingsGoal) => {
    if (goal.targetAmount > 0 && goal.currentAmount >= goal.targetAmount) return 'completed' as const;
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    if (goal.targetDate && goal.targetDate < today) return 'overdue' as const;
    return 'in-progress' as const;
  };

  return (
    <div className="app-page mx-auto max-w-none pb-6 animate-in fade-in duration-200">
      <PageHeader title="Tus ahorros" divider={false} period={<PeriodSelector year={year} month={month} onMonthChange={onMonthChange} />} actions={<ExportButton onClick={onOpenExport} />} />
      {movementError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{movementError}</p>}

      <section aria-labelledby="savings-summary-title" className="balance-panel">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p id="savings-summary-title" className="balance-label">Dinero ahorrado</p>
            <p className="type-display type-money mt-1 text-primary">{profile.currency} {summary.totalSavingsVault.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo vigente del fondo.</p>
          </div>
          <button type="button" onClick={() => onOpenSavingsModal('deposit_from_month')} className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 text-sm"><Plus className="h-4 w-4" aria-hidden="true" />Aportar dinero</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200/80 pt-4 dark:border-slate-800/80 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-slate-200/80 dark:sm:divide-slate-800/80">
          <div className="sm:pr-4"><p className="text-xs text-slate-500 dark:text-slate-400">Ahorro libre</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.currency} {totalFreeSavings.toLocaleString()}</p></div>
          <div className="sm:px-4"><p className="text-xs text-slate-500 dark:text-slate-400">Asignado a metas</p><p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{profile.currency} {totalAssignedToGoals.toLocaleString()}</p></div>
          <div className="col-span-2 border-t border-slate-200/80 pt-3 dark:border-slate-800/80 sm:col-span-1 sm:border-t-0 sm:py-0 sm:pl-4"><p className="text-xs text-slate-500 dark:text-slate-400">Aportes del mes</p><p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">+{profile.currency} {summary.savingsTransfersTo.toLocaleString()}</p></div>
        </div>
      </section>

      <section aria-labelledby="savings-goals-title" className="app-surface space-y-4">
        {!selectedGoal ? <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="savings-goals-title" className="text-base font-bold text-slate-900 dark:text-white">Metas de ahorro</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Organiza tu ahorro por objetivos.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {goals.length > 0 && <button type="button" onClick={() => onOpenSavingsModal('deposit_from_month', undefined, 'goal')} aria-label="Aportar a una meta existente" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus className="h-4 w-4" aria-hidden="true" /><span>Aportar a meta</span></button>}
              <button type="button" onClick={() => { setIsAddingGoal(!isAddingGoal); setGoalError(''); }} aria-label={isAddingGoal ? 'Cancelar nueva meta' : 'Crear nueva meta'} aria-expanded={isAddingGoal} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 px-3.5 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus className="h-4 w-4" aria-hidden="true" /><span>Nueva meta</span></button>
            </div>
          </div>
          {isAddingGoal && <form onSubmit={handleCreateGoal} className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Crear una meta</h3>
            {goalError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{goalError}</p>}
            <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="block min-w-0 space-y-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"><span>Nombre</span><input type="text" required placeholder="Ej. Vacaciones" value={newGoalTitle} onChange={(e) => setNewGoalTitle(e.target.value)} className="h-14 w-full rounded-xl border border-slate-200 bg-app-background px-3 text-sm text-app-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700" /></label>
              <MoneyField label="Monto objetivo" currency={profile.currency} value={newGoalTarget} onValueChange={setNewGoalTarget} min="1" />
              <label className="block min-w-0 space-y-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"><span>Fecha objetivo</span><input type="date" value={newGoalDate} onChange={(e) => setNewGoalDate(e.target.value)} className="h-14 w-full min-w-0 rounded-xl border border-slate-200 bg-app-background px-3 text-sm text-app-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700" /></label>
              <div className="flex min-h-14 items-center justify-end gap-2 sm:col-span-2 xl:col-span-1"><button type="button" onClick={() => setIsAddingGoal(false)} className="min-h-11 rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</button><button type="submit" className="btn-primary min-h-11 text-sm">Guardar meta</button></div>
            </div>
          </form>}
          {goals.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center dark:border-slate-700"><Target className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Aún no tienes metas de ahorro</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Crea una meta para organizar el dinero que quieres reservar.</p></div> : <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {goals.map((goal) => {
              const percent = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
              const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
              const status = getGoalStatus(goal);
              const statusStyle = status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : status === 'overdue' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-primary/5 text-primary dark:bg-primary/15 dark:text-blue-200';
              const statusLabel = status === 'completed' ? 'Completada' : status === 'overdue' ? 'Vencida' : 'En progreso';
              const StatusIcon = status === 'completed' ? Check : status === 'overdue' ? AlertCircle : Clock3;
              return <article key={goal.id} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary/30 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{goal.title}</h3>{goal.targetDate && <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />Objetivo: {formatNaturalDate(goal.targetDate)}</p>}</div>
                  <div className="flex shrink-0 items-center gap-1.5"><span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ' + statusStyle}><StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />{statusLabel}</span><button type="button" onClick={() => handleDeleteGoal(goal.id)} className="btn-icon h-9 w-9 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" aria-label={(goal.currentAmount > 0 ? 'Cerrar' : 'Eliminar') + ' meta ' + goal.title} title={goal.currentAmount > 0 ? 'Cerrar meta' : 'Eliminar meta'}><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div>
                </div>
                <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-xs text-slate-500 dark:text-slate-400">Ahorrado</p><p className="mt-0.5 text-lg font-bold tracking-tight text-slate-950 dark:text-white">{profile.currency} {goal.currentAmount.toLocaleString()}</p></div><p className="pb-1 text-right text-xs text-slate-500 dark:text-slate-400">Meta<br /><span className="font-semibold text-slate-700 dark:text-slate-200">{profile.currency} {goal.targetAmount.toLocaleString()}</span></p></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" role="progressbar" aria-label={'Progreso de ' + goal.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: percent + '%' }} /></div>
                <div className="mt-2 flex items-center justify-between text-xs"><span className="font-semibold text-primary">{percent.toFixed(0)}% completado</span><span className="text-slate-500 dark:text-slate-400">{remaining > 0 ? 'Faltan ' + profile.currency + ' ' + remaining.toLocaleString() : 'Objetivo alcanzado'}</span></div>
                <div className="mt-auto flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:pt-5"><button type="button" onClick={() => onOpenSavingsModal('deposit_from_month', goal.id)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Plus className="h-4 w-4" aria-hidden="true" />Aportar</button><button type="button" onClick={() => setSelectedGoalId(goal.id)} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Ver detalles</button></div>
              </article>;
            })}
          </div>}
        </> : <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" aria-labelledby="goal-detail-title">
          <button type="button" onClick={() => setSelectedGoalId(null)} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Volver a todas las metas</button>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="goal-detail-title" className="text-lg font-bold text-slate-900 dark:text-white">{selectedGoal.title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Saldo asignado a esta meta · {getGoalStatus(selectedGoal) === 'completed' ? 'Completada' : getGoalStatus(selectedGoal) === 'overdue' ? 'Vencida' : 'En progreso'}</p></div>{selectedGoal.targetDate && <span className="text-sm text-slate-500 dark:text-slate-400">Objetivo: {formatNaturalDate(selectedGoal.targetDate)}</span>}</div>
          <div className="flex flex-wrap items-end justify-between gap-3"><p className="type-money text-2xl font-bold text-primary">{profile.currency} {selectedGoal.currentAmount.toLocaleString()}</p><p className="text-sm text-slate-500 dark:text-slate-400">de {profile.currency} {selectedGoal.targetAmount.toLocaleString()}</p></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-primary" style={{ width: (selectedGoal.targetAmount > 0 ? Math.min(100, selectedGoal.currentAmount / selectedGoal.targetAmount * 100) : 0) + '%' }} /></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onOpenSavingsModal('deposit_from_month', selectedGoal.id)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><Plus className="h-4 w-4" aria-hidden="true" />Aportar</button><button type="button" onClick={() => onOpenSavingsModal('withdraw_to_month', selectedGoal.id)} className="min-h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Retirar de la meta</button><button type="button" onClick={() => handleDeleteGoal(selectedGoal.id)} className="ml-auto flex min-h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30" aria-label="Eliminar meta"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div>
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Historial de esta meta</h3><span className="text-xs text-slate-500 dark:text-slate-400">{selectedGoalMovements.length} movimiento{selectedGoalMovements.length === 1 ? '' : 's'}</span></div>
            {selectedGoalMovements.length === 0 ? <p className="py-4 text-sm text-slate-500 dark:text-slate-400">Aún no hay aportes o retiros vinculados a esta meta.</p> : <div className="divide-y divide-slate-100 dark:divide-slate-800">{selectedGoalMovements.map((movement: SavingsMovement) => { const isDeposit = movement.type === 'deposit_from_month'; const label = isDeposit ? 'Aporte' : movement.type === 'withdraw_to_month' ? 'Retiro al mes' : movement.type === 'direct_expense' ? 'Gasto desde la meta' : 'Reasignación'; return <div key={movement.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-start gap-3"><div className={'mt-0.5 rounded-full p-2 ' + (isDeposit ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400')}>{isDeposit ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{movement.description}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label} · {formatNaturalDate(movement.date)}{movement.category ? ' · ' + movement.category : ''}</p></div></div><span className={'shrink-0 text-sm font-bold ' + (isDeposit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{isDeposit ? '+' : '−'}{profile.currency} {movement.amount.toLocaleString()}</span></div>; })}</div>}
          </div>
        </section>}
      </section>

      {!selectedGoal && <section className="app-surface" aria-labelledby="savings-history-title">
        <div className="app-section-heading"><div><h2 id="savings-history-title" className="type-section-title">Historial de ahorro</h2><p className="mt-1 text-xs text-slate-500">Aportes, retiros y pagos del mes seleccionado.</p></div></div>
        {movements.filter(movement => movement.monthKey === monthKey).length === 0 ? <p className="app-empty mt-3">Aún no hay movimientos de ahorro en este mes.</p> : [...movements].filter(movement => movement.monthKey === monthKey).sort((a, b) => b.date.localeCompare(a.date)).map(movement => <div key={movement.id} className="recent-row">
          <span className={'movement-icon ' + (movement.type === 'direct_expense' ? 'text-rose-600 dark:text-rose-400' : 'text-primary')}>{movement.type === 'deposit_from_month' ? <ArrowDownRight className="h-5 w-5" aria-hidden="true" /> : <ArrowUpRight className="h-5 w-5" aria-hidden="true" />}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{movement.description}</p><p className="mt-0.5 text-xs text-slate-500">{movement.type === 'deposit_from_month' ? 'Aporte interno' : movement.type === 'withdraw_to_month' ? 'Retiro al mes' : movement.type === 'direct_expense' ? 'Gasto desde ahorro' : 'Reasignación'} · {formatNaturalDate(movement.date)}</p></div>
          <span className="max-w-full break-words text-right text-sm font-semibold tabular-nums">{profile.currency} {movement.amount.toLocaleString()}</span>
        </div>)}
      </section>}

      {goalPendingDeletion && <ModalShell title="Eliminar meta de ahorro" onClose={() => setGoalPendingDeletion(null)}><ModalSurface className="app-mobile-sheet p-5"><h2 id="delete-goal-title" className="text-lg font-bold text-slate-900 dark:text-white">Eliminar «{goalPendingDeletion.title}»</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Esta meta tiene <strong>{profile.currency} {goalPendingDeletion.currentAmount.toLocaleString()}</strong>. Elige qué hacer con ese saldo antes de eliminarla.</p><div className="mt-4 space-y-2" role="radiogroup" aria-label="Destino del saldo de la meta"><button type="button" role="radio" aria-checked={goalDeleteResolution === 'general'} onClick={() => setGoalDeleteResolution('general')} className={goalDeleteResolution === 'general' ? 'w-full rounded-xl border border-primary bg-primary-soft/50 p-3 text-left' : 'w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}><span className="block text-sm font-semibold text-slate-900 dark:text-white">Mover a Ahorro General</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Conserva el dinero y el historial; el saldo queda sin asignar a una meta.</span></button><button type="button" role="radio" aria-checked={goalDeleteResolution === 'month'} onClick={() => setGoalDeleteResolution('month')} className={goalDeleteResolution === 'month' ? 'w-full rounded-xl border border-primary bg-primary-soft/50 p-3 text-left' : 'w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}><span className="block text-sm font-semibold text-slate-900 dark:text-white">Pasar al presupuesto de este mes</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">El saldo se agrega al dinero disponible del mes y deja de contar como ahorro.</span></button><button type="button" role="radio" aria-checked={goalDeleteResolution === 'fictional'} onClick={() => setGoalDeleteResolution('fictional')} className={goalDeleteResolution === 'fictional' ? 'w-full rounded-xl border border-rose-300 bg-rose-50 p-3 text-left dark:border-rose-900 dark:bg-rose-950/30' : 'w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}><span className="block text-sm font-semibold text-slate-900 dark:text-white">El saldo era ficticio</span><span className="mt-1 block text-xs text-rose-700 dark:text-rose-300">Solo elige esto si nunca ahorraste ese dinero. Se eliminarán el saldo y los movimientos asociados.</span></button></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setGoalPendingDeletion(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button><button type="button" onClick={handleConfirmGoalDeletion} className={goalDeleteResolution === 'fictional' ? 'min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-700' : 'min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover'}>Confirmar y eliminar</button></div></ModalSurface></ModalShell>}
    </div>
  );
};

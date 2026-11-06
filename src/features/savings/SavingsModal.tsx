import { parseMovementAmount } from '../../domain/movementAmount';
import { MoneyField } from '../../components/ui/MoneyField';
import { ModalShell } from '../../components/ui/ModalShell';
import { ModalSurface } from '../../components/ui/ModalSurface';
import React, { useState, useEffect } from 'react';
import {
  X,
  PiggyBank,
  ArrowDownRight,
  ArrowUpRight,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { SavingsMovementType, UserProfile, FinancialSummary, SavingsGoal } from '../../types';
import { financeApplication } from '../../application/financeApplication';
import { EXPENSE_CATEGORIES } from '../../constants/categories';

interface SavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  year: number;
  month: number;
  profile: UserProfile;
  summary: FinancialSummary;
  onSaved: () => void;
  initialMode?: SavingsMovementType;
  initialGoalId?: string;
  initialDraft?: { amount: string; description: string; date: string };
}

export const SavingsModal: React.FC<SavingsModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  profile,
  summary,
  onSaved,
  initialMode = 'deposit_from_month',
  initialGoalId,
  initialDraft,
}) => {
  const [mode, setMode] = useState<SavingsMovementType>(initialMode);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [destinationType, setDestinationType] = useState<'general' | 'goal'>('general');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].name);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setAmount(initialDraft?.amount || '');
      setDescription(initialDraft?.description || '');
      setDestinationType(initialGoalId ? 'goal' : 'general');
      setErrorMsg('');
      setDate(initialDraft?.date || new Date().toISOString().split('T')[0]);
      const gList = financeApplication.getSavingsGoals();
      setGoals(gList);
      if (gList.length > 0) {
        setSelectedGoalId(initialGoalId || gList[0].id);
      } else {
        setSelectedGoalId('');
      }
    }
  }, [isOpen, initialMode, initialGoalId, initialDraft]);

  if (!isOpen) return null;

  const numAmount = parseMovementAmount(amount) ?? 0;
  const currentGoal = goals.find((g) => g.id === selectedGoalId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (numAmount <= 0) {
      setErrorMsg('Por favor introduce un monto válido mayor a 0.');
      return;
    }

    if (mode === 'deposit_from_month' && numAmount > summary.availableBalance) {
      setErrorMsg(
        `El monto excede el saldo disponible del mes (${profile.currency} ${summary.availableBalance.toLocaleString()}).`
      );
      return;
    }

    if (
      (mode === 'withdraw_to_month' || mode === 'direct_expense') &&
      numAmount > summary.totalSavingsVault
    ) {
      setErrorMsg(
        `No tienes suficiente dinero en tu fondo de ahorro (${profile.currency} ${summary.totalSavingsVault.toLocaleString()}).`
      );
      return;
    }

    if (mode !== 'deposit_from_month' && destinationType === 'general') {
      const assignedToGoals = goals.reduce((sum, goal) => sum + (Number(goal.currentAmount) || 0), 0);
      const generalAvailable = Math.max(0, summary.totalSavingsVault - assignedToGoals);
      if (numAmount > generalAvailable) {
        setErrorMsg('El ahorro general disponible es ' + profile.currency + ' ' + generalAvailable.toLocaleString() + '. Los fondos asignados a metas deben retirarse desde su meta.');
        return;
      }
    }

    if (destinationType === 'goal' && (!selectedGoalId || !currentGoal)) {
      setErrorMsg('Por favor selecciona una meta de ahorro.');
      return;
    }

    if (mode !== 'deposit_from_month' && destinationType === 'goal' && currentGoal && numAmount > currentGoal.currentAmount) {
      setErrorMsg(`El retiro supera el saldo de esta meta (${profile.currency} ${currentGoal.currentAmount.toLocaleString()}).`);
      return;
    }

    const defaultDesc =
      mode === 'deposit_from_month'
        ? destinationType === 'goal'
          ? `Aporte a meta: ${currentGoal?.title || 'Meta'}`
          : 'Aporte a Ahorro General'
        : mode === 'withdraw_to_month'
        ? destinationType === 'goal' ? `Retiro de meta: ${currentGoal?.title || 'Meta'}` : 'Transferencia al mes corriente'
        : destinationType === 'goal' ? `Pago desde meta: ${currentGoal?.title || 'Meta'}` : 'Gasto directo desde ahorros';

    financeApplication.addSavingsMovement({
      monthKey,
      type: mode,
      amount: numAmount,
      description: description.trim() || defaultDesc,
      destinationType,
      goalId: destinationType === 'goal' ? selectedGoalId : undefined,
      goalTitle: destinationType === 'goal' ? currentGoal?.title : undefined,
      category: mode === 'direct_expense' ? category : undefined,
      date,
    });

    onSaved();
    onClose();
    setAmount('');
    setDescription('');
  };

  return (
    <ModalShell title="Gestionar ahorro" onClose={onClose}>
      <ModalSurface scroll="auto">
        {/* Header */}
        <div className="p-5 bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <SlidersHorizontal className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="type-dialog-title font-bold">{initialGoalId ? (mode === 'deposit_from_month' ? 'Aportar a la meta' : mode === 'withdraw_to_month' ? 'Retirar de la meta' : 'Pagar desde la meta') : 'Gestionar ahorro'}</h2>
              <p className="text-xs text-white/75">Fondo Total en Bóveda: {profile.currency} {summary.totalSavingsVault.toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mx-5 mt-4 flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => { setMode('deposit_from_month'); setErrorMsg(''); }}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-2 text-xs font-semibold transition-colors ${
              mode === 'deposit_from_month'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Mes ➔ Ahorro</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('withdraw_to_month'); setErrorMsg(''); }}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-2 text-xs font-semibold transition-colors ${
              mode === 'withdraw_to_month'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Ahorro ➔ Mes</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('direct_expense'); setErrorMsg(''); }}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-2 text-xs font-semibold transition-colors ${
              mode === 'direct_expense'
                ? 'border-b-2 border-primary text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Pago Directo</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-4">
          {/* Quick Context Card */}
          <div className="flex items-center justify-between gap-3 border-y border-slate-200 py-3 text-sm dark:border-slate-800">
            {mode === 'deposit_from_month' ? (
              <>
                <span className="text-slate-500 dark:text-slate-400">Disponible en mes actual:</span>
                <span className="font-bold text-primary">
                  {profile.currency} {summary.availableBalance.toLocaleString()}
                </span>
              </>
            ) : (
              <>
                {destinationType === 'goal' && currentGoal ? (
                <>
                  <span className="text-slate-500 dark:text-slate-400">Saldo de la meta:</span>
                  <span className="font-bold text-primary">{profile.currency} {currentGoal.currentAmount.toLocaleString()}</span>
                </>
              ) : (
                <>
                  <span className="text-slate-500 dark:text-slate-400">Saldo actual en alcancía:</span>
                  <span className="font-bold text-primary">{profile.currency} {summary.totalSavingsVault.toLocaleString()}</span>
                </>
              )}
              </>
            )}
          </div>

          {/* Select the goal that receives this contribution or funds this withdrawal. */}
          {initialGoalId ? (
            <div className="space-y-1" aria-label="Meta seleccionada">
              <p className="text-xs text-slate-500 dark:text-slate-400">Meta de ahorro</p>
              <p className="font-semibold">{currentGoal?.title || 'Esta meta ya no está disponible'}</p>
            </div>
          ) : (
          <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {mode === 'deposit_from_month' ? 'Destino del ahorro' : 'Origen de los fondos'}
              </label>
              <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDestinationType('general')}
                  className={`w-full py-3 text-left transition-colors flex flex-col gap-1 ${
                    destinationType === 'general'
                      ? 'text-primary'
                      : 'text-slate-700 dark:text-slate-300 hover:text-primary'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <PiggyBank className="w-3.5 h-3.5 text-primary" />
                    <span>Ahorro General</span>
                  </div>
                  <span className="text-xs text-slate-500">Sin asignar a meta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDestinationType('goal')}
                  disabled={goals.length === 0}
                  className={`w-full py-3 text-left transition-colors flex flex-col gap-1 disabled:cursor-not-allowed disabled:opacity-50 ${
                    destinationType === 'goal'
                      ? 'text-primary'
                      : 'text-slate-700 dark:text-slate-300 hover:text-primary'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span>Meta de Ahorro</span>
                  </div>
                  <span className="text-xs text-slate-500">{mode === 'deposit_from_month' ? 'Suma al saldo de la meta' : 'Se descuenta del saldo de la meta'}</span>
                </button>
              </div>

              {destinationType === 'goal' && (
                <div className="mt-2 space-y-1">
                  <select
                    value={selectedGoalId}
                    onChange={(e) => setSelectedGoalId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title} ({profile.currency}{g.currentAmount.toLocaleString()} de {profile.currency}{g.targetAmount.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}
          </div>

          )}

          <MoneyField label="Monto" currency={profile.currency} value={amount} onValueChange={setAmount} min="1" />

          {/* Direct expense category */}
          {mode === 'direct_expense' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Categoría del Pago
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Concepto / Motivo
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                mode === 'deposit_from_month'
                  ? destinationType === 'goal'
                    ? `Ej. Aporte para ${currentGoal?.title || 'meta'}`
                    : 'Ej. Depósito quincenal a la alcancía'
                  : mode === 'withdraw_to_month'
                  ? 'Ej. Usar ahorro para cubrir imprevisto del mes'
                  : 'Ej. Pago de reparación de auto o compra urgente'
              }
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar</span>
            </button>
          </div>
        </form>
      </ModalSurface>
    </ModalShell>
  );
};


import { parseMovementAmount } from '../../domain/movementAmount';
import { MoneyField } from '../ui/MoneyField';
import { ModalShell } from '../ui/ModalShell';
import { ModalSurface } from '../ui/ModalSurface';
import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  PiggyBank,
  Target,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { UserProfile, FinancialSummary, SavingsGoal } from '../../types';
import { financeApplication } from '../../application/financeApplication';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  profile: UserProfile;
  summary: FinancialSummary;
  onSaved: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  profile,
  summary,
  onSaved,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [destinationType, setDestinationType] = useState<'general' | 'goal'>('general');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    if (isOpen) {
      const gList = financeApplication.getSavingsGoals();
      setGoals(gList);
      if (gList.length > 0) {
        setSelectedGoalId(gList[0].id);
      }
      setAmount('');
      setDestinationType('general');
      setDescription('');
      setErrorMsg('');
      setDate(new Date().toISOString().split('T')[0]);
    }
  }, [isOpen]);

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

    if (numAmount > summary.availableBalance) {
      setErrorMsg(
        `El monto excede el saldo disponible del mes (${profile.currency} ${summary.availableBalance.toLocaleString()}).`
      );
      return;
    }

    if (destinationType === 'goal' && (!selectedGoalId || !currentGoal)) {
      setErrorMsg('Por favor selecciona una meta de ahorro de destino.');
      return;
    }

    const defaultDesc =
      destinationType === 'goal'
        ? `Aporte a meta: ${currentGoal?.title || 'Meta'}`
        : 'Aporte a Ahorro General';

    financeApplication.addSavingsMovement({
      monthKey,
      type: 'deposit_from_month',
      amount: numAmount,
      description: description.trim() || defaultDesc,
      destinationType,
      goalId: destinationType === 'goal' ? selectedGoalId : undefined,
      goalTitle: destinationType === 'goal' ? currentGoal?.title : undefined,
      date,
    });

    onSaved();
    onClose();
  };

  return (
    <ModalShell title="Transferir a ahorro" onClose={onClose} size="md">
      <ModalSurface scroll="auto">
        {/* Header */}
        <div className="p-5 bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="type-dialog-title font-bold">Transferir Dinero a Ahorro</h2>
              <p className="text-xs text-white/75">
                Pase de fondos del mes activo a tu alcancía
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Available in month banner */}
        <div className="mx-5 mt-4 flex items-center justify-between gap-3 border-y border-slate-200 py-3 text-sm dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            Balance disponible este mes:
          </span>
          <span className="font-extrabold text-primary text-sm">
            {profile.currency} {summary.availableBalance.toLocaleString()}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <MoneyField label="Monto a transferir" currency={profile.currency} value={amount} onValueChange={setAmount} min="1" max={summary.availableBalance > 0 ? summary.availableBalance : undefined} />

          {/* Destination Selector: Ahorro General vs Meta */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Destino del Dinero
            </label>
            <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDestinationType('general')}
                className={`w-full py-3 text-left transition-colors flex flex-col gap-1.5 ${
                  destinationType === 'general'
                    ? 'text-primary'
                    : 'text-slate-700 dark:text-slate-300 hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <PiggyBank className="w-4 h-4 text-primary" />
                  <span>Ahorro General</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                  Fondo libre. No se contabiliza en ninguna meta.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDestinationType('goal')}
                className={`w-full py-3 text-left transition-colors flex flex-col gap-1.5 ${
                  destinationType === 'goal'
                    ? 'text-primary'
                    : 'text-slate-700 dark:text-slate-300 hover:text-primary'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Target className="w-4 h-4 text-primary" />
                  <span>Meta de Ahorro</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                  Suma a la meta y también cuenta en ahorro general.
                </p>
              </button>
            </div>
          </div>

          {/* Goal Selector (if destination is goal) */}
          {destinationType === 'goal' && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Selecciona la Meta a la que transferir:
              </label>
              {goals.length === 0 ? (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
                  No tienes metas creadas aún. Puedes crear una en la sección de Ahorros o transferir a Ahorro General.
                </div>
              ) : (
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {goals.map((g) => {
                    const percent = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
                    return (
                      <option key={g.id} value={g.id}>
                        {g.title} ({profile.currency}{g.currentAmount.toLocaleString()} de {profile.currency}{g.targetAmount.toLocaleString()} - {percent}%)
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Concepto / Nota (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                destinationType === 'goal'
                  ? `Ej. Aporte para ${currentGoal?.title || 'meta'}`
                  : 'Ej. Depósito quincenal a la alcancía'
              }
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Clarity note */}
          <div className="p-2.5 rounded-xl bg-primary-soft dark:bg-primary-soft border border-primary/20 text-xs text-primary dark:text-primary flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-primary mt-0.5" />
            <span>
              {destinationType === 'goal'
                ? `💡 Se transferirá a "${currentGoal?.title || 'la meta'}" y también sumará al balance total de Ahorro General.`
                : '💡 Se transferirá a Ahorro General. Quedará disponible en tu fondo de ahorro sin asignar a ninguna meta específica.'}
            </span>
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
              <span>Transferir a Ahorro</span>
            </button>
          </div>
        </form>
      </ModalSurface>
    </ModalShell>
  );
};

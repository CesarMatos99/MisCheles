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
import { UserProfile, FinancialSummary, SavingsGoal } from '../types';
import { storageService } from '../services/storage';

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
      const gList = storageService.getSavingsGoals();
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

  const numAmount = parseFloat(amount) || 0;
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

    storageService.addSavingsMovement({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-teal-600 via-emerald-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <ArrowRightLeft className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Transferir Dinero a Ahorro</h2>
              <p className="text-xs text-emerald-100">
                Pase de fondos del mes activo a tu alcancía
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Available in month banner */}
        <div className="p-3 mx-5 mt-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs flex justify-between items-center">
          <span className="text-slate-500 dark:text-slate-400">
            Balance disponible este mes:
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
            {profile.currency} {summary.availableBalance.toLocaleString()}
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Monto a transferir ({profile.currency})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">
                {profile.currency}
              </span>
              <input
                type="number"
                step="any"
                required
                min="1"
                max={summary.availableBalance > 0 ? summary.availableBalance : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Destination Selector: Ahorro General vs Meta */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Destino del Dinero
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDestinationType('general')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1.5 ${
                  destinationType === 'general'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Ahorro General</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Fondo libre. No se contabiliza en ninguna meta.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDestinationType('goal')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1.5 ${
                  destinationType === 'goal'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Meta de Ahorro</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
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
                  className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Clarity note */}
          <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 text-[11px] text-teal-800 dark:text-teal-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
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
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Transferir a Ahorro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

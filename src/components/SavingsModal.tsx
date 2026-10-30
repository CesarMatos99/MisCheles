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
import { SavingsMovementType, UserProfile, FinancialSummary, SavingsGoal } from '../types';
import { storageService } from '../services/storage';
import { EXPENSE_CATEGORIES } from '../constants/categories';

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
}

export const SavingsModal: React.FC<SavingsModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  profile,
  summary,
  onSaved,
  initialMode = 'deposit_from_month',
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
      setAmount('');
      setDescription('');
      setDestinationType('general');
      setErrorMsg('');
      setDate(new Date().toISOString().split('T')[0]);
      const gList = storageService.getSavingsGoals();
      setGoals(gList);
      if (gList.length > 0) {
        setSelectedGoalId(gList[0].id);
      }
    }
  }, [isOpen, initialMode]);

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

    if (mode === 'deposit_from_month' && destinationType === 'goal' && (!selectedGoalId || !currentGoal)) {
      setErrorMsg('Por favor selecciona una meta de ahorro de destino.');
      return;
    }

    const defaultDesc =
      mode === 'deposit_from_month'
        ? destinationType === 'goal'
          ? `Aporte a meta: ${currentGoal?.title || 'Meta'}`
          : 'Aporte a Ahorro General'
        : mode === 'withdraw_to_month'
        ? 'Transferencia al mes corriente'
        : 'Gasto directo desde ahorros';

    storageService.addSavingsMovement({
      monthKey,
      type: mode,
      amount: numAmount,
      description: description.trim() || defaultDesc,
      destinationType: mode === 'deposit_from_month' ? destinationType : undefined,
      goalId: mode === 'deposit_from_month' && destinationType === 'goal' ? selectedGoalId : undefined,
      goalTitle: mode === 'deposit_from_month' && destinationType === 'goal' ? currentGoal?.title : undefined,
      category: mode === 'direct_expense' ? category : undefined,
      date,
    });

    onSaved();
    onClose();
    setAmount('');
    setDescription('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <SlidersHorizontal className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Gestionar Acciones de Ahorro</h2>
              <p className="text-xs text-emerald-100">Fondo Total en Bóveda: {profile.currency} {summary.totalSavingsVault.toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="p-2 bg-slate-100 dark:bg-slate-800/80 m-4 rounded-2xl flex gap-1">
          <button
            type="button"
            onClick={() => { setMode('deposit_from_month'); setErrorMsg(''); }}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'deposit_from_month'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Mes ➔ Ahorro</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('withdraw_to_month'); setErrorMsg(''); }}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'withdraw_to_month'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Ahorro ➔ Mes</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('direct_expense'); setErrorMsg(''); }}
            className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'direct_expense'
                ? 'bg-rose-600 text-white shadow-sm'
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
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs flex justify-between items-center">
            {mode === 'deposit_from_month' ? (
              <>
                <span className="text-slate-500 dark:text-slate-400">Disponible en mes actual:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {profile.currency} {summary.availableBalance.toLocaleString()}
                </span>
              </>
            ) : (
              <>
                <span className="text-slate-500 dark:text-slate-400">Saldo actual en alcancía:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {profile.currency} {summary.totalSavingsVault.toLocaleString()}
                </span>
              </>
            )}
          </div>

          {/* Destination Selector for deposit_from_month: General vs Meta */}
          {mode === 'deposit_from_month' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Destino del Ahorro
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDestinationType('general')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                    destinationType === 'general'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <PiggyBank className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Ahorro General</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Sin asignar a meta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDestinationType('goal')}
                  className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 ${
                    destinationType === 'goal'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-sm ring-1 ring-emerald-500'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Meta de Ahorro</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Suma a meta y total</span>
                </button>
              </div>

              {destinationType === 'goal' && (
                <div className="mt-2 space-y-1">
                  <select
                    value={selectedGoalId}
                    onChange={(e) => setSelectedGoalId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Monto ({profile.currency})
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Direct expense category */}
          {mode === 'direct_expense' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Categoría del Pago
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


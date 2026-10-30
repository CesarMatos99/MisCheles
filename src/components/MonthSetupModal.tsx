import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Wallet,
  PiggyBank,
  Target,
  ArrowRight,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { MonthConfig, UserProfile, SavingsGoal } from '../types';
import { MONTH_NAMES_ES } from '../constants/categories';
import { storageService, getPrevMonthKey } from '../services/storage';

interface MonthSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  profile: UserProfile;
  onSaved: (config: MonthConfig) => void;
}

type RolloverOption = 'rollover_to_month' | 'transfer_to_savings_general' | 'transfer_to_goal' | 'none';

export const MonthSetupModal: React.FC<MonthSetupModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  profile,
  onSaved,
}) => {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthName = MONTH_NAMES_ES[month - 1];
  const { year: prevYear, month: prevMonthNumber, key: prevKey } = getPrevMonthKey(year, month);
  const prevMonthName = MONTH_NAMES_ES[prevMonthNumber - 1];

  const [initialIncome, setInitialIncome] = useState<string>('');
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [rolloverAction, setRolloverAction] = useState<RolloverOption>('rollover_to_month');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const existing = storageService.getMonthConfig(monthKey);
      const remainingPrev = storageService.getPreviousMonthRemaining(year, month);
      const effectivePrevBalance = Math.max(remainingPrev, existing?.carryoverFromPrev || 0);
      setPreviousBalance(effectivePrevBalance);

      const gList = storageService.getSavingsGoals();
      setGoals(gList);
      if (gList.length > 0) {
        setSelectedGoalId(existing?.rolloverGoalId || gList[0].id);
      }

      if (existing) {
        setInitialIncome(existing.initialIncome > 0 ? String(existing.initialIncome) : '');
        setRolloverAction(
          existing.rolloverAction || (existing.carryoverFromPrev > 0 ? 'rollover_to_month' : 'none')
        );
        setNotes(existing.notes || '');
      } else {
        setInitialIncome(profile.monthlyTargetIncome > 0 ? String(profile.monthlyTargetIncome) : '');
        setRolloverAction(effectivePrevBalance > 0 ? 'rollover_to_month' : 'none');
        setNotes('');
      }
    }
  }, [isOpen, monthKey, year, month, profile.monthlyTargetIncome]);

  if (!isOpen) return null;

  const numInitial = parseFloat(initialIncome) || 0;
  const carryoverAmount =
    previousBalance > 0 && rolloverAction === 'rollover_to_month' ? previousBalance : 0;
  const totalStartingBudget = numInitial + carryoverAmount;
  const currentGoal = goals.find((g) => g.id === selectedGoalId);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // If transferring to savings, record the transfer in storage
    if (previousBalance > 0) {
      if (rolloverAction === 'transfer_to_savings_general') {
        storageService.addSavingsMovement({
          monthKey: prevKey,
          type: 'deposit_from_month',
          amount: previousBalance,
          description: `Traspaso sobrante de ${prevMonthName} a Ahorro General`,
          destinationType: 'general',
          date: new Date().toISOString().split('T')[0],
        });
      } else if (rolloverAction === 'transfer_to_goal' && selectedGoalId && currentGoal) {
        storageService.addSavingsMovement({
          monthKey: prevKey,
          type: 'deposit_from_month',
          amount: previousBalance,
          description: `Traspaso sobrante de ${prevMonthName} a Meta: ${currentGoal.title}`,
          destinationType: 'goal',
          goalId: selectedGoalId,
          goalTitle: currentGoal.title,
          date: new Date().toISOString().split('T')[0],
        });
      }
    }

    const config: MonthConfig = {
      monthKey,
      year,
      month,
      initialIncome: numInitial,
      carryoverFromPrev: carryoverAmount,
      autoRolloverEnabled: rolloverAction === 'rollover_to_month',
      rolloverAction,
      rolloverGoalId: rolloverAction === 'transfer_to_goal' ? selectedGoalId : undefined,
      rolloverGoalTitle: rolloverAction === 'transfer_to_goal' ? currentGoal?.title : undefined,
      notes,
      isConfigured: true,
    };

    storageService.saveMonthConfig(config);
    onSaved(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Cobro / Configurar Mes</h2>
              <p className="text-xs text-emerald-100">{monthName} {year}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Initial Income */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Monto inicial de este mes ({profile.currency})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">
                {profile.currency}
              </span>
              <input
                type="number"
                step="any"
                required
                min="0"
                value={initialIncome}
                onChange={(e) => setInitialIncome(e.target.value)}
                placeholder="Ej. 65000"
                className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Tu cobro mensual, salario o fondo asignado para arrancar {monthName}.
            </p>
          </div>

          {/* Dinero Restante del Mes Anterior: Options Section */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              previousBalance > 0
                ? 'bg-slate-50 dark:bg-slate-800/50 border-emerald-500/30 dark:border-emerald-500/20'
                : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700/50'
            }`}
          >
            <div className="flex items-start gap-2.5 mb-3">
              <div
                className={`p-2 rounded-xl mt-0.5 ${
                  previousBalance > 0
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
              >
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Dinero Restante de {prevMonthName} {prevYear}
                  </h4>
                  {previousBalance > 0 && (
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {profile.currency} {previousBalance.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {previousBalance > 0
                    ? `Tienes ${profile.currency} ${previousBalance.toLocaleString()} disponibles del mes anterior. ¿Qué deseas hacer con ellos?`
                    : `No hubo dinero restante en ${prevMonthName}.`}
                </p>
              </div>
            </div>

            {/* Action options for leftover balance */}
            {previousBalance > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                {/* Option 1: Sumar al mes siguiente */}
                <label
                  onClick={() => setRolloverAction('rollover_to_month')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    rolloverAction === 'rollover_to_month'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-slate-900 dark:text-white ring-1 ring-emerald-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="rolloverAction"
                    checked={rolloverAction === 'rollover_to_month'}
                    onChange={() => setRolloverAction('rollover_to_month')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Sumar al mes siguiente ({monthName})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Se añade al presupuesto disponible de {monthName} (+{profile.currency}{previousBalance.toLocaleString()}).
                    </p>
                  </div>
                </label>

                {/* Option 2: Transferir a ahorro general */}
                <label
                  onClick={() => setRolloverAction('transfer_to_savings_general')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    rolloverAction === 'transfer_to_savings_general'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-slate-900 dark:text-white ring-1 ring-emerald-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="rolloverAction"
                    checked={rolloverAction === 'transfer_to_savings_general'}
                    onChange={() => setRolloverAction('transfer_to_savings_general')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <PiggyBank className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      <span>Transferir a Ahorro General</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Deposita el sobrante directamente en tu alcancía/ahorro sin asignarlo a ninguna meta.
                    </p>
                  </div>
                </label>

                {/* Option 3: Transferir a meta específica */}
                <label
                  onClick={() => setRolloverAction('transfer_to_goal')}
                  className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition ${
                    rolloverAction === 'transfer_to_goal'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-slate-900 dark:text-white ring-1 ring-emerald-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="rolloverAction"
                      checked={rolloverAction === 'transfer_to_goal'}
                      onChange={() => setRolloverAction('transfer_to_goal')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Target className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Transferir a una Meta Específica</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Abona a la meta seleccionada y también se contabiliza en tu ahorro total.
                      </p>
                    </div>
                  </div>

                  {rolloverAction === 'transfer_to_goal' && (
                    <div className="pl-6 pt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                      <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                        Selecciona la meta de ahorro:
                      </label>
                      {goals.length === 0 ? (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                          No tienes metas creadas. Puedes crearlas en el módulo de Ahorro.
                        </p>
                      ) : (
                        <select
                          value={selectedGoalId}
                          onChange={(e) => setSelectedGoalId(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {goals.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title} ({profile.currency}{g.currentAmount.toLocaleString()} de {profile.currency}{g.targetAmount.toLocaleString()})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </label>

                {/* Option 4: No transferir */}
                <label
                  onClick={() => setRolloverAction('none')}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                    rolloverAction === 'none'
                      ? 'bg-slate-200/60 dark:bg-slate-800 border-slate-400 text-slate-900 dark:text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="rolloverAction"
                    checked={rolloverAction === 'none'}
                    onChange={() => setRolloverAction('none')}
                    className="mt-0.5 text-slate-600 focus:ring-slate-500"
                  />
                  <div className="min-w-0">
                    <span className="font-semibold text-xs">No transferir</span>
                    <p className="text-[11px] text-slate-400">
                      Dejar el remanente en el mes anterior sin transferir a ningún lado.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Resulting Total preview */}
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">Presupuesto Inicial del Mes:</span>
            <div className="text-right">
              <span className="text-lg font-extrabold text-emerald-400">
                {profile.currency} {totalStartingBudget.toLocaleString()}
              </span>
              {carryoverAmount > 0 ? (
                <p className="text-[10px] text-slate-400">
                  ({profile.currency}{numInitial.toLocaleString()} + {profile.currency}{carryoverAmount.toLocaleString()} de {prevMonthName})
                </p>
              ) : rolloverAction === 'transfer_to_savings_general' && previousBalance > 0 ? (
                <p className="text-[10px] text-teal-400">
                  +{profile.currency}{previousBalance.toLocaleString()} transferidos a Ahorro General
                </p>
              ) : rolloverAction === 'transfer_to_goal' && previousBalance > 0 ? (
                <p className="text-[10px] text-blue-400">
                  +{profile.currency}{previousBalance.toLocaleString()} transferidos a Meta: {currentGoal?.title}
                </p>
              ) : null}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Notas u objetivos del mes (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Priorizar ahorro y evitar compras impulsivas"
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

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
              <span>Guardar Presupuesto</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

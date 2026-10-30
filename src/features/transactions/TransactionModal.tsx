import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, CheckCircle2, DollarSign, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { Transaction, TransactionType, UserProfile } from '../../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../constants/categories';
import { storageService } from '../../services/storage';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  profile: UserProfile;
  onSaved: () => void;
  transactionToEdit?: Transaction | null;
  defaultType?: TransactionType;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  profile,
  onSaved,
  transactionToEdit,
  defaultType = 'expense',
}) => {
  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].name);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [usesCustomCategory, setUsesCustomCategory] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);

  useEffect(() => {
    if (isOpen) {
      if (transactionToEdit) {
        setType(transactionToEdit.type);
        setAmount(String(transactionToEdit.amount));
        const knownCategories = transactionToEdit.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
        const isCustom = !knownCategories.some((item) => item.name === transactionToEdit.category);
        setCategory(isCustom ? '__custom__' : transactionToEdit.category);
        setUsesCustomCategory(isCustom);
        setCustomCategory(isCustom ? transactionToEdit.category : '');
        setDescription(transactionToEdit.description);
        setDate(transactionToEdit.date);
        setPaymentMethod(transactionToEdit.paymentMethod || PAYMENT_METHODS[0]);
      } else {
        setType(defaultType);
        setAmount('');
        const defaultCategory =
          defaultType === 'expense' ? EXPENSE_CATEGORIES[0].name : INCOME_CATEGORIES[0].name;
        setCategory(defaultCategory);
        setUsesCustomCategory(false);
        setCustomCategory('');
        setDescription('');
        // Generate current date matching monthKey
        const [y, m] = monthKey.split('-');
        const today = new Date();
        const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        if (currentYearMonth === monthKey) {
          setDate(today.toISOString().split('T')[0]);
        } else {
          setDate(`${y}-${m}-01`);
        }
        setPaymentMethod(PAYMENT_METHODS[0]);
      }
    }
  }, [isOpen, transactionToEdit, defaultType, monthKey]);

  if (!isOpen) return null;

  const currentCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || (usesCustomCategory && !customCategory.trim())) return;
    const finalCategory = usesCustomCategory ? customCategory.trim() : category;

    if (transactionToEdit) {
      storageService.updateTransaction({
        ...transactionToEdit,
        type,
        amount: numAmount,
        category: finalCategory,
        description: description.trim() || finalCategory,
        date,
        paymentMethod,
      });
    } else {
      storageService.addTransaction({
        monthKey,
        type,
        amount: numAmount,
        category: finalCategory,
        description: description.trim() || finalCategory,
        date,
        paymentMethod,
      });
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className={`p-5 text-white flex items-center justify-between ${
          type === 'expense' ? 'bg-gradient-to-r from-rose-600 to-red-700' : 'bg-gradient-to-r from-emerald-600 to-teal-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              {type === 'expense' ? <Minus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {transactionToEdit ? 'Editar Movimiento' : type === 'expense' ? 'Registrar Gasto' : 'Registrar Ingreso Extra'}
              </h2>
              <p className="text-xs opacity-90">Control Financiero Mensual</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type toggle */}
        {!transactionToEdit && (
          <div className="p-2 bg-slate-100 dark:bg-slate-800/80 m-4 rounded-2xl flex gap-1">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setCategory(EXPENSE_CATEGORIES[0].name);
                setUsesCustomCategory(false);
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Minus className="w-4 h-4" />
              <span>Gasto</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory(INCOME_CATEGORIES[0].name);
                setUsesCustomCategory(false);
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Ingreso Extra</span>
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3.5">
          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
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
                min="0.01"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border rounded-2xl text-xl font-extrabold focus:outline-none focus:ring-2 ${
                  type === 'expense'
                    ? 'text-rose-600 dark:text-rose-400 border-slate-200 dark:border-slate-700 focus:ring-rose-500'
                    : 'text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700 focus:ring-emerald-500'
                }`}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Categoría
            </label>
            <select
              value={usesCustomCategory ? '__custom__' : category}
              onChange={(e) => {
                const next = e.target.value;
                setUsesCustomCategory(next === '__custom__');
                setCategory(next);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {currentCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
              <option value="__custom__">+ Crear categoría</option>
            </select>
            {usesCustomCategory && (
              <input
                type="text"
                required
                autoFocus
                maxLength={40}
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder={type === 'expense' ? 'Ej. Regalo' : 'Ej. Reembolso'}
                className="mt-2 w-full rounded-xl border border-emerald-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-800 dark:text-white"
              />
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Descripción o Detalle
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Supermercado quincena, Alquiler, Combustible"
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Date and Payment Method Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Fecha
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Método
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white shadow-lg active:scale-95 transition flex items-center justify-center gap-2 ${
                type === 'expense'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{transactionToEdit ? 'Guardar Cambios' : 'Registrar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

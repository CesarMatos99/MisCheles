import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, CheckCircle2, CircleAlert, DollarSign, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { Transaction, TransactionType, UserProfile } from '../../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../constants/categories';
import { storageService } from '../../services/storage';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  profile: UserProfile;
  onSaved: (transaction: Transaction) => void;
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
  const [showBudgetWarning, setShowBudgetWarning] = useState(false);
  const budgetCategories = storageService.getCategoryBudgets(monthKey).map((budget) => ({
    id: 'budget-' + budget.category,
    name: budget.category,
  }));
  const expenseCategoryOptions = Array.from(
    new Map([...EXPENSE_CATEGORIES, ...budgetCategories].map((item) => [item.name.toLocaleLowerCase('es-DO'), item])).values(),
  );

  useEffect(() => {
    if (isOpen) {
      setShowBudgetWarning(false);
      if (transactionToEdit) {
        setType(transactionToEdit.type);
        setAmount(String(transactionToEdit.amount));
        const knownCategories = transactionToEdit.type === 'expense' ? expenseCategoryOptions : INCOME_CATEGORIES;
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

  const currentCategories = type === 'expense' ? expenseCategoryOptions : INCOME_CATEGORIES;
  const finalCategory = usesCustomCategory ? customCategory.trim() : category;
  const amountValue = Number.parseFloat(amount) || 0;
  const categoryBudget = type === 'expense' ? storageService.getCategoryBudgets(monthKey).find((budget) => budget.category.toLocaleLowerCase('es-DO') === finalCategory.toLocaleLowerCase('es-DO')) : undefined;
  const currentCategoryTransactions = type === 'expense' ? storageService.getTransactionsByMonth(monthKey).filter((transaction) => transaction.type === 'expense' && transaction.category.toLocaleLowerCase('es-DO') === finalCategory.toLocaleLowerCase('es-DO')) : [];
  const previousCategorySpend = currentCategoryTransactions.reduce((total, transaction) => total + transaction.amount, 0);
  const projectedCategorySpend = currentCategoryTransactions.filter((transaction) => transaction.id !== transactionToEdit?.id).reduce((total, transaction) => total + transaction.amount, amountValue);
  const wouldExceedBudget = Boolean(categoryBudget && projectedCategorySpend > categoryBudget.amount && projectedCategorySpend > previousCategorySpend);

  const saveTransaction = (allowBudgetExceeded = false) => {
    const numAmount = Number.parseFloat(amount);
    if (!numAmount || numAmount <= 0 || (usesCustomCategory && !customCategory.trim())) return;
    const savedCategory = usesCustomCategory ? customCategory.trim() : category;
    if (wouldExceedBudget && !allowBudgetExceeded) {
      setShowBudgetWarning(true);
      return;
    }

    let savedTransaction: Transaction;
    if (transactionToEdit) {
      savedTransaction = {
        ...transactionToEdit,
        type,
        amount: numAmount,
        category: savedCategory,
        description: description.trim() || savedCategory,
        date,
        paymentMethod,
      };
      storageService.updateTransaction(savedTransaction);
    } else {
      savedTransaction = storageService.addTransaction({
        monthKey,
        type,
        amount: numAmount,
        category: savedCategory,
        description: description.trim() || savedCategory,
        date,
        paymentMethod,
      });
    }

    onSaved(savedTransaction);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTransaction();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              {type === 'expense' ? <Minus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="type-dialog-title font-bold">
                {transactionToEdit ? 'Editar movimiento' : type === 'expense' ? 'Registrar gasto' : 'Registrar ingreso'}
              </h2>
              <p className="text-xs opacity-90">Control Financiero Mensual</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type toggle */}
        {!transactionToEdit && (
          <div className="mx-5 mt-4 flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setCategory(EXPENSE_CATEGORIES[0].name);
                setUsesCustomCategory(false);
              }}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 border-transparent px-3 text-sm font-semibold transition-colors ${
                type === 'expense'
                  ? 'border-b-2 border-primary text-primary'
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
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 border-transparent px-3 text-sm font-semibold transition-colors ${
                type === 'income'
                  ? 'border-b-2 border-primary text-primary'
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
                className={`w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border rounded-2xl type-money text-xl font-extrabold focus:outline-none focus:ring-2 ${
                  type === 'expense'
                    ? 'text-rose-600 dark:text-rose-400 border-slate-200 dark:border-slate-700 focus:ring-primary'
                    : 'text-primary border-slate-200 dark:border-slate-700 focus:ring-primary'
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
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
              className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
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
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Método
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {showBudgetWarning && wouldExceedBudget && categoryBudget && (
            <div role='alert' className='rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200'>
              <div className='flex items-start gap-2'>
                <CircleAlert className='mt-0.5 h-4 w-4 shrink-0' aria-hidden='true' />
                <p>Este gasto supera el monto de {categoryBudget.category} por {profile.currency} {(projectedCategorySpend - categoryBudget.amount).toLocaleString('es-DO')}.</p>
              </div>
              <div className='mt-3 flex justify-end gap-2'>
                <button type='button' onClick={() => setShowBudgetWarning(false)} className='min-h-9 rounded-lg px-3 text-xs font-semibold text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-slate-900/60'>Volver a editar</button>
                <button type='button' onClick={() => saveTransaction(true)} className='min-h-9 rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white hover:bg-rose-800'>Registrar de todas formas</button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-11 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`flex-1 min-h-11 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg active:scale-95 transition flex items-center justify-center gap-2 ${
                type === 'expense'
                  ? 'bg-primary hover:bg-primary-hover shadow-primary/50'
                  : 'bg-primary hover:bg-primary-hover shadow-primary/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{transactionToEdit ? 'Guardar cambios' : type === 'expense' ? 'Registrar gasto' : 'Registrar ingreso'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

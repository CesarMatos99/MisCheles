import { isSavingsBudgetCategory } from '../../domain/transactionPresentation';
import { projectCategoryBudget } from '../../domain/financialQueries';
import { MoneyField } from '../../components/ui/MoneyField';
import { parseMovementAmount } from '../../domain/movementAmount';
import { ModalShell } from '../../components/ui/ModalShell';
import { ModalSurface } from '../../components/ui/ModalSurface';
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, CheckCircle2, CircleAlert } from 'lucide-react';
import { Transaction, TransactionType, UserProfile } from '../../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../constants/categories';
import { financeApplication } from '../../application/financeApplication';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';
import { isCalendarDayInMonth } from '../../domain/calendarDay';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string;
  profile: UserProfile;
  onSaved: (transaction: Transaction) => void;
  transactionToEdit?: Transaction | null;
  defaultType?: TransactionType;
  initialCategory?: string;
  onRequestSavings: (draft: { amount: string; description: string; date: string }) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  profile,
  onSaved,
  transactionToEdit,
  onRequestSavings,
  defaultType = 'expense',
  initialCategory,
}) => {
  const { language } = useLanguage();
  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0].name);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [usesCustomCategory, setUsesCustomCategory] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [validationError, setValidationError] = useState('');
  const [showBudgetWarning, setShowBudgetWarning] = useState(false);
  const budgetCategories = financeApplication.getCategoryBudgets(monthKey).map((budget) => ({
    id: 'budget-' + budget.category,
    name: budget.category,
  }));
  const expenseCategoryOptions = Array.from(
    new Map([...EXPENSE_CATEGORIES, ...budgetCategories].map((item) => [item.name.toLocaleLowerCase('es-DO'), item])).values(),
  );

  useEffect(() => {
    if (isOpen) {
      setValidationError('');
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
          defaultType === 'expense' ? initialCategory || EXPENSE_CATEGORIES[0].name : INCOME_CATEGORIES[0].name;
        const known = (defaultType === 'expense' ? expenseCategoryOptions : INCOME_CATEGORIES).some(item => item.name === defaultCategory);
        setCategory(known ? defaultCategory : '__custom__');
        setUsesCustomCategory(!known);
        setCustomCategory(known ? '' : defaultCategory);
        setDescription('');
        // Generate current date matching monthKey
        const [y, m] = monthKey.split('-');
        const today = new Date();
        const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        if (currentYearMonth === monthKey) {
          setDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
        } else {
          setDate(`${y}-${m}-01`);
        }
        setPaymentMethod(PAYMENT_METHODS[0]);
      }
    }
  }, [isOpen, transactionToEdit, defaultType, monthKey, initialCategory]);

  if (!isOpen) return null;

  const currentCategories = type === 'expense' ? expenseCategoryOptions : INCOME_CATEGORIES;
  const finalCategory = usesCustomCategory ? customCategory.trim() : category;
  const amountValue = Number.parseFloat(amount) || 0;
  const categoryBudget = type === 'expense' ? financeApplication.getCategoryBudgets(monthKey).find((budget) => budget.category.toLocaleLowerCase('es-DO') === finalCategory.toLocaleLowerCase('es-DO')) : undefined;
  const currentCategoryTransactions = type === 'expense' ? financeApplication.getTransactionsByMonth(monthKey).filter((transaction) => transaction.type === 'expense' && transaction.category.toLocaleLowerCase('es-DO') === finalCategory.toLocaleLowerCase('es-DO')) : [];
  const budgetProjection = categoryBudget ? projectCategoryBudget({ transactions: currentCategoryTransactions, category: finalCategory, amount: amountValue, editingId: transactionToEdit?.id, budget: categoryBudget.amount }) : null;
  const wouldExceedBudget = Boolean(budgetProjection?.exceeded && budgetProjection.projected > budgetProjection.previous);

  const saveTransaction = (allowBudgetExceeded = false) => {
    const numAmount = parseMovementAmount(amount);
    if (numAmount === null || (usesCustomCategory && !customCategory.trim())) {
      setValidationError('Introduce un monto válido mayor que cero, con hasta dos decimales, y una categoría.');
      return;
    }
    if (type === 'income' && !isCalendarDayInMonth(date, monthKey)) {
      setValidationError('La fecha debe pertenecer al mes seleccionado. Cambia el mes para registrar un ingreso de otro período.');
      return;
    }
    setValidationError('');
    const savedCategory = usesCustomCategory ? customCategory.trim() : category;
    if (!transactionToEdit && type === 'expense' && isSavingsBudgetCategory(savedCategory)) {
      onRequestSavings({ amount, description, date });
      return;
    }
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
      try { financeApplication.updateTransaction(savedTransaction); }
      catch (error) { setValidationError(error instanceof Error ? error.message : 'No se pudo guardar el movimiento.'); return; }
    } else {
      savedTransaction = financeApplication.addTransaction({
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
    <ModalShell title="Registrar movimiento" onClose={onClose}>
      <ModalSurface scroll="auto">
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
        <form onSubmit={handleSubmit} className="space-y-4 px-5 pb-5 pt-5">
          {validationError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{validationError}</p>}
          <MoneyField label="Monto" currency={profile.currency} value={amount} onValueChange={setAmount} autoFocus min="0.01" />

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
                  {localizeCategoryName(language, c.name)}
                </option>
              ))}
              <option value="__custom__">{language === 'en' ? '+ Create category' : '+ Crear categoría'}</option>
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
                min={type === 'income' ? `${monthKey}-01` : undefined}
                max={type === 'income' ? `${monthKey}-${String(new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate()).padStart(2, '0')}` : undefined}
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
                <p>{language === 'en' ? 'This expense exceeds the ' + localizeCategoryName(language, categoryBudget.category) + ' limit by ' : 'Este gasto supera el monto de ' + localizeCategoryName(language, categoryBudget.category) + ' por '}{profile.currency} {((budgetProjection?.projected ?? 0) - categoryBudget.amount).toLocaleString(language === 'en' ? 'en-US' : 'es-DO')}.</p>
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
              className="btn-secondary flex-1 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex flex-1 items-center justify-center gap-2 text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{transactionToEdit ? 'Guardar cambios' : type === 'expense' ? 'Registrar gasto' : 'Registrar ingreso'}</span>
            </button>
          </div>
        </form>
      </ModalSurface>
    </ModalShell>
  );
};

import { ModalShell } from '../ui/ModalShell';
import { ModalSurface } from '../ui/ModalSurface';
import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { CategoryBudget } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';
import { MoneyField } from '../ui/MoneyField';

interface CategoryBudgetModalProps {
  isOpen: boolean;
  monthLabel: string;
  currency: string;
  budgets: CategoryBudget[];
  isSingleCategory?: boolean;
  startWithNewCategory?: boolean;
  reservedCategories?: string[];
  suggestedCategories: string[];
  onClose: () => void;
  onSave: (budgets: CategoryBudget[]) => void;
}

type BudgetDraft = {
  category: string;
  amount: string;
  isCustom: boolean;
  customCategory: string;
};

const emptyDraft = (): BudgetDraft => ({ category: '', amount: '', isCustom: false, customCategory: '' });
const normalizeCategory = (category: string) => category.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-DO');

export const CategoryBudgetModal: React.FC<CategoryBudgetModalProps> = ({
  isOpen,
  monthLabel,
  currency,
  budgets,
  isSingleCategory = false,
  startWithNewCategory = false,
  reservedCategories = [],
  suggestedCategories,
  onClose,
  onSave,
}) => {
  const { language } = useLanguage();
  const [drafts, setDrafts] = useState<BudgetDraft[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const currentDrafts = budgets.map((budget) => ({ category: budget.category, amount: String(budget.amount), isCustom: false, customCategory: '' }));
      setDrafts(startWithNewCategory && !isSingleCategory ? [...currentDrafts, emptyDraft()] : currentDrafts);
      setError('');
    }
  }, [isOpen, budgets, startWithNewCategory, isSingleCategory]);

  if (!isOpen) return null;

  const updateDraft = (index: number, patch: Partial<BudgetDraft>) => {
    setDrafts((current) => current.map((draft, i) => i === index ? { ...draft, ...patch } : draft));
    setError('');
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = drafts.map((draft) => ({
      category: (draft.isCustom ? draft.customCategory : draft.category).trim(),
      amount: Number(draft.amount),
    }));

    if (normalized.some((budget) => !budget.category || !Number.isFinite(budget.amount) || budget.amount <= 0)) {
      setError('Completa cada categoría y coloca un monto mayor que cero.');
      return;
    }

    const names = [
      ...normalized.map((budget) => normalizeCategory(budget.category)),
      ...reservedCategories.map(normalizeCategory),
    ];
    if (new Set(names).size !== names.length) {
      setError('Cada categoría debe aparecer una sola vez y no puede repetir otra ya configurada.');
      return;
    }

    onSave(normalized);
    onClose();
  };

  const reservedKeys = new Set(reservedCategories.map(normalizeCategory));
  const suggestions = Array.from(new Set([
    ...suggestedCategories,
    ...budgets.map((budget) => budget.category),
  ].map((category) => category.trim()).filter(Boolean)))
    .filter((category) => !reservedKeys.has(normalizeCategory(category)) || budgets.some((budget) => normalizeCategory(budget.category) === normalizeCategory(category)));


  return (
    <ModalShell title="Editar categorías" onClose={onClose} size="lg">
      <ModalSurface size="lg" scroll="hidden">
        <header className="flex items-start justify-between gap-4 bg-primary px-5 py-4 text-white">
          <div>
            <h2 id="category-budget-title" className="type-dialog-title">{isSingleCategory ? 'Editar categoría' : startWithNewCategory ? 'Agregar categoría' : 'Categorías del mes'}</h2>
            <p className="mt-1 text-sm text-white/75">{monthLabel}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Asigna un monto mensual a cada categoría. El consumo se actualiza automáticamente con los movimientos de Registro.
            </p>

            {drafts.length === 0 ? (
              <div className="border-y border-slate-200 py-6 text-center dark:border-slate-800">
                <p className="font-medium text-slate-800 dark:text-slate-100">Aún no hay categorías configuradas</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Puedes elegir una categoría existente o crear una propia.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {drafts.map((draft, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.7fr)_2.75rem] items-end gap-2 py-3 first:pt-0">
                    <label className="min-w-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Categoría
                      <select
                        value={draft.isCustom ? '__custom__' : draft.category}
                        onChange={(event) => {
                          const selected = event.target.value;
                          updateDraft(index, selected === '__custom__'
                            ? { category: '', isCustom: true, customCategory: '' }
                            : { category: selected, isCustom: false, customCategory: '' });
                        }}
                        className="mt-1.5 block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="" disabled>Selecciona</option>
                        {suggestions.map((category) => <option key={category} value={category}>{localizeCategoryName(language, category)}</option>)}
                        <option value="__custom__">+ Crear categoría</option>
                      </select>
                      {draft.isCustom && (
                        <input
                          type="text"
                          required
                          autoFocus
                          maxLength={40}
                          value={draft.customCategory}
                          onChange={(event) => updateDraft(index, { customCategory: event.target.value })}
                          placeholder="Escribe la categoría"
                          className="mt-2 block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      )}
                    </label>
                    <MoneyField size="compact" label="Monto mensual" currency={currency} value={draft.amount} onValueChange={(amount) => updateDraft(index, { amount })} min="0.01" className="min-w-0" />
                    <button type="button" onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))} aria-label={'Quitar ' + (draft.category || draft.customCategory || 'categoría')} className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
            {!isSingleCategory && (
              <button type="button" onClick={() => setDrafts((current) => [...current, emptyDraft()])} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition hover:bg-primary-soft">
                <Plus className="h-4 w-4" />
                Agregar categoría
              </button>
            )}
          </div>

          <footer className="flex gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex flex-1 items-center justify-center gap-2">
              <Save className="h-4 w-4" />
              Guardar
            </button>
          </footer>
        </form>
      </ModalSurface>
    </ModalShell>
  );
};

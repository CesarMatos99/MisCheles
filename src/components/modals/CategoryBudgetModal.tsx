import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { CategoryBudget } from '../../types';

interface CategoryBudgetModalProps {
  isOpen: boolean;
  monthLabel: string;
  currency: string;
  budgets: CategoryBudget[];
  suggestedCategories: string[];
  onClose: () => void;
  onSave: (budgets: CategoryBudget[]) => void;
}

type BudgetDraft = { category: string; amount: string };

export const CategoryBudgetModal: React.FC<CategoryBudgetModalProps> = ({
  isOpen,
  monthLabel,
  currency,
  budgets,
  suggestedCategories,
  onClose,
  onSave,
}) => {
  const [drafts, setDrafts] = useState<BudgetDraft[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDrafts(budgets.map((budget) => ({ category: budget.category, amount: String(budget.amount) })));
      setError('');
    }
  }, [isOpen, budgets]);

  if (!isOpen) return null;

  const updateDraft = (index: number, patch: Partial<BudgetDraft>) => {
    setDrafts((current) => current.map((draft, i) => i === index ? { ...draft, ...patch } : draft));
    setError('');
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = drafts.map((draft) => ({
      category: draft.category.trim(),
      amount: Number(draft.amount),
    }));

    if (normalized.some((budget) => !budget.category || !Number.isFinite(budget.amount) || budget.amount <= 0)) {
      setError('Completa cada categoría y coloca un monto mayor que cero.');
      return;
    }

    const names = normalized.map((budget) => budget.category.toLocaleLowerCase('es-DO'));
    if (new Set(names).size !== names.length) {
      setError('Cada categoría debe aparecer una sola vez.');
      return;
    }

    onSave(normalized);
    onClose();
  };

  const suggestions = Array.from(new Set(suggestedCategories.map((category) => category.trim()).filter(Boolean)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="category-budget-title" className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-4 bg-primary px-5 py-4 text-white">
          <div>
            <h2 id="category-budget-title" className="type-dialog-title">Presupuesto por categoría</h2>
            <p className="mt-1 text-sm text-white/75">{monthLabel}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Define cuánto quieres asignar a cada cosa. El gasto se calculará con los movimientos de Registro.
            </p>

            {drafts.length === 0 ? (
              <div className="border-y border-slate-200 py-6 text-center dark:border-slate-800">
                <p className="font-medium text-slate-800 dark:text-slate-100">Aún no hay presupuestos por categoría</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Agrega supermercado, electricidad, internet o lo que necesites.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {drafts.map((draft, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.7fr)_2.75rem] items-end gap-2 py-3 first:pt-0">
                    <label className="min-w-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Categoría
                      <input
                        list="monthly-budget-category-suggestions"
                        maxLength={40}
                        value={draft.category}
                        onChange={(event) => updateDraft(index, { category: event.target.value })}
                        placeholder="Ej. Supermercado"
                        className="mt-1.5 block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <label className="min-w-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Tope mensual ({currency})
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(event) => updateDraft(index, { amount: event.target.value })}
                        placeholder={currency}
                        className="mt-1.5 block h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </label>
                    <button type="button" onClick={() => setDrafts((current) => current.filter((_, i) => i !== index))} aria-label={'Quitar ' + (draft.category || 'categoría')} className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <datalist id="monthly-budget-category-suggestions">
              {suggestions.map((category) => <option key={category} value={category} />)}
            </datalist>
            {error && <p role="alert" className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
            <button type="button" onClick={() => setDrafts((current) => [...current, { category: '', amount: '' }])} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition hover:bg-primary-soft">
              <Plus className="h-4 w-4" />
              Agregar categoría
            </button>
          </div>

          <footer className="flex gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex flex-1 items-center justify-center gap-2">
              <Save className="h-4 w-4" />
              Guardar
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

import React from 'react';
import { ArrowRight, Pencil, SlidersHorizontal, Sparkles, Tags } from 'lucide-react';
import { CategoryBudget, FinancialSummary, MonthConfig, Transaction, UserProfile } from '../../types';
import { MONTH_NAMES_ES } from '../../constants/categories';
import { PeriodSelector } from '../../components/layout/PeriodSelector';

interface DashboardViewProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  monthConfig: MonthConfig | null;
  summary: FinancialSummary;
  transactions: Transaction[];
  categoryBudgets: CategoryBudget[];
  profile: UserProfile;
  onOpenMonthSetup: () => void;
  onManageBudgets: () => void;
  onEditCategory: (category: string) => void;
  onOpenUnbudgetedCategory: (category: string) => void;
}

const categoryKey = (category: string) => category.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-DO');

export const DashboardView: React.FC<DashboardViewProps> = ({
  year,
  month,
  onMonthChange,
  monthConfig,
  summary,
  transactions,
  categoryBudgets,
  profile,
  onOpenMonthSetup,
  onManageBudgets,
  onEditCategory,
  onOpenUnbudgetedCategory,
}) => {
  const monthName = MONTH_NAMES_ES[month - 1];
  const money = (value: number) => profile.currency + ' ' + value.toLocaleString('es-DO', { maximumFractionDigits: 2 });
  const expenses = transactions.filter((tx) => tx.type === 'expense');

  const spendByCategory = new Map<string, number>();
  for (const transaction of expenses) {
    const key = categoryKey(transaction.category);
    spendByCategory.set(key, (spendByCategory.get(key) || 0) + transaction.amount);
  }

  const budgetedCategories = new Set(categoryBudgets.map((budget) => categoryKey(budget.category)));
  const unbudgeted = Array.from(spendByCategory.entries())
    .filter(([category]) => !budgetedCategories.has(category))
    .map(([category, amount]) => ({
      category: expenses.find((tx) => categoryKey(tx.category) === category)?.category || category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalUnbudgeted = unbudgeted.reduce((total, item) => total + item.amount, 0);
  const totalConsumption = expenses.reduce((total, transaction) => total + transaction.amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-6 animate-in fade-in duration-200">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-secondary">Resumen mensual</p>
          <h1 className="type-screen-title text-slate-900 dark:text-white">Así va tu dinero</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PeriodSelector year={year} month={month} onMonthChange={onMonthChange} />
          <button type="button" onClick={onOpenMonthSetup} aria-label="Configurar ingresos del mes" title="Configurar mes" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {(!monthConfig || !monthConfig.isConfigured) && (
        <button onClick={onOpenMonthSetup} className="flex w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary-soft p-4 text-left text-sm text-primary dark:border-primary/30 dark:bg-primary-soft dark:text-primary">
          <Sparkles className="h-5 w-5 shrink-0" />
          <span className="flex-1">Configura los ingresos de {monthName}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <section className="border-b border-slate-200 py-2 dark:border-slate-800">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Disponible este mes</p>
        <p className="mt-1 type-display type-money text-slate-900 dark:text-white sm:text-5xl">{money(summary.availableBalance)}</p>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:max-w-lg">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ingresos disponibles</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{money(summary.totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gastado en el mes</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-white">{money(totalConsumption)}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">Gastos por categoría</h2>
          <button type="button" onClick={onManageBudgets} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-primary transition hover:bg-primary-soft">
            <Tags className="h-4 w-4" />
            <span>Editar categorías</span>
          </button>
        </div>

        {categoryBudgets.length === 0 ? (
          <p className="border-b border-slate-200 py-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">Aún no has asignado montos a tus categorías.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {categoryBudgets.map((budget) => {
              const spent = spendByCategory.get(categoryKey(budget.category)) || 0;
              const remaining = budget.amount - spent;
              const percent = Math.round((spent / budget.amount) * 100);
              const overBudget = remaining < 0;
              return (
                <button
                  key={categoryKey(budget.category)}
                  type="button"
                  onClick={() => onEditCategory(budget.category)}
                  aria-label={'Editar categoría ' + budget.category}
                  className="group w-full rounded-lg py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-900/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-semibold text-slate-900 dark:text-white">
                        <span className="truncate">{budget.category}</span>
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-primary" aria-hidden="true" />
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{money(spent)} de {money(budget.amount)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={overBudget ? 'text-sm font-semibold text-rose-600 dark:text-rose-400' : 'text-sm font-semibold text-slate-900 dark:text-white'}>
                        {overBudget ? 'Excedido ' + money(Math.abs(remaining)) : 'Restan ' + money(remaining)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{percent}% usado</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-label={'Consumo de ' + budget.category} aria-valuemin={0} aria-valuemax={budget.amount} aria-valuenow={Math.min(spent, budget.amount)}>
                    <div className={'h-full rounded-full transition-all ' + (overBudget ? 'bg-rose-500' : percent >= 85 ? 'bg-amber-500' : 'bg-primary')} style={{ width: Math.min(percent, 100) + '%' }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {unbudgeted.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-2 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sin monto asignado</h2>
            <p className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">{money(totalUnbudgeted)}</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {unbudgeted.map((item) => (
              <button
                key={categoryKey(item.category)}
                type="button"
                onClick={() => onOpenUnbudgetedCategory(item.category)}
                aria-label={'Ver y editar movimientos de ' + item.category}
                title="Abrir movimientos en Registro"
                className="flex w-full items-center justify-between gap-4 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <span className="truncate text-sm text-slate-700 dark:text-slate-300">{item.category}</span>
                <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                  {money(item.amount)}
                  <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

import { isConsumptionExpenseTransaction, normalizeFinancialCategory } from '../../domain/financialClassification';
import { isSavingsBudgetCategory } from '../../domain/transactionPresentation';
import { unmatchedSavingsContributionAmount } from '../../domain/financialSummary';
import React from 'react';
import { ArrowLeft, CalendarDays, Pencil, Receipt, Trash2 } from 'lucide-react';
import { CategoryBudget, SavingsMovement, Transaction, UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';

interface CategoryDetailViewProps {
  category: string;
  monthLabel: string;
  budget?: CategoryBudget;
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  profile: UserProfile;
  onBack: () => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onManageBudget: () => void;
}

const normalizeCategory = normalizeFinancialCategory;

export const CategoryDetailView: React.FC<CategoryDetailViewProps> = ({ category, monthLabel, budget, transactions, savingsMovements, profile, onBack, onEditTransaction, onDeleteTransaction, onManageBudget }) => {
  const { language } = useLanguage();
  const displayCategory = localizeCategoryName(language, category);
  const money = (value: number) => profile.currency + ' ' + Math.abs(value).toLocaleString('es-DO', { maximumFractionDigits: 2 });
  const movements = transactions
    .filter((transaction) => isConsumptionExpenseTransaction(transaction) && normalizeCategory(transaction.category) === normalizeCategory(category))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const isSavings = isSavingsBudgetCategory(category);
  const contributions = savingsMovements.filter(movement => movement.type === 'deposit_from_month').sort((a, b) => b.date.localeCompare(a.date));
  const directSavingsExpenses = savingsMovements.filter(movement => movement.type === 'direct_expense' && normalizeCategory(movement.category || 'Otros') === normalizeCategory(category)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const spent = isSavings ? contributions.reduce((sum, movement) => sum + movement.amount, 0) + unmatchedSavingsContributionAmount(transactions, savingsMovements) : movements.reduce((total, movement) => total + movement.amount, 0) + directSavingsExpenses.reduce((total, movement) => total + movement.amount, 0);
  const remaining = budget ? budget.amount - spent : undefined;
  const percent = budget ? Math.min(100, Math.round((spent / budget.amount) * 100)) : 0;

  return (
    <div className='app-surface mx-auto max-w-5xl space-y-4 pb-6 animate-in fade-in duration-200'>
      <button type='button' onClick={onBack} className='inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary dark:text-slate-300'>
        <ArrowLeft className='h-4 w-4' aria-hidden='true' /> Volver a Inicio
      </button>

      <header className='border-b border-slate-200 pb-3 dark:border-slate-800'>
        <p className='type-secondary'>{monthLabel}</p>
        <h1 className='type-screen-title text-slate-900 dark:text-white'>{displayCategory}</h1>
      </header>

      <section aria-label='Resumen de categoría' className='rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'>
        <div className='mb-3 flex justify-end'>
          <button type='button' onClick={onManageBudget} className='inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-primary transition hover:bg-primary-soft'>{budget ? 'Editar monto' : 'Asignar monto'}</button>
        </div>
        <div className='flex items-start justify-between gap-4'>
          <div>
            <p className='type-secondary'>{isSavings ? 'Aportado a ahorro' : 'Gastado'}</p>
            <p className='mt-1 type-money text-2xl font-bold text-slate-900 dark:text-white'>{money(spent)}</p>
          </div>
          <div className='text-right'>
            <p className='type-secondary'>Asignado</p>
            <p className='mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100'>{budget ? money(budget.amount) : 'Sin monto'}</p>
          </div>
        </div>
        {budget ? (
          <div className='mt-4'>
            <div className='flex items-center justify-between gap-3 text-sm'>
              <span className={remaining !== undefined && remaining < 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-semibold text-emerald-700 dark:text-emerald-400'}>
                {remaining !== undefined && remaining < 0 ? 'Excedido ' + money(remaining) : 'Restante ' + money(remaining || 0)}
              </span>
              <span className='type-secondary'>Monto mensual</span>
            </div>
            <div className='mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800' role='progressbar' aria-label={(isSavings ? 'Aportes a ' : 'Consumo de ') + displayCategory} aria-valuemin={0} aria-valuemax={budget.amount} aria-valuenow={Math.min(spent, budget.amount)}>
              <div className={'h-full rounded-full ' + (remaining !== undefined && remaining < 0 ? 'bg-rose-500 dark:opacity-80' : percent >= 80 ? 'bg-amber-500 dark:opacity-80' : 'bg-primary dark:opacity-80')} style={{ width: percent + '%' }} />
            </div>
          </div>
        ) : (
          <p className='mt-3 border-t border-slate-200 pt-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-300'>Esta categoría no tiene un monto mensual asignado.</p>
        )}
      </section>

      <section>
        <div className='flex items-center justify-between border-b border-slate-200 py-2 dark:border-slate-800'>
          <h2 className='font-semibold text-slate-900 dark:text-white'>Movimientos</h2>
          <span className='type-secondary'>{isSavings ? contributions.length : movements.length + directSavingsExpenses.length} movimientos</span>
        </div>
        {isSavings ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {unmatchedSavingsContributionAmount(transactions, savingsMovements) > 0 && <p className="py-3 text-xs text-slate-500">El total incluye {money(unmatchedSavingsContributionAmount(transactions, savingsMovements))} de aportes antiguos sin destino vinculado.</p>}
            {contributions.length === 0 && <p className="py-4 text-sm text-slate-500">No hay aportes vinculados en este período.</p>}
            {contributions.map(movement => <article key={movement.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-sm font-semibold">{movement.description || 'Aporte a ahorro'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">{movement.date} · {movement.goalTitle || 'Ahorro general'}</p></div>
              <span className="shrink-0 text-sm font-semibold text-primary">{money(movement.amount)} aportados</span>
            </article>)}
            {directSavingsExpenses.length > 0 && <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Pagado desde ahorros</p>}
            {directSavingsExpenses.map(movement => <article key={movement.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-semibold">{movement.description || displayCategory}</p><p className="text-xs text-slate-500 dark:text-slate-300">{movement.date} · Desde ahorro</p></div><span className="shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-200">−{money(movement.amount)}</span></article>)}

          </div>
        ) : movements.length === 0 ? (
          <p className='py-5 text-sm text-slate-500 dark:text-slate-300'>No hay movimientos de {displayCategory} en {monthLabel}.</p>
        ) : (
          <div className='divide-y divide-slate-200 dark:divide-slate-800'>
            {movements.map((movement) => (
              <article key={movement.id} className='flex items-center gap-3 py-3'>
                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'>
                  <Receipt className='h-4 w-4' aria-hidden='true' />
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm font-semibold text-slate-900 dark:text-white'>{movement.description || displayCategory}</p>
                  <p className='mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-300'>
                    <CalendarDays className='h-3 w-3 shrink-0' aria-hidden='true' />
                    <span>{movement.date}</span><span aria-hidden='true'>·</span><span className='truncate'>{movement.paymentMethod || 'Sin método'}</span>
                  </p>
                </div>
                <span className='shrink-0 text-sm font-semibold text-slate-900 dark:text-white'>−{money(movement.amount)}</span>
                <button type='button' onClick={() => onEditTransaction(movement)} aria-label={'Editar movimiento ' + movement.description} className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-primary-soft hover:text-primary dark:text-slate-300'>
                  <Pencil className='h-4 w-4' aria-hidden='true' />
                </button>
                <button type='button' onClick={() => onDeleteTransaction(movement.id)} aria-label={'Eliminar movimiento ' + movement.description} className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300'>
                  <Trash2 className='h-4 w-4' aria-hidden='true' />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

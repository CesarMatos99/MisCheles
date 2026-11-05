import { isConsumptionExpenseTransaction, normalizeFinancialCategory } from '../../domain/financialClassification';
import { isSavingsBudgetCategory } from '../../domain/transactionPresentation';
import { spendingByCategory } from '../../domain/financialQueries';
import React from 'react';
import { ArrowRight, SlidersHorizontal, Sparkles, Tags } from 'lucide-react';
import { CategoryBudget, FinancialSummary, MonthConfig, SavingsMovement, Transaction, UserProfile } from '../../types';
import { PeriodSelector } from '../../components/layout/PeriodSelector';
import { PageHeader } from '../../components/layout/PageHeader';
import { ExportButton } from '../../components/ui/ExportButton';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeCategoryName } from '../../i18n/categoryLabels';

interface DashboardViewProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
  monthConfig: MonthConfig | null;
  summary: FinancialSummary;
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  categoryBudgets: CategoryBudget[];
  profile: UserProfile;
  onOpenMonthSetup: () => void;
  onOpenExport: () => void;
  onManageBudgets: () => void;
  onOpenCategory: (category: string) => void;
}

const categoryKey = normalizeFinancialCategory;

export const DashboardView: React.FC<DashboardViewProps> = ({
  year,
  month,
  onMonthChange,
  monthConfig,
  summary,
  transactions,
  savingsMovements,
  categoryBudgets,
  profile,
  onOpenMonthSetup,
  onOpenExport,
  onManageBudgets,
  onOpenCategory,
}) => {
  const { t, locale, language } = useLanguage();
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(year, month - 1, 1));
  const firstName = profile.name.trim().split(/\s+/)[0] || 'Usuario';
  const money = (value: number) => profile.currency + ' ' + value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const expenses = transactions.filter(isConsumptionExpenseTransaction);

  const spendingRows = spendingByCategory(transactions, savingsMovements);
  const spendByCategory = new Map([...spendingRows].map(([key, row]) => [key, row.amount]));

  const budgetedCategories = new Set(categoryBudgets.map((budget) => categoryKey(budget.category)));
  const unbudgeted = Array.from(spendByCategory.entries())
    .filter(([category]) => !budgetedCategories.has(category))
    .map(([category, amount]) => ({
      category: spendingRows.get(category)?.category || expenses.find((tx) => categoryKey(tx.category) === category)?.category || category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalUnbudgeted = unbudgeted.reduce((total, item) => total + item.amount, 0);
  const totalConsumption = summary.totalExpenses;

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-6 animate-in fade-in duration-200">
      <PageHeader eyebrow={(locale.startsWith('en') ? 'Hello' : 'Hola') + ' ' + firstName} title={t('moneyOverview')} period={<PeriodSelector year={year} month={month} onMonthChange={onMonthChange} />} actions={<ExportButton onClick={onOpenExport} />} />

      {(!monthConfig || !monthConfig.isConfigured) && (
        <button onClick={onOpenMonthSetup} className='flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary-soft p-3 text-left text-sm text-primary dark:border-primary/30 dark:bg-primary-soft dark:text-primary'>
          <Sparkles className='h-5 w-5 shrink-0' />
          <span className='flex-1'>{t('configureIncome')} {monthName}</span>
          <ArrowRight className='h-4 w-4' />
        </button>
      )}

      <section aria-label={t('monthlySummary')} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-sm font-medium text-slate-500 dark:text-slate-300'>{t('availableThisMonth')}</p>
            <p className='mt-1 type-display type-money text-primary'>{money(summary.availableBalance)}</p>
          </div>
          {monthConfig?.isConfigured && <button type='button' onClick={onOpenMonthSetup} aria-label='Ajustar configuración del mes' title='Ajustar mes' className='inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-slate-500 transition hover:bg-primary-soft hover:text-primary dark:text-slate-300'>
            <SlidersHorizontal className='h-4 w-4' aria-hidden='true' />
            <span>Ajustar</span>
          </button>}
        </div>
        <div className='mt-3 grid grid-cols-2 gap-4 border-t border-slate-200 pt-3 dark:border-slate-800'>
          <div>
            <p className='text-xs text-slate-500 dark:text-slate-300'>{t('openingMoney')}</p>
            <p className='mt-0.5 text-sm font-semibold text-slate-900 dark:text-white'>{money(summary.initialIncome + summary.carryover)}</p>
          </div>
          <div>
            <p className='text-xs text-slate-500 dark:text-slate-300'>{t('spentThisMonth')}</p>
            <p className='mt-0.5 text-sm font-semibold text-slate-900 dark:text-white'>{money(totalConsumption)}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 py-3 dark:border-slate-800">
          <h2 className="font-bold text-slate-900 dark:text-white">{t('myCategories')}</h2>
          <button type="button" onClick={onManageBudgets} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-primary transition hover:bg-primary-soft">
            <Tags className="h-4 w-4" />
            <span>{t('edit')}</span>
          </button>
        </div>

        {categoryBudgets.length === 0 ? (
          <p className="border-b border-slate-200 py-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{t('assignedAmountsEmpty')}</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {categoryBudgets.map((budget) => {
              const isSavings = isSavingsBudgetCategory(budget.category);
              const spent = isSavings ? summary.savingsTransfersTo : spendByCategory.get(categoryKey(budget.category)) || 0;
              const remaining = budget.amount - spent;
              const percent = Math.round((spent / budget.amount) * 100);
              const overBudget = remaining < 0;
              return (
                <button
                  key={categoryKey(budget.category)}
                  type='button'
                  onClick={() => onOpenCategory(budget.category)}
                  aria-label={'Ver movimientos de ' + localizeCategoryName(language, budget.category) + '. Asignado ' + money(budget.amount) + ', ' + (isSavings ? 'aportado ' : 'gastado ') + money(spent) + ', restante ' + money(remaining)}
                  className='w-full py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-900/50'
                >
                  <div className='flex items-start justify-between gap-3'>
                    <p className='min-w-0 truncate font-semibold text-slate-900 dark:text-white'>{localizeCategoryName(language, budget.category)}</p>
                    <p className={overBudget ? 'shrink-0 text-sm font-semibold text-rose-600 dark:text-rose-400' : 'shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400'}>
                      {overBudget ? '−' + money(Math.abs(remaining)) : money(remaining)}
                    </p>
                  </div>
                  <div className='mt-1 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-300'>
                    <span>{money(spent)} {isSavings ? 'aportados' : 'gastados'}</span>
                    <span>{money(budget.amount)} asignados</span>
                  </div>
                  <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800' role='progressbar' aria-label={(isSavings ? 'Aportes a ' : 'Consumo de ') + localizeCategoryName(language, budget.category)} aria-valuemin={0} aria-valuemax={budget.amount} aria-valuenow={Math.min(spent, budget.amount)}>
                    <div className={'h-full rounded-full transition-all ' + (overBudget ? 'bg-rose-500 dark:opacity-80' : percent >= 80 ? 'bg-amber-500 dark:opacity-80' : 'bg-primary dark:opacity-80')} style={{ width: Math.min(percent, 100) + '%' }} />
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
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('unassigned')}</h2>
            <p className="shrink-0 text-sm font-semibold text-slate-900 dark:text-white">{money(totalUnbudgeted)}</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {unbudgeted.map((item) => (
              <button
                key={categoryKey(item.category)}
                type="button"
                onClick={() => onOpenCategory(item.category)}
                aria-label={'Ver movimientos de ' + localizeCategoryName(language, item.category)}
                title="Abrir movimientos en Registro"
                className="flex w-full items-center justify-between gap-4 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <span className="truncate text-sm text-slate-700 dark:text-slate-300">{localizeCategoryName(language, item.category)}</span>
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

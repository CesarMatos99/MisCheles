import React from 'react';
import { List, BarChart3 } from 'lucide-react';
import { highestCategoryExpense, sortCategoryExpenses, type CategoryExpenseShare } from '../../domain/analyticsPeriodComparison';

type View = 'chart' | 'list';
type Sort = 'high' | 'low' | 'name';
export function QuickExpenseChart({ rows, view, onViewChange, sort, onSort, fmt, localize }: { rows: CategoryExpenseShare[]; view: View; onViewChange: (view: View) => void; sort: Sort; onSort: (sort: Sort) => void; fmt: (amount: number) => string; localize: (category: string) => string; }) {
  const chartRows = sortCategoryExpenses(rows.filter(row => row.amount > 0), 'high');
  const listRows = sortCategoryExpenses(chartRows, sort);
  const maximum = Math.max(1, ...chartRows.map(row => row.amount));
  const highest = highestCategoryExpense(chartRows);
  return <div className="min-w-0">
    <div className="flex flex-wrap items-center justify-end gap-2 pb-3" role="group" aria-label="Presentación de gastos">
      <div className="inline-flex rounded-full border border-slate-300 p-1 dark:border-slate-700">
        <button type="button" aria-pressed={view === 'chart'} onClick={() => onViewChange('chart')} className={'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs ' + (view === 'chart' ? 'bg-primary font-semibold text-white' : 'text-slate-500')}><BarChart3 className="h-4 w-4" aria-hidden="true" />Gráfico</button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => onViewChange('list')} className={'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs ' + (view === 'list' ? 'bg-primary font-semibold text-white' : 'text-slate-500')}><List className="h-4 w-4" aria-hidden="true" />Lista</button>
      </div>
      {view === 'list' && <select aria-label="Ordenar lectura rápida" value={sort} onChange={event => onSort(event.target.value as Sort)} className="app-field max-w-40 text-xs"><option value="high">Mayor gasto</option><option value="low">Menor gasto</option><option value="name">Nombre</option></select>}
    </div>
    {!chartRows.length ? <p className="app-empty">Aún no hay gastos registrados en este período.</p> : view === 'chart' ?
      <div className="space-y-4" role="img" aria-label={'Gastos reales por categoría, orden descendente: ' + chartRows.map(row => localize(row.category) + ', ' + fmt(row.amount)).join('; ')}>
        {chartRows.map((row, index) => <div key={row.category} className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs"><span className="min-w-0 break-words font-medium">{localize(row.category)}</span><span className="max-w-full break-words font-semibold tabular-nums">{fmt(row.amount)}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={'h-full rounded-full ' + (index === 0 ? 'bg-primary' : 'bg-[var(--app-action)]')} style={{ width: Math.max(1, row.amount / maximum * 100) + '%' }} /></div>
        </div>)}
      </div> : <ol className="divide-y divide-slate-200 dark:divide-slate-800">{listRows.map((row, index) => <li key={row.category} className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"><span className="min-w-0 break-words text-sm">{index + 1}. {localize(row.category)}</span><span className="max-w-full break-words text-right text-xs font-semibold tabular-nums">{fmt(row.amount)} <span className="font-normal text-slate-500">· {row.share.toLocaleString('es-DO', { maximumFractionDigits: 1 })}%</span></span></li>)}</ol>}
    {highest && <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">Mayor gasto en <strong className="text-app-foreground">{localize(highest.category)}</strong></p>}
  </div>;
}
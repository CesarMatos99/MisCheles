import React from 'react';
import type { CategoryExpenseShare } from '../../domain/analyticsPeriodComparison';
import { getCategoryPresentation } from '../../domain/categoryPresentation';
import { CategoryIcon } from '../../components/ui/CategoryIcon';
export function CategoryDonut({ rows, totalLabel, selectedCategory, onSelect, localize, fmt }: {
  rows: CategoryExpenseShare[]; totalLabel: string; fmt: (amount: number) => string; selectedCategory: string | null; onSelect: (category: string) => void; localize: (category: string) => string;
}) {
  let cumulative = 0;
  const stops = rows.map((row) => { const start = cumulative; cumulative += row.share; return getCategoryPresentation(row.category).color + ' ' + start + '% ' + cumulative + '%'; });
  const legendRows = [...rows].sort((a, b) => localize(a.category).localeCompare(localize(b.category), 'es'));
  const description = rows.map(row => localize(row.category) + ' ' + row.share.toLocaleString('es-DO', { maximumFractionDigits: 1 }) + '%').join(', ');
  return <div className="grid min-w-0 gap-5 sm:grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] sm:items-center">
    <div className="mx-auto flex flex-col items-center gap-2"><div role="img" aria-label={'Distribución del gasto: ' + description} className="relative h-44 w-44 rounded-full" style={{ background: 'conic-gradient(' + (stops.length ? stops.join(', ') : '#cbd5e1 0% 100%') + ')' }}><div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-app-background text-center"><span className="text-[10px] text-slate-500">Gasto real</span><span className="max-w-full px-2 text-sm font-semibold tabular-nums break-words">{totalLabel}</span></div></div><p className="text-[10px] text-slate-500">{rows.length} categorías</p></div>
    <ul className="grid min-w-0 gap-x-4 gap-y-1.5 lg:grid-cols-2">{legendRows.map((row) => { const color = getCategoryPresentation(row.category).color; return <li key={row.category} className="min-w-0"><button type="button" aria-pressed={selectedCategory === row.category} onClick={() => onSelect(row.category)} className="flex min-h-11 w-full min-w-0 flex-wrap items-center gap-2 rounded-lg px-1 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800"><CategoryIcon category={row.category} size="sm" /><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} /><span className="min-w-0 flex-1 truncate text-xs" title={localize(row.category)}>{localize(row.category)}</span><span className="max-w-full break-words text-right text-xs font-semibold tabular-nums">{fmt(row.amount)} · {row.share.toLocaleString('es-DO', { maximumFractionDigits: 1 })}%</span></button></li>; })}</ul>
  </div>;
}

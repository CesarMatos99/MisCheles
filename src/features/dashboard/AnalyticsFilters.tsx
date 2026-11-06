import React, { useState } from 'react';
import { FilterPanel } from '../../components/ui/FilterPanel';
import { useLanguage } from '../../i18n/LanguageContext';
import { validateAnalyticsFilters, type AnalyticsFiltersValue } from '../../domain/analyticsFilterContract';
export type { AnalyticsFiltersValue } from '../../domain/analyticsFilterContract';
export function AnalyticsFilters({ value, defaults, categoriesByType, onApply, onClose }: {
  value: AnalyticsFiltersValue; defaults: AnalyticsFiltersValue; categoriesByType: Record<AnalyticsFiltersValue['movementType'], string[]>;
  onApply: (value: AnalyticsFiltersValue) => void; onClose: () => void;
}) {
  const { t } = useLanguage(); const [draft, setDraft] = useState(value); const [error, setError] = useState('');
  const field = <K extends keyof AnalyticsFiltersValue>(key: K, value: AnalyticsFiltersValue[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const apply = () => { const validationError = validateAnalyticsFilters(draft); if (validationError) { setError(validationError); return; } onApply({ ...draft, category: draft.movementType === 'savings' ? 'Todas' : draft.category }); };
  const categories = categoriesByType[draft.movementType] || []; const inputClass = 'mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-transparent px-3 text-sm dark:border-slate-700';
  return <FilterPanel title="Filtros de Estadísticas" onClose={onClose} onCancel={onClose} onClear={() => { setDraft(defaults); setError(''); }} onApply={apply} size="lg">
    <label className="block text-sm">Período<select className={inputClass} value={draft.mode} onChange={e => field('mode', e.target.value as typeof draft.mode)}><option value="month">Mes</option><option value="year">Año</option><option value="6m">Últimos 6 meses</option><option value="12m">Últimos 12 meses</option><option value="custom">Rango personalizado</option></select></label>
    {draft.mode === 'year' && <label className="block text-sm">Año<input className={inputClass} type="number" min="1900" max="9999" required value={draft.year} onChange={e => field('year', Number(e.target.value))} /></label>}
    {draft.mode === 'custom' && <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="min-w-0 text-sm">Desde<input className={inputClass} type="date" required value={draft.from} onChange={e => field('from', e.target.value)} /></label><label className="min-w-0 text-sm">Hasta<input className={inputClass} type="date" required value={draft.to} onChange={e => field('to', e.target.value)} /></label></div>}
    <label className="block text-sm">Tipo de movimiento<select className={inputClass} value={draft.movementType} onChange={e => setDraft({ ...draft, movementType: e.target.value as typeof draft.movementType, category: 'Todas' })}><option value="all">{t('allMovementTypes')}</option><option value="income">{t('incomeMovementType')}</option><option value="expense">{t('expenseMovementType')}</option><option value="savings">{t('savingsMovementType')}</option></select></label>
    <label className="block text-sm">Categoría<select className={inputClass} disabled={draft.movementType === 'savings'} value={draft.category} onChange={e => field('category', e.target.value)}><option value="Todas">{t('allCategories')}</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
  </FilterPanel>;
}

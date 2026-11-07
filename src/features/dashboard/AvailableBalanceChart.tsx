import React, { useState } from 'react';
import type { AvailableBalancePoint } from '../../domain/availableBalanceTrend';

interface AvailableBalanceChartProps {
  points: AvailableBalancePoint[];
  currency: string;
  locale: string;
}

const formatMoney = (amount: number, currency: string, locale: string) => currency + ' ' + amount.toLocaleString(locale, { maximumFractionDigits: 0 });
const formatDate = (date: string, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(date + 'T00:00:00'));

export const AvailableBalanceChart: React.FC<AvailableBalanceChartProps> = ({ points, currency, locale }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const values = points.map(point => point.available);
  const observedMin = Math.min(...values);
  const observedMax = Math.max(...values);
  const rangePadding = Math.max(1, Math.abs(observedMax - observedMin) * 0.12, Math.abs(observedMax) * 0.015);
  const minValue = observedMin - rangePadding;
  const maxValue = observedMax + rangePadding;
  const pointCoordinates = points.map((point, index) => ({
    ...point,
    x: points.length < 2 ? 300 : 8 + (index / (points.length - 1)) * 584,
    y: 12 + ((maxValue - point.available) / (maxValue - minValue)) * 156,
  }));
  const linePoints = pointCoordinates.map(point => point.x + ',' + point.y).join(' ');
  const activePoint = activeIndex === null ? null : points[activeIndex] || null;
  const indexAtClientX = (clientX: number, bounds: DOMRect) => Math.max(0, Math.min(points.length - 1, Math.round(((clientX - bounds.left) / Math.max(1, bounds.width)) * (points.length - 1))));

  return <section aria-label="Tendencia del dinero disponible" className="app-surface dashboard-trend-panel">
    <div className="app-section-heading">
      <div>
        <h2 className="type-section-title">Tendencia del disponible</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo real por día, calculado con los movimientos y cierres configurados.</p>
      </div>
      {points.length > 0 && <p className="text-right text-xs font-semibold tabular-nums text-app-foreground">{formatMoney(points[points.length - 1].available, currency, locale)}</p>}
    </div>
    {points.length < 2 ? <p className="app-empty mt-3">No hay saldos históricos suficientes para trazar estos 30 días.</p> : <>
      <div
        className="relative mt-3 min-w-0"
        onPointerMove={event => {
          if (event.pointerType === 'touch' || points.length < 2) return;
          setActiveIndex(indexAtClientX(event.clientX, event.currentTarget.getBoundingClientRect()));
          setPinned(false);
        }}
        onPointerLeave={() => { if (!pinned) setActiveIndex(null); }}
        onClick={event => {
          if (points.length < 2 || event.target instanceof HTMLInputElement) return;
          setActiveIndex(indexAtClientX(event.clientX, event.currentTarget.getBoundingClientRect()));
          setPinned(true);
        }}
      >
        <svg className="h-40 w-full overflow-visible" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={'Dinero disponible desde ' + formatDate(points[0].date, locale) + ' hasta ' + formatDate(points[points.length - 1].date, locale)}>
          {[0, 1, 2].map(index => <line key={index} x1="0" x2="600" y1={22 + index * 68} y2={22 + index * 68} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="4 6" />)}
          <polyline points={linePoints} fill="none" stroke="var(--app-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {pointCoordinates.map(point => <circle key={point.date} cx={point.x} cy={point.y} r={activePoint?.date === point.date ? 5 : 2.5} fill="var(--app-primary)"><title>{formatDate(point.date, locale)} · Disponible {formatMoney(point.available, currency, locale)} · Gastos {formatMoney(point.expenses, currency, locale)}{point.income > 0 ? ' · Ingresos ' + formatMoney(point.income, currency, locale) : ''}{point.savingsTransfers > 0 ? ' · Ahorro ' + formatMoney(point.savingsTransfers, currency, locale) : ''}</title></circle>)}
        </svg>
        {activePoint && <div role="status" aria-live="polite" className="pointer-events-none absolute left-1/2 top-2 z-10 w-[calc(100%-1rem)] max-w-[260px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-2.5 text-[10px] shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <p className="text-xs font-semibold text-app-foreground">{formatDate(activePoint.date, locale)}</p>
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-500 dark:text-slate-300">
            <span>Disponible al cierre</span><strong className="text-right tabular-nums text-app-foreground">{formatMoney(activePoint.available, currency, locale)}</strong>
            <span>Gastos del día</span><strong className="text-right tabular-nums text-app-foreground">{formatMoney(activePoint.expenses, currency, locale)}</strong>
            {activePoint.income > 0 && <><span>Ingresos del día</span><strong className="text-right tabular-nums text-emerald-700 dark:text-emerald-300">{formatMoney(activePoint.income, currency, locale)}</strong></>}
            {activePoint.savingsTransfers > 0 && <><span>Transferido a ahorro</span><strong className="text-right tabular-nums text-primary">{formatMoney(activePoint.savingsTransfers, currency, locale)}</strong></>}
            {activePoint.savingsWithdrawals > 0 && <><span>Retirado de ahorro</span><strong className="text-right tabular-nums text-primary">{formatMoney(activePoint.savingsWithdrawals, currency, locale)}</strong></>}
          </div>
        </div>}
        <label className="sr-only" htmlFor="available-balance-day">Explorar el disponible por día</label>
        <input id="available-balance-day" type="range" min={0} max={points.length - 1} step={1} value={activeIndex ?? points.length - 1} onChange={event => { setActiveIndex(Number(event.target.value)); setPinned(true); }} aria-label="Explorar el disponible por día" className="sr-only focus:not-sr-only focus:relative focus:z-20 focus:block focus:w-full" />
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{formatDate(points[0].date, locale)}</span>
        <span>Últimos {points.length} días</span>
        <span>{formatDate(points[points.length - 1].date, locale)}</span>
      </div>
    </>}
  </section>;
};

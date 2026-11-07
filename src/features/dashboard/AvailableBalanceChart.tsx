import React from 'react';
import type { AvailableBalancePoint } from '../../domain/availableBalanceTrend';

interface AvailableBalanceChartProps {
  points: AvailableBalancePoint[];
  currency: string;
  locale: string;
}

const formatMoney = (amount: number, currency: string, locale: string) => currency + ' ' + amount.toLocaleString(locale, { maximumFractionDigits: 0 });
const formatDate = (date: string, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(date + 'T00:00:00'));

export const AvailableBalanceChart: React.FC<AvailableBalanceChartProps> = ({ points, currency, locale }) => {
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

  return <section aria-label="Tendencia del dinero disponible" className="app-surface dashboard-trend-panel">
    <div className="app-section-heading">
      <div>
        <h2 className="type-section-title">Tendencia del disponible</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Saldo real por día, calculado con los movimientos y cierres configurados.</p>
      </div>
      {points.length > 0 && <p className="text-right text-xs font-semibold tabular-nums text-app-foreground">{formatMoney(points[points.length - 1].available, currency, locale)}</p>}
    </div>
    {points.length < 2 ? <p className="app-empty mt-3">No hay saldos históricos suficientes para trazar estos 30 días.</p> : <>
      <svg className="mt-3 h-40 w-full overflow-visible" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={'Dinero disponible desde ' + formatDate(points[0].date, locale) + ' hasta ' + formatDate(points[points.length - 1].date, locale)}>
        {[0, 1, 2].map(index => <line key={index} x1="0" x2="600" y1={22 + index * 68} y2={22 + index * 68} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="4 6" />)}
        <polyline points={linePoints} fill="none" stroke="var(--app-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {pointCoordinates.map(point => <circle key={point.date} cx={point.x} cy={point.y} r="2.5" fill="var(--app-primary)"><title>{formatDate(point.date, locale)}: {formatMoney(point.available, currency, locale)}</title></circle>)}
      </svg>
      <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{formatDate(points[0].date, locale)}</span>
        <span>Últimos {points.length} días</span>
        <span>{formatDate(points[points.length - 1].date, locale)}</span>
      </div>
    </>}
  </section>;
};

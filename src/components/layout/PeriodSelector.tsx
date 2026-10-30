import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTH_NAMES_ES } from '../../constants/categories';

interface PeriodSelectorProps {
  year: number;
  month: number;
  onMonthChange: (year: number, month: number) => void;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ year, month, onMonthChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const latestYear = Math.max(2030, new Date().getFullYear() + 4);
  const years = Array.from({ length: latestYear - 2024 + 1 }, (_, index) => 2024 + index);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const shiftMonth = (amount: number) => {
    const next = new Date(year, month - 1 + amount, 1);
    onMonthChange(next.getFullYear(), next.getMonth() + 1);
  };

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-1">
      <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => setIsOpen((open) => !open)} aria-label="Elegir mes" aria-expanded={isOpen} aria-haspopup="true" className="min-h-11 rounded-xl px-2 text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100">
        {MONTH_NAMES_ES[month - 1]} {year}
      </button>
      <button type="button" onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Período</span>
            <select value={year} onChange={(event) => onMonthChange(Number(event.target.value), month)} aria-label="Año" className="h-9 rounded-lg border border-slate-200 bg-transparent px-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:text-slate-100">
              {years.map((availableYear) => <option key={availableYear} value={availableYear}>{availableYear}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTH_NAMES_ES.map((name, index) => {
              const selected = month === index + 1;
              return <button key={name} type="button" aria-pressed={selected} onClick={() => { onMonthChange(year, index + 1); setIsOpen(false); }} className={'min-h-10 rounded-lg px-2 text-sm font-medium transition-colors ' + (selected ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                {name.slice(0, 3)}
              </button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

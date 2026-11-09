import React, { useId } from 'react';
import { FormattedAmountInput } from './FormattedAmountInput';

interface MoneyFieldProps {
  label: string;
  currency: string;
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  min?: string;
  max?: number;
  step?: string;
  autoFocus?: boolean;
  className?: string;
}

export function MoneyField({ label, currency, value, onValueChange, required = true, min = '0.01', max, step = '0.01', autoFocus, className = '' }: MoneyFieldProps) {
  const id = useId();
  return <div className={'min-w-0 space-y-1.5 ' + className}>
    <label htmlFor={id} className="block text-sm font-medium text-slate-600 dark:text-slate-300">{label} ({currency})</label>
    <div className="flex min-h-14 items-center overflow-hidden rounded-xl border border-slate-300 bg-transparent transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-700">
      <span aria-hidden="true" className="shrink-0 pl-4 pr-2 text-base font-semibold text-slate-500 dark:text-slate-300">{currency}</span>
      <FormattedAmountInput id={id} className="type-money h-14 min-w-0 w-full bg-transparent px-2 pr-4 text-right text-xl font-bold text-app-foreground outline-none placeholder:text-slate-400" min={min} max={max} step={step} required={required} autoFocus={autoFocus} value={value} onValueChange={onValueChange} />
    </div>
  </div>;
}

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
  size?: 'default' | 'compact';
  className?: string;
}

export function MoneyField({ label, currency, value, onValueChange, required = true, min = '0.01', max, step = '0.01', autoFocus, size = 'default', className = '' }: MoneyFieldProps) {
  const id = useId();
  const compact = size === 'compact';
  return <div className={'min-w-0 space-y-1.5 ' + className}>
    <label htmlFor={id} className={'block font-medium text-slate-600 dark:text-slate-300 ' + (compact ? 'text-xs' : 'text-sm')}>{label} ({currency})</label>
    <div className={'flex items-center overflow-hidden rounded-xl border border-slate-300 bg-transparent transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 dark:border-slate-700 ' + (compact ? 'min-h-11' : 'min-h-14')}>
      <span aria-hidden="true" className={'shrink-0 font-semibold text-slate-500 dark:text-slate-300 ' + (compact ? 'pl-2.5 pr-1 text-xs' : 'pl-4 pr-2 text-base')}>{currency}</span>
      <FormattedAmountInput id={id} className={'min-w-0 w-full bg-transparent text-right text-app-foreground outline-none placeholder:text-slate-400 ' + (compact ? 'h-11 px-1.5 pr-2 text-sm font-semibold' : 'type-money h-14 px-2 pr-4 text-xl font-bold')} min={min} max={max} step={step} required={required} autoFocus={autoFocus} value={value} onValueChange={onValueChange} />
    </div>
  </div>;
}

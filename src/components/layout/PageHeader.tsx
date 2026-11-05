import React from 'react';

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  period?: React.ReactNode;
  actions?: React.ReactNode;
  divider?: boolean;
  className?: string;
}

/** Shared page title and action row for the primary app modules. */
export function PageHeader({ title, eyebrow, description, period, actions, divider = true, className = '' }: PageHeaderProps) {
  return <header className={'flex flex-col gap-3 ' + (divider ? 'border-b border-slate-200/80 pb-3 dark:border-slate-800/80 ' : '') + 'sm:flex-row sm:items-center sm:justify-between ' + className}>
    <div className="min-w-0">{eyebrow && <p className="type-secondary">{eyebrow}</p>}<h1 className="type-screen-title text-slate-900 dark:text-white">{title}</h1>{description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}</div>
    {(period || actions) && <div className="flex w-full flex-wrap items-center justify-between gap-1 sm:w-auto sm:justify-end sm:gap-2">{period}{actions}</div>}
  </header>;
}

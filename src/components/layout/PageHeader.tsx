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
  return <header className={'page-heading flex flex-col gap-3 ' + (divider ? 'border-b border-slate-200/80 dark:border-slate-800/80 ' : '') + 'sm:flex-row sm:items-center sm:justify-between ' + className}>
    <div className="min-w-0">{eyebrow && <p className="page-eyebrow">{eyebrow}</p>}<h1 className="type-screen-title text-app-foreground">{title}</h1>{description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}</div>
    {(period || actions) && <div className="page-tools flex w-full flex-wrap items-center justify-between sm:w-auto sm:justify-end">
      {period && <div className="page-period min-w-0">{period}</div>}
      {actions && <div className="page-actions flex flex-wrap items-center gap-2">{actions}</div>}
    </div>}
  </header>;
}

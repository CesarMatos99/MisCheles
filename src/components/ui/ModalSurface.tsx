import React from 'react';

export function ModalSurface({ children, size = 'md', scroll = 'auto', className = '' }: {
  children: React.ReactNode; size?: 'md' | 'lg'; scroll?: 'auto' | 'hidden'; className?: string;
}) {
  return <section className={'flex max-h-[90dvh] w-full flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 ' + (size === 'lg' ? 'max-w-lg ' : 'max-w-md ') + (scroll === 'hidden' ? 'overflow-hidden ' : 'overflow-y-auto ') + className}>{children}</section>;
}

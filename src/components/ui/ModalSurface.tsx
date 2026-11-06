import React from 'react';

export function ModalSurface({ children, size = 'md', scroll = 'auto', className = '' }: {
  children: React.ReactNode; size?: 'md' | 'lg'; scroll?: 'auto' | 'hidden'; className?: string;
}) {
  return <section className={'app-modal-surface flex w-full flex-col overscroll-contain text-app-foreground ' + (size === 'lg' ? 'max-w-lg ' : 'max-w-md ') + (scroll === 'hidden' ? 'overflow-hidden ' : 'overflow-y-auto ') + className}>{children}</section>;
}

import React from 'react';
import { X } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { ModalSurface } from './ModalSurface';

interface FilterPanelProps {
  title: string;
  onClose: () => void;
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
  size?: 'md' | 'lg';
  children: React.ReactNode;
}

/** Shared modal surface and apply/cancel/clear lifecycle for feature-owned filters. */
export function FilterPanel({ title, onClose, onClear, onCancel, onApply, size = 'md', children }: FilterPanelProps) {
  return <ModalShell title={title} onClose={onClose} size={size}>
    <ModalSurface size={size} scroll="hidden" className="text-app-foreground">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <h2 className="text-base font-semibold">{title}</h2>
        <button type="button" onClick={onCancel} aria-label="Cerrar filtros" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-app-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
      </header>
      <form onSubmit={event => { event.preventDefault(); onApply(); }} className="flex max-h-[calc(100dvh-6rem)] min-h-0 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <button type="button" onClick={onClear} className="btn-quiet text-sm">Limpiar filtros</button>
          <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
          <button type="submit" className="btn-primary text-sm">Aplicar filtros</button>
        </footer>
      </form>
    </ModalSurface>
  </ModalShell>;
}

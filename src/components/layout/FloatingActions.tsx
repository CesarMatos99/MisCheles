import React, { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Plus, X } from 'lucide-react';

interface FloatingActionsProps {
  onExpense: () => void;
  onIncome: () => void;
  onTransfer: () => void;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({ onExpense, onIncome, onTransfer }) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  const actions = [
    { label: 'Registrar gasto', icon: ArrowUpRight, onClick: onExpense },
    { label: 'Registrar ingreso', icon: ArrowDownLeft, onClick: onIncome },
    { label: 'Registrar transferencia', icon: ArrowRightLeft, onClick: onTransfer },
  ];

  return (
    <div ref={rootRef} className="fixed z-40 fab-position">
      {isOpen && (
        <div
          id="movement-actions-menu"
          role="group"
          aria-label="Selecciona el tipo de movimiento"
          className="absolute bottom-full mb-3 right-0 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {actions.map(({ label, icon: Icon, onClick }, index) => (
            <button
              key={label}
              type="button"
              onClick={() => { setIsOpen(false); onClick(); }}
              className={'flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800' + (index < actions.length - 1 ? ' border-b border-slate-100 dark:border-slate-800' : '')}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={isOpen ? 'Cerrar opciones de movimiento' : 'Registrar movimiento'}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="movement-actions-menu"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        {isOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Plus className="h-6 w-6" aria-hidden="true" />}
      </button>
    </div>
  );
};

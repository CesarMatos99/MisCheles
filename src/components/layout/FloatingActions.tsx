import React, { useState } from 'react';
import { ArrowRightLeft, ArrowDownLeft, ArrowUpRight, Plus, Receipt, X } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { ModalSurface } from '../ui/ModalSurface';

interface FloatingActionsProps {
  contextAction?: () => void;
  contextLabel?: string;
  onExpense: () => void;
  onIncome: () => void;
  onTransfer: () => void;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({ onExpense, onIncome, onTransfer, contextAction, contextLabel }) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { label: 'Registrar gasto', icon: ArrowUpRight, onClick: onExpense },
    { label: 'Registrar ingreso', icon: ArrowDownLeft, onClick: onIncome },
    { label: 'Registrar transferencia', icon: ArrowRightLeft, onClick: onTransfer },
    ...(contextAction ? [{ label: contextLabel || 'Registrar en esta categoría', icon: Receipt, onClick: contextAction }] : []),
  ];

  return (
    <>
      <div className="fixed z-40 fab-position lg:hidden">
      <button
        type="button"
        aria-label={isOpen ? 'Cerrar opciones de movimiento' : 'Registrar movimiento'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="mobile-movement-actions-menu"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--app-action)] text-white shadow-lg shadow-blue-950/20 transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
      </button>
      </div>
      {isOpen && <ModalShell title="Nuevo registro" onClose={() => setIsOpen(false)}>
        <ModalSurface className="app-mobile-sheet app-action-sheet" scroll="auto">
          <div id="mobile-movement-actions-menu" className="p-4 sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-app-foreground">Nuevo registro</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Elige el tipo de operación.</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar opciones" className="btn-icon text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <div role="group" aria-label="Tipos de registro" className="mt-3 grid gap-2">
              {actions.map(({ label, icon: Icon, onClick }) => <button key={label} type="button" onClick={() => { setIsOpen(false); onClick(); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-left text-sm font-semibold text-slate-800 transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <span>{label}</span>
              </button>)}
            </div>
          </div>
        </ModalSurface>
      </ModalShell>}
    </>
  );
};

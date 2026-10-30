import React from 'react';
import { ArrowDownLeft, ArrowRightLeft, Plus } from 'lucide-react';

interface FloatingActionsProps {
  onExpense: () => void;
  onIncome: () => void;
  onTransfer: () => void;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({ onExpense, onIncome, onTransfer }) => (
  <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-3 sm:bottom-6 sm:right-6" aria-label="Acciones rápidas">
    <button type="button" onClick={onTransfer} aria-label="Registrar transferencia" title="Transferencia" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700">
      <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
    </button>
    <button type="button" onClick={onIncome} aria-label="Agregar ingreso" title="Agregar ingreso" className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-xl active:scale-95">
      <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
    </button>
    <button type="button" onClick={onExpense} aria-label="Agregar gasto" title="Agregar gasto" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-2xl active:scale-95">
      <Plus className="h-6 w-6" aria-hidden="true" />
    </button>
  </div>
);

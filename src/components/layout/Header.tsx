import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Moon, Plus, Sun, UserRound, X } from 'lucide-react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onExpense: () => void;
  onIncome: () => void;
  onTransfer: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme, onOpenProfile, onExpense, onIncome, onTransfer, profile }) => {
  const { t } = useLanguage();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!createMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !createMenuRef.current?.contains(event.target)) setCreateMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [createMenuOpen]);

  const createActions = [
    { label: 'Registrar gasto', icon: ArrowUpRight, action: onExpense },
    { label: 'Registrar ingreso', icon: ArrowDownLeft, action: onIncome },
    { label: 'Registrar transferencia', icon: ArrowRightLeft, action: onTransfer },
  ];

  return (
  <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-0 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
    <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
      <div className="min-w-0 lg:hidden">
        <span className="truncate text-lg font-extrabold tracking-tight text-primary">MisCheles</span>
      </div>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div ref={createMenuRef} className="relative">
          <button type="button" onClick={() => setCreateMenuOpen(open => !open)} aria-label="Nuevo registro" aria-haspopup="true" aria-expanded={createMenuOpen} aria-controls="header-create-menu" className="btn-primary inline-flex min-h-10 items-center gap-2 px-3 text-sm sm:px-4">
            {createMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            <span className="hidden sm:inline">Nuevo registro</span>
          </button>
          {createMenuOpen && <div id="header-create-menu" role="group" aria-label="Selecciona el tipo de registro" className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {createActions.map(({ label, icon: Icon, action }) => <button key={label} type="button" onClick={() => { setCreateMenuOpen(false); action(); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-100 dark:hover:bg-slate-800">
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />{label}
            </button>)}
          </div>}
        </div>
        <button onClick={onToggleTheme} aria-label={isDarkMode ? t('enableLight') : t('enableDark')} className="btn-icon text-slate-600 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
          {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
        </button>
        <button onClick={onOpenProfile} aria-label={t('openProfile') + ' ' + profile.name} className="btn-icon overflow-hidden border border-slate-300 bg-slate-50 text-primary transition hover:border-primary dark:border-slate-600 dark:bg-slate-900">
          <UserRound className="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>
  );
};

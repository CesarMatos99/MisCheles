import React from 'react';
import { LockKeyhole, Moon, Sun, UserRound, Wallet } from 'lucide-react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLockApp: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme, onLockApp, onOpenProfile, profile }) => {
  const { t } = useLanguage();
  return (
  <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-3 py-2 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white" aria-hidden="true">
          <Wallet className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white">MisCheles</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onToggleTheme} aria-label={isDarkMode ? t('enableLight') : t('enableDark')} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
          {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
        </button>
        <button onClick={onLockApp} aria-label={t('lockApp')} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
          <LockKeyhole className="h-5 w-5" />
        </button>
        <button onClick={onOpenProfile} aria-label={t('openProfile') + ' ' + profile.name} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-600 dark:text-slate-300">
          <UserRound className="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>
  );
};

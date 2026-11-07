import React from 'react';
import { Moon, Sun, UserRound } from 'lucide-react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme, onOpenProfile, profile }) => {
  const { t } = useLanguage();
  return (
  <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-0 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex min-w-0 items-center">
        <span className="truncate text-lg font-extrabold tracking-tight text-primary">MisCheles</span>
      </div>
      <div className="flex items-center gap-1">
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

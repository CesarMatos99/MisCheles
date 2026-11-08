import React from 'react';
import { Moon, Sun, UserRound } from 'lucide-react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAccountAuth } from '../../firebase/AccountAuthProvider';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme, onOpenProfile, profile }) => {
  const { t } = useLanguage();
  const { user } = useAccountAuth();
  const identityName = user?.displayName?.trim() || profile.name;
  const firstName = identityName.trim().split(/\s+/)[0];

  return (
  <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-0 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
    <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 xl:px-8">
      <div className="min-w-0 lg:hidden">
        <span className="truncate text-lg font-extrabold tracking-tight text-primary">MisCheles</span>
      </div>
      <p className="ml-auto hidden min-w-0 truncate text-base font-semibold text-app-foreground lg:block">¡Hola{firstName ? ', ' + firstName : ''}!</p>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
        <button onClick={onToggleTheme} aria-label={isDarkMode ? t('enableLight') : t('enableDark')} className="btn-icon text-slate-600 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
          {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
        </button>
        <button onClick={onOpenProfile} aria-label={t('openProfile') + ' ' + identityName} className="btn-icon overflow-hidden border border-slate-300 bg-slate-50 text-primary transition hover:border-primary dark:border-slate-600 dark:bg-slate-900">
          <UserRound className="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>
  );
};

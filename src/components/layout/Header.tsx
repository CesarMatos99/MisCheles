import React from 'react';
import { LockKeyhole, Moon, Sun, UserRound } from 'lucide-react';
import { UserProfile } from '../../types';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onLockApp: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme, onLockApp, onOpenProfile, profile }) => (
  <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white" aria-hidden="true">
          <img src="/app-icon.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">MisCheles</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onToggleTheme} aria-label={isDarkMode ? 'Activar modo claro' : 'Activar modo oscuro'} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
          {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
        </button>
        <button onClick={onLockApp} aria-label="Bloquear aplicación" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
          <LockKeyhole className="h-5 w-5" />
        </button>
        <button onClick={onOpenProfile} aria-label={'Abrir perfil de ' + profile.name} className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary dark:border-slate-700 dark:text-slate-300">
          {profile.photoUrl ? <img src={profile.photoUrl} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5" />}
        </button>
      </div>
    </div>
  </header>
);

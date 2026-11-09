import React, { useEffect, useRef, useState } from 'react';
import { LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAccountAuth } from '../../firebase/AccountAuthProvider';
import { accountAuthMessage } from '../../firebase/accountAuthErrors';
import { resolveVisibleIdentity } from '../../domain/visibleIdentity';
import { useWebAccess } from '../../onboarding/WebAccessContext';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({ isDarkMode, onToggleTheme, onOpenProfile, onOpenSettings, profile }) => {
  const { language, t } = useLanguage();
  const { user, signOut } = useAccountAuth();
  const { mode, exitDemo } = useWebAccess();
  const isDemo = mode === 'demo';
  const identity = resolveVisibleIdentity(profile, user, isDemo);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isEnglish = language === 'en';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    const focusFrame = window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [menuOpen]);

  const handleMenuKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!menuOpen) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
    else if (event.key === 'ArrowUp') next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    items[next]?.focus();
  };

  const handleSignOut = async () => {
    setBusy(true);
    setError('');
    try { await signOut(); setMenuOpen(false); }
    catch (reason) { setError(accountAuthMessage(reason, language)); }
    finally { setBusy(false); }
  };
  const openProfile = () => { setMenuOpen(false); onOpenProfile(); };
  const openSettings = () => { setMenuOpen(false); onOpenSettings(); };
  const handleExitDemo = () => { setMenuOpen(false); exitDemo(); };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-0 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 xl:px-8">
        <div className="min-w-0 lg:hidden"><span className="truncate text-lg font-extrabold tracking-tight text-primary">MisCheles</span></div>
        <p className="ml-auto hidden min-w-0 truncate text-base font-semibold text-app-foreground lg:block">
          {isDemo ? (isEnglish ? 'Demo mode' : 'Modo demostración') : identity.firstName ? (isEnglish ? 'Hello, ' : '¡Hola, ') + identity.firstName + '!' : (isEnglish ? 'Hello!' : '¡Hola!')}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
          <button type="button" onClick={onToggleTheme} aria-label={isDarkMode ? t('enableLight') : t('enableDark')} className="btn-icon text-slate-600 transition hover:bg-slate-100 hover:text-primary dark:text-slate-300 dark:hover:bg-slate-800">
            {isDarkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
          </button>
          <div className="relative" ref={menuRef} onKeyDown={handleMenuKeys}>
            <button ref={triggerRef} type="button" onClick={() => { setError(''); setMenuOpen((open) => !open); }} aria-haspopup="menu" aria-expanded={menuOpen} aria-controls="account-avatar-menu" aria-label={(isEnglish ? 'Account menu for ' : 'Menú de cuenta de ') + identity.name} className="btn-icon overflow-hidden border border-slate-300 bg-slate-50 text-primary transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:border-slate-600 dark:bg-slate-900">
              {!isDemo && identity.photoUrl ? <img src={identity.photoUrl} alt="" className="h-full w-full object-cover" /> : isDemo ? <UserRound className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true" className="text-sm font-bold">{identity.name.charAt(0).toUpperCase()}</span>}
            </button>
            {menuOpen && <div id="account-avatar-menu" role="menu" aria-label={isEnglish ? 'Account' : 'Cuenta'} className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
                <p className="truncate text-sm font-semibold text-app-foreground">{identity.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{isDemo ? (isEnglish ? 'Fictional demo account' : 'Identidad ficticia') : identity.accountEmail}</p>
              </div>
              <button type="button" role="menuitem" onClick={openProfile} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-slate-800">{isEnglish ? 'My profile' : 'Mi perfil'}</button>
              <button type="button" role="menuitem" onClick={openSettings} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-slate-800">{isEnglish ? 'Settings' : 'Configuración'}</button>
              {error && <p role="alert" className="px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
              {isDemo ? <button type="button" role="menuitem" disabled={busy} onClick={handleExitDemo} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"><LogOut className="h-4 w-4" aria-hidden="true" />{isEnglish ? 'Exit the demo' : 'Salir de la demostración'}</button> : <button type="button" role="menuitem" disabled={busy} onClick={() => void handleSignOut()} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/30"><LogOut className="h-4 w-4" aria-hidden="true" />{busy ? (isEnglish ? 'Signing out…' : 'Cerrando sesión…') : (isEnglish ? 'Sign out' : 'Cerrar sesión')}</button>}
            </div>}
          </div>
        </div>
      </div>
    </header>
  );
};

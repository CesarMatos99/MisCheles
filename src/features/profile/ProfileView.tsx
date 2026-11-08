import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Lock,
  LogOut,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Sun,
  UserRound,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { financeApplication } from '../../application/financeApplication';
import { CURRENCY_OPTIONS } from '../../constants/categories';
import { useLanguage } from '../../i18n/LanguageContext';
import { LANGUAGE_OPTIONS } from '../../i18n/catalog';
import { AccountSettingsSection } from '../../firebase/AccountSettingsSection';
import { useAccountAuth } from '../../firebase/AccountAuthProvider';
import { accountAuthMessage } from '../../firebase/accountAuthErrors';
import { localLockCredential } from '../../services/localLockCredential';
import { PageHeader } from '../../components/layout/PageHeader';
import { ACCENT_COLORS } from '../../constants/accentColors';

type ProfileSection = 'home' | 'profile' | 'appearance' | 'security' | 'account';

interface ProfileViewProps {
  profile: UserProfile;
  isDarkMode: boolean;
  accentColor: string;
  onThemeChange: (isDark: boolean) => void;
  onAccentColorChange: (color: string) => void;
  onProfileUpdated: (profile: UserProfile) => void;
  onOpenInstall: () => void;
  onLockApp: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  isDarkMode,
  accentColor,
  onThemeChange,
  onAccentColorChange,
  onProfileUpdated,
  onOpenInstall,
  onLockApp,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAccountAuth();
  const [section, setSection] = useState<ProfileSection>('home');
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [savedMessage, setSavedMessage] = useState('');
  const [newPin, setNewPin] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);

  const identityName = user?.displayName?.trim() || profile.name || 'Usuario';
  const identityEmail = user?.email || profile.email || 'Sin correo registrado';
  const identityPhoto = user?.photoURL || profile.photoUrl;
  const isSpanish = language === 'es';

  const handleSignOut = async () => {
    setAccountBusy(true);
    setAccountError('');
    try { await signOut(); }
    catch (error) { setAccountError(accountAuthMessage(error, language)); }
    finally { setAccountBusy(false); }
  };

  useEffect(() => setDraft(profile), [profile]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSecurityError('');
    if (section === 'security') {
      try {
        if (newPin) await localLockCredential.setPin(newPin);
        if (draft.pinLockEnabled && !newPin && !(await localLockCredential.hasPin())) { setSecurityError('Configura un PIN de 4 dígitos antes de activar el bloqueo.'); return; }
      } catch (error) { setSecurityError(error instanceof Error ? error.message : 'No se pudo guardar el PIN.'); return; }
    }
    const updated: UserProfile = { ...draft, name: draft.name.trim() || 'Usuario', email: draft.email.trim(), biometricsEnabled: false, monthlyTargetIncome: Number(draft.monthlyTargetIncome) || 0 };
    financeApplication.saveProfile(updated);
    onProfileUpdated(updated);
    setDraft(updated);
    setNewPin('');
    setSavedMessage('Cambios guardados');
    window.setTimeout(() => setSavedMessage(''), 2200);
  };

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, photoUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const title = section === 'profile'
    ? t('profileData')
    : section === 'appearance'
    ? t('appearance')
    : section === 'security'
    ? t('security')
    : section === 'account'
    ? t('accountSync')
    : t('profile');

  const fieldClass = 'app-field';

  return (
    <div className="app-profile mx-auto w-full max-w-5xl animate-in fade-in duration-200">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        {section !== 'home' && (
          <button type="button" onClick={() => setSection('home')} className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> {t('profile')}
          </button>
        )}
        <PageHeader title={title} eyebrow={t('settings')} divider={false} />
      </div>

      {section === 'home' && (
        <>
          <section className="flex flex-col items-center gap-3 border-b border-slate-200 py-6 text-center dark:border-slate-800 sm:flex-row sm:items-center sm:gap-4 sm:text-left">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-bold text-white">
              {identityPhoto ? <img src={identityPhoto} alt={identityName} className="h-full w-full object-cover" /> : identityName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="type-section-title truncate text-slate-900 dark:text-white">{identityName}</h2>
              <p className="type-secondary truncate">{identityEmail}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Moneda: {profile.currency}</p>
              {user && <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{isSpanish ? 'Cuenta MisCheles · ' : 'MisCheles account · '}{user.emailVerified ? (isSpanish ? 'correo verificado' : 'email verified') : (isSpanish ? 'verificación pendiente' : 'verification pending')}</p>}
            </div>
            {user && <button type="button" disabled={accountBusy} onClick={() => void handleSignOut()} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30 sm:w-auto">
              <LogOut className="h-4 w-4" aria-hidden="true" />{accountBusy ? t('pleaseWait') : t('signOut')}
            </button>}
          </section>
          {accountError && <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">{accountError}</p>}
          <nav className="grid grid-cols-1 divide-y divide-slate-200 dark:divide-slate-800 lg:grid-cols-2 lg:gap-3 lg:divide-y-0" aria-label="Configuración">
            <button type="button" onClick={() => setSection('profile')} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:rounded-xl lg:border lg:border-slate-200 lg:px-4 lg:hover:bg-slate-50 lg:dark:border-slate-800 lg:dark:hover:bg-slate-900">
              <UserRound className="h-5 w-5 text-primary" /><span className="flex-1">{t('profileData')}</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={() => setSection('appearance')} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:rounded-xl lg:border lg:border-slate-200 lg:px-4 lg:hover:bg-slate-50 lg:dark:border-slate-800 lg:dark:hover:bg-slate-900">
              <Palette className="h-5 w-5 text-primary" /><span className="flex-1">{t('appearance')}</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={() => setSection('account')} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:rounded-xl lg:border lg:border-slate-200 lg:px-4 lg:hover:bg-slate-50 lg:dark:border-slate-800 lg:dark:hover:bg-slate-900">
              <Smartphone className="h-5 w-5 text-primary" /><span className="flex-1">{t('accountSync')}</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={() => setSection('security')} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:rounded-xl lg:border lg:border-slate-200 lg:px-4 lg:hover:bg-slate-50 lg:dark:border-slate-800 lg:dark:hover:bg-slate-900">
              <Shield className="h-5 w-5 text-primary" /><span className="flex-1">{t('security')}</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={onOpenInstall} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:rounded-xl lg:border lg:border-slate-200 lg:px-4 lg:hover:bg-slate-50 lg:dark:border-slate-800 lg:dark:hover:bg-slate-900">
              <Smartphone className="h-5 w-5 text-primary" /><span className="flex-1">{t('installApp')}</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={onLockApp} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-rose-600 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:rounded-xl lg:border lg:border-slate-200 lg:px-4 lg:hover:bg-slate-50 lg:dark:border-slate-800 lg:dark:hover:bg-slate-900">
              <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" /><span className="flex-1">{t('lockApp')}</span>
            </button>
          </nav>
        </>
      )}

      {section === 'profile' && (
        <form onSubmit={saveProfile} className="space-y-5 py-5">
          <section className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-bold text-white">
              {draft.photoUrl ? <img src={draft.photoUrl} alt={draft.name} className="h-full w-full object-cover" /> : draft.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <input ref={photoInput} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
              <button type="button" onClick={() => photoInput.current?.click()} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Camera className="mr-2 inline h-4 w-4" />Cambiar foto
              </button>
              <p className="mt-1 text-xs text-slate-500">La foto se guarda en este dispositivo.</p>
            </div>
          </section>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre</span>
            <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Correo de contacto</span>
            <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className={fieldClass} />
            <span className="text-xs text-slate-500">Este correo de perfil no activa una cuenta ni sincroniza copias de seguridad.</span>
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Moneda</span>
              <select value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} className={fieldClass}>
                {CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ingreso base mensual</span>
              <input type="number" min="0" value={draft.monthlyTargetIncome} onChange={(e) => setDraft({ ...draft, monthlyTargetIncome: Number(e.target.value) })} className={fieldClass} />
            </label>
          </div>
          <SaveActions savedMessage={savedMessage} />
        </form>
      )}

      {section === 'appearance' && (
        <div className="space-y-7 py-5">
          <section>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('language')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('languageHelp')}</p>
            <label className="mt-3 block max-w-sm">
              <span className="sr-only">{t('language')}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className={fieldClass}>
                {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}
              </select>
            </label>
          </section>
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('theme')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('themeHelp')}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => onThemeChange(false)} aria-pressed={!isDarkMode} className={!isDarkMode ? 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary transition' : 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition dark:border-slate-700 dark:text-slate-300'}>
                <Sun className="h-4 w-4" />{t('light')}
              </button>
              <button type="button" onClick={() => onThemeChange(true)} aria-pressed={isDarkMode} className={isDarkMode ? 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary transition' : 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition dark:border-slate-700 dark:text-slate-300'}>
                <Moon className="h-4 w-4" />{t('dark')}
              </button>
            </div>
          </section>
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('primaryColor')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('primaryColorHelp')}</p>
            <div className="mt-4 flex flex-wrap gap-4">
              {ACCENT_COLORS.map((color) => {
                const selected = accentColor.toLowerCase() === color.value;
                return <button key={color.value} type="button" aria-label={'Usar color ' + color.name} aria-pressed={selected} title={color.name} onClick={() => onAccentColorChange(color.value)} className="flex h-11 w-11 items-center justify-center rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 dark:ring-offset-slate-950" style={{ backgroundColor: color.value, outline: selected ? '3px solid ' + color.value : undefined }}>
                  {selected && <Check className="h-5 w-5 text-white" />}
                </button>;
              })}
            </div>
          </section>
        </div>
      )}

      {section === 'account' && <AccountSettingsSection />}

      {section === 'security' && (
        <form onSubmit={saveProfile} className="space-y-5 py-5">
          <label className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
            <span><span className="block text-sm font-semibold text-slate-900 dark:text-white">Bloquear la aplicación al salir</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Al volver después de enviarla al fondo, solicita tu PIN. No cierra tu sesión ni sustituye el acceso a tu cuenta.</span></span>
            <input type="checkbox" checked={draft.pinLockEnabled} onChange={(e) => setDraft({ ...draft, pinLockEnabled: e.target.checked })} className="mt-1 h-4 w-4 accent-primary" />
          </label>
          <div className="rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300"><strong>Desbloqueo biométrico</strong><p className="mt-1">No está disponible en esta versión web. El acceso biométrico no se simula ni reemplaza la verificación del PIN.</p></div>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">PIN de privacidad (4 dígitos)</span>
            <input type="password" autoComplete="new-password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Deja vacío para conservarlo" className={fieldClass + ' max-w-64 tracking-[0.25em]'} />
            <span className="block text-xs text-slate-500 dark:text-slate-400">Se guarda solo en este dispositivo y no se sincroniza con tu cuenta.</span>
          </label>
          {securityError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{securityError}</p>}
          <SaveActions savedMessage={savedMessage} />
        </form>
      )}
    </div>
  );
};

const SaveActions: React.FC<{ savedMessage: string }> = ({ savedMessage }) => (
  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
    <p role="status" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{savedMessage}</p>
    <button type="submit" className="btn-primary text-sm">Guardar cambios</button>
  </div>
);

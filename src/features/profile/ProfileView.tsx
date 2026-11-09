import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Lock,
  Moon,
  Palette,
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
import { localLockCredential } from '../../services/localLockCredential';
import { PageHeader } from '../../components/layout/PageHeader';
import { ACCENT_COLORS } from '../../constants/accentColors';
import { resolveVisibleIdentity } from '../../domain/visibleIdentity';
import { useWebAccess } from '../../onboarding/WebAccessContext';

type ProfileSection = 'home' | 'appearance' | 'security' | 'account';

interface ProfileViewProps {
  profile: UserProfile;
  isDarkMode: boolean;
  accentColor: string;
  onThemeChange: (isDark: boolean) => void;
  onAccentColorChange: (color: string) => void;
  onProfileUpdated: (profile: UserProfile) => void;
  onOpenInstall: () => void;
  onLockApp: () => void;
  navigationRequest: { id: number; section: 'home' | 'appearance' } | null;
  onNavigationRequestHandled: (id: number) => void;
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
  navigationRequest,
  onNavigationRequestHandled,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAccountAuth();
  const { mode } = useWebAccess();
  const isDemo = mode === 'demo';
  const [section, setSection] = useState<ProfileSection>('home');
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [editingName, setEditingName] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasLocalPin, setHasLocalPin] = useState(false);
  const [pinStatusLoading, setPinStatusLoading] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);

  const identity = resolveVisibleIdentity(profile, user, isDemo);
  const identityName = identity.name;
  const identityPhoto = identity.photoUrl;
  const isSpanish = language === 'es';
  const securityCopy = isSpanish ? {
    lockTitle: 'Bloqueo al salir', lockDescription: 'Al volver a MisCheles se solicita tu PIN local. Esto no cierra la sesión de tu cuenta.',
    lockLabel: 'Bloquear la aplicación al salir', configureBefore: 'Configura un PIN antes de activar el bloqueo al salir.', lockNow: 'Bloquear aplicación ahora',
    pinTitle: 'PIN de privacidad', checkingPin: 'Comprobando PIN local…', pinSet: 'PIN configurado en este dispositivo.', pinMissing: 'Aún no hay un PIN configurado.',
    cancel: 'Cancelar', changePin: 'Cambiar PIN', configurePin: 'Configurar PIN', newPin: 'Nuevo PIN (4 dígitos)', setupPin: 'Configurar PIN (4 dígitos)', confirmPin: 'Confirmar PIN',
    pinHelp: 'El PIN usa PBKDF2 y se guarda solo en este dispositivo; es independiente de tu inicio de sesión.',
    pinLengthError: 'El PIN debe tener exactamente 4 dígitos.', pinMismatch: 'Los PIN no coinciden.', pinRequired: 'Configura un PIN antes de activar el bloqueo al salir.',
  } : {
    lockTitle: 'Lock when leaving', lockDescription: 'MisCheles will ask for your local PIN when you return. This does not sign you out.',
    lockLabel: 'Lock the app when leaving', configureBefore: 'Set a PIN before enabling the lock.', lockNow: 'Lock app now',
    pinTitle: 'Privacy PIN', checkingPin: 'Checking local PIN…', pinSet: 'PIN is set on this device.', pinMissing: 'No PIN is set yet.',
    cancel: 'Cancel', changePin: 'Change PIN', configurePin: 'Set up PIN', newPin: 'New PIN (4 digits)', setupPin: 'Set up PIN (4 digits)', confirmPin: 'Confirm PIN',
    pinHelp: 'The PIN uses PBKDF2 and stays on this device; it is separate from your sign-in.',
    pinLengthError: 'The PIN must be exactly 4 digits.', pinMismatch: 'The PINs do not match.', pinRequired: 'Set a PIN before enabling the lock.',
  };

  useEffect(() => {
    setDraft(profile);
    setEditingName(false);
  }, [profile]);

  useEffect(() => {
    if (section !== 'security') return undefined;
    let active = true;
    setPinStatusLoading(true);
    setSecurityError('');
    void localLockCredential.hasPin()
      .then((exists) => {
        if (!active) return;
        setHasLocalPin(exists);
        setEditingPin(!exists);
      })
      .catch((error: unknown) => {
        if (active) setSecurityError(error instanceof Error ? error.message : 'No se pudo consultar el PIN local.');
      })
      .finally(() => { if (active) setPinStatusLoading(false); });
    return () => { active = false; };
  }, [section]);

  useEffect(() => {
    if (!navigationRequest) return;
    setSection(navigationRequest.section);
    onNavigationRequestHandled(navigationRequest.id);
  }, [navigationRequest?.id]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSecurityError('');
    if (section === 'security') {
      try {
        const pinWasEntered = newPin.length > 0 || confirmPin.length > 0;
        if (pinWasEntered) {
          if (!/^\d{4}$/.test(newPin)) { setSecurityError(securityCopy.pinLengthError); setEditingPin(true); return; }
          if (newPin !== confirmPin) { setSecurityError(securityCopy.pinMismatch); setEditingPin(true); return; }
          await localLockCredential.setPin(newPin);
          setHasLocalPin(true);
          setEditingPin(false);
          setNewPin('');
          setConfirmPin('');
        }
        if (draft.pinLockEnabled && !newPin && !(await localLockCredential.hasPin())) {
          setHasLocalPin(false);
          setEditingPin(true);
          setSecurityError(securityCopy.pinRequired);
          return;
        }
      } catch (error) { setSecurityError(error instanceof Error ? error.message : 'No se pudo guardar el PIN.'); return; }
    }
    const updated: UserProfile = {
      ...draft,
      name: profile.name,
      email: profile.email,
      photoUrl: profile.photoUrl,
      currency: profile.currency,
      biometricsEnabled: false,
      monthlyTargetIncome: profile.monthlyTargetIncome,
    };
    financeApplication.saveProfile(updated);
    onProfileUpdated(updated);
    setDraft(updated);
    setEditingName(false);
    setNewPin('');
    setSavedMessage('Cambios guardados');
    window.setTimeout(() => setSavedMessage(''), 2200);
  };

  const saveVisibleName = (event: React.FormEvent) => {
    event.preventDefault();
    const updated = { ...profile, name: draft.name.trim() };
    financeApplication.saveProfile(updated);
    onProfileUpdated(updated);
    setDraft(updated);
    setEditingName(false);
    setSavedMessage(isSpanish ? 'Nombre actualizado' : 'Name updated');
    window.setTimeout(() => setSavedMessage(''), 2200);
  };

  const updateCurrency = (currency: string) => {
    const updated = { ...profile, currency };
    financeApplication.saveProfile(updated);
    onProfileUpdated(updated);
    setDraft(updated);
  };

  const handlePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const updated = { ...profile, photoUrl: String(reader.result || '') };
      financeApplication.saveProfile(updated);
      onProfileUpdated(updated);
      setDraft(updated);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const accountLabel = isSpanish ? 'Mi cuenta' : 'My account';
  const title = section === 'appearance'
    ? t('appearance')
    : section === 'security'
    ? t('security')
    : section === 'account'
    ? accountLabel
    : t('profile');

  const fieldClass = 'app-field';

  return (
    <div className="app-profile mx-auto w-full max-w-none animate-in fade-in duration-200">
      <input ref={photoInput} type="file" accept="image/*" onChange={handlePhoto} className="hidden" disabled={isDemo} aria-label="Seleccionar foto de perfil" />
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
          <section className="flex flex-col items-center gap-3 border-b border-slate-200 py-7 text-center dark:border-slate-800">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-3xl font-bold text-white">
              {isDemo ? <UserRound className="h-6 w-6" aria-hidden="true" /> : identityPhoto ? <img src={identityPhoto} alt={identityName} className="h-full w-full object-cover" /> : identityName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 w-full">
              <h2 className="type-section-title truncate text-slate-900 dark:text-white">{identityName}</h2>
              {isDemo ? <p className="type-secondary truncate">Modo demostración · datos ficticios</p> : identity.accountEmail && <p className="type-secondary truncate">{identity.accountEmail}</p>}
            </div>
            {user && <p className={'text-xs font-semibold ' + (user.emailVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300')}>
              {user.emailVerified ? (isSpanish ? 'Correo verificado' : 'Email verified') : (isSpanish ? 'Verificación pendiente' : 'Verification pending')}
            </p>}
          </section>
          <nav className="divide-y divide-slate-200 dark:divide-slate-800" aria-label={isSpanish ? 'Opciones de perfil' : 'Profile settings'}>
            <button type="button" onClick={() => setSection('account')} className="flex min-h-16 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <UserRound className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{accountLabel}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{isSpanish ? 'Identidad y métodos de acceso' : 'Identity and sign-in methods'}</span></span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={() => setSection('appearance')} className="flex min-h-16 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Palette className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t('appearance')}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{isSpanish ? 'Idioma, tema y color' : 'Language, theme, and color'}</span></span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={() => setSection('security')} className="flex min-h-16 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Lock className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t('security')}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{isSpanish ? 'Bloqueo local y PIN' : 'Local lock and PIN'}</span></span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={onOpenInstall} className="flex min-h-16 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <Smartphone className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{t('installApp')}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{isSpanish ? 'Añade MisCheles a este dispositivo' : 'Add MisCheles to this device'}</span></span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </nav>
        </>
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
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{isSpanish ? 'Moneda predeterminada' : 'Default currency'}</h2>
            <label className="mt-3 block max-w-sm">
              <span className="sr-only">{isSpanish ? 'Moneda predeterminada' : 'Default currency'}</span>
              <select disabled={isDemo} value={draft.currency} onChange={(event) => updateCurrency(event.target.value)} className={fieldClass}>
                {CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </section>
        </div>
      )}

      {section === 'account' && <div className="space-y-6 py-5">
        <form onSubmit={saveVisibleName} className="space-y-4">
          <section className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {identityPhoto ? <img src={identityPhoto} alt="" className="h-full w-full object-cover" /> : identityName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{identityName}</p>
              {identity.accountEmail && <p className="truncate text-sm text-slate-600 dark:text-slate-300">{identity.accountEmail}</p>}
              <button type="button" disabled={isDemo} onClick={() => photoInput.current?.click()} className="mt-1 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary transition hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-60">
                <Camera className="h-4 w-4" aria-hidden="true" />{isSpanish ? 'Cambiar foto' : 'Change photo'}
              </button>
            </div>
          </section>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{isSpanish ? 'Nombre visible' : 'Display name'}</span>
            <input disabled={isDemo} autoComplete="name" maxLength={80} value={editingName ? draft.name : (profile.name.trim() && profile.name.trim().toLocaleLowerCase('es') !== 'usuario' ? profile.name : identityName)} onFocus={() => {
              if (!editingName) setDraft((current) => ({ ...current, name: profile.name.trim() && profile.name.trim().toLocaleLowerCase('es') !== 'usuario' ? profile.name : identity.name }));
              setEditingName(true);
            }} onChange={(event) => { setEditingName(true); setDraft({ ...draft, name: event.target.value }); }} className={fieldClass} />
          </label>
          {editingName && <SaveActions savedMessage={savedMessage} label={isSpanish ? 'Guardar nombre' : 'Save name'} />}
        </form>
        <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
          <AccountSettingsSection />
        </div>
      </div>}

      {section === 'security' && (
        <form onSubmit={saveProfile} className="space-y-6 py-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0"><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{securityCopy.lockTitle}</h2><p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{securityCopy.lockDescription}</p></div>
              <button type="button" role="switch" aria-checked={draft.pinLockEnabled} aria-label={securityCopy.lockLabel} disabled={pinStatusLoading || (!hasLocalPin && !draft.pinLockEnabled)} onClick={() => setDraft({ ...draft, pinLockEnabled: !draft.pinLockEnabled })} className={'relative inline-flex h-11 w-14 shrink-0 items-center rounded-full p-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ' + (draft.pinLockEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700')}>
                <span aria-hidden="true" className={'h-9 w-9 rounded-full bg-white shadow transition-transform ' + (draft.pinLockEnabled ? 'translate-x-3' : 'translate-x-0')} />
              </button>
            </div>
            {!hasLocalPin && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{securityCopy.configureBefore}</p>}
            <button type="button" disabled={!hasLocalPin} onClick={onLockApp} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50">{securityCopy.lockNow}</button>
          </section>
          <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-slate-900 dark:text-white">{securityCopy.pinTitle}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pinStatusLoading ? securityCopy.checkingPin : hasLocalPin ? securityCopy.pinSet : securityCopy.pinMissing}</p></div>
              <button type="button" onClick={() => { setEditingPin((editing) => !editing); setNewPin(''); setConfirmPin(''); setSecurityError(''); }} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{editingPin ? securityCopy.cancel : hasLocalPin ? securityCopy.changePin : securityCopy.configurePin}</button>
            </div>
            {editingPin && <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{hasLocalPin ? securityCopy.newPin : securityCopy.setupPin}</span><input required={draft.pinLockEnabled || newPin.length > 0 || confirmPin.length > 0} inputMode="numeric" pattern="[0-9]{4}" autoComplete="new-password" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className={fieldClass + ' tracking-[0.35em]'} /></label>
              <label className="block space-y-1.5"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{securityCopy.confirmPin}</span><input required={draft.pinLockEnabled || newPin.length > 0 || confirmPin.length > 0} inputMode="numeric" pattern="[0-9]{4}" autoComplete="new-password" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className={fieldClass + ' tracking-[0.35em]'} /></label>
            </div>}
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{securityCopy.pinHelp}</p>
          </section>
          {securityError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{securityError}</p>}
          <SaveActions savedMessage={savedMessage} label={isSpanish ? 'Guardar seguridad' : 'Save security'} />
        </form>
      )}
    </div>
  );
};

const SaveActions: React.FC<{ savedMessage: string; label?: string }> = ({ savedMessage, label = 'Guardar cambios' }) => (
  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
    <p role="status" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{savedMessage}</p>
    <button type="submit" className="btn-primary text-sm">{label}</button>
  </div>
);

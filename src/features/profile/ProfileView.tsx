import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Lock,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Sun,
  UserRound,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { storageService } from '../../services/storage';
import { CURRENCY_OPTIONS } from '../../constants/categories';

type ProfileSection = 'home' | 'profile' | 'appearance' | 'security';

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

const ACCENT_COLORS = [
  { name: 'Azul marino', value: '#012677' },
  { name: 'Azul', value: '#2563eb' },
  { name: 'Verde azulado', value: '#0f766e' },
  { name: 'Violeta', value: '#6d28d9' },
  { name: 'Coral', value: '#b54737' },
  { name: 'Ámbar', value: '#8a4b08' },
];

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
  const [section, setSection] = useState<ProfileSection>('home');
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [savedMessage, setSavedMessage] = useState('');
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(profile), [profile]);

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    const updated = {
      ...draft,
      name: draft.name.trim() || 'Usuario',
      email: draft.email.trim(),
      pinCode: draft.pinCode.trim() || '1234',
      monthlyTargetIncome: Number(draft.monthlyTargetIncome) || 0,
    };
    storageService.saveProfile(updated);
    onProfileUpdated(updated);
    setDraft(updated);
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
    ? 'Datos del perfil'
    : section === 'appearance'
    ? 'Apariencia'
    : section === 'security'
    ? 'Seguridad'
    : 'Perfil';

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-slate-700 dark:text-white';

  return (
    <div className="mx-auto w-full max-w-3xl animate-in fade-in duration-200">
      <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
        {section !== 'home' && (
          <button type="button" onClick={() => setSection('home')} className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Perfil
          </button>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">Cuenta y preferencias</p>
        <h1 className="mt-1 type-screen-title text-slate-900 dark:text-white">{title}</h1>
      </header>

      {section === 'home' && (
        <>
          <section className="flex items-center gap-4 border-b border-slate-200 py-6 dark:border-slate-800">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-bold text-white">
              {profile.photoUrl ? <img src={profile.photoUrl} alt={profile.name} className="h-full w-full object-cover" /> : profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="type-section-title truncate text-slate-900 dark:text-white">{profile.name}</h2>
              <p className="type-secondary truncate">{profile.email || 'Sin correo registrado'}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Moneda: {profile.currency}</p>
            </div>
          </section>
          <nav className="divide-y divide-slate-200 dark:divide-slate-800" aria-label="Configuración">
            <button type="button" onClick={() => setSection('profile')} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100">
              <UserRound className="h-5 w-5 text-primary" /><span className="flex-1">Datos del perfil</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={() => setSection('appearance')} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100">
              <Palette className="h-5 w-5 text-primary" /><span className="flex-1">Apariencia</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={() => setSection('security')} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100">
              <Shield className="h-5 w-5 text-primary" /><span className="flex-1">Seguridad</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={onOpenInstall} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-primary dark:text-slate-100">
              <Smartphone className="h-5 w-5 text-primary" /><span className="flex-1">Instalar aplicación</span><ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button type="button" onClick={onLockApp} className="flex min-h-14 w-full items-center gap-3 py-3 text-left text-sm font-semibold text-slate-800 transition hover:text-rose-600 dark:text-slate-100">
              <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" /><span className="flex-1">Bloquear aplicación</span>
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
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Tema</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Elige cómo quieres ver MisCheles.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => onThemeChange(false)} aria-pressed={!isDarkMode} className={!isDarkMode ? 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary transition' : 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition dark:border-slate-700 dark:text-slate-300'}>
                <Sun className="h-4 w-4" />Claro
              </button>
              <button type="button" onClick={() => onThemeChange(true)} aria-pressed={isDarkMode} className={isDarkMode ? 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-3 text-sm font-semibold text-primary transition' : 'flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 transition dark:border-slate-700 dark:text-slate-300'}>
                <Moon className="h-4 w-4" />Oscuro
              </button>
            </div>
          </section>
          <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Color principal</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Se aplica a botones, indicadores y elementos destacados.</p>
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

      {section === 'security' && (
        <form onSubmit={saveProfile} className="space-y-5 py-5">
          <label className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
            <span><span className="block text-sm font-semibold text-slate-900 dark:text-white">Bloqueo al abrir</span><span className="mt-1 block text-xs text-slate-500">Solicita autenticación al volver a entrar a la aplicación.</span></span>
            <input type="checkbox" checked={draft.pinLockEnabled} onChange={(e) => setDraft({ ...draft, pinLockEnabled: e.target.checked })} className="mt-1 h-4 w-4 accent-primary" />
          </label>
          <label className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
            <span><span className="block text-sm font-semibold text-slate-900 dark:text-white">Desbloqueo biométrico</span><span className="mt-1 block text-xs text-slate-500">Usa huella o reconocimiento facial si el dispositivo lo permite.</span></span>
            <input type="checkbox" checked={draft.biometricsEnabled} onChange={(e) => setDraft({ ...draft, biometricsEnabled: e.target.checked })} className="mt-1 h-4 w-4 accent-primary" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">PIN de respaldo (4 dígitos)</span>
            <input type="password" inputMode="numeric" maxLength={4} value={draft.pinCode} onChange={(e) => setDraft({ ...draft, pinCode: e.target.value.replace(/\D/g, '').slice(0, 4) })} className={fieldClass + ' max-w-40 tracking-[0.4em]'} />
            <span className="block text-xs text-slate-500">Se usa como alternativa si no puedes desbloquear con biometría.</span>
          </label>
          <SaveActions savedMessage={savedMessage} />
        </form>
      )}
    </div>
  );
};

const SaveActions: React.FC<{ savedMessage: string }> = ({ savedMessage }) => (
  <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
    <p role="status" className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{savedMessage}</p>
    <button type="submit" className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary-hover">Guardar cambios</button>
  </div>
);

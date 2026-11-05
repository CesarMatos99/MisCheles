import React, { useState, type FormEvent } from 'react';
import { ArrowLeft, Cloud, FlaskConical, HardDrive, WalletCards } from 'lucide-react';
import { useAccountAuth } from '../firebase/AccountAuthProvider';
import { setStorageScope } from '../services/storage';
import { LANGUAGE_OPTIONS } from '../i18n/catalog';
import { useLanguage } from '../i18n/LanguageContext';
import { resolveRestoredWebMode, type RestoredWebMode } from './webModePolicy';

const MODE_KEY = 'mischeles_web_mode_v1';
const LOCAL_DATA_KEYS = [
  'mischeles_transactions_v3', 'mischeles_savings_movements_v3',
  'mischeles_savings_goals_v3', 'mischeles_month_configs_v2',
  'mischeles_category_budgets_v1', 'mischeles_user_profile_v2',
];
type LocalMode = RestoredWebMode;

function restoreMode(): LocalMode | null {
  try {
    const restored = resolveRestoredWebMode(
      localStorage.getItem(MODE_KEY),
      LOCAL_DATA_KEYS.some((key) => localStorage.getItem(key) !== null),
    );
    if (!restored) return null;
    const scope = restored === 'demo' ? 'demo' : 'local';
    localStorage.setItem(MODE_KEY, scope);
    setStorageScope(scope);
    return restored;
  } catch { /* Continue to onboarding if browser storage is unavailable. */ }
  return null;
}

export const WebModeGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { configured, ready, user, signIn, signInWithGoogle, createAccount, sendPasswordReset } = useAccountAuth();
  const { language, setLanguage, t } = useLanguage();
  const [mode, setMode] = useState<LocalMode | null>(restoreMode);
  const [authView, setAuthView] = useState<'signIn' | 'create' | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isEnglish = language === 'en';
  const copy = isEnglish ? {
    title: 'How would you like to use Mis Cheles?',
    subtitle: 'Choose where to keep your financial records. You can connect an account later to sync your devices.',
    demo: 'Try the demo', demoHelp: 'Explore the app with sample records. Demo data stays separate from your own records.',
    local: 'Use without an account', localHelp: 'Keep your records in this browser. You can create an account and migrate them later.',
    account: 'I already have an account', accountHelp: 'Sign in to sync your records with your other devices.',
    unavailable: 'Cloud accounts are not configured here yet. Local and demo modes are available.',
    create: 'Create account', signIn: 'Sign in', fullName: 'Name', email: 'Account email', password: 'Password (at least 8 characters)',
    google: 'Continue with Google', back: 'Back', verify: 'Account created. Verify your email, then sign in.',
    reset: 'Send password reset email', resetSent: 'If the account exists, reset instructions will arrive by email.',
    language: 'Display language', privacy: 'Signing in to Mis Cheles does not grant access to email accounts or bank messages.',
    failed: 'Could not complete the request. Check your details and try again.',
  } : {
    title: '¿Cómo quieres usar Mis Cheles?',
    subtitle: 'Elige dónde guardar tus registros. Más adelante puedes conectar una cuenta para sincronizar tus dispositivos.',
    demo: 'Probar la app', demoHelp: 'Explora la app con registros de ejemplo. La demo queda separada de tus datos.',
    local: 'Usar sin cuenta', localHelp: 'Tus registros se guardan en este navegador y podrás migrarlos a una cuenta después.',
    account: 'Ya tengo una cuenta', accountHelp: 'Inicia sesión para sincronizar tus registros con otros dispositivos.',
    unavailable: 'Las cuentas en la nube aún no están configuradas aquí. Puedes usar el modo local o demo.',
    create: 'Crear cuenta', signIn: 'Iniciar sesión', fullName: 'Nombre', email: 'Correo de la cuenta', password: 'Contraseña (mínimo 8 caracteres)',
    google: 'Continuar con Google', back: 'Volver', verify: 'Cuenta creada. Verifica tu correo y luego inicia sesión.',
    reset: 'Enviar correo para restablecer contraseña', resetSent: 'Si la cuenta existe, recibirás instrucciones por correo.',
    language: 'Idioma de visualización', privacy: 'Iniciar sesión en Mis Cheles no autoriza el acceso a tus correos ni a mensajes del banco.',
    failed: 'No se pudo completar la solicitud. Revisa tus datos e inténtalo de nuevo.',
  };

  const chooseMode = (next: 'demo' | 'local') => {
    try { localStorage.setItem(MODE_KEY, next); } catch { /* The current session can still use the selected scope. */ }
    setStorageScope(next);
    setMode(next);
  };

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (authView === 'create') {
        await createAccount(name.trim(), email.trim(), password);
        setAuthView('signIn'); setPassword(''); setMessage(copy.verify);
      } else {
        await signIn(email.trim(), password);
      }
    } catch { setError(copy.failed); }
    finally { setBusy(false); }
  };

  const sendReset = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await sendPasswordReset(email.trim()); setMessage(copy.resetSent); }
    catch { setError(copy.failed); }
    finally { setBusy(false); }
  };

  if (!ready) return <main className='grid min-h-screen place-items-center bg-app-background text-app-foreground'>{t('loadingAccount')}</main>;
  if (user || mode === 'demo' || mode === 'local') return <>{children}</>;
  if (mode === 'legacyLocal') return <><div role='status' className='border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'>{isEnglish ? 'Existing browser records are kept here for review. Create an account in Profile → Account sync to migrate and back them up.' : 'Tus registros anteriores siguen en este navegador. Crea una cuenta en Perfil → Sincronización para revisarlos y respaldarlos.'}</div>{children}</>;

  return (
    <main className='min-h-screen bg-app-background px-5 py-8 text-app-foreground sm:grid sm:place-items-center'>
      <div className='mx-auto w-full max-w-md'>
        <div className='mb-8 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <span className='grid h-11 w-11 place-items-center rounded-2xl bg-primary text-white'><WalletCards size={22} /></span>
            <span className='text-lg font-bold'>MisCheles</span>
          </div>
          <label className='flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400'>
            <span>{copy.language}</span>
            <select aria-label={copy.language} value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className='rounded-lg border border-slate-200 bg-white px-2 py-2 text-app-foreground dark:border-slate-700 dark:bg-slate-900'>
              {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}
            </select>
          </label>
        </div>

        <section className='space-y-5'>
          <header>
            <p className='text-sm text-slate-500 dark:text-slate-400'>{t('monthlySummary')}</p>
            <h1 className='mt-1 text-2xl font-bold tracking-tight'>{authView ? (authView === 'create' ? copy.create : copy.account) : copy.title}</h1>
            <p className='mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400'>{authView ? copy.accountHelp : copy.subtitle}</p>
          </header>

          {authView ? (
            <div className='space-y-4 border-y border-slate-200 py-5 dark:border-slate-800'>
              <button type='button' onClick={() => { setAuthView(null); setError(''); setMessage(''); }} className='inline-flex items-center gap-2 text-sm text-primary'><ArrowLeft size={16} />{copy.back}</button>
              <form onSubmit={(event) => void submitAccount(event)} className='space-y-4'>
                {authView === 'create' && <label className='block space-y-1 text-sm font-medium'>{copy.fullName}<input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>}
                <label className='block space-y-1 text-sm font-medium'>{copy.email}<input required type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>
                {authView === 'signIn' && <label className='block space-y-1 text-sm font-medium'>{copy.password}<input required type='password' autoComplete='current-password' value={password} onChange={(event) => setPassword(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>}
                {authView === 'create' && <label className='block space-y-1 text-sm font-medium'>{copy.password}<input required minLength={8} type='password' autoComplete='new-password' value={password} onChange={(event) => setPassword(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>}
                {error && <p role='alert' className='text-sm text-rose-600'>{error}</p>}
                {message && <p role='status' className='text-sm text-emerald-700 dark:text-emerald-400'>{message}</p>}
                <button disabled={busy} className='h-11 w-full rounded-xl bg-primary px-4 font-semibold text-white disabled:opacity-60'>{busy ? t('pleaseWait') : authView === 'create' ? copy.create : copy.signIn}</button>
              </form>
              {authView === 'signIn' && <button type='button' disabled={busy || !email.trim()} onClick={() => void sendReset()} className='text-sm text-primary disabled:opacity-50'>{t('forgotPassword')}</button>}
              {authView === 'signIn' && <button type='button' disabled={busy} onClick={() => { setAuthView('create'); setError(''); setMessage(''); }} className='block text-sm text-primary'>{t('needAccount')}</button>}
              {authView === 'signIn' && <button type='button' disabled={busy} onClick={() => void signInWithGoogle().catch(() => setError(copy.failed))} className='h-11 w-full rounded-xl border border-slate-200 font-semibold dark:border-slate-700'>{copy.google}</button>}
              <p className='text-xs leading-5 text-slate-500 dark:text-slate-400'>{copy.privacy}</p>
            </div>
          ) : (
            <div className='space-y-3'>
              <button type='button' onClick={() => chooseMode('demo')} className='flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-primary dark:border-slate-800 dark:bg-slate-900'>
                <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'><FlaskConical size={20} /></span>
                <span><span className='block font-semibold'>{copy.demo}</span><span className='mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400'>{copy.demoHelp}</span></span>
              </button>
              <button type='button' onClick={() => chooseMode('local')} className='flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-primary dark:border-slate-800 dark:bg-slate-900'>
                <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'><HardDrive size={20} /></span>
                <span><span className='block font-semibold'>{copy.local}</span><span className='mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400'>{copy.localHelp}</span></span>
              </button>
              <button type='button' onClick={() => setAuthView('signIn')} disabled={!configured} className='flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900'>
                <span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'><Cloud size={20} /></span>
                <span><span className='block font-semibold'>{copy.account}</span><span className='mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400'>{copy.accountHelp}</span></span>
              </button>
              {!configured && <p className='text-xs leading-5 text-slate-500 dark:text-slate-400'>{copy.unavailable}</p>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

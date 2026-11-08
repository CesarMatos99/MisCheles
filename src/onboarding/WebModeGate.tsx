import React, { useState, type FormEvent } from 'react';
import { ArrowLeft, Cloud, Eye, EyeOff, FlaskConical, HardDrive, WalletCards } from 'lucide-react';
import { useAccountAuth } from '../firebase/AccountAuthProvider';
import { accountAuthMessage } from '../firebase/accountAuthErrors';
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
type AuthView = 'signIn' | 'create' | 'reset';

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
  const { configured, ready, user, error: authError, signIn, signInWithGoogle, createAccount, sendPasswordReset } = useAccountAuth();
  const { language, setLanguage, t } = useLanguage();
  const [mode, setMode] = useState<LocalMode | null>(restoreMode);
  const [authView, setAuthView] = useState<AuthView | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isEnglish = language === 'en';
  const copy = isEnglish ? {
    title: 'How would you like to use MisCheles?',
    subtitle: 'Choose how to use MisCheles. A sign-in identifies your account but does not upload or back up financial records.',
    demo: 'Try the demo', demoHelp: 'Explore the app with sample records. Demo data stays separate from your own records.',
    local: 'Use without an account', localHelp: 'Keep using every financial feature. Your records stay in this browser and work offline.',
    account: 'I already have an account', accountHelp: 'Sign in to identify this session. Financial data remains local to this browser.',
    unavailable: 'Firebase Authentication is not configured here. Local and demo modes are available.',
    create: 'Create account', signIn: 'Sign in', fullName: 'Name', email: 'Account email', password: 'Password', confirmPassword: 'Confirm password',
    google: 'Continue with Google', back: 'Back', verify: 'Account created. Check your email for verification. Local financial data was not uploaded.',
    reset: 'Send reset instructions', resetSent: 'If the account exists, reset instructions will be sent by email.',
    language: 'Display language', privacy: 'Signing in does not enable financial data sync, backup, email access, or bank-message access.',
    failed: 'Could not complete the request. Check the details and try again.',
  } : {
    title: '¿Cómo quieres usar MisCheles?',
    subtitle: 'Elige cómo usar MisCheles. Iniciar sesión identifica tu cuenta, pero no sube ni respalda registros financieros.',
    demo: 'Probar la app', demoHelp: 'Explora la app con registros de ejemplo. La demo queda separada de tus datos.',
    local: 'Usar sin cuenta', localHelp: 'Conserva todas las funciones financieras. Tus registros siguen en este navegador y funcionan sin conexión.',
    account: 'Ya tengo una cuenta', accountHelp: 'Inicia sesión para identificar esta sesión. Los datos financieros permanecen localmente.',
    unavailable: 'Firebase Authentication no está configurado aquí. Puedes usar el modo local o demo.',
    create: 'Crear cuenta', signIn: 'Iniciar sesión', fullName: 'Nombre', email: 'Correo de la cuenta', password: 'Contraseña', confirmPassword: 'Confirmar contraseña',
    google: 'Continuar con Google', back: 'Volver', verify: 'Cuenta creada. Revisa tu correo para verificarlo. No se subieron datos financieros locales.',
    reset: 'Enviar instrucciones', resetSent: 'Si la cuenta existe, recibirás instrucciones por correo.',
    language: 'Idioma de visualización', privacy: 'Iniciar sesión no activa sincronización financiera, respaldo ni acceso a correos o mensajes bancarios.',
    failed: 'No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.',
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
        if (password !== confirmPassword) throw new Error('PASSWORD_CONFIRMATION_MISMATCH');
        await createAccount(name, email, password);
        setPassword(''); setConfirmPassword(''); setMessage(copy.verify);
      } else if (authView === 'reset') {
        await sendPasswordReset(email);
        setMessage(copy.resetSent);
      } else {
        await signIn(email, password);
      }
    } catch (reason) {
      setError(accountAuthMessage(reason, language));
    } finally { setBusy(false); }
  };

  const useGoogle = async () => {
    setBusy(true); setError(''); setMessage('');
    try { await signInWithGoogle(); }
    catch (reason) { setError(accountAuthMessage(reason, language)); }
    finally { setBusy(false); }
  };

  if (!ready) return <main className='grid min-h-screen place-items-center bg-app-background text-app-foreground'>{t('loadingAccount')}</main>;
  if (user || mode === 'demo' || mode === 'local') return <>{children}</>;
  const providerError = authError ? accountAuthMessage(authError, language) : '';
  if (mode === 'legacyLocal') return <><div role='status' className='border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200'>{isEnglish
    ? 'Existing financial records remain in this browser. Signing in uses a separate local space; records are not moved or uploaded.'
    : 'Tus registros financieros anteriores permanecen en este navegador. Iniciar sesión usa un espacio local separado; los registros no se mueven ni se suben.'}</div>{children}</>;

  const isAuthForm = authView !== null;
  const activeError = error || providerError;
  const authTitle = authView === 'create' ? copy.create : authView === 'reset' ? copy.reset : copy.account;
  const authPassword = authView === 'reset' ? null : <>
    <label className='block space-y-1 text-sm font-medium'>{copy.password}<span className='relative mt-1 block'><input required type={showPassword ? 'text' : 'password'} autoComplete={authView === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 pr-12 dark:border-slate-700' /><button type='button' aria-label={showPassword ? (isEnglish ? 'Hide password' : 'Ocultar contraseña') : (isEnglish ? 'Show password' : 'Mostrar contraseña')} onClick={() => setShowPassword((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
    {authView === 'create' && <label className='block space-y-1 text-sm font-medium'>{copy.confirmPassword}<span className='relative mt-1 block'><input required type={showConfirm ? 'text' : 'password'} autoComplete='new-password' value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 pr-12 dark:border-slate-700' /><button type='button' aria-label={showConfirm ? (isEnglish ? 'Hide confirmation' : 'Ocultar confirmación') : (isEnglish ? 'Show confirmation' : 'Mostrar confirmación')} onClick={() => setShowConfirm((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'>{showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
  </>;

  return (
    <main className='min-h-screen bg-app-background px-5 py-8 text-app-foreground sm:grid sm:place-items-center'>
      <div className='mx-auto w-full max-w-md'>
        <div className='mb-8 flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3'><span className='grid h-11 w-11 place-items-center rounded-2xl bg-primary text-white'><WalletCards size={22} /></span><span className='text-lg font-bold'>MisCheles</span></div>
          <label className='flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400'><span>{copy.language}</span><select aria-label={copy.language} value={language} onChange={(event) => setLanguage(event.target.value as typeof language)} className='rounded-lg border border-slate-200 bg-white px-2 py-2 text-app-foreground dark:border-slate-700 dark:bg-slate-900'>{LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label>
        </div>

        <section className='space-y-5'>
          <header><p className='text-sm text-slate-500 dark:text-slate-400'>{t('monthlySummary')}</p><h1 className='mt-1 text-2xl font-bold tracking-tight'>{isAuthForm ? authTitle : copy.title}</h1><p className='mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400'>{isAuthForm ? copy.accountHelp : copy.subtitle}</p></header>
          {isAuthForm ? <div className='space-y-4 border-y border-slate-200 py-5 dark:border-slate-800'>
            <button type='button' onClick={() => { setAuthView(null); setError(''); setMessage(''); }} className='inline-flex min-h-10 items-center gap-2 text-sm text-primary'><ArrowLeft size={16} />{copy.back}</button>
            <form onSubmit={(event) => void submitAccount(event)} className='space-y-4'>
              {authView === 'create' && <label className='block space-y-1 text-sm font-medium'>{copy.fullName}<input required maxLength={80} autoComplete='name' value={name} onChange={(event) => setName(event.target.value)} className='mt-1 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>}
              <label className='block space-y-1 text-sm font-medium'>{copy.email}<input required type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} className='mt-1 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>
              {authPassword}
              {activeError && <p role='alert' className='text-sm text-rose-600 dark:text-rose-400'>{activeError}</p>}
              {message && <p role='status' className='text-sm text-emerald-700 dark:text-emerald-400'>{message}</p>}
              <button disabled={busy || !configured} className='h-11 w-full rounded-xl bg-primary px-4 font-semibold text-white disabled:opacity-60'>{busy ? t('pleaseWait') : authView === 'create' ? copy.create : authView === 'reset' ? copy.reset : copy.signIn}</button>
            </form>
            {authView === 'signIn' && <button type='button' disabled={busy || !configured} onClick={() => { setAuthView('reset'); setError(''); setMessage(''); }} className='min-h-10 text-sm text-primary'>{t('forgotPassword')}</button>}
            {authView === 'reset' && <button type='button' onClick={() => { setAuthView('signIn'); setError(''); setMessage(''); }} className='min-h-10 text-sm text-primary'>{isEnglish ? 'Back to sign in' : 'Volver a iniciar sesión'}</button>}
            {authView === 'signIn' && <><button type='button' disabled={busy || !configured} onClick={() => setAuthView('create')} className='block min-h-10 text-sm text-primary'>{isEnglish ? 'Create an account' : 'Crear cuenta'}</button><button type='button' disabled={busy || !configured} onClick={() => void useGoogle()} className='h-11 w-full rounded-xl border border-slate-200 font-semibold dark:border-slate-700'>{copy.google}</button></>}
            {authView === 'create' && <button type='button' disabled={busy} onClick={() => { setAuthView('signIn'); setError(''); setMessage(''); }} className='min-h-10 text-sm text-primary'>{isEnglish ? 'I already have an account' : 'Ya tengo una cuenta'}</button>}
            <p className='text-xs leading-5 text-slate-500 dark:text-slate-400'>{copy.privacy}</p>
          </div> : <div className='space-y-3'>
            <button type='button' onClick={() => chooseMode('demo')} className='flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-primary dark:border-slate-800 dark:bg-slate-900'><span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'><FlaskConical size={20} /></span><span><span className='block font-semibold'>{copy.demo}</span><span className='mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400'>{copy.demoHelp}</span></span></button>
            <button type='button' onClick={() => chooseMode('local')} className='flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-primary dark:border-slate-800 dark:bg-slate-900'><span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'><HardDrive size={20} /></span><span><span className='block font-semibold'>{copy.local}</span><span className='mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400'>{copy.localHelp}</span></span></button>
            <button type='button' onClick={() => { setAuthView('signIn'); setError(''); setMessage(''); }} disabled={!configured} className='flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900'><span className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary'><Cloud size={20} /></span><span><span className='block font-semibold'>{copy.account}</span><span className='mt-1 block text-sm leading-5 text-slate-500 dark:text-slate-400'>{copy.accountHelp}</span></span></button>
            {!configured && <p className='text-xs leading-5 text-slate-500 dark:text-slate-400'>{copy.unavailable}</p>}
          </div>}
        </section>
      </div>
    </main>
  );
};

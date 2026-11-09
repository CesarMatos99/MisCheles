import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Eye, EyeOff, FlaskConical } from 'lucide-react';
import { useAccountAuth } from '../firebase/AccountAuthProvider';
import { accountAuthMessage } from '../firebase/accountAuthErrors';
import { setStorageScope } from '../services/storage';
import { LANGUAGE_OPTIONS } from '../i18n/catalog';
import { useLanguage } from '../i18n/LanguageContext';
import { resolveWebAccessState } from './webModePolicy';
import { WebAccessProvider } from './WebAccessContext';

type AuthView = 'welcome' | 'signIn' | 'create' | 'reset';

function navigateHome(): void {
  if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export const WebModeGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const {
    configured, ready, user, error: authError, signIn, signInWithGoogle, createAccount,
    sendPasswordReset, retrySession, resendVerificationEmail, refreshEmailVerification, signOut,
  } = useAccountAuth();
  const { language, setLanguage, t } = useLanguage();
  const [demoActive, setDemoActive] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('welcome');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verificationCooldownUntil, setVerificationCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const requestPending = useRef(false);

  const isEnglish = language === 'en';
  const access = resolveWebAccessState(ready, user, demoActive);
  const copy = isEnglish ? {
    title: 'Your money, made clearer.', subtitle: 'Organize income, spending, and savings in one place.',
    signInHelp: 'Access your MisCheles account.', createHelp: 'Create your MisCheles account.', resetHelp: 'We will send password reset instructions by email.',
    signIn: 'Sign in', create: 'Create account', google: 'Continue with Google',
    demo: 'Explore the demo',
    firebaseUnavailable: 'Firebase Authentication is not configured here. Configure it to use an account, or explore the isolated demo.',
    fullName: 'Name', email: 'Email', password: 'Password', confirmPassword: 'Confirm password (minimum 12 characters)',
    reset: 'Send reset instructions', resetSent: 'If the account exists, reset instructions will be sent by email.',
    registrationSent: 'Account created. Check your email and verify it before opening your financial space.',
    verificationTitle: 'Verify your email', verificationHelp: 'Confirm the email address for this account before opening its financial records. You can resend the message or check again after following its link.',
    resend: 'Resend verification email', checkVerified: 'I verified my email', retry: 'Retry connection', back: 'Back', pending: 'Sending…',
    demoLabel: 'Demo mode · fictional data only', exitDemo: 'Exit the demo',
    signOut: 'Sign out',
  } : {
    title: 'Tu dinero, más claro.', subtitle: 'Organiza tus ingresos, gastos y ahorros en un solo lugar.',
    signInHelp: 'Entra a tu cuenta de MisCheles.', createHelp: 'Crea tu cuenta de MisCheles.', resetHelp: 'Te enviaremos instrucciones para recuperar tu contraseña.',
    signIn: 'Iniciar sesión', create: 'Crear cuenta', google: 'Continuar con Google',
    demo: 'Explorar demostración',
    firebaseUnavailable: 'Firebase Authentication no está configurado aquí. Configúralo para usar una cuenta o explora la demostración aislada.',
    fullName: 'Nombre', email: 'Correo electrónico', password: 'Contraseña', confirmPassword: 'Confirmar contraseña (mínimo 12 caracteres)',
    reset: 'Enviar instrucciones', resetSent: 'Si la cuenta existe, recibirás instrucciones por correo.',
    registrationSent: 'Cuenta creada. Revisa tu correo y verifícalo antes de abrir tu espacio financiero.',
    verificationTitle: 'Verifica tu correo', verificationHelp: 'Confirma el correo de esta cuenta antes de abrir sus registros financieros. Puedes reenviar el mensaje o comprobarlo después de abrir el enlace.',
    resend: 'Reenviar correo de verificación', checkVerified: 'Ya verifiqué mi correo', retry: 'Reintentar conexión', back: 'Volver', pending: 'Enviando…',
    demoLabel: 'Modo demostración · solo datos ficticios', exitDemo: 'Salir de la demostración',
    signOut: 'Cerrar sesión',
  };

  useEffect(() => {
    // Scope switches to local only after the private/demo view has been unmounted.
    if (!user && !demoActive) setStorageScope('local');
  }, [demoActive, user]);

  useEffect(() => {
    if (access === 'account' || access === 'verification' || access === 'visitor') navigateHome();
  }, [access]);

  useEffect(() => {
    if (!verificationCooldownUntil) return undefined;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((verificationCooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (!remaining) setVerificationCooldownUntil(0);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [verificationCooldownUntil]);

  const chooseDemo = () => {
    setStorageScope('demo');
    setDemoActive(true);
    setAuthView('welcome');
    navigateHome();
  };
  const exitDemo = () => {
    setDemoActive(false);
    setAuthView('welcome');
    navigateHome();
  };

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      if (authView === 'create') {
        if (password !== confirmPassword) throw new Error('PASSWORD_CONFIRMATION_MISMATCH');
        await createAccount(name, email, password);
        setPassword(''); setConfirmPassword('');
        setMessage(isEnglish ? 'Account created. Check your email and verify it before opening your financial space.' : 'Cuenta creada. Revisa tu correo y verifícalo antes de abrir tu espacio financiero.');
      } else if (authView === 'reset') {
        await sendPasswordReset(email);
        setMessage(copy.resetSent);
      } else await signIn(email, password);
    } catch (reason) { setError(accountAuthMessage(reason, language)); }
    finally { requestPending.current = false; setBusy(false); }
  };

  const useGoogle = async () => {
    if (requestPending.current) return;
    requestPending.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await signInWithGoogle(); }
    catch (reason) { setError(accountAuthMessage(reason, language)); }
    finally { requestPending.current = false; setBusy(false); }
  };

  const resendVerification = async () => {
    if (requestPending.current) return;
    requestPending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      await resendVerificationEmail();
      setVerificationCooldownUntil(Date.now() + 60_000);
      setMessage(isEnglish ? 'Verification email sent.' : 'Correo de verificación enviado.');
    } catch (reason) { setError(accountAuthMessage(reason, language)); }
    finally { requestPending.current = false; setBusy(false); }
  };

  const checkVerification = async () => {
    if (requestPending.current) return;
    requestPending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      const verified = await refreshEmailVerification();
      if (!verified) throw new Error('EMAIL_NOT_VERIFIED');
      setMessage(isEnglish ? 'Email verified.' : 'Correo verificado.');
    } catch (reason) { setError(accountAuthMessage(reason, language)); }
    finally { requestPending.current = false; setBusy(false); }
  };

  const handleSignOut = async () => {
    if (requestPending.current) return;
    requestPending.current = true;
    setBusy(true); setError('');
    try { await signOut(); }
    catch (reason) { setError(accountAuthMessage(reason, language)); }
    finally { requestPending.current = false; setBusy(false); }
  };

  if (access === 'restoring') return <main className='grid min-h-screen place-items-center bg-app-background px-5 text-app-foreground'><p role='status' className='text-sm text-slate-500 dark:text-slate-400'>{t('loadingAccount')}</p></main>;
  if (access === 'account') return <WebAccessProvider mode='account' exitDemo={() => undefined}>{children}</WebAccessProvider>;

  if (access === 'demo') return <WebAccessProvider mode='demo' exitDemo={exitDemo}><div className='min-h-screen bg-app-background text-app-foreground'>
    <div className='flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100' role='status'>
      <span>{copy.demoLabel}</span>
      <button type='button' onClick={exitDemo} className='min-h-9 rounded-lg px-3 underline underline-offset-2 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-amber-900'>{copy.exitDemo}</button>
    </div>
    {children}
  </div></WebAccessProvider>;

  if (access === 'verification') return <main className='grid min-h-screen place-items-center bg-app-background px-4 py-8 text-app-foreground'>
    <section className='w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8'>
      <Brand language={language} setLanguage={setLanguage} />
      <div><h1 className='text-2xl font-bold'>{copy.verificationTitle}</h1><p className='mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400'>{copy.verificationHelp}</p></div>
      <div className='rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800'><strong>{user?.displayName || (isEnglish ? 'Account' : 'Cuenta')}</strong><span className='mt-1 block break-all text-slate-600 dark:text-slate-300'>{user?.email}</span></div>
      {(error || authError) && <p role='alert' className='text-sm text-rose-600 dark:text-rose-400'>{error || accountAuthMessage(authError, language)}</p>}
      {message && <p role='status' className='text-sm text-emerald-700 dark:text-emerald-400'>{message}</p>}
      <div className='grid gap-3 sm:grid-cols-2'>
        <button type='button' disabled={busy || cooldownSeconds > 0} onClick={() => void resendVerification()} className='min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800'>{cooldownSeconds ? copy.resend + ' (' + cooldownSeconds + 's)' : copy.resend}</button>
        <button type='button' disabled={busy} onClick={() => void checkVerification()} className='min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50'>{busy ? copy.pending : copy.checkVerified}</button>
      </div>
      <button type='button' disabled={busy} onClick={() => void handleSignOut()} className='min-h-10 text-sm font-semibold text-slate-500 hover:text-primary disabled:opacity-50'>{copy.signOut}</button>
    </section>
  </main>;

  const providerError = authError ? accountAuthMessage(authError, language) : '';
  const activeError = error || providerError;
  const formTitle = authView === 'create' ? copy.create : authView === 'reset' ? copy.reset : copy.signIn;
  const formHelp = authView === 'create' ? copy.createHelp : authView === 'reset' ? copy.resetHelp : copy.signInHelp;
  const showForm = authView !== 'welcome';
  const passwordFields = authView === 'reset' ? null : <>
    <label className='block space-y-1.5 text-sm font-medium'>{copy.password}<span className='relative mt-1 block'><input required type={showPassword ? 'text' : 'password'} autoComplete={authView === 'create' ? 'new-password' : 'current-password'} minLength={authView === 'create' ? 12 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 pr-12 dark:border-slate-700' /><button type='button' aria-label={showPassword ? (isEnglish ? 'Hide password' : 'Ocultar contraseña') : (isEnglish ? 'Show password' : 'Mostrar contraseña')} onClick={() => setShowPassword((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>{authView === 'create' && <span className='block text-xs font-normal text-slate-500'>{isEnglish ? 'At least 12 characters and Firebase password rules.' : 'Mínimo 12 caracteres y requisitos de Firebase.'}</span>}</label>
    {authView === 'create' && <label className='block space-y-1.5 text-sm font-medium'>{copy.confirmPassword}<span className='relative mt-1 block'><input required minLength={12} type={showConfirm ? 'text' : 'password'} autoComplete='new-password' value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 pr-12 dark:border-slate-700' /><button type='button' aria-label={showConfirm ? (isEnglish ? 'Hide confirmation' : 'Ocultar confirmación') : (isEnglish ? 'Show confirmation' : 'Mostrar confirmación')} onClick={() => setShowConfirm((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'>{showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
  </>;

  return <main className='grid min-h-[100svh] w-full place-items-center overflow-y-auto bg-app-background px-4 py-6 text-app-foreground sm:py-10'>
    <section className='w-full max-w-[500px] space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8'>
      <Brand language={language} setLanguage={setLanguage} />
      <header><h1 className='text-[1.65rem] font-bold leading-tight tracking-tight sm:text-3xl'>{showForm ? formTitle : copy.title}</h1><p className='mt-2 text-base leading-6 text-slate-500 dark:text-slate-400'>{showForm ? formHelp : copy.subtitle}</p></header>
      {!configured && <div role='alert' className='space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'><p>{copy.firebaseUnavailable}</p>{authError === 'AUTH_SESSION_UNAVAILABLE' && <button type='button' disabled={busy} onClick={() => void retrySession().catch(() => undefined)} className='min-h-10 rounded-lg border border-amber-500 px-3 font-semibold disabled:opacity-50'>{copy.retry}</button>}</div>}
      {configured && authError && <div role='alert' className='space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'><p>{accountAuthMessage(authError, language)}</p>{authError === 'AUTH_SESSION_UNAVAILABLE' && <button type='button' disabled={busy} onClick={() => void retrySession().catch(() => undefined)} className='min-h-10 rounded-lg border border-amber-500 px-3 font-semibold disabled:opacity-50'>{copy.retry}</button>}</div>}
      {showForm ? <div className='space-y-4'>
        <button type='button' onClick={() => { setAuthView('welcome'); setError(''); setMessage(''); }} className='inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft size={16} />{copy.back}</button>
        <form onSubmit={(event) => void submitAccount(event)} className='space-y-4'>
          {authView === 'create' && <label className='block space-y-1.5 text-sm font-medium'>{copy.fullName}<input required maxLength={80} autoComplete='name' value={name} onChange={(event) => setName(event.target.value)} className='mt-1 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>}
          <label className='block space-y-1.5 text-sm font-medium'>{copy.email}<input required type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} className='mt-1 h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-700' /></label>
          {passwordFields}
          {activeError && <p role='alert' className='text-sm text-rose-600 dark:text-rose-400'>{activeError}</p>}
          {message && <p role='status' className='text-sm text-emerald-700 dark:text-emerald-400'>{message}</p>}
          <button disabled={busy || !configured} className='min-h-[3.25rem] w-full rounded-xl bg-primary px-4 font-semibold text-white disabled:opacity-60'>{busy ? copy.pending : authView === 'create' ? copy.create : authView === 'reset' ? copy.reset : copy.signIn}</button>
        </form>
        {authView === 'signIn' && <div className='space-y-3'>
          <button type='button' disabled={busy || !configured} onClick={() => { setAuthView('reset'); setError(''); setMessage(''); }} className='min-h-10 text-sm font-medium text-primary'>{t('forgotPassword')}</button>
          <button type='button' disabled={busy || !configured} onClick={() => void useGoogle()} className='min-h-[3.25rem] w-full rounded-xl border border-slate-200 px-4 font-semibold transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800'>{copy.google}</button>
          <p className='text-center text-sm text-slate-500 dark:text-slate-400'>{isEnglish ? "Don't have an account?" : '¿Todavía no tienes cuenta?'} <button type='button' disabled={busy || !configured} onClick={() => { setAuthView('create'); setError(''); setMessage(''); }} className='font-semibold text-primary'>{copy.create}</button></p>
        </div>}
        {authView === 'create' && <p className='text-center text-sm text-slate-500 dark:text-slate-400'>{isEnglish ? 'Already have an account?' : '¿Ya tienes una cuenta?'} <button type='button' disabled={busy} onClick={() => { setAuthView('signIn'); setError(''); setMessage(''); }} className='font-semibold text-primary'>{copy.signIn}</button></p>}
        {authView === 'reset' && <button type='button' onClick={() => { setAuthView('signIn'); setError(''); setMessage(''); }} className='min-h-10 text-sm font-semibold text-primary'>{isEnglish ? 'Back to sign in' : 'Volver a iniciar sesión'}</button>}
      </div> : <div className='space-y-2.5'>
        <button type='button' disabled={!configured || busy} onClick={() => { setAuthView('signIn'); setError(''); setMessage(''); }} className='min-h-[3.25rem] w-full rounded-xl bg-primary px-4 font-semibold text-white shadow-sm transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50'>{copy.signIn}</button>
        <button type='button' disabled={!configured || busy} onClick={() => void useGoogle()} className='min-h-[3.25rem] w-full rounded-xl border border-slate-200 px-4 font-semibold transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800'>{copy.google}</button>
        <button type='button' disabled={!configured || busy} onClick={() => { setAuthView('create'); setError(''); setMessage(''); }} className='min-h-[3.25rem] w-full rounded-xl border border-slate-200 px-4 font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'>{copy.create}</button>
        <button type='button' onClick={chooseDemo} className='mx-auto flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-500 transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:text-slate-400'><FlaskConical size={15} aria-hidden='true' />{copy.demo}</button>
      </div>}
    </section>
  </main>;
};

const Brand: React.FC<{ language: string; setLanguage: (language: 'es' | 'en') => void }> = ({ language, setLanguage }) => (
  <div className='flex items-center justify-between gap-3'>
    <div className='flex min-w-0 items-center gap-3'><img src='/app-icon.png' alt='' className='h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14' /><span className='truncate text-lg font-bold sm:text-xl'>MisCheles</span></div>
    <label className='flex shrink-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400'><span className='sr-only'>{language === 'en' ? 'Display language' : 'Idioma de visualización'}</span><select aria-label={language === 'en' ? 'Display language' : 'Idioma de visualización'} value={language} onChange={(event) => setLanguage(event.target.value as 'es' | 'en')} className='rounded-lg border border-slate-200 bg-white px-2 py-2 text-app-foreground dark:border-slate-700 dark:bg-slate-900'>{LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}</select></label>
  </div>
);

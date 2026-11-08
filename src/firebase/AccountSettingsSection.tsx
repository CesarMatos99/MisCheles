import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAccountAuth } from './AccountAuthProvider';
import { accountAuthMessage } from './accountAuthErrors';
import { useLanguage } from '../i18n/LanguageContext';

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-slate-700';
const buttonClass = 'btn-primary min-h-11 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

type AuthView = 'signIn' | 'create' | 'reset';

export const AccountSettingsSection: React.FC = () => {
  const {
    configured, ready, user, error: authError, signIn, createAccount, sendPasswordReset,
    changePassword, deleteAccount, signInWithGoogle, signOut,
    resendVerificationEmail, refreshEmailVerification,
  } = useAccountAuth();
  const { language, t } = useLanguage();
  const isSpanish = language === 'es';
  const [view, setView] = useState<AuthView>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [verified, setVerified] = useState(Boolean(user?.emailVerified));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const [resendUntil, setResendUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    setVerified(Boolean(user?.emailVerified));
  }, [user]);

  useEffect(() => {
    if (!resendUntil) return undefined;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining === 0) setResendUntil(0);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [resendUntil]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback('');
    setFailed(false);
    try {
      await action();
      setFeedback(success);
      return true;
    } catch (actionError) {
      setFeedback(accountAuthMessage(actionError, language));
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    if (view === 'create' && password !== confirmPassword) {
      setFeedback(accountAuthMessage(new Error('PASSWORD_CONFIRMATION_MISMATCH'), language));
      setFailed(true);
      return;
    }
    if (view === 'reset') {
      await run(() => sendPasswordReset(email), isSpanish
        ? 'Si la cuenta existe, recibirás instrucciones para restablecer la contraseña.'
        : 'If the account exists, password reset instructions will be sent.');
      return;
    }
    if (view === 'create') {
      await run(() => createAccount(displayName, email, password), isSpanish
        ? 'Cuenta creada. Revisa tu correo para verificar la dirección. Tus datos financieros locales no se han subido.'
        : 'Account created. Check your email to verify the address. Your local financial data was not uploaded.');
      setPassword('');
      setConfirmPassword('');
      return;
    }
    await run(() => signIn(email, password), isSpanish
      ? 'Sesión iniciada. Esta acción no sincroniza ni respalda datos financieros.'
      : 'Signed in. This does not sync or back up financial data.');
  };

  const submitChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(() => changePassword(currentPassword, newPassword, confirmNewPassword), isSpanish
      ? 'Contraseña actualizada.' : 'Password updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const submitDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const expected = isSpanish ? 'ELIMINAR' : 'DELETE';
    if (deleteConfirmation.trim().toUpperCase() !== expected) {
      setFeedback(accountAuthMessage(new Error('DELETE_CONFIRMATION_REQUIRED'), language));
      setFailed(true);
      return;
    }
    const accepted = window.confirm(isSpanish
      ? 'Se eliminará la identidad de Firebase Authentication. Los datos financieros locales permanecerán en este dispositivo y no se borrarán ni se transferirán. Los registros locales asociados a esta identidad no volverán a mostrarse automáticamente; exporta lo que necesites antes de continuar. Esta acción no elimina datos que pudieran existir en otros servicios. ¿Continuar?'
      : 'This deletes the Firebase Authentication identity. Local financial data will remain on this device and will not be deleted or transferred. Account-scoped local records will no longer be shown automatically; export anything you need first. This does not delete data that may exist in other services. Continue?');
    if (!accepted) return;
    await run(() => deleteAccount(deletePassword, deleteConfirmation), isSpanish
      ? 'La identidad de Firebase Authentication fue eliminada. Los datos locales se conservaron.'
      : 'The Firebase Authentication identity was deleted. Local data was kept.');
  };

  const resendVerification = async () => {
    const sent = await run(resendVerificationEmail, isSpanish
      ? 'Correo de verificación enviado.' : 'Verification email sent.');
    if (sent) setResendUntil(Date.now() + 60_000);
  };

  const refreshVerification = async () => {
    await run(async () => {
      const isVerified = await refreshEmailVerification();
      setVerified(isVerified);
      if (!isVerified) throw new Error('EMAIL_NOT_VERIFIED');
    }, isSpanish ? 'Correo verificado.' : 'Email verified.');
  };

  const providerNames = user?.providerData.map(({ providerId }) => {
    if (providerId === 'password') return isSpanish ? 'Correo y contraseña' : 'Email and password';
    if (providerId === 'google.com') return 'Google';
    return providerId;
  }).filter(Boolean).join(', ');
  const accountError = authError ? accountAuthMessage(authError, language) : '';

  return <section className='space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6' aria-labelledby='account-settings-title'>
    <header className='space-y-1'>
      <h2 id='account-settings-title' className='text-lg font-bold text-slate-950 dark:text-white'>{isSpanish ? 'Cuenta' : 'Account'}</h2>
      <p className='text-sm leading-6 text-slate-500 dark:text-slate-400'>{isSpanish
        ? 'La cuenta solo identifica tu sesión. Los datos financieros sin cuenta permanecen en su espacio local y no se trasladan; cada identidad usa un espacio local separado. Nada se sincroniza ni se respalda en la nube.'
        : 'The account identifies your session only. Financial data from before sign-in stays in its local space and is not moved; each identity uses a separate local space. Nothing is synced or backed up to the cloud.'}</p>
    </header>

    {!ready ? <p role='status' className='text-sm text-slate-500'>{t('loadingAccount')}</p> : user ? <div className='space-y-5'>
      <div className='flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70'>
        <span className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary'><ShieldCheck size={20} aria-hidden='true' /></span>
        <div className='min-w-0 flex-1'>
          <p className='truncate font-semibold text-slate-900 dark:text-white'>{user.displayName || user.email || (isSpanish ? 'Cuenta de MisCheles' : 'MisCheles account')}</p>
          {user.email && <p className='truncate text-sm text-slate-600 dark:text-slate-300'>{user.email}</p>}
          <p className='mt-1 text-xs text-slate-500 dark:text-slate-400'>{isSpanish ? 'Acceso mediante' : 'Signed in with'}: {providerNames || (isSpanish ? 'proveedor de cuenta' : 'account provider')}</p>
        </div>
      </div>

      {user.email && <div className='flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-2 text-sm'>
          <MailCheck size={18} className={verified ? 'text-emerald-600' : 'text-amber-600'} aria-hidden='true' />
          <span>{isSpanish ? 'Correo electrónico:' : 'Email address:'}</span>
          <strong className={verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}>{verified ? (isSpanish ? 'verificado' : 'verified') : (isSpanish ? 'pendiente' : 'pending')}</strong>
        </div>
        {!verified && <div className='flex flex-wrap gap-2'>
          <button type='button' disabled={busy || cooldownSeconds > 0} onClick={() => void resendVerification()} className='min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-primary disabled:opacity-50 dark:border-slate-700'>
            {cooldownSeconds > 0 ? `${isSpanish ? 'Reintentar en' : 'Try again in'} ${cooldownSeconds}s` : (isSpanish ? 'Reenviar correo' : 'Resend email')}
          </button>
          <button type='button' disabled={busy} onClick={() => void refreshVerification()} className='inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50'>
            <RefreshCw size={15} aria-hidden='true' />{isSpanish ? 'Ya verifiqué' : 'I verified'}
          </button>
        </div>}
      </div>}

      {user.providerData.some(({ providerId }) => providerId === 'password') && <form onSubmit={(event) => void submitChangePassword(event)} className='space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800'>
        <h3 className='font-semibold'>{isSpanish ? 'Cambiar contraseña' : 'Change password'}</h3>
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Contraseña actual' : 'Current password'}</span><input required type='password' autoComplete='current-password' value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} /></label>
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Nueva contraseña' : 'New password'}</span><span className='relative block'><input required type={showNewPassword ? 'text' : 'password'} autoComplete='new-password' value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass + ' pr-12'} /><button type='button' aria-label={showNewPassword ? (isSpanish ? 'Ocultar contraseña' : 'Hide password') : (isSpanish ? 'Mostrar contraseña' : 'Show password')} onClick={() => setShowNewPassword((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'><EyeIcon visible={showNewPassword} /></button></span></label>
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Confirmar nueva contraseña' : 'Confirm new password'}</span><input required type={showNewPassword ? 'text' : 'password'} autoComplete='new-password' value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} className={inputClass} /></label>
        <button type='submit' disabled={busy} className={buttonClass}>{busy ? t('pleaseWait') : (isSpanish ? 'Actualizar contraseña' : 'Update password')}</button>
      </form>}

      <form onSubmit={(event) => void submitDeleteAccount(event)} className='space-y-3 border-t border-rose-200 pt-4 dark:border-rose-900/60'>
        <div><h3 className='font-semibold text-rose-700 dark:text-rose-400'>{isSpanish ? 'Eliminar cuenta' : 'Delete account'}</h3><p className='mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400'>{isSpanish
          ? 'Esto elimina la identidad de Firebase Authentication. Los datos financieros locales no se eliminan automáticamente ni se suben a la nube. Si quedaron datos de una sincronización anterior en otros servicios, esta fase no los elimina.'
          : 'This removes the Firebase Authentication identity. Local financial data is not automatically deleted or uploaded. Any data from an older sync in other services is outside this phase.'}</p></div>
        {user.providerData.some(({ providerId }) => providerId === 'password') && <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Contraseña actual' : 'Current password'}</span><input required type='password' autoComplete='current-password' value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className={inputClass} /></label>}
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Escribe ELIMINAR para continuar' : 'Type DELETE to continue'}</span><input required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className={inputClass + ' border-rose-200 focus:border-rose-500 dark:border-rose-900'} /></label>
        <button type='submit' disabled={busy} className='min-h-11 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30'>{isSpanish ? 'Eliminar mi cuenta' : 'Delete my account'}</button>
      </form>
      <button type='button' disabled={busy} className='min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800' onClick={() => void run(signOut, t('signedOut'))}>{t('signOut')}</button>
    </div> : <div className='space-y-4'>
      {!configured && <p role='status' className='rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300'>{accountAuthMessage(new Error('FIREBASE_NOT_CONFIGURED'), language)}</p>}
      <div className='flex flex-wrap gap-2'>
        <button type='button' aria-pressed={view === 'signIn'} onClick={() => { setView('signIn'); setFeedback(''); }} className={'min-h-10 rounded-lg px-3 text-sm font-semibold ' + (view === 'signIn' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300')}>{isSpanish ? 'Iniciar sesión' : 'Sign in'}</button>
        <button type='button' aria-pressed={view === 'create'} onClick={() => { setView('create'); setFeedback(''); }} className={'min-h-10 rounded-lg px-3 text-sm font-semibold ' + (view === 'create' ? 'bg-primary/10 text-primary' : 'text-slate-600 dark:text-slate-300')}>{isSpanish ? 'Crear cuenta' : 'Create account'}</button>
      </div>
      <form onSubmit={(event) => void submitAuth(event)} className='space-y-3'>
        {view === 'create' && <label className='block space-y-1.5'><span className='text-sm font-semibold'>{t('accountName')}</span><input required maxLength={80} autoComplete='name' value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} /></label>}
        <label className='block space-y-1.5'><span className='text-sm font-semibold'>{t('accountEmail')}</span><input required type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label>
        {view !== 'reset' && <label className='block space-y-1.5'><span className='text-sm font-semibold'>{t('accountPassword')}</span><span className='relative block'><input required type={showPassword ? 'text' : 'password'} autoComplete={view === 'create' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass + ' pr-12'} /><button type='button' aria-label={showPassword ? (isSpanish ? 'Ocultar contraseña' : 'Hide password') : (isSpanish ? 'Mostrar contraseña' : 'Show password')} onClick={() => setShowPassword((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'><EyeIcon visible={showPassword} /></button></span></label>}
        {view === 'create' && <label className='block space-y-1.5'><span className='text-sm font-semibold'>{isSpanish ? 'Confirmar contraseña' : 'Confirm password'}</span><span className='relative block'><input required type={showConfirmPassword ? 'text' : 'password'} autoComplete='new-password' value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass + ' pr-12'} /><button type='button' aria-label={showConfirmPassword ? (isSpanish ? 'Ocultar confirmación' : 'Hide confirmation') : (isSpanish ? 'Mostrar confirmación' : 'Show confirmation')} onClick={() => setShowConfirmPassword((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'><EyeIcon visible={showConfirmPassword} /></button></span></label>}
        <button type='submit' disabled={busy || !configured} className={buttonClass}>{busy ? t('pleaseWait') : view === 'create' ? t('createAccount') : view === 'reset' ? (isSpanish ? 'Enviar instrucciones' : 'Send instructions') : t('signIn')}</button>
      </form>
      {view === 'signIn' && <div className='flex flex-wrap items-center gap-3'>
        <button type='button' disabled={busy || !configured} onClick={() => { setView('reset'); setFeedback(''); }} className='min-h-10 text-sm font-semibold text-primary'>{t('forgotPassword')}</button>
        <button type='button' disabled={busy || !configured} onClick={() => void run(signInWithGoogle, isSpanish ? 'Sesión iniciada. No se sincronizaron datos financieros.' : 'Signed in. No financial data was synced.')} className='min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700'>{t('continueGoogle')}</button>
      </div>}
      {view === 'reset' && <button type='button' onClick={() => setView('signIn')} className='min-h-10 text-sm font-semibold text-primary'>{isSpanish ? 'Volver a iniciar sesión' : 'Back to sign in'}</button>}
      {view !== 'signIn' && view !== 'reset' && <button type='button' onClick={() => setView('signIn')} className='min-h-10 text-sm font-semibold text-primary'>{t('alreadyHaveAccount')}</button>}
      <p className='border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400'>{isSpanish
        ? 'Puedes seguir usando MisCheles sin cuenta. Iniciar sesión utiliza otro espacio local: tus datos actuales no se mueven ni se suben y volverán a mostrarse al cerrar sesión.'
        : 'You can keep using MisCheles without an account. Signing in uses another local space: existing data is not moved or uploaded and will appear again after sign-out.'}</p>
    </div>}
    {(feedback || accountError) && <p role={failed ? 'alert' : 'status'} className={'text-sm leading-5 ' + (failed || accountError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400')}>{feedback || accountError}</p>}
  </section>;
};

const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) => visible ? <EyeOff size={17} aria-hidden='true' /> : <Eye size={17} aria-hidden='true' />;

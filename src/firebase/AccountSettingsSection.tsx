import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Link2, MailCheck, RefreshCw } from 'lucide-react';
import { useAccountAuth } from './AccountAuthProvider';
import { accountAuthMessage } from './accountAuthErrors';
import { useLanguage } from '../i18n/LanguageContext';

const inputClass = 'min-h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-slate-700';
const buttonClass = 'btn-primary min-h-11 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

export const AccountSettingsSection: React.FC = () => {
  const {
    configured, ready, user, error: authError,
    changePassword, deleteAccount, linkPassword, linkGoogle,
    resendVerificationEmail, refreshEmailVerification,
  } = useAccountAuth();
  const { language, t } = useLanguage();
  const isSpanish = language === 'es';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [linkedPassword, setLinkedPassword] = useState('');
  const [confirmLinkedPassword, setConfirmLinkedPassword] = useState('');
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

  const submitChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    await run(() => changePassword(currentPassword, newPassword, confirmNewPassword), isSpanish
      ? 'Contraseña actualizada.' : 'Password updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const submitLinkPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const linked = await run(() => linkPassword(linkedPassword, confirmLinkedPassword), isSpanish
      ? 'Correo y contraseña quedaron vinculados a esta misma cuenta.'
      : 'Email and password were linked to this same account.');
    if (linked) { setLinkedPassword(''); setConfirmLinkedPassword(''); }
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

  const hasPasswordProvider = Boolean(user?.providerData.some(({ providerId }) => providerId === 'password'));
  const hasGoogleProvider = Boolean(user?.providerData.some(({ providerId }) => providerId === 'google.com'));
  const accountError = authError ? accountAuthMessage(authError, language) : '';

  return <section className='space-y-6' aria-labelledby='account-settings-title'>
    <h2 id='account-settings-title' className='sr-only'>{isSpanish ? 'Mi cuenta' : 'My account'}</h2>
    <p className='text-sm leading-6 text-slate-500 dark:text-slate-400'>{isSpanish
      ? 'Tu cuenta mantiene separado su espacio local. Los movimientos permanecen en este navegador, no están cifrados por la aplicación y no se sincronizan.'
      : 'Your account keeps its local workspace separate. Financial records stay in this browser, are not encrypted by the app, and are not synced.'}</p>

    {!ready ? <p role='status' className='text-sm text-slate-500'>{t('loadingAccount')}</p> : user ? <div className='space-y-5'>
      {user.email && <div className='flex flex-col gap-3 border-y border-slate-200 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between'>
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

      <section className='space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800' aria-labelledby='account-methods-title'>
        <div><h3 id='account-methods-title' className='font-semibold'>{isSpanish ? 'Métodos de acceso' : 'Sign-in methods'}</h3><p className='mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400'>{isSpanish
          ? 'Los proveedores vinculados comparten este mismo UID y espacio local. No se crea una segunda cuenta.'
          : 'Linked providers share this same UID and local namespace. A second account is not created.'}</p></div>
        <ul className='flex flex-wrap gap-2' aria-label={isSpanish ? 'Métodos vinculados' : 'Linked methods'}>
          {user.providerData.map(({ providerId }) => <li key={providerId} className='rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary'>{providerId === 'password' ? (isSpanish ? 'Correo y contraseña' : 'Email and password') : providerId === 'google.com' ? 'Google' : providerId}</li>)}
        </ul>
        {!hasPasswordProvider && user.email && <form onSubmit={(event) => void submitLinkPassword(event)} className='space-y-3 border-l-2 border-primary/30 pl-4'>
          <p className='text-sm font-medium'>{isSpanish ? `Agregar contraseña a ${user.email}` : `Add a password to ${user.email}`}</p>
          <label className='block space-y-1.5'><span className='text-sm'>{isSpanish ? 'Nueva contraseña (mínimo 12 caracteres)' : 'New password (at least 12 characters)'}</span><input required minLength={12} type='password' autoComplete='new-password' value={linkedPassword} onChange={(event) => setLinkedPassword(event.target.value)} className={inputClass} /></label>
          <label className='block space-y-1.5'><span className='text-sm'>{isSpanish ? 'Confirmar contraseña' : 'Confirm password'}</span><input required minLength={12} type='password' autoComplete='new-password' value={confirmLinkedPassword} onChange={(event) => setConfirmLinkedPassword(event.target.value)} className={inputClass} /></label>
          <button type='submit' disabled={busy || !configured} className={buttonClass}>{busy ? t('pleaseWait') : (isSpanish ? 'Vincular contraseña' : 'Link password')}</button>
        </form>}
        {!hasGoogleProvider && <button type='button' disabled={busy || !configured} onClick={() => void run(linkGoogle, isSpanish ? 'Google quedó vinculado a esta misma cuenta.' : 'Google was linked to this same account.')} className='inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50 dark:border-slate-700'>
          <Link2 size={16} aria-hidden='true' />{isSpanish ? 'Vincular Google' : 'Link Google'}
        </button>}
      </section>

      {hasPasswordProvider && <form onSubmit={(event) => void submitChangePassword(event)} className='space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800'>
        <h3 className='font-semibold'>{isSpanish ? 'Cambiar contraseña' : 'Change password'}</h3>
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Contraseña actual' : 'Current password'}</span><input required type='password' autoComplete='current-password' value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} /></label>
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Nueva contraseña (mínimo 12 caracteres)' : 'New password (at least 12 characters)'}</span><span className='relative block'><input required minLength={12} type={showNewPassword ? 'text' : 'password'} autoComplete='new-password' value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass + ' pr-12'} /><button type='button' aria-label={showNewPassword ? (isSpanish ? 'Ocultar contraseña' : 'Hide password') : (isSpanish ? 'Mostrar contraseña' : 'Show password')} onClick={() => setShowNewPassword((value) => !value)} className='absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500'><EyeIcon visible={showNewPassword} /></button></span></label>
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Confirmar nueva contraseña' : 'Confirm new password'}</span><input required minLength={12} type={showNewPassword ? 'text' : 'password'} autoComplete='new-password' value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} className={inputClass} /></label>
        <button type='submit' disabled={busy} className={buttonClass}>{busy ? t('pleaseWait') : (isSpanish ? 'Actualizar contraseña' : 'Update password')}</button>
      </form>}

      <form onSubmit={(event) => void submitDeleteAccount(event)} className='space-y-3 border-t border-rose-200 pt-4 dark:border-rose-900/60'>
        <div><h3 className='font-semibold text-rose-700 dark:text-rose-400'>{isSpanish ? 'Eliminar cuenta' : 'Delete account'}</h3><p className='mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400'>{isSpanish
          ? 'Esto elimina la identidad de Firebase Authentication. Los datos financieros locales no se eliminan automáticamente ni se suben a la nube. Si quedaron datos de una sincronización anterior en otros servicios, esta fase no los elimina.'
          : 'This removes the Firebase Authentication identity. Local financial data is not automatically deleted or uploaded. Any data from an older sync in other services is outside this phase.'}</p></div>
        {hasPasswordProvider && <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Contraseña actual' : 'Current password'}</span><input required type='password' autoComplete='current-password' value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className={inputClass} /></label>}
        <label className='block space-y-1.5'><span className='text-sm font-medium'>{isSpanish ? 'Escribe ELIMINAR para continuar' : 'Type DELETE to continue'}</span><input required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className={inputClass + ' border-rose-200 focus:border-rose-500 dark:border-rose-900'} /></label>
        <button type='submit' disabled={busy} className='min-h-11 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30'>{isSpanish ? 'Eliminar mi cuenta' : 'Delete my account'}</button>
      </form>
    </div> : <p role='alert' className='text-sm text-amber-700 dark:text-amber-300'>{isSpanish ? 'No hay una sesión autenticada. Vuelve a la pantalla de acceso.' : 'No authenticated session. Return to the access screen.'}</p>}
    {(feedback || accountError) && <p role={failed ? 'alert' : 'status'} className={'text-sm leading-5 ' + (failed || accountError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400')}>{feedback || accountError}</p>}
  </section>;
};

const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) => visible ? <EyeOff size={17} aria-hidden='true' /> : <Eye size={17} aria-hidden='true' />;

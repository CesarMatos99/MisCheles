import React, { useState } from 'react';
import { useAccountAuth } from './AccountAuthProvider';
import { useLanguage } from '../i18n/LanguageContext';
import { previewLegacyMigration, includeRemoteMigrationDuplicates, executeLegacyMigration, type LegacyMigrationPreview } from '../services/localMigrationService';
import { FirestoreMigrationTarget } from './FirestoreMigrationTarget';
import { firestore } from './client';
import { accountSyncService } from './accountSyncService';
import { MailImportReview } from './MailImportReview';

const migrationKey = (item: { collection: string; sourceId: string }) => item.collection + ':' + item.sourceId;
const migrationLabel = (item: { collection: string; data: Record<string, unknown> }, language: string) => {
  const data = item.data;
  const kind = language === 'es' ? ({ transactions: 'Movimiento', savingsMovements: 'Movimiento de ahorro', savingsGoals: 'Meta de ahorro', monthConfigurations: 'Configuración mensual', categoryBudgets: 'Categoría' } as Record<string, string>) : ({ transactions: 'Transaction', savingsMovements: 'Savings movement', savingsGoals: 'Savings goal', monthConfigurations: 'Monthly setup', categoryBudgets: 'Category' } as Record<string, string>);
  const description = [data.description, data.title, data.category].find((value) => typeof value === 'string' && value.trim());
  const amount = typeof data.amount === 'number' || typeof data.currentAmount === 'number' || typeof data.targetAmount === 'number' ? (data.amount ?? data.currentAmount ?? data.targetAmount) : null;
  const date = [data.date, data.monthKey, data.targetDate].find((value) => typeof value === 'string');
  return [kind[item.collection] || item.collection, description, amount !== null ? String(amount) : null, date].filter(Boolean).join(' · ');
};

export const AccountSettingsSection: React.FC = () => {
  const { configured, ready, user, signIn, createAccount, sendPasswordReset, changePassword, deleteAccount, signInWithGoogle, signOut } = useAccountAuth();
  const { language, t } = useLanguage();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const [migrationPreview, setMigrationPreview] = useState<LegacyMigrationPreview | null>(null);
  const [includeSamples, setIncludeSamples] = useState(false);
  const [excludedMigrationKeys, setExcludedMigrationKeys] = useState<Set<string>>(new Set());
  const [includeSettings, setIncludeSettings] = useState(true);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState('');
  const button = 'btn-primary text-sm disabled:opacity-50';
  const reviewLocal = async () => {
    setMigrationMessage('');
    setIncludeSamples(false);
    setExcludedMigrationKeys(new Set());
    setIncludeSettings(true);
    setMigrationBusy(true);
    try {
      const localPreview = previewLegacyMigration(window.localStorage);
      if (!user || !firestore) throw new Error('La cuenta en la nube no está disponible.');
      const preview = await includeRemoteMigrationDuplicates(
        user.uid,
        localPreview,
        new FirestoreMigrationTarget(firestore),
      );
      setMigrationPreview(preview);
      setExcludedMigrationKeys(new Set());
      setIncludeSettings(Boolean(preview.settings));
    } catch {
      setMigrationPreview(null);
      setMigrationMessage(t('migrationFailed'));
    } finally {
      setMigrationBusy(false);
    }
  };
  const migrateLocal = async () => {
    if (!user || !firestore || !migrationPreview) return;
    const items = migrationPreview.items.filter((item) => !excludedMigrationKeys.has(item.collection + ':' + item.sourceId));
    const sampleItems = includeSamples ? migrationPreview.suspectedSamples.filter((item) => !excludedMigrationKeys.has(item.collection + ':' + item.sourceId)) : [];
    const selectedSettings = includeSettings ? migrationPreview.settings : undefined;
    const total = items.length + sampleItems.length + (selectedSettings ? 1 : 0);
    if (!window.confirm(t('confirmLocalMigration').replace('{count}', String(total)))) return;
    setMigrationBusy(true); setMigrationMessage('');
    try {
      const selectedSourceKeys = new Set([...items, ...sampleItems].map((item) => item.collection + ':' + item.sourceId));
      const result = await executeLegacyMigration({
        uid: user.uid, preview: { ...migrationPreview, settings: selectedSettings }, selectedSourceKeys,
        explicitlyIncludeSampleKeys: new Set(sampleItems.map((item) => item.collection + ':' + item.sourceId)),
        confirmed: true, target: new FirestoreMigrationTarget(firestore),
      });
      if (includeSamples) localStorage.setItem('mischeles_sync_included_samples_v1', JSON.stringify(sampleItems.map((item) => item.collection + ':' + item.sourceId)));
      await accountSyncService.enable(user.uid);
      setMigrationMessage(t('migrationComplete').replace('{uploaded}', String(result.uploaded)).replace('{existing}', String(result.alreadyPresent)));
      setMigrationPreview(null);
      setExcludedMigrationKeys(new Set());
    } catch { setMigrationMessage(t('migrationFailed')); }
    finally { setMigrationBusy(false); }
  };
  const enableWithoutMigration = async () => {
    if (!user || !window.confirm(t('enableSyncConfirm'))) return;
    setMigrationBusy(true); setMigrationMessage('');
    try { await accountSyncService.enable(user.uid); setMigrationMessage(t('syncEnabled')); }
    catch { setMigrationMessage(t('migrationFailed')); }
    finally { setMigrationBusy(false); }
  };
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setFeedback(''); setFailed(false);
    try { await action(); setFeedback(success); }
    catch (error) { setFeedback(error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED' ? t('verifyEmailFirst') : t('accountActionError')); setFailed(true); }
    finally { setBusy(false); }
  };
  const submitDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const expectedConfirmation = language === 'es' ? 'ELIMINAR' : 'DELETE';
    if (deleteConfirmation.trim().toUpperCase() !== expectedConfirmation) {
      setFeedback(language === 'es' ? 'Escribe ELIMINAR para confirmar.' : 'Type DELETE to confirm.');
      setFailed(true);
      return;
    }
    const accepted = window.confirm(language === 'es' ? 'Se eliminarán la cuenta y sus datos sincronizados. Esta acción no se puede deshacer. ¿Continuar?' : 'Your account and synced data will be deleted. This cannot be undone. Continue?');
    if (!accepted) return;
    setBusy(true); setFeedback(''); setFailed(false);
    try { await deleteAccount(deletePassword, deleteConfirmation); }
    catch (error) {
      setFeedback(error instanceof Error && error.message === 'PASSWORD_PROVIDER_REQUIRED' ? (language === 'es' ? 'Vuelve a iniciar sesión para confirmar la eliminación.' : 'Sign in again to confirm deletion.') : t('accountActionError'));
      setFailed(true);
    } finally { setBusy(false); }
  };
  const submitPasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8 || newPassword !== confirmNewPassword) {
      setFeedback(language === 'es' ? 'La contraseña nueva debe tener al menos 8 caracteres y coincidir en ambos campos.' : 'The new password must be at least 8 characters and match in both fields.');
      setFailed(true);
      return;
    }
    await run(() => changePassword(currentPassword, newPassword), language === 'es' ? 'Contraseña actualizada.' : 'Password updated.');
    setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
  };
  return <section className='space-y-5 py-5'>
    <div className='border-b border-slate-200 pb-4 dark:border-slate-800'><h2 className='text-base font-bold text-slate-900 dark:text-white'>{t('cloudAccount')}</h2><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{t('cloudAccountHelp')}</p></div>
    {!configured ? <div className='rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300'>{t('firebaseNotConfigured')}</div> : !ready ? <p role='status' className='text-sm text-slate-500'>{t('loadingAccount')}</p> : user ? <div className='space-y-4'>
      <div className='flex items-center gap-3 border-b border-slate-200 pb-4 dark:border-slate-800'><div className='flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft font-bold text-primary' aria-hidden='true'>{(user.email || '?').charAt(0).toUpperCase()}</div><div className='min-w-0 flex-1'><p className='text-sm font-semibold text-slate-900 dark:text-white'>{t('signedInAs')}</p><p className='truncate text-sm text-slate-500'>{user.email}</p></div></div>
      {user.providerData.some((provider) => provider.providerId === 'password') && <form onSubmit={(event) => void submitPasswordChange(event)} className='space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800'>
        <div><h3 className='text-sm font-semibold text-slate-900 dark:text-white'>{language === 'es' ? 'Cambiar contraseña' : 'Change password'}</h3><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{language === 'es' ? 'Confirma tu contraseña actual para proteger este cambio.' : 'Confirm your current password to protect this change.'}</p></div>
        <input required type='password' autoComplete='current-password' value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder={language === 'es' ? 'Contraseña actual' : 'Current password'} className='w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-primary dark:border-slate-700' />
        <input required type='password' minLength={8} autoComplete='new-password' value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={language === 'es' ? 'Nueva contraseña (8 caracteres mínimo)' : 'New password (8 characters minimum)'} className='w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-primary dark:border-slate-700' />
        <input required type='password' minLength={8} autoComplete='new-password' value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} placeholder={language === 'es' ? 'Confirmar nueva contraseña' : 'Confirm new password'} className='w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-primary dark:border-slate-700' />
        <button type='submit' disabled={busy} className='min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-primary disabled:opacity-50 dark:border-slate-700'>{language === 'es' ? 'Actualizar contraseña' : 'Update password'}</button>
      </form>}
      <div className='space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800'>
        <div><h3 className='text-sm font-semibold text-slate-900 dark:text-white'>{t('localDataMigration')}</h3><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{t('localDataMigrationHelp')}</p></div>
        {!migrationPreview ? <button type='button' disabled={migrationBusy} onClick={() => void reviewLocal()} className='min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-primary dark:border-slate-700'>{t('reviewLocalData')}</button> : <div className='space-y-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800'>
          <p className='font-semibold text-slate-900 dark:text-white'>{t('migrationPreview')}</p><p className='text-slate-500 dark:text-slate-400'>{t('safeRecords')}: {migrationPreview.items.length} · {t('samplesOmitted')}: {migrationPreview.suspectedSamples.length} · {t('duplicates')}: {migrationPreview.duplicates.length} · {t('invalidRecords')}: {migrationPreview.invalid.length}</p>
          <p className='text-xs text-slate-500 dark:text-slate-400'>{language === 'es' ? 'Selecciona los registros que quieres copiar. Los datos locales originales se conservarán.' : 'Choose which records to copy. Original local data will remain on this device.'}</p>
          {migrationPreview.mirroredSavingsTransactions.length > 0 && <p className='text-xs text-slate-500'>{t('savingsMirrorsSkipped')}: {migrationPreview.mirroredSavingsTransactions.length}</p>}
          {migrationPreview.settings && <label className='flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300'><input type='checkbox' checked={includeSettings} onChange={(event) => setIncludeSettings(event.target.checked)} className='mt-1 accent-primary' /><span>{language === 'es' ? 'Copiar también preferencias del perfil' : 'Also copy profile preferences'}</span></label>}
          {migrationPreview.items.length > 0 && <div className='max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 px-3 dark:divide-slate-800 dark:border-slate-700'>{migrationPreview.items.map((item) => { const key = migrationKey(item); return <label key={key} className='flex min-h-10 cursor-pointer items-center gap-2 py-2 text-xs text-slate-700 dark:text-slate-300'><input type='checkbox' checked={!excludedMigrationKeys.has(key)} onChange={(event) => setExcludedMigrationKeys((current) => { const next = new Set(current); event.target.checked ? next.delete(key) : next.add(key); return next; })} className='accent-primary' /><span className='min-w-0 truncate'>{migrationLabel(item, language)}</span></label>; })}</div>}
          {migrationPreview.suspectedSamples.length > 0 && <><label className='flex items-start gap-2 text-slate-600 dark:text-slate-300'><input type='checkbox' checked={includeSamples} onChange={(event) => { setIncludeSamples(event.target.checked); if (!event.target.checked) setExcludedMigrationKeys((current) => { const next = new Set(current); migrationPreview.suspectedSamples.forEach((item) => next.delete(migrationKey(item))); return next; }); }} className='mt-1 accent-primary' /><span>{t('includeFictionalSamples')}</span></label>{includeSamples && <div className='max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-amber-200 px-3 dark:divide-slate-800 dark:border-amber-900'>{migrationPreview.suspectedSamples.map((item) => { const key = migrationKey(item); return <label key={key} className='flex min-h-10 cursor-pointer items-center gap-2 py-2 text-xs text-slate-700 dark:text-slate-300'><input type='checkbox' checked={!excludedMigrationKeys.has(key)} onChange={(event) => setExcludedMigrationKeys((current) => { const next = new Set(current); event.target.checked ? next.delete(key) : next.add(key); return next; })} className='accent-primary' /><span className='min-w-0 truncate'>{migrationLabel(item, language)}</span></label>; })}</div>}</>}
          <p className='text-xs font-medium text-slate-600 dark:text-slate-300'>{language === 'es' ? 'Seleccionados' : 'Selected'}: {migrationPreview.items.filter((item) => !excludedMigrationKeys.has(migrationKey(item))).length + (includeSamples ? migrationPreview.suspectedSamples.filter((item) => !excludedMigrationKeys.has(migrationKey(item))).length : 0) + (includeSettings ? 1 : 0)}</p>
          <div className='flex flex-wrap gap-2'><button type='button' disabled={migrationBusy || migrationPreview.items.every((item) => excludedMigrationKeys.has(migrationKey(item))) && (!includeSamples || migrationPreview.suspectedSamples.every((item) => excludedMigrationKeys.has(migrationKey(item)))) && !includeSettings} onClick={() => void migrateLocal()} className={button}>{migrationBusy ? t('pleaseWait') : t('copyToAccount')}</button><button type='button' onClick={() => setMigrationPreview(null)} className='min-h-11 px-3 text-sm text-slate-500'>{t('cancel')}</button></div>
        </div>}
        {migrationPreview && migrationPreview.items.length === 0 && !migrationPreview.settings && <button type='button' disabled={migrationBusy} onClick={() => void enableWithoutMigration()} className='min-h-10 rounded-xl px-3 text-sm font-semibold text-primary'>{t('enableSync')}</button>}
        {migrationMessage && <p role='status' className='text-sm text-slate-600 dark:text-slate-300'>{migrationMessage}</p>}
      </div>
      <form onSubmit={(event) => void submitDeleteAccount(event)} className='space-y-3 border-t border-rose-200 pt-4 dark:border-rose-900/50'>
        <div><h3 className='text-sm font-semibold text-rose-700 dark:text-rose-400'>{language === 'es' ? 'Eliminar cuenta' : 'Delete account'}</h3><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{language === 'es' ? 'Elimina la identidad y los datos sincronizados. Los datos de prueba/locales se mantienen.' : 'Deletes the identity and synced data. Demo/local data remains.'}</p></div>
        {user.providerData.some((provider) => provider.providerId === 'password') && <input required type='password' autoComplete='current-password' value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder={language === 'es' ? 'Contraseña actual' : 'Current password'} className='w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-primary dark:border-slate-700' />}
        <label className='block space-y-1'><span className='text-xs text-slate-500'>{language === 'es' ? 'Escribe ELIMINAR para continuar' : 'Type DELETE to continue'}</span><input required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className='w-full rounded-xl border border-rose-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-rose-500 dark:border-rose-900' /></label>
        <button type='submit' disabled={busy} className='min-h-10 rounded-xl border border-rose-300 px-3 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-400'>{language === 'es' ? 'Eliminar mi cuenta' : 'Delete my account'}</button>
      </form>
      <p className='text-sm text-slate-500 dark:text-slate-400'>{t('accountSeparationNotice')}</p><MailImportReview uid={user.uid} /><button type='button' disabled={busy} className={button} onClick={() => void run(signOut, t('signedOut'))}>{t('signOut')}</button>
    </div> : <form className='space-y-4' onSubmit={(event) => { event.preventDefault(); void run(() => creating ? createAccount(displayName, email, password) : signIn(email, password), creating ? t('verifyEmailSent') : t('signedIn')); }}>
      {creating && <label className='block space-y-1.5'><span className='text-sm font-semibold text-slate-700 dark:text-slate-300'>{t('accountName')}</span><input required autoComplete='name' value={displayName} onChange={(event) => setDisplayName(event.target.value)} className='w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-primary dark:border-slate-700' /></label>}
      <label className='block space-y-1.5'><span className='text-sm font-semibold text-slate-700 dark:text-slate-300'>{t('accountEmail')}</span><input required type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} className='w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-primary dark:border-slate-700' /></label>
      <label className='block space-y-1.5'><span className='text-sm font-semibold text-slate-700 dark:text-slate-300'>{t('accountPassword')}</span><input required type='password' minLength={8} autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} className='w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-3 text-sm outline-none focus:border-primary dark:border-slate-700' /></label>
      <div className='flex flex-wrap items-center gap-3'><button type='submit' disabled={busy} className={button}>{busy ? t('pleaseWait') : creating ? t('createAccount') : t('signIn')}</button><button type='button' className='min-h-11 px-2 text-sm font-semibold text-primary' onClick={() => { setCreating(!creating); setFeedback(''); }}>{creating ? t('alreadyHaveAccount') : t('needAccount')}</button></div>
      {!creating && <button type='button' disabled={busy} onClick={() => void run(signInWithGoogle, t('signedIn'))} className='min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200'>{t('continueGoogle')}</button>}
      {!creating && <button type='button' disabled={busy || !email.trim()} className='block min-h-10 text-sm text-slate-500 underline disabled:opacity-50' onClick={() => void run(() => sendPasswordReset(email), t('resetEmailSent'))}>{t('forgotPassword')}</button>}
    </form>}
    {feedback && <p role={failed ? 'alert' : 'status'} className={'text-sm ' + (failed ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400')}>{feedback}</p>}
    <p className='border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400'>{language === 'es' ? 'La cuenta de Mis Cheles es independiente del permiso opcional para leer notificaciones bancarias por correo.' : 'Your Mis Cheles account is separate from the optional permission to read bank alerts in email.'}</p>
  </section>;
};

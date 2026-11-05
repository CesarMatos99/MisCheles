import React, { useEffect, useState } from 'react';
import { useAccountAuth } from '../../firebase/AccountAuthProvider';
import { accountSyncService, type AccountSyncConflict } from '../../firebase/accountSyncService';
import { useLanguage } from '../../i18n/LanguageContext';

type SyncConflict = AccountSyncConflict;

export const SyncConflictResolver: React.FC = () => {
  const { user } = useAccountAuth();
  const { language } = useLanguage();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const english = language === 'en';

  useEffect(() => {
    if (!user) { setConflicts([]); return; }
    const refresh = () => setConflicts(accountSyncService.getConflicts(user.uid));
    refresh();
    const onConflict = (event: Event) => {
      const detail = (event as CustomEvent<SyncConflict>).detail;
      if (detail?.uid === user.uid) refresh();
    };
    window.addEventListener('mischeles:sync-conflict', onConflict);
    return () => window.removeEventListener('mischeles:sync-conflict', onConflict);
  }, [user]);

  const conflict = conflicts[0];
  if (!user || !conflict) return null;

  const label = conflict.collection === 'transactions' ? (english ? 'Transaction' : 'Movimiento')
    : conflict.collection === 'savingsMovements' ? (english ? 'Savings movement' : 'Movimiento de ahorro')
      : conflict.collection === 'savingsGoals' ? (english ? 'Savings goal' : 'Meta de ahorro')
        : conflict.collection === 'monthConfigurations' ? (english ? 'Monthly setup' : 'Configuración del mes')
          : (english ? 'Category amount' : 'Monto de categoría');
  const summary = (record: Record<string, unknown> | null) => {
    if (!record) return english ? 'This record was deleted on the other device.' : 'Este registro se eliminó en el otro dispositivo.';
    const description = String(record.description || record.title || record.category || '');
    const amount = Number(record.amount ?? record.currentAmount ?? record.targetAmount ?? record.initialIncome ?? 0);
    const formatted = Number.isFinite(amount) ? new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-DO', { maximumFractionDigits: 2 }).format(amount) : '';
    return [description, formatted ? (english ? 'Amount ' : 'Monto ') + formatted : ''].filter(Boolean).join(' · ') || (english ? 'No description' : 'Sin descripción');
  };

  const resolve = async (choice: 'keepLocal' | 'useCloud') => {
    setBusy(true); setError('');
    try {
      await accountSyncService.resolveConflict(user.uid, conflict.collection, conflict.sourceId, choice);
      setConflicts(accountSyncService.getConflicts(user.uid));
    } catch {
      setError(english ? 'Could not resolve this change. Your local data is still saved.' : 'No se pudo resolver el cambio. Tus datos locales siguen guardados.');
    } finally { setBusy(false); }
  };
  const countLabel = conflicts.length > 1 ? ' · ' + conflicts.length + ' ' + (english ? 'changes' : 'cambios') : '';

  return (
    <div className='fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4' role='presentation'>
      <section role='dialog' aria-modal='true' aria-labelledby='sync-conflict-title' className='w-full max-w-md space-y-4 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl dark:bg-slate-900 dark:text-white'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-primary'>{label}{countLabel}</p>
          <h2 id='sync-conflict-title' className='mt-1 text-lg font-bold'>{english ? 'This record changed on another device' : 'Este registro cambió en otro dispositivo'}</h2>
          <p className='mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400'>{english ? 'Your version was kept on this device and was not uploaded. Choose which version to keep.' : 'Tu versión se conservó en este dispositivo y no se subió. Elige cuál versión conservar.'}</p>
        </div>
        <div className='space-y-2 border-y border-slate-200 py-3 text-sm dark:border-slate-700'>
          <p className='font-semibold'>{english ? 'This device' : 'Este dispositivo'}: <span className='font-normal text-slate-600 dark:text-slate-300'>{summary(conflict.localRecord)}</span></p>
          <p className='font-semibold'>{english ? 'Other device' : 'Otro dispositivo'}: <span className='font-normal text-slate-600 dark:text-slate-300'>{summary(conflict.remoteRecord)}</span></p>
        </div>
        {error && <p role='alert' className='text-sm text-rose-600'>{error}</p>}
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
          <button type='button' disabled={busy} onClick={() => void resolve('useCloud')} className='min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50 dark:border-slate-700'>{english ? 'Use other device' : 'Usar versión del otro dispositivo'}</button>
          <button type='button' disabled={busy} onClick={() => void resolve('keepLocal')} className='min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50'>{english ? 'Keep this device' : 'Conservar esta versión'}</button>
        </div>
      </section>
    </div>
  );
};

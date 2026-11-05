import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, LoaderCircle, Mail, X } from 'lucide-react';
import { firebaseFunctions, firestore } from './client';
import { beginMailOAuth, confirmMailReviewCandidate, disconnectMail, ignoreMailReviewCandidate, watchMailConnections, watchMailReviewCandidates, type MailConnectionSummary, type MailReviewCandidate } from './mailImportReviewService';
import { useLanguage } from '../i18n/LanguageContext';

interface MailImportReviewProps { uid: string; }

export const MailImportReview: React.FC<MailImportReviewProps> = ({ uid }) => {
  const { language } = useLanguage();
  const en = language === 'en';
  const [items, setItems] = useState<MailReviewCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [connections, setConnections] = useState<MailConnectionSummary[]>([]);
  const [connecting, setConnecting] = useState<'gmail' | 'outlook' | ''>('');
  const [disconnecting, setDisconnecting] = useState('');

  useEffect(() => {
    if (!firestore) { setLoading(false); setFailed(true); return; }
    setLoading(true); setFailed(false);
    const stopCandidates = watchMailReviewCandidates(firestore, uid, (next) => { setItems(next); setLoading(false); }, () => { setFailed(true); setLoading(false); });
    const stopConnections = watchMailConnections(firestore, uid, setConnections, () => setConnections([]));
    return () => { stopCandidates(); stopConnections(); };
  }, [uid]);

  const connect = async (provider: 'gmail' | 'outlook') => {
    if (!firebaseFunctions) { setMessage(en ? 'Cloud Functions are not configured yet.' : 'Las funciones en la nube todavía no están configuradas.'); return; }
    const popup = window.open('about:blank', '_blank');
    if (!popup) { setMessage(en ? 'Allow pop-ups to connect your mailbox.' : 'Permite las ventanas emergentes para conectar tu correo.'); return; }
    popup.opener = null;
    setConnecting(provider); setMessage('');
    try {
      const authorization = await beginMailOAuth(firebaseFunctions, provider);
      popup.location.replace(authorization.authorizationUrl);
      setMessage(en ? 'Finish consent in the provider window, then return here.' : 'Completa el permiso en la ventana del proveedor y vuelve aquí.');
    } catch {
      popup.close();
      setMessage(en ? 'Could not start mailbox authorization.' : 'No se pudo iniciar la autorización del correo.');
    } finally { setConnecting(''); }
  };

  const disconnect = async (connection: MailConnectionSummary) => {
    if (!firebaseFunctions) return;
    const prompt = en ? 'Disconnect this mailbox from Mis Cheles?' : '¿Desconectar este correo de Mis Cheles?';
    if (!window.confirm(prompt)) return;
    setDisconnecting(connection.id); setMessage('');
    try { await disconnectMail(firebaseFunctions, connection.id, connection.provider); }
    catch { setMessage(en ? 'Could not revoke this connection. For Outlook, remove Mis Cheles from your Microsoft account permissions, then retry.' : 'No se pudo revocar esta conexión. En Outlook, elimina Mis Cheles de los permisos de tu cuenta Microsoft y vuelve a intentarlo.'); }
    finally { setDisconnecting(''); }
  };

  const ignore = async (candidate: MailReviewCandidate) => {
    if (!firestore) return;
    setBusyId(candidate.id); setMessage('');
    try { await ignoreMailReviewCandidate(firestore, uid, candidate.id); }
    catch { setMessage(en ? 'Could not ignore this imported movement. Try again.' : 'No se pudo ignorar este movimiento. Inténtalo de nuevo.'); }
    finally { setBusyId(''); }
  };

  const confirm = async (candidate: MailReviewCandidate, categoryName: string, paymentMethod: ConfirmMailReviewPayment) => {
    if (!firebaseFunctions) { setMessage(en ? 'Cloud Functions are not configured yet.' : 'Las funciones en la nube todavía no están configuradas.'); return; }
    setBusyId(candidate.id); setMessage('');
    try {
      await confirmMailReviewCandidate(firebaseFunctions, {
        candidateId: candidate.id,
        categoryName,
        description: candidate.description || candidate.merchant,
        paymentMethod,
        ...(candidate.reviewStatus === 'possible_duplicate' ? { confirmPossibleDuplicate: true } : {}),
      });
      setMessage(en ? 'Movement added to Transactions.' : 'Movimiento agregado a Registro.');
    } catch {
      setMessage(en ? 'Could not register this movement. Review the category and try again.' : 'No se pudo registrar el movimiento. Revisa la categoría e inténtalo de nuevo.');
    } finally { setBusyId(''); }
  };

  return <section className='space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800'>
    <div className='flex items-start gap-3'><Mail className='mt-0.5 h-5 w-5 shrink-0 text-primary' /><div><h3 className='text-sm font-semibold text-slate-900 dark:text-white'>{en ? 'Bank email notifications' : 'Notificaciones bancarias por correo'}</h3><p className='mt-1 text-sm text-slate-500 dark:text-slate-400'>{en ? 'Mis Cheles account access is separate from permission to read Gmail or Outlook.' : 'El acceso a Mis Cheles es independiente del permiso para leer Gmail u Outlook.'}</p></div></div>
    <div className='space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900'>
      <div className='flex flex-wrap gap-2'>
        <button type='button' disabled={!firebaseFunctions || Boolean(connecting)} onClick={() => void connect('gmail')} className='min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50 dark:border-slate-700'>{connecting === 'gmail' ? (en ? 'Connecting…' : 'Conectando…') : (en ? 'Connect Gmail' : 'Conectar Gmail')}</button>
        <button type='button' disabled={!firebaseFunctions || Boolean(connecting)} onClick={() => void connect('outlook')} className='min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50 dark:border-slate-700'>{connecting === 'outlook' ? (en ? 'Connecting…' : 'Conectando…') : (en ? 'Connect Outlook' : 'Conectar Outlook')}</button>
      </div>
      {connections.map((connection) => <div key={connection.id} className='flex items-center justify-between gap-3 border-t border-slate-200 pt-2 text-sm dark:border-slate-700'>
        <span className='min-w-0 truncate'>{connection.provider === 'gmail' ? 'Gmail' : 'Outlook'} · {connection.maskedAddress} · {connection.status === 'active' ? (en ? 'Connected' : 'Conectado') : connection.status === 'reauthorization_required' ? (en ? 'Reconnect required' : 'Requiere reconexión') : (en ? 'Disconnected' : 'Desconectado')}</span>
        {connection.status !== 'disconnected' && <button type='button' disabled={!firebaseFunctions || Boolean(disconnecting)} onClick={() => void disconnect(connection)} className='shrink-0 text-xs font-semibold text-rose-700 disabled:opacity-50 dark:text-rose-400'>{disconnecting === connection.id ? (en ? 'Disconnecting…' : 'Desconectando…') : (en ? 'Disconnect' : 'Desconectar')}</button>}
      </div>)}
    </div>
    {loading ? <p className='text-sm text-slate-500'>{en ? 'Loading imported movements…' : 'Cargando movimientos importados…'}</p>
      : failed ? <p role='alert' className='text-sm text-rose-600'>{en ? 'Could not load imported movements.' : 'No se pudieron cargar los movimientos importados.'}</p>
      : items.length === 0 ? <p className='rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400'>{en ? 'No imported bank notifications are waiting for review.' : 'No hay notificaciones bancarias importadas pendientes de revisión.'}</p>
      : <div className='divide-y divide-slate-200 dark:divide-slate-800'>{items.map((candidate) => <MailCandidateCard key={candidate.id} candidate={candidate} language={language} busy={busyId === candidate.id} disabled={Boolean(busyId)} onIgnore={() => void ignore(candidate)} onConfirm={(category, payment) => void confirm(candidate, category, payment)} />)}</div>}
    {message && <p role='status' className='text-sm text-slate-600 dark:text-slate-300'>{message}</p>}
  </section>;
};

type ConfirmMailReviewPayment = NonNullable<MailReviewCandidate['paymentHint']>;
const PAYMENT_METHODS: ConfirmMailReviewPayment[] = ['cash', 'debit_card', 'credit_card', 'bank_transfer', 'other'];
const paymentLabel = (language: string, value: string) => {
  const labels: Record<string, string> = language === 'en'
    ? {cash:'Cash',debit_card:'Debit card',credit_card:'Credit card',bank_transfer:'Bank transfer',other:'Other'}
    : {cash:'Efectivo',debit_card:'Tarjeta de débito',credit_card:'Tarjeta de crédito',bank_transfer:'Transferencia bancaria',other:'Otro'};
  return labels[value] || labels.other;
};

const MailCandidateCard: React.FC<{candidate:MailReviewCandidate;language:string;busy:boolean;disabled:boolean;onIgnore:()=>void;onConfirm:(category:string,payment:ConfirmMailReviewPayment)=>void}> = ({candidate,language,busy,disabled,onIgnore,onConfirm}) => {
  const en = language === 'en';
  const [category, setCategory] = useState('');
  const [payment, setPayment] = useState<string>(candidate.paymentHint || 'other');
  const isDuplicate = candidate.reviewStatus === 'possible_duplicate';
  let amount = String(candidate.amountMinor / 100) + ' ' + candidate.currency;
  try { amount = new Intl.NumberFormat(en ? 'en-US' : 'es-DO', {style:'currency',currency:candidate.currency}).format(candidate.amountMinor / 100); } catch { /* Keep a readable ISO amount for unsupported currency codes. */ }
  return <article className='space-y-3 py-4'>
    <div className='flex items-start justify-between gap-3'><div className='min-w-0'><p className='font-semibold text-slate-900 dark:text-white'>{candidate.merchant}</p><p className='text-xs text-slate-500 dark:text-slate-400'>{candidate.provider === 'gmail' ? 'Gmail' : 'Outlook'} · {candidate.occurredOn} · {candidate.transactionType === 'income' ? (en ? 'Income' : 'Ingreso') : (en ? 'Expense' : 'Gasto')}</p></div><p className='shrink-0 font-semibold tabular-nums'>{amount}</p></div>
    {isDuplicate && <p className='flex gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'><AlertTriangle className='h-4 w-4 shrink-0' />{en ? 'A similar movement exists. Confirm only if this should be a separate transaction.' : 'Hay un movimiento parecido. Confirma solo si debe registrarse como una transacción distinta.'}</p>}
    <label className='block space-y-1'><span className='text-xs font-medium text-slate-600 dark:text-slate-300'>{en ? 'Category' : 'Categoría'}</span><input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={120} className='w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700' placeholder={en ? 'Choose a category' : 'Escribe una categoría'} /></label>
    <label className='block space-y-1'><span className='text-xs font-medium text-slate-600 dark:text-slate-300'>{en ? 'Payment method' : 'Medio de pago'}</span><select value={payment} onChange={(event) => setPayment(event.target.value)} className='w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950'>{PAYMENT_METHODS.map((method)=><option key={method} value={method}>{paymentLabel(language,method)}</option>)}</select></label>
    <div className='flex flex-wrap gap-2'><button type='button' disabled={disabled || !category.trim()} onClick={()=>onConfirm(category.trim(),payment as ConfirmMailReviewPayment)} className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-white disabled:opacity-50'>{busy ? <LoaderCircle className='h-4 w-4 animate-spin'/> : <Check className='h-4 w-4'/>}{isDuplicate ? (en ? 'Register as a new movement' : 'Registrar como movimiento nuevo') : (en ? 'Register movement' : 'Registrar movimiento')}</button><button type='button' disabled={disabled} onClick={onIgnore} className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300'><X className='h-4 w-4'/>{en ? 'Ignore' : 'Ignorar'}</button></div>
  </article>;
};

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let openModalCount = 0;
let previousBodyOverflow = '';
interface Props { title: string; onClose: () => void; children: React.ReactNode; size?: 'md' | 'lg'; }

/** Visual shell and keyboard lifecycle only; forms retain their business rules. */
export function ModalShell({ title, onClose, children, size = 'md' }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (openModalCount++ === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    ) || []).filter(element => element.getClientRects().length > 0);
    (focusable()[0] || panel.current)?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (!panel.current?.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const items = focusable(), first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); panel.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (--openModalCount === 0) document.body.style.overflow = previousBodyOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(
    <div className="app-modal-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 backdrop-blur-sm">
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={'w-full outline-none ' + (size === 'lg' ? 'max-w-lg' : 'max-w-md')}>
        {children}
      </div>
    </div>, document.body);
}

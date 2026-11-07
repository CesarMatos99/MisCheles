import React from 'react';
import { Download } from 'lucide-react';

export function ExportButton({ onClick, label = 'Exportar', disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="btn-secondary inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-2.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-50 sm:px-3">
    <Download className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
  </button>;
}

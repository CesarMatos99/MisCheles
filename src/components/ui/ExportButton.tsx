import React from 'react';
import { Download } from 'lucide-react';

export function ExportButton({ onClick, label = 'Exportar', disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="btn-secondary inline-flex h-11 w-11 shrink-0 items-center justify-center px-0 text-xs transition disabled:cursor-not-allowed disabled:opacity-50">
    <Download className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{label}</span>
  </button>;
}

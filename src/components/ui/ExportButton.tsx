import React from 'react';
import { Download } from 'lucide-react';

export function ExportButton({ onClick, label = 'Exportar', disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="btn-secondary inline-flex shrink-0 items-center justify-center gap-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-50">
    <Download className="h-4 w-4" aria-hidden="true" /><span>{label}</span>
  </button>;
}

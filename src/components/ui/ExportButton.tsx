import React from 'react';
import { Download } from 'lucide-react';

export function ExportButton({ onClick, label = 'Exportar', disabled = false }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <Download className="h-4 w-4" aria-hidden="true" /><span>{label}</span>
  </button>;
}

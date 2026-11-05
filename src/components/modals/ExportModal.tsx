import { ModalShell } from '../ui/ModalShell';
import { ModalSurface } from '../ui/ModalSurface';
import type { AnalyticsReport } from '../../domain/analyticsReport';
import React, { useEffect, useState } from 'react';
import { X, FileSpreadsheet, FileText, Download, CheckCircle2, Calendar } from 'lucide-react';
import { FinancialSummary, Transaction, UserProfile, SavingsMovement } from '../../types';
import { MONTH_NAMES_ES } from '../../constants/categories';
import { exportService } from '../../services/exportService';

interface ExportModalProps {
  analyticsReport?: AnalyticsReport;
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  summary: FinancialSummary;
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  profile: UserProfile;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  analyticsReport,
  isOpen,
  onClose,
  year,
  month,
  summary,
  transactions,
  savingsMovements,
  profile,
}) => {
  const [exportError, setExportError] = useState('');
  const [format, setFormat] = useState<'excel' | 'pdf'>('pdf');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const monthName = MONTH_NAMES_ES[month - 1];

  useEffect(() => { if (isOpen) setExportError(''); }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = () => {
    if (isExporting) return;
    setExportError('');
    setIsExporting(true);
    try {
      if (analyticsReport) {
        exportService.exportAnalytics(analyticsReport, format, profile);
      } else if (format === 'excel') {
        exportService.exportToExcel({
          year,
          month,
          summary,
          transactions,
          savingsMovements,
          profile,
        });
      } else {
        exportService.exportToPDF({
          year,
          month,
          summary,
          transactions,
          savingsMovements,
          profile,
        });
      }
      onClose();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'No se pudo generar el reporte. Inténtalo de nuevo.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ModalShell title="Exportar reporte" onClose={onClose} size="md">
      <ModalSurface scroll="auto">
        {/* Header */}
        <div className="p-5 bg-primary text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="type-dialog-title font-bold">Exportar Reporte Financiero</h2>
              <p className="text-xs text-white/75">{analyticsReport ? analyticsReport.period : monthName + ' ' + year}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {analyticsReport ? 'Descarga los indicadores, tablas y movimientos del conjunto consultado en Estadísticas.' : 'Descarga un reporte consolidado con el resumen del mes, ingresos, gastos y operaciones de ahorro.'}
          </p>

          {/* Format selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat('pdf')}
              className={`p-4 rounded-2xl border-2 text-left transition flex flex-col items-center text-center gap-2 ${
                format === 'pdf'
                  ? 'border-primary bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-600 rounded-2xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-sm block">Documento PDF</span>
                <span className="text-xs opacity-75">Formato imprimible estilizado</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('excel')}
              className={`p-4 rounded-2xl border-2 text-left transition flex flex-col items-center text-center gap-2 ${
                format === 'excel'
                  ? 'border-primary bg-primary-soft dark:bg-primary-soft text-primary dark:text-primary shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-2xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-sm block">Hoja Excel (.xlsx)</span>
                <span className="text-xs opacity-75">Hojas tabuladas y fórmulas</span>
              </div>
            </button>
          </div>

          {/* Quick Metrics preview */}
          {analyticsReport ? <div className="space-y-2 text-xs">{analyticsReport.metrics.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><span>{label}</span><strong>{value}</strong></div>)}</div> : <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Fondos Iniciales + Cobro:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {profile.currency} {(summary.initialIncome + summary.carryover).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Total Gastado:</span>
              <span className="font-bold text-rose-500">
                {profile.currency} {summary.totalExpenses.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Balance Disponible al Cierre:</span>
              <span className="font-bold text-primary">
                {profile.currency} {summary.availableBalance.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Total de Registros a exportar:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {transactions.length} transacciones
              </span>
            </div>
          </div>}

          {exportError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{exportError}</p>}
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-11 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 min-h-11 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-sm font-bold text-white shadow-lg shadow-primary/50 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generando...' : `Descargar ${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </ModalSurface>
    </ModalShell>
  );
};

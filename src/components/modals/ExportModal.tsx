import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Download, CheckCircle2, Calendar } from 'lucide-react';
import { FinancialSummary, Transaction, UserProfile, SavingsMovement } from '../../types';
import { MONTH_NAMES_ES } from '../../constants/categories';
import { exportService } from '../../services/exportService';

interface ExportModalProps {
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
  isOpen,
  onClose,
  year,
  month,
  summary,
  transactions,
  savingsMovements,
  profile,
}) => {
  const [format, setFormat] = useState<'excel' | 'pdf'>('pdf');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const monthName = MONTH_NAMES_ES[month - 1];

  if (!isOpen) return null;

  const handleExport = () => {
    setIsExporting(true);
    try {
      if (format === 'excel') {
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
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (e) {
      console.error(e);
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Exportar Reporte Financiero</h2>
              <p className="text-xs text-emerald-100">{monthName} {year}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Descarga un reporte consolidado con el resumen del mes, cobros, desglose de gastos y operaciones del módulo de ahorro.
          </p>

          {/* Format selection */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat('pdf')}
              className={`p-4 rounded-2xl border-2 text-left transition flex flex-col items-center text-center gap-2 ${
                format === 'pdf'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-600 rounded-2xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-sm block">Documento PDF</span>
                <span className="text-[11px] opacity-75">Formato imprimible estilizado</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('excel')}
              className={`p-4 rounded-2xl border-2 text-left transition flex flex-col items-center text-center gap-2 ${
                format === 'excel'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-2xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <span className="font-bold text-sm block">Hoja Excel (.xlsx)</span>
                <span className="text-[11px] opacity-75">Hojas tabuladas y fórmulas</span>
              </div>
            </button>
          </div>

          {/* Quick Metrics preview */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
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
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {profile.currency} {summary.availableBalance.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">Total de Registros a exportar:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {transactions.length} transacciones
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Generando...' : `Descargar ${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

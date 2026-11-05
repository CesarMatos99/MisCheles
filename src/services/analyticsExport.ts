import type { AnalyticsReport } from '../domain/analyticsReport';
import type { UserProfile } from '../types';
import { transactionTypeLabel } from '../domain/transactionPresentation.ts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
export function buildAnalyticsExport(report: AnalyticsReport, format: 'excel' | 'pdf', profile: UserProfile): XLSX.WorkBook | jsPDF {
    const rows = [
      ...report.transactions.map(t => [t.date, transactionTypeLabel(t), t.category, t.description, t.amount]),
      ...report.savingsMovements.map(sm => [sm.date,
        sm.type === 'deposit_from_month' ? 'Aporte a ahorro' : sm.type === 'withdraw_to_month' ? 'Retiro de ahorro' : sm.type === 'direct_expense' ? 'Gasto desde ahorro' : 'Transferencia entre fondos',
        sm.goalTitle || sm.category || 'Ahorro general', sm.description, sm.amount]),
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const header = ['Fecha', 'Tipo', 'Categoría / Destino', 'Descripción', 'Monto (' + profile.currency + ')'];
    if (format === 'excel') {
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['ESTADÍSTICAS - MISCHELES'], ['Período', report.period], ['Categoría', report.category],
        ['Usuario', profile.name], [], ['Indicador', 'Valor'], ...report.metrics,
      ]), 'Resumen');
      if (report.breakdown) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[report.breakdown.title], ['Categoría / Destino', 'Monto', 'Participación'], ...report.breakdown.rows]), 'Ranking');
      report.tables?.forEach((table, index) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[table.title], table.headers, ...table.rows]), 'Análisis ' + (index + 1)));
      if (rows.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([header, ...rows]), 'Movimientos');
      return workbook;
    } else {
      const pdf = new jsPDF();
      pdf.setFontSize(16); pdf.text('Estadísticas - MisCheles', 14, 18);
      autoTable(pdf, { startY: 24, body: [['Período', report.period], ['Categoría', report.category], ...report.metrics], theme: 'striped' });
      if (report.breakdown) { pdf.addPage(); pdf.setFontSize(12); pdf.text(report.breakdown.title, 14, 18); autoTable(pdf, { startY: 24, head: [['Categoría / Destino', 'Monto', 'Participación']], body: report.breakdown.rows }); }
      report.tables?.forEach(table => { pdf.addPage(); pdf.setFontSize(12); pdf.text(table.title, 14, 18); autoTable(pdf, { startY: 24, head: [table.headers], body: table.rows, styles: { fontSize: 8 } }); });
      if (rows.length) { pdf.addPage(); autoTable(pdf, { head: [header], body: rows, styles: { fontSize: 8 } }); }
      return pdf;
    }
}

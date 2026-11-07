import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import type jsPDF from 'jspdf';
import { buildAnalyticsExport } from './analyticsExport.ts';
import type { UserProfile } from '../types';
const report = { period: 'Octubre frente a noviembre 2026', category: 'Todas', metrics: [], transactions: [], savingsMovements: [], tables: [{ title: 'Comparación', headers: ['Indicador', 'A', 'B'], rows: [['Gastos', 100, 150]] }] };
test('Excel serializes and reloads the actual filtered analysis table', () => {
  const workbook = buildAnalyticsExport(report, 'excel', { name: 'Prueba aislada', currency: 'RD$' } as UserProfile) as XLSX.WorkBook;
  const loaded = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  assert.deepEqual(loaded.SheetNames, ['Resumen', 'Análisis 1']);
  assert.deepEqual(XLSX.utils.sheet_to_json(loaded.Sheets['Análisis 1'], { header: 1 }), [['Comparación'], ['Indicador', 'A', 'B'], ['Gastos', 100, 150]]);
});
test('PDF keeps compact reports on one page and emits a branded document', () => {
  const pdf = buildAnalyticsExport(report, 'pdf', { name: 'Prueba aislada', currency: 'RD$' } as UserProfile) as jsPDF;
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.ok(pdf.output('arraybuffer').byteLength > 1000);
});

test('PDF flows long movement tables across pages without dropping rows', () => {
  const longReport = {
    ...report,
    metrics: [['Ingresos', 'RD$ 100,000']],
    transactions: Array.from({ length: 80 }, (_, index) => ({
      id: `tx-${index}`,
      monthKey: '2026-10',
      date: `2026-10-${String((index % 28) + 1).padStart(2, '0')}`,
      type: 'expense' as const,
      category: 'Alimentos',
      description: `Compra ${index}`,
      amount: 100 + index,
      paymentMethod: 'Efectivo',
      createdAt: index,
    })),
  };
  const pdf = buildAnalyticsExport(longReport, 'pdf', { name: 'Prueba aislada', currency: 'RD$' } as UserProfile) as jsPDF;
  assert.ok(pdf.getNumberOfPages() > 1);
  assert.ok(pdf.output('arraybuffer').byteLength > 5000);
});

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
test('PDF produces separate summary and analysis pages', () => {
  const pdf = buildAnalyticsExport(report, 'pdf', { name: 'Prueba aislada', currency: 'RD$' } as UserProfile) as jsPDF;
  assert.equal(pdf.getNumberOfPages(), 2);
  assert.ok(pdf.output('arraybuffer').byteLength > 1000);
});

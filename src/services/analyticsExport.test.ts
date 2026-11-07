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
    tables: [],
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
  const content = new TextDecoder().decode(pdf.output('arraybuffer'));
  assert.equal(pdf.getNumberOfPages(), 3);
  assert.equal((content.match(/\(Fecha\) Tj/g) || []).length, pdf.getNumberOfPages());
  assert.match(content, /Compra 79/);
  assert.ok(content.length > 5000);
});

test('statistics PDF consolidates summary and budget data without exporting movement history', () => {
  const statisticsReport = {
    ...report,
    reportScope: 'statistics' as const,
    metrics: [['Ingresos', '11,000'], ['Gastos de consumo', '350'], ['Aportes a ahorro', '100'], ['Disponible del período', '-175'], ['Promedio diario', '25']],
    financialSummary: { income: 11000, expenses: 350, savingsContributions: 100, available: -175 },
    expenseBreakdown: [
      { category: 'Alimentos', amount: 350, share: 100, budget: 300, remaining: -50 },
      { category: 'Transporte', amount: 0, share: 0, budget: 200, remaining: 200 },
      { category: 'Sin actividad', amount: 0, share: 0 },
    ],
    breakdown: { title: 'Gastos por categoría', rows: [['Alimentos', '350', '100%'] as [string, string, string]] },
    tables: [
      { title: 'Categorías de gasto', headers: ['Categoría', 'Gastado'], rows: [['Alimentos', '350']] },
      { title: 'Presupuestos asignados', headers: ['Categoría', 'Monto'], rows: [['Alimentos', '300']] },
      { title: 'Metas de ahorro', headers: ['Meta'], rows: [['Fondo de prueba']] },
      { title: 'Movimientos de ahorro', headers: ['Operación'], rows: [['Aporte de prueba']] },
    ],
    transactions: [{ id: 'tx-1', monthKey: '2026-11', type: 'expense' as const, amount: 350, category: 'Alimentos', description: 'No debe exportarse', date: '2026-11-01', paymentMethod: 'Efectivo', createdAt: 1 }],
    savingsMovements: [{ id: 'sav-1', monthKey: '2026-11', type: 'deposit_from_month' as const, amount: 100, description: 'Aporte de prueba', date: '2026-11-02', createdAt: 2 }],
  };
  const pdf = buildAnalyticsExport(statisticsReport, 'pdf', { name: 'Prueba aislada', currency: 'RD$' } as UserProfile) as jsPDF;
  const content = new TextDecoder().decode(pdf.output('arraybuffer'));
  assert.equal(pdf.getNumberOfPages(), 1);
  assert.match(content, /Gastos por categor/);
  assert.match(content, /Excedido RD\$ 50/);
  assert.match(content, /RD\$ -175/);
  assert.match(content, /Transporte/);
  assert.doesNotMatch(content, /Sin actividad|Presupuestos asignados|Categorías de gasto|Metas de ahorro|Fondo de prueba|Movimientos de ahorro|No debe exportarse|Aporte de prueba|Promedio diario/);
});

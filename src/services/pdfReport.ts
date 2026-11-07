import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import type { FinancialSummary, SavingsMovement, Transaction, UserProfile } from '../types';
import { MONTH_NAMES_ES } from '../constants/categories';
import { transactionTypeLabel } from '../domain/transactionPresentation';

export interface PdfBrandingOptions {
  brandIconDataUrl?: string;
  generatedAt?: Date;
}

type PdfDocument = jsPDF & { lastAutoTable?: { finalY: number } };

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 14;
const HEADER_HEIGHT = 29;
const BOTTOM_MARGIN = 18;
const COLORS = {
  primary: [1, 38, 119] as [number, number, number],
  text: [23, 32, 51] as [number, number, number],
  secondary: [104, 115, 134] as [number, number, number],
  line: [227, 231, 238] as [number, number, number],
  positive: [23, 132, 93] as [number, number, number],
  negative: [194, 65, 75] as [number, number, number],
  savings: [15, 118, 110] as [number, number, number],
};

const money = (currency: string, amount: number) => `${currency} ${Math.round(amount).toLocaleString('es-DO')}`;
const generatedLabel = (value: Date) => value.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: 'numeric' });
const reportY = (doc: PdfDocument) => doc.lastAutoTable?.finalY || HEADER_HEIGHT + 8;

function drawHeader(doc: PdfDocument, title: string, period: string, profile: UserProfile, options: PdfBrandingOptions) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, 'F');
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, HEADER_HEIGHT, PAGE_WIDTH - MARGIN_X, HEADER_HEIGHT);
  let titleX = MARGIN_X;
  if (options.brandIconDataUrl) {
    try {
      doc.addImage(options.brandIconDataUrl, 'PNG', MARGIN_X, 7, 13, 13, undefined, 'FAST');
      titleX = 31;
    } catch {
      // A missing image must never prevent a financial report from being generated.
    }
  }
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MisCheles', titleX, 13);
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(10);
  doc.text(title, titleX, 20);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(period, PAGE_WIDTH - MARGIN_X, 11, { align: 'right' });
  doc.text(`Generado ${generatedLabel(options.generatedAt || new Date())}`, PAGE_WIDTH - MARGIN_X, 18, { align: 'right' });
  doc.text(profile.name, PAGE_WIDTH - MARGIN_X, 25, { align: 'right' });
}

function drawFooter(doc: PdfDocument, page: number, total: number) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  doc.line(MARGIN_X, PAGE_HEIGHT - BOTTOM_MARGIN + 4, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - BOTTOM_MARGIN + 4);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('MisCheles · reporte financiero', MARGIN_X, PAGE_HEIGHT - BOTTOM_MARGIN + 10);
  doc.text(`Página ${page} de ${total}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - BOTTOM_MARGIN + 10, { align: 'right' });
}

function finishDocument(doc: PdfDocument) {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, total);
  }
}

function sectionTitle(doc: PdfDocument, title: string, y: number, header: { title: string; period: string; profile: UserProfile; options: PdfBrandingOptions }) {
  let nextY = y;
  if (nextY > PAGE_HEIGHT - BOTTOM_MARGIN - 24) {
    doc.addPage();
    drawHeader(doc, header.title, header.period, header.profile, header.options);
    nextY = HEADER_HEIGHT + 8;
  }
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, MARGIN_X, nextY);
  return nextY + 5;
}

function renderTable(
  doc: PdfDocument,
  y: number,
  head: string[][],
  body: Array<Array<string | number>>,
  header: { title: string; period: string; profile: UserProfile; options: PdfBrandingOptions },
  columnStyles?: UserOptions['columnStyles'],
) {
  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    margin: { top: HEADER_HEIGHT + 7, right: MARGIN_X, bottom: BOTTOM_MARGIN + 8, left: MARGIN_X },
    tableWidth: 'auto',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: COLORS.text,
      lineColor: COLORS.line,
      lineWidth: 0.2,
      cellPadding: 2.2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: 255,
      fontStyle: 'bold',
      lineColor: COLORS.primary,
      cellPadding: 2.5,
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles,
    didParseCell: data => {
      if (data.section !== 'body' || data.column.index === 0 || data.column.index > 1) return;
      const row = data.row.raw as Array<string | number> | undefined;
      const label = String(row?.[0] ?? '').toLowerCase();
      if (label.includes('ingreso')) data.cell.styles.textColor = COLORS.positive;
      else if (label.includes('gasto') || label.includes('expense')) data.cell.styles.textColor = COLORS.negative;
      else if (label.includes('ahorro') || label.includes('aporte') || label.includes('retiro')) data.cell.styles.textColor = COLORS.savings;
    },
    willDrawPage: () => drawHeader(doc, header.title, header.period, header.profile, header.options),
  });
  return reportY(doc) + 8;
}

function savingsMovementLabel(movement: SavingsMovement) {
  if (movement.type === 'deposit_from_month') return 'Aporte a ahorro';
  if (movement.type === 'withdraw_to_month') return 'Retiro de ahorro';
  if (movement.type === 'direct_expense') return 'Gasto desde ahorro';
  return 'Transferencia entre fondos';
}

export async function loadPdfBrandIconDataUrl(path = '/app-icon.png'): Promise<string | undefined> {
  try {
    if (typeof fetch !== 'function' || typeof btoa !== 'function') return undefined;
    const response = await fetch(path);
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/png;base64,${btoa(binary)}`;
  } catch {
    return undefined;
  }
}

export function buildMonthlyPdf(params: {
  year: number;
  month: number;
  summary: FinancialSummary;
  transactions: Transaction[];
  savingsMovements: SavingsMovement[];
  profile: UserProfile;
}, options: PdfBrandingOptions = {}) {
  const { year, month, summary, transactions, savingsMovements, profile } = params;
  const monthName = MONTH_NAMES_ES[month - 1];
  const doc = new jsPDF() as PdfDocument;
  const header = { title: 'Estado financiero', period: `${monthName} ${year}`, profile, options };
  drawHeader(doc, header.title, header.period, profile, options);
  let y = HEADER_HEIGHT + 8;
  const summaryRows: Array<[string, string]> = [
    ['Ingresos del período', money(profile.currency, summary.totalIncome)],
    ['Gastos de consumo', money(profile.currency, summary.totalExpenses)],
    ['Aportes a ahorro', money(profile.currency, summary.savingsTransfersTo)],
    ['Disponible al cierre', money(profile.currency, summary.availableBalance)],
    ['Dinero ahorrado', money(profile.currency, summary.totalSavingsVault)],
  ];
  y = sectionTitle(doc, 'Resumen financiero', y, header);
  y = renderTable(doc, y, [['Indicador', 'Monto']], summaryRows, header, { 1: { halign: 'right', fontStyle: 'bold' } });

  if (transactions.length) {
    y = sectionTitle(doc, `Movimientos (${transactions.length})`, y, header);
    y = renderTable(doc, y, [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Método', 'Monto']], transactions.map(transaction => [transaction.date, transactionTypeLabel(transaction), transaction.category, transaction.description, transaction.paymentMethod || 'Efectivo', money(profile.currency, transaction.amount)]), header, { 0: { cellWidth: 22 }, 1: { cellWidth: 22 }, 5: { halign: 'right', fontStyle: 'bold' } });
  }
  if (savingsMovements.length) {
    y = sectionTitle(doc, `Movimientos de ahorro (${savingsMovements.length})`, y, header);
    renderTable(doc, y, [['Fecha', 'Operación', 'Destino', 'Concepto', 'Monto']], savingsMovements.map(movement => [movement.date, savingsMovementLabel(movement), movement.goalTitle || movement.category || 'Ahorro general', movement.description, money(profile.currency, movement.amount)]), header, { 0: { cellWidth: 22 }, 4: { halign: 'right', fontStyle: 'bold' } });
  }
  finishDocument(doc);
  return doc;
}

export function buildAnalyticsPdf(report: { period: string; category: string; metrics: Array<[string, string]>; transactions: Transaction[]; savingsMovements: SavingsMovement[]; breakdown?: { title: string; rows: Array<[string, string, string]> }; tables?: Array<{ title: string; headers: string[]; rows: Array<Array<string | number>> }> }, profile: UserProfile, options: PdfBrandingOptions = {}) {
  const doc = new jsPDF() as PdfDocument;
  const period = report.category && report.category !== 'Todas' ? `${report.period} · ${report.category}` : report.period;
  const header = { title: 'Reporte de estadísticas', period, profile, options };
  drawHeader(doc, header.title, header.period, profile, options);
  let y = HEADER_HEIGHT + 8;
  if (report.metrics.length) {
    y = sectionTitle(doc, 'Resumen financiero', y, header);
    y = renderTable(doc, y, [['Indicador', 'Valor']], report.metrics, header, { 1: { halign: 'right', fontStyle: 'bold' } });
  }
  if (report.breakdown?.rows.length) {
    y = sectionTitle(doc, report.breakdown.title, y, header);
    y = renderTable(doc, y, [['Categoría / Destino', 'Monto', 'Participación']], report.breakdown.rows, header, { 1: { halign: 'right' }, 2: { halign: 'right' } });
  }
  for (const table of report.tables || []) {
    if (!table.rows.length) continue;
    y = sectionTitle(doc, table.title, y, header);
    y = renderTable(doc, y, [table.headers], table.rows, header);
  }
  const movementRows = [
    ...report.transactions.map(transaction => [transaction.date, transactionTypeLabel(transaction), transaction.category, transaction.description, money(profile.currency, transaction.amount)]),
    ...report.savingsMovements.map(movement => [movement.date, savingsMovementLabel(movement), movement.goalTitle || movement.category || 'Ahorro general', movement.description, money(profile.currency, movement.amount)]),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  if (movementRows.length) {
    y = sectionTitle(doc, `Movimientos (${movementRows.length})`, y, header);
    renderTable(doc, y, [['Fecha', 'Tipo', 'Categoría / Destino', 'Descripción', 'Monto']], movementRows, header, { 0: { cellWidth: 22 }, 4: { halign: 'right', fontStyle: 'bold' } });
  }
  finishDocument(doc);
  return doc;
}

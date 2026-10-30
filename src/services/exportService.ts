import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, SavingsMovement, FinancialSummary, UserProfile } from '../types';
import { MONTH_NAMES_ES } from '../constants/categories';

export const exportService = {
  // Export to Excel (.xlsx)
  exportToExcel(params: {
    year: number;
    month: number;
    summary: FinancialSummary;
    transactions: Transaction[];
    savingsMovements: SavingsMovement[];
    profile: UserProfile;
  }) {
    const { year, month, summary, transactions, savingsMovements, profile } = params;
    const monthName = MONTH_NAMES_ES[month - 1];

    // Workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumen General
    const summaryData = [
      ['REPORTE FINANCIERO MENSUAL - MISCHELES'],
      ['Usuario:', profile.name],
      ['Período:', `${monthName} ${year}`],
      ['Moneda:', profile.currency],
      ['Fecha de Generación:', new Date().toLocaleString('es-ES')],
      [],
      ['MÉTRICA', 'MONTO (' + profile.currency + ')'],
      ['Cobro / Monto Inicial del Mes', summary.initialIncome],
      ['Sobrante Rollover (Mes Anterior)', summary.carryover],
      ['Ingresos Adicionales del Mes', summary.totalAdditionalIncome],
      ['Retiros de Ahorro hacia este Mes', summary.savingsTransfersFrom],
      ['TOTAL FONDOS DISPONIBLES', summary.totalIncome],
      ['Gastos Totales del Mes', summary.totalExpenses],
      ['Aportes enviados al Módulo de Ahorro', summary.savingsTransfersTo],
      ['BALANCE DISPONIBLE AL CIERRE', summary.availableBalance],
      [],
      ['FONDO DE AHORRO GLOBAL', summary.totalSavingsVault],
      ['Gastos directos desde Ahorro este mes', summary.savingsDirectExpenses],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Mes');

    // Sheet 2: Transacciones del Mes
    const txHeaders = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Método de Pago', `Monto (${profile.currency})`];
    const txRows = transactions.map((t) => [
      t.date,
      t.type === 'expense' ? 'Gasto' : 'Ingreso',
      t.category,
      t.description,
      t.paymentMethod || 'Efectivo',
      t.amount,
    ]);
    const wsTx = XLSX.utils.aoa_to_sheet([txHeaders, ...txRows]);
    XLSX.utils.book_append_sheet(wb, wsTx, 'Transacciones');

    // Sheet 3: Movimientos de Ahorro
    const savingsHeaders = ['Fecha', 'Tipo de Movimiento', 'Concepto / Descripción', 'Categoría', `Monto (${profile.currency})`];
    const savingsRows = savingsMovements.map((sm) => {
      let typeLabel = 'Aporte desde el Mes';
      if (sm.type === 'withdraw_to_month') typeLabel = 'Retiro hacia el Mes';
      if (sm.type === 'direct_expense') typeLabel = 'Pago Directo / Gasto desde Ahorro';
      return [sm.date, typeLabel, sm.description, sm.category || '-', sm.amount];
    });
    const wsSavings = XLSX.utils.aoa_to_sheet([savingsHeaders, ...savingsRows]);
    XLSX.utils.book_append_sheet(wb, wsSavings, 'Modulo Ahorros');

    // Generate filename
    const filename = `MisCheles_${monthName}_${year}.xlsx`;
    XLSX.writeFile(wb, filename);
  },

  // Export to PDF
  exportToPDF(params: {
    year: number;
    month: number;
    summary: FinancialSummary;
    transactions: Transaction[];
    savingsMovements: SavingsMovement[];
    profile: UserProfile;
  }) {
    const { year, month, summary, transactions, savingsMovements, profile } = params;
    const monthName = MONTH_NAMES_ES[month - 1];
    const doc = new jsPDF();
    const curr = profile.currency;

    // Header styling
    doc.setFillColor(16, 185, 129); // Emerald
    doc.rect(0, 0, 210, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('MISCHELES - ESTADO FINANCIERO', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${monthName} ${year} | Usuario: ${profile.name}`, 14, 26);
    doc.text(`Emitido: ${new Date().toLocaleDateString('es-ES')}`, 155, 26);

    // Summary Cards block
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen del Mes', 14, 42);

    const summaryRows = [
      ['Cobro / Monto Inicial del Mes', `${curr} ${summary.initialIncome.toLocaleString()}`],
      ['Sobrante Acumulado Mes Anterior', `${curr} ${summary.carryover.toLocaleString()}`],
      ['Ingresos Extra del Mes', `${curr} ${summary.totalAdditionalIncome.toLocaleString()}`],
      ['Gastos Realizados', `${curr} ${summary.totalExpenses.toLocaleString()}`],
      ['Transferencias Enviadas al Ahorro', `${curr} ${summary.savingsTransfersTo.toLocaleString()}`],
      ['BALANCE DISPONIBLE FINAL', `${curr} ${summary.availableBalance.toLocaleString()}`],
      ['FONDO TOTAL EN AHORROS', `${curr} ${summary.totalSavingsVault.toLocaleString()}`],
    ];

    autoTable(doc, {
      startY: 46,
      head: [['Concepto', 'Total']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [4, 120, 87], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' },
      },
    });

    // Transactions Table
    const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 100;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Detalle de Transacciones (${transactions.length})`, 14, lastY + 12);

    const txBody = transactions.map((t) => [
      t.date,
      t.type === 'expense' ? 'Gasto' : 'Ingreso',
      t.category,
      t.description,
      t.paymentMethod || 'Efectivo',
      `${curr} ${t.amount.toLocaleString()}`,
    ]);

    autoTable(doc, {
      startY: lastY + 16,
      head: [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Método', 'Monto']],
      body: txBody.length > 0 ? txBody : [['-', '-', 'Sin registros en este mes', '-', '-', '-']],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 20 },
        2: { cellWidth: 38 },
        3: { cellWidth: 50 },
        4: { cellWidth: 32 },
        5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
    });

    // Savings movements if any
    const txFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || 180;
    if (savingsMovements.length > 0 && txFinalY < 240) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Movimientos de Ahorro del Mes', 14, txFinalY + 10);

      const savingsBody = savingsMovements.map((sm) => [
        sm.date,
        sm.type === 'deposit_from_month'
          ? 'Aporte al Ahorro'
          : sm.type === 'withdraw_to_month'
          ? 'Retorno al Mes'
          : 'Pago/Gasto desde Ahorro',
        sm.description,
        `${curr} ${sm.amount.toLocaleString()}`,
      ]);

      autoTable(doc, {
        startY: txFinalY + 14,
        head: [['Fecha', 'Operación', 'Concepto', 'Monto']],
        body: savingsBody,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 2 },
      });
    }

    const filename = `MisCheles_${monthName}_${year}.pdf`;
    doc.save(filename);
  },
};

export type AppLanguage = 'es' | 'en';

const englishCategoryLabels: Readonly<Record<string, string>> = {
  'Vivienda y Alquiler': 'Housing and Rent',
  'Alimentación y Supermercado': 'Food and Groceries',
  'Energía eléctrica': 'Electricity',
  'Agua': 'Water',
  'Internet': 'Internet',
  'Teléfono': 'Phone',
  'Transporte y Combustible': 'Transportation and Fuel',
  'Salud y Farmacia': 'Health and Pharmacy',
  'Educación y Cursos': 'Education and Courses',
  'Entretenimiento y Salidas': 'Entertainment and Outings',
  'Ropa y Cuidado Personal': 'Clothing and Personal Care',
  'Deudas y Tarjetas': 'Debt and Cards',
  'Mascotas': 'Pets',
  'Aporte al Ahorro': 'Savings Contribution',
  'Otros Gastos': 'Other Expenses',
  'Cobro del Mes / Salario': 'Monthly Pay / Salary',
  'Trabajo Extra / Negocio': 'Extra Work / Business',
  'Ventas o Comisiones': 'Sales or Commissions',
  'Rendimientos / Intereses': 'Returns / Interest',
  'Regalos / Devolución': 'Gifts / Refunds',
  'Otros Ingresos': 'Other Income',
  'Alimentación': 'Food and Groceries',
  'Vivienda': 'Housing',
  'Transporte': 'Transportation',
  'Servicios': 'Utilities',
  'Salud': 'Health',
  'Entretenimiento': 'Entertainment',
  'Otros': 'Other',
  'Regalo': 'Gift',
};

/** Translates known labels for display while preserving the canonical stored category. */
export function localizeCategoryName(language: AppLanguage, storedName: string): string {
  if (language !== 'en' || !Object.prototype.hasOwnProperty.call(englishCategoryLabels, storedName)) return storedName;
  return englishCategoryLabels[storedName];
}

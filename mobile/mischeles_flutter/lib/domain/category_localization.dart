const Map<String, String> _englishCategoryLabels = <String, String>{
  'Vivienda y Alquiler': 'Housing and Rent',
  'Vivienda': 'Housing',
  'Alimentación y Supermercado': 'Food and Groceries',
  'Alimentación': 'Food and Groceries',
  'Energía eléctrica': 'Electricity',
  'Agua': 'Water',
  'Internet': 'Internet',
  'Teléfono': 'Phone',
  'Transporte y Combustible': 'Transportation and Fuel',
  'Transporte': 'Transportation',
  'Salud y Farmacia': 'Health and Pharmacy',
  'Salud': 'Health',
  'Educación y Cursos': 'Education and Courses',
  'Entretenimiento y Salidas': 'Entertainment and Outings',
  'Entretenimiento': 'Entertainment',
  'Ropa y Cuidado Personal': 'Clothing and Personal Care',
  'Deudas y Tarjetas': 'Debt and Cards',
  'Mascotas': 'Pets',
  'Aporte al Ahorro': 'Savings Contribution',
  'Otros Gastos': 'Other Expenses',
  'Salario': 'Salary',
  'Trabajo Extra / Negocio': 'Extra Work / Business',
  'Ventas o Comisiones': 'Sales or Commissions',
  'Rendimientos / Intereses': 'Returns / Interest',
  'Regalos / Devolución': 'Gifts / Refunds',
  'Regalo': 'Gift',
  'Servicios': 'Utilities',
};

String localizedCategoryLabel(String language, String storedName) =>
    language == 'en'
    ? _englishCategoryLabels[storedName] ?? storedName
    : storedName;

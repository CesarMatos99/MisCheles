export interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgLight: string;
  bgDark: string;
}

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: 'vivienda', name: 'Vivienda y Alquiler', icon: 'Home', color: '#3b82f6', bgLight: '#eff6ff', bgDark: '#1e3a8a' },
  { id: 'alimentacion', name: 'Alimentación y Supermercado', icon: 'Utensils', color: '#10b981', bgLight: '#ecfdf5', bgDark: '#064e3b' },
  { id: 'servicios', name: 'Servicios (Luz, Agua, Internet)', icon: 'Zap', color: '#f59e0b', bgLight: '#fffbeb', bgDark: '#78350f' },
  { id: 'transporte', name: 'Transporte y Combustible', icon: 'Car', color: '#8b5cf6', bgLight: '#f5f3ff', bgDark: '#4c1d95' },
  { id: 'salud', name: 'Salud y Farmacia', icon: 'HeartPulse', color: '#ef4444', bgLight: '#fef2f2', bgDark: '#7f1d1d' },
  { id: 'educacion', name: 'Educación y Cursos', icon: 'GraduationCap', color: '#06b6d4', bgLight: '#ecfeff', bgDark: '#164e63' },
  { id: 'entretenimiento', name: 'Entretenimiento y Salidas', icon: 'Film', color: '#ec4899', bgLight: '#fdf2f8', bgDark: '#831843' },
  { id: 'ropa', name: 'Ropa y Cuidado Personal', icon: 'ShoppingBag', color: '#14b8a6', bgLight: '#f0fdfa', bgDark: '#134e4a' },
  { id: 'deudas', name: 'Deudas y Tarjetas', icon: 'CreditCard', color: '#f97316', bgLight: '#fff7ed', bgDark: '#7c2d12' },
  { id: 'mascotas', name: 'Mascotas', icon: 'PawPrint', color: '#a855f7', bgLight: '#faf5ff', bgDark: '#581c87' },
  { id: 'ahorro', name: 'Aporte al Ahorro', icon: 'PiggyBank', color: '#10b981', bgLight: '#ecfdf5', bgDark: '#064e3b' },
  { id: 'otros', name: 'Otros Gastos', icon: 'MoreHorizontal', color: '#64748b', bgLight: '#f8fafc', bgDark: '#334155' },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { id: 'salario', name: 'Cobro del Mes / Salario', icon: 'Briefcase', color: '#10b981', bgLight: '#ecfdf5', bgDark: '#064e3b' },
  { id: 'extra', name: 'Trabajo Extra / Negocio', icon: 'TrendingUp', color: '#3b82f6', bgLight: '#eff6ff', bgDark: '#1e3a8a' },
  { id: 'ventas', name: 'Ventas o Comisiones', icon: 'DollarSign', color: '#8b5cf6', bgLight: '#f5f3ff', bgDark: '#4c1d95' },
  { id: 'intereses', name: 'Rendimientos / Intereses', icon: 'PieChart', color: '#f59e0b', bgLight: '#fffbeb', bgDark: '#78350f' },
  { id: 'regalo', name: 'Regalos / Devolución', icon: 'Gift', color: '#ec4899', bgLight: '#fdf2f8', bgDark: '#831843' },
  { id: 'otros_ingresos', name: 'Otros Ingresos', icon: 'PlusCircle', color: '#64748b', bgLight: '#f8fafc', bgDark: '#334155' },
];

export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta de Débito',
  'Tarjeta de Crédito',
  'Transferencia Bancaria',
  'Billetera Móvil',
];

export const CURRENCY_OPTIONS = [
  { label: 'Dólar ($)', value: '$' },
  { label: 'Peso Dominicano (RD$)', value: 'RD$' },
  { label: 'Euro (€)', value: '€' },
  { label: 'Peso Mexicano (MXN$)', value: 'MXN$' },
  { label: 'Peso Colombiano (COP$)', value: 'COP$' },
  { label: 'Sol Peruano (S/)', value: 'S/' },
  { label: 'Peso Chileno (CLP$)', value: 'CLP$' },
  { label: 'Peso Argentino (ARS$)', value: 'ARS$' },
];

import {
  Transaction,
  SavingsMovement,
  SavingsGoal,
  MonthConfig,
  UserProfile,
  FinancialSummary,
} from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'mischeles_transactions_v2',
  SAVINGS_MOVEMENTS: 'mischeles_savings_movements_v2',
  SAVINGS_GOALS: 'mischeles_savings_goals_v2',
  MONTH_CONFIGS: 'mischeles_month_configs_v2',
  USER_PROFILE: 'mischeles_user_profile_v2',
  APP_THEME: 'mischeles_theme_v2',
  APP_LOCKED: 'mischeles_locked_v2',
};

export const getMonthKey = (year: number, month: number): string => {
  return `${year}-${String(month).padStart(2, '0')}`;
};

export const getPrevMonthKey = (year: number, month: number): { year: number; month: number; key: string } => {
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return {
    year: prevYear,
    month: prevMonth,
    key: getMonthKey(prevYear, prevMonth),
  };
};

export const defaultProfile: UserProfile = {
  name: 'César Matos',
  email: 'cesarmatos99@gmail.com',
  photoUrl: '',
  currency: 'RD$',
  pinCode: '1234',
  biometricsEnabled: true,
  pinLockEnabled: true,
  monthlyTargetIncome: 65000,
};

// Seed realistic data for August and September 2026 so rollover can be seen in action
const getInitialSeedData = () => {
  const augKey = '2026-08';
  const sepKey = '2026-09';

  const monthConfigs: Record<string, MonthConfig> = {
    [augKey]: {
      monthKey: augKey,
      year: 2026,
      month: 8,
      initialIncome: 60000,
      carryoverFromPrev: 0,
      autoRolloverEnabled: true,
      notes: 'Presupuesto inicial de Agosto',
      isConfigured: true,
    },
    [sepKey]: {
      monthKey: sepKey,
      year: 2026,
      month: 9,
      initialIncome: 65000,
      carryoverFromPrev: 10500, // Leftover from August
      autoRolloverEnabled: true,
      notes: 'Inicio de Septiembre con cobro y saldo anterior',
      isConfigured: true,
    },
  };

  const transactions: Transaction[] = [
    // August transactions
    {
      id: 'tx-aug-1',
      monthKey: augKey,
      type: 'income',
      amount: 5000,
      category: 'Trabajo Extra / Negocio',
      description: 'Proyecto freelance de diseño',
      date: '2026-08-10',
      paymentMethod: 'Transferencia Bancaria',
      createdAt: Date.now() - 40 * 86400000,
    },
    {
      id: 'tx-aug-2',
      monthKey: augKey,
      type: 'expense',
      amount: 18000,
      category: 'Vivienda y Alquiler',
      description: 'Alquiler departamento',
      date: '2026-08-05',
      paymentMethod: 'Transferencia Bancaria',
      createdAt: Date.now() - 45 * 86400000,
    },
    {
      id: 'tx-aug-3',
      monthKey: augKey,
      type: 'expense',
      amount: 14500,
      category: 'Alimentación y Supermercado',
      description: 'Supermercado compras quincena',
      date: '2026-08-15',
      paymentMethod: 'Tarjeta de Débito',
      createdAt: Date.now() - 35 * 86400000,
    },
    {
      id: 'tx-aug-4',
      monthKey: augKey,
      type: 'expense',
      amount: 7000,
      category: 'Servicios (Luz, Agua, Internet)',
      description: 'Pago de electricidad e internet',
      date: '2026-08-18',
      paymentMethod: 'Tarjeta de Crédito',
      createdAt: Date.now() - 32 * 86400000,
    },
    {
      id: 'tx-aug-5',
      monthKey: augKey,
      type: 'expense',
      amount: 5000,
      category: 'Transporte y Combustible',
      description: 'Combustible y mantenimiento',
      date: '2026-08-22',
      paymentMethod: 'Tarjeta de Débito',
      createdAt: Date.now() - 28 * 86400000,
    },
    {
      id: 'tx-aug-savings-1',
      monthKey: augKey,
      type: 'expense',
      amount: 10000,
      category: 'Aporte al Ahorro',
      description: 'Aporte de ahorro de Agosto',
      date: '2026-08-25',
      paymentMethod: 'Transferencia a Ahorro',
      relatedSavingsMovementId: 'sm-aug-1',
      createdAt: Date.now() - 25 * 86400000,
    },
    // September transactions
    {
      id: 'tx-sep-1',
      monthKey: sepKey,
      type: 'income',
      amount: 8000,
      category: 'Trabajo Extra / Negocio',
      description: 'Consultoría técnica',
      date: '2026-09-08',
      paymentMethod: 'Transferencia Bancaria',
      createdAt: Date.now() - 15 * 86400000,
    },
    {
      id: 'tx-sep-2',
      monthKey: sepKey,
      type: 'expense',
      amount: 18000,
      category: 'Vivienda y Alquiler',
      description: 'Alquiler del mes',
      date: '2026-09-02',
      paymentMethod: 'Transferencia Bancaria',
      createdAt: Date.now() - 24 * 86400000,
    },
    {
      id: 'tx-sep-3',
      monthKey: sepKey,
      type: 'expense',
      amount: 12500,
      category: 'Alimentación y Supermercado',
      description: 'Compras del supermercado',
      date: '2026-09-12',
      paymentMethod: 'Tarjeta de Débito',
      createdAt: Date.now() - 14 * 86400000,
    },
    {
      id: 'tx-sep-4',
      monthKey: sepKey,
      type: 'expense',
      amount: 6200,
      category: 'Servicios (Luz, Agua, Internet)',
      description: 'Servicios básicos hogar',
      date: '2026-09-16',
      paymentMethod: 'Transferencia Bancaria',
      createdAt: Date.now() - 10 * 86400000,
    },
    {
      id: 'tx-sep-5',
      monthKey: sepKey,
      type: 'expense',
      amount: 4800,
      category: 'Transporte y Combustible',
      description: 'Gasolina mensual',
      date: '2026-09-20',
      paymentMethod: 'Tarjeta de Crédito',
      createdAt: Date.now() - 6 * 86400000,
    },
    {
      id: 'tx-sep-6',
      monthKey: sepKey,
      type: 'expense',
      amount: 3200,
      category: 'Entretenimiento y Salidas',
      description: 'Cena familiar de fin de semana',
      date: '2026-09-22',
      paymentMethod: 'Efectivo',
      createdAt: Date.now() - 4 * 86400000,
    },
    {
      id: 'tx-sep-savings-1',
      monthKey: sepKey,
      type: 'expense',
      amount: 8000,
      category: 'Aporte al Ahorro',
      description: 'Transferencia mensual a la alcancía',
      date: '2026-09-05',
      paymentMethod: 'Transferencia a Ahorro',
      relatedSavingsMovementId: 'sm-sep-1',
      createdAt: Date.now() - 21 * 86400000,
    },
  ];

  const savingsMovements: SavingsMovement[] = [
    {
      id: 'sm-aug-1',
      monthKey: augKey,
      type: 'deposit_from_month',
      amount: 10000,
      description: 'Aporte de ahorro de Agosto',
      date: '2026-08-25',
      createdAt: Date.now() - 25 * 86400000,
    },
    {
      id: 'sm-sep-1',
      monthKey: sepKey,
      type: 'deposit_from_month',
      amount: 8000,
      description: 'Transferencia mensual a la alcancía',
      date: '2026-09-05',
      createdAt: Date.now() - 21 * 86400000,
    },
    {
      id: 'sm-sep-2',
      monthKey: sepKey,
      type: 'direct_expense',
      amount: 2500,
      description: 'Compra de repuesto vehículo (Fondo Emergencia)',
      category: 'Transporte y Combustible',
      date: '2026-09-18',
      createdAt: Date.now() - 8 * 86400000,
    },
  ];

  const savingsGoals: SavingsGoal[] = [
    {
      id: 'goal-1',
      title: 'Fondo de Emergencia',
      targetAmount: 50000,
      currentAmount: 15500,
      targetDate: '2026-12-31',
      color: '#10b981',
    },
    {
      id: 'goal-2',
      title: 'Mantenimiento del Vehículo',
      targetAmount: 20000,
      currentAmount: 8000,
      targetDate: '2026-11-15',
      color: '#3b82f6',
    },
    {
      id: 'goal-3',
      title: 'Vacaciones de Fin de Año',
      targetAmount: 35000,
      currentAmount: 12000,
      targetDate: '2026-12-20',
      color: '#f59e0b',
    },
  ];

  return { monthConfigs, transactions, savingsMovements, savingsGoals };
};

export const storageService = {
  // Profile
  getProfile(): UserProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    return defaultProfile;
  },

  saveProfile(profile: UserProfile): void {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  },

  // Month configs
  getMonthConfigs(): Record<string, MonthConfig> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MONTH_CONFIGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    const seed = getInitialSeedData();
    localStorage.setItem(STORAGE_KEYS.MONTH_CONFIGS, JSON.stringify(seed.monthConfigs));
    return seed.monthConfigs;
  },

  getMonthConfig(monthKey: string): MonthConfig | null {
    const configs = this.getMonthConfigs();
    return configs[monthKey] || null;
  },

  saveMonthConfig(config: MonthConfig): void {
    const configs = this.getMonthConfigs();
    configs[config.monthKey] = config;
    localStorage.setItem(STORAGE_KEYS.MONTH_CONFIGS, JSON.stringify(configs));
  },

  // Transactions
  getTransactions(): Transaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    const seed = getInitialSeedData();
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(seed.transactions));
    return seed.transactions;
  },

  getTransactionsByMonth(monthKey: string): Transaction[] {
    const list = this.getTransactions();
    return list.filter((t) => t.monthKey === monthKey).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const list = this.getTransactions();
    const newTx: Transaction = {
      ...tx,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: Date.now(),
    };
    list.unshift(newTx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
    return newTx;
  },

  updateTransaction(tx: Transaction): void {
    const list = this.getTransactions();
    const idx = list.findIndex((t) => t.id === tx.id);
    if (idx !== -1) {
      list[idx] = tx;
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
    }
  },

  deleteTransaction(id: string): void {
    const list = this.getTransactions().filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
  },

  // Savings movements
  getSavingsMovements(): SavingsMovement[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVINGS_MOVEMENTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    const seed = getInitialSeedData();
    localStorage.setItem(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(seed.savingsMovements));
    return seed.savingsMovements;
  },

  addSavingsMovement(sm: Omit<SavingsMovement, 'id' | 'createdAt'>): SavingsMovement {
    const list = this.getSavingsMovements();
    const newSm: SavingsMovement = {
      ...sm,
      id: 'sm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: Date.now(),
    };
    list.unshift(newSm);
    localStorage.setItem(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(list));

    // When money is transferred to a specific savings goal, update the goal amount
    if (newSm.goalId && newSm.type === 'deposit_from_month') {
      const goals = this.getSavingsGoals();
      const goalIndex = goals.findIndex((g) => g.id === newSm.goalId);
      if (goalIndex !== -1) {
        goals[goalIndex].currentAmount = Math.max(0, (goals[goalIndex].currentAmount || 0) + newSm.amount);
        this.saveSavingsGoals(goals);
      }
    }

    // When money is transferred from the month to savings, also register as an expense in that month
    // under category 'Aporte al Ahorro' so it appears in 'Gasto por categorías'
    if (newSm.type === 'deposit_from_month') {
      this.addTransaction({
        monthKey: newSm.monthKey,
        type: 'expense',
        amount: newSm.amount,
        category: 'Aporte al Ahorro',
        description: newSm.description || 'Pase al Módulo de Ahorro',
        date: newSm.date,
        paymentMethod: 'Transferencia a Ahorro',
        relatedSavingsMovementId: newSm.id,
      });
    }

    return newSm;
  },

  deleteSavingsMovement(id: string): void {
    const list = this.getSavingsMovements();
    const target = list.find((m) => m.id === id);
    if (target && target.goalId && target.type === 'deposit_from_month') {
      const goals = this.getSavingsGoals();
      const goalIndex = goals.findIndex((g) => g.id === target.goalId);
      if (goalIndex !== -1) {
        goals[goalIndex].currentAmount = Math.max(0, (goals[goalIndex].currentAmount || 0) - target.amount);
        this.saveSavingsGoals(goals);
      }
    }

    const filtered = list.filter((m) => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(filtered));

    // Also remove any linked transaction in transactions list
    const txList = this.getTransactions().filter((t) => t.relatedSavingsMovementId !== id);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txList));
  },

  // Savings goals
  getSavingsGoals(): SavingsGoal[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SAVINGS_GOALS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    const seed = getInitialSeedData();
    localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(seed.savingsGoals));
    return seed.savingsGoals;
  },

  saveSavingsGoals(goals: SavingsGoal[]): void {
    localStorage.setItem(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(goals));
  },

  // Total savings vault calculation across all time
  getTotalSavingsVault(): number {
    const movements = this.getSavingsMovements();
    let total = 0;
    for (const m of movements) {
      if (m.type === 'deposit_from_month') {
        total += m.amount;
      } else if (m.type === 'withdraw_to_month' || m.type === 'direct_expense') {
        total -= m.amount;
      }
    }
    return Math.max(0, total);
  },

  // Calculate financial summary for a specific month
  getFinancialSummary(monthKey: string): FinancialSummary {
    const config = this.getMonthConfig(monthKey);
    const initialIncome = config ? config.initialIncome : 0;
    const carryover = config ? config.carryoverFromPrev : 0;

    const txs = this.getTransactionsByMonth(monthKey);
    let totalAdditionalIncome = 0;
    let totalExpenses = 0;

    for (const t of txs) {
      if (t.type === 'income') {
        totalAdditionalIncome += t.amount;
      } else if (t.type === 'expense') {
        totalExpenses += t.amount;
      }
    }

    const savingsMovs = this.getSavingsMovements().filter((m) => m.monthKey === monthKey);
    let savingsTransfersTo = 0;
    let savingsTransfersFrom = 0;
    let savingsDirectExpenses = 0;

    for (const sm of savingsMovs) {
      if (sm.type === 'deposit_from_month') {
        savingsTransfersTo += sm.amount;
      } else if (sm.type === 'withdraw_to_month') {
        savingsTransfersFrom += sm.amount;
      } else if (sm.type === 'direct_expense') {
        savingsDirectExpenses += sm.amount;
      }
    }

    const totalIncome = initialIncome + carryover + totalAdditionalIncome + savingsTransfersFrom;
    // Since deposit_from_month movements are now tracked as category 'Aporte al Ahorro' in transactions (totalExpenses),
    // we subtract totalExpenses without subtracting savingsTransfersTo twice.
    const availableBalance = totalIncome - totalExpenses;
    const totalSavingsVault = this.getTotalSavingsVault();

    return {
      initialIncome,
      carryover,
      totalAdditionalIncome,
      totalIncome,
      totalExpenses,
      savingsTransfersTo,
      savingsTransfersFrom,
      availableBalance,
      totalSavingsVault,
      savingsDirectExpenses,
    };
  },

  // Calculate remaining balance of the previous month
  getPreviousMonthRemaining(year: number, month: number): number {
    const { key: prevKey } = getPrevMonthKey(year, month);
    const summary = this.getFinancialSummary(prevKey);
    return Math.max(0, summary.availableBalance);
  },

  // Security Lock
  isAppLocked(): boolean {
    const profile = this.getProfile();
    if (!profile.pinLockEnabled && !profile.biometricsEnabled) return false;
    return sessionStorage.getItem(STORAGE_KEYS.APP_LOCKED) !== 'unlocked';
  },

  setAppUnlocked(): void {
    sessionStorage.setItem(STORAGE_KEYS.APP_LOCKED, 'unlocked');
  },

  setAppLocked(): void {
    sessionStorage.removeItem(STORAGE_KEYS.APP_LOCKED);
  },

  // Reset or clear all data
  resetAllData(): void {
    localStorage.clear();
    sessionStorage.clear();
  },
};

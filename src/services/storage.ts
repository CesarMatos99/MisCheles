import { calculateFinancialSummary } from '../domain/financialSummary.ts';
import { currencyDisplayFromCode } from '../domain/currency.ts';
import { calculateSavingsVaultBalance } from '../domain/financialSummary.ts';
import { deriveSavingsGoalBalance, savingsGoalOpeningBalance } from '../domain/savingsBalance';
import { savingsGoalDeletionKeys } from '../../shared/savingsGoalDeletion.ts';
import type {
  Transaction,
  SavingsMovement,
  SavingsGoal,
  MonthConfig,
  UserProfile,
  FinancialSummary,
} from '../types';

const STORAGE_KEYS = {
  TRANSACTIONS: 'mischeles_transactions_v3',
  SAVINGS_MOVEMENTS: 'mischeles_savings_movements_v3',
  SAVINGS_GOALS: 'mischeles_savings_goals_v3',
  MONTH_CONFIGS: 'mischeles_month_configs_v2',
  CATEGORY_BUDGETS: 'mischeles_category_budgets_v1',
  USER_PROFILE: 'mischeles_user_profile_v2',
  APP_THEME: 'mischeles_theme_v2',
  APP_LOCKED: 'mischeles_locked_v2',
};

const ACTIVE_ACCOUNT_SCOPE_KEY = 'mischeles_active_account_scope_v1';
const SCOPED_STORAGE_KEYS = new Set<string>(Object.values(STORAGE_KEYS));
function readInitialStorageScope(): string {
  // Never trust a persisted account selector before Firebase confirms the signed-in UID.
  try { localStorage.removeItem(ACTIVE_ACCOUNT_SCOPE_KEY); } catch { /* Storage can be unavailable. */ }
  return 'local';
}
let activeStorageScope = readInitialStorageScope();
function scopedStorageKey(key: string): string {
  if (activeStorageScope === 'local') return key;
  if (activeStorageScope === 'demo') return 'mischeles_demo_' + key;
  return 'mischeles_scope_' + activeStorageScope.slice('account:'.length) + '_' + key;
}
function readAppValue(key: string): string | null { return localStorage.getItem(scopedStorageKey(key)); }
function writeAppValue(key: string, value: string): void { localStorage.setItem(scopedStorageKey(key), value); }
export function setStorageScope(scope: 'local' | 'demo' | { accountUid: string }): void {
  const next = scope === 'local' || scope === 'demo' ? scope : 'account:' + scope.accountUid;
  if (next === activeStorageScope) return;
  activeStorageScope = next;
  try { localStorage.removeItem(ACTIVE_ACCOUNT_SCOPE_KEY); } catch { /* Scope remains valid for this session if storage is unavailable. */ }
  notifyStorageMutation('userSettings', 'storage-scope', 'upsert', 'remote');
}
export function getScopedStorageReader(): Pick<Storage, 'getItem'> { return { getItem: (key) => SCOPED_STORAGE_KEYS.has(key) ? readAppValue(key) : localStorage.getItem(key) }; }

/** Removes only the client-side mirror belonging to one verified account UID. */
export function clearAccountScope(uid: string): void {
  if (!uid || uid.includes('/')) throw new Error('Invalid account UID.');
  const prefix = 'mischeles_scope_' + uid + '_';
  try {
    for (const key of SCOPED_STORAGE_KEYS) localStorage.removeItem(prefix + key);
  } catch {
    throw new Error('The local account copy could not be cleared.');
  }
}

export function preferredUnauthenticatedScope(): 'local' | 'demo' {
  try { return localStorage.getItem('mischeles_web_mode_v1') === 'demo' ? 'demo' : 'local'; }
  catch { return 'local'; }
}


export type SyncCollection = 'transactions' | 'savingsMovements' | 'savingsGoals' | 'monthConfigurations' | 'categoryBudgets' | 'userSettings';
export interface StorageMutation {
  collection: SyncCollection;
  sourceId: string;
  operation: 'upsert' | 'delete';
  origin: 'local' | 'remote';
  expectedRevision?: string | null;
  deletedRecord?: Record<string, unknown>;
}
const STORAGE_MUTATION_EVENT = 'mischeles:storage-mutation';
export function notifyStorageMutation(collection: SyncCollection, sourceId: string, operation: 'upsert' | 'delete' = 'upsert', origin: 'local' | 'remote' = 'local', deletedRecord?: Record<string, unknown>) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<StorageMutation>(STORAGE_MUTATION_EVENT, { detail: { collection, sourceId, operation, origin, ...(operation === 'delete' ? { expectedRevision: typeof deletedRecord?._cloudRevision === 'string' ? deletedRecord._cloudRevision : null, deletedRecord } : {}) } }));
}
export const storageMutationEvent = STORAGE_MUTATION_EVENT;

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

let pendingLegacyLockPin = '';

export const defaultProfile: UserProfile = {
  name: 'César Matos',
  email: 'cesarmatos99@gmail.com',
  photoUrl: '',
  currency: 'RD$',
  biometricsEnabled: false,
  pinLockEnabled: false,
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
      category: 'Energía eléctrica',
      description: 'Pago de electricidad',
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
      amount: 15500,
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
      description: 'Pago de electricidad',
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
      amount: 10500,
      category: 'Aporte al Ahorro',
      description: 'Transferencia mensual a la alcancía',
      date: '2026-09-05',
      paymentMethod: 'Transferencia a Ahorro',
      relatedSavingsMovementId: 'sm-sep-1',
      createdAt: Date.now() - 21 * 86400000,
    },
    {
      id: 'tx-sep-savings-2',
      monthKey: sepKey,
      type: 'expense',
      amount: 12000,
      category: 'Aporte al Ahorro',
      description: 'Aporte para Vacaciones de Fin de Año',
      date: '2026-09-25',
      paymentMethod: 'Transferencia a Ahorro',
      relatedSavingsMovementId: 'sm-sep-3',
      createdAt: Date.now() - 2 * 86400000,
    },
  ];

  const savingsMovements: SavingsMovement[] = [
    {
      id: 'sm-aug-1',
      monthKey: augKey,
      type: 'deposit_from_month',
      amount: 15500,
      description: 'Aporte de ahorro de Agosto',
      goalId: 'goal-1',
      goalTitle: 'Fondo de Emergencia',
      destinationType: 'goal',
      date: '2026-08-25',
      createdAt: Date.now() - 25 * 86400000,
    },
    {
      id: 'sm-sep-1',
      monthKey: sepKey,
      type: 'deposit_from_month',
      amount: 10500,
      description: 'Aporte a Mantenimiento del Vehículo',
      goalId: 'goal-2',
      goalTitle: 'Mantenimiento del Vehículo',
      destinationType: 'goal',
      date: '2026-09-05',
      createdAt: Date.now() - 21 * 86400000,
    },
    {
      id: 'sm-sep-2',
      monthKey: sepKey,
      type: 'direct_expense',
      amount: 2500,
      description: 'Compra de repuesto vehículo (Mantenimiento del Vehículo)',
      goalId: 'goal-2',
      goalTitle: 'Mantenimiento del Vehículo',
      destinationType: 'goal',
      category: 'Transporte y Combustible',
      date: '2026-09-18',
      createdAt: Date.now() - 8 * 86400000,
    },
    {
      id: 'sm-sep-3',
      monthKey: sepKey,
      type: 'deposit_from_month',
      amount: 12000,
      description: 'Aporte para Vacaciones de Fin de Año',
      goalId: 'goal-3',
      goalTitle: 'Vacaciones de Fin de Año',
      destinationType: 'goal',
      date: '2026-09-25',
      createdAt: Date.now() - 2 * 86400000,
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


function rawArray<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(readAppValue(key) || '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch { return []; }
}
function mergeRemoteRecords<T extends Record<string, unknown>>(local: T[], remote: T[], idOf: (item: T) => string, previousRemoteIds: Set<string>, protectedIds: Set<string> = new Set()): T[] {
  const remoteIds = new Set(remote.map(idOf));
  const merged = new Map<string, T>();
  for (const item of local) {
    const id = idOf(item);
    if (id && (!previousRemoteIds.has(id) || remoteIds.has(id) || protectedIds.has(id))) merged.set(id, item);
  }
  for (const item of remote) {
    const id = idOf(item);
    if (id && !(protectedIds.has(id) && merged.has(id))) merged.set(id, item);
  }
  return [...merged.values()];
}

export const storageService = {
  // Profile
  getProfile(): UserProfile {
    try {
      const data = readAppValue(STORAGE_KEYS.USER_PROFILE);
      if (data) {
        const stored = JSON.parse(data) as UserProfile & { pinCode?: string };
        if (stored.pinCode) pendingLegacyLockPin = stored.pinCode;
        const safe = { ...stored, biometricsEnabled: false } as UserProfile & { pinCode?: string };
        delete safe.pinCode;
        if (stored.pinLockEnabled && !stored.pinCode && !pendingLegacyLockPin) safe.pinLockEnabled = false;
        writeAppValue(STORAGE_KEYS.USER_PROFILE, JSON.stringify(safe));
        return safe;
      }
    } catch (e) {
      console.error(e);
    }
    if (activeStorageScope === 'demo') return { ...defaultProfile, biometricsEnabled: false, pinLockEnabled: false };
    return { ...defaultProfile, name: '', email: '', photoUrl: '', biometricsEnabled: false, pinLockEnabled: false, monthlyTargetIncome: 0 };
  },

  saveProfile(profile: UserProfile): void {
    const safe = { ...profile, biometricsEnabled: false } as UserProfile & { pinCode?: string };
    delete safe.pinCode;
    writeAppValue(STORAGE_KEYS.USER_PROFILE, JSON.stringify(safe));
    notifyStorageMutation('userSettings', 'profile');
  },

  takeLegacyLockPin(): string | null { const pin = pendingLegacyLockPin; pendingLegacyLockPin = ''; return pin || null; },

  // Month configs
  getMonthConfigs(): Record<string, MonthConfig> {
    try {
      const data = readAppValue(STORAGE_KEYS.MONTH_CONFIGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    if (activeStorageScope !== 'demo') return {};
    const seed = getInitialSeedData();
    writeAppValue(STORAGE_KEYS.MONTH_CONFIGS, JSON.stringify(seed.monthConfigs));
    return seed.monthConfigs;
  },

  getMonthConfig(monthKey: string): MonthConfig | null {
    const configs = this.getMonthConfigs();
    return configs[monthKey] || null;
  },

  saveMonthConfig(config: MonthConfig): void {
    const configs = this.getMonthConfigs();
    configs[config.monthKey] = { ...(configs[config.monthKey] || {}), ...config };
    writeAppValue(STORAGE_KEYS.MONTH_CONFIGS, JSON.stringify(configs));
    notifyStorageMutation('monthConfigurations', config.monthKey);
  },

  // Monthly category budgets
  getCategoryBudgets(monthKey: string): ({ category: string; amount: number } & Record<string, unknown>)[] {
    try {
      const data = readAppValue(STORAGE_KEYS.CATEGORY_BUDGETS);
      if (!data) return [];
      const byMonth = JSON.parse(data) as Record<string, unknown>;
      const budgets = byMonth[monthKey];
      if (!Array.isArray(budgets)) return [];
      return budgets.filter((budget): budget is { category: string; amount: number } & Record<string, unknown> =>
        Boolean(budget)
        && typeof budget.category === 'string'
        && budget.category.trim().length > 0
        && budget.category.trim() !== 'Servicios (Luz, Agua, Internet)'
        && typeof budget.amount === 'number'
        && Number.isFinite(budget.amount)
        && budget.amount > 0,
      );
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  getAllCategoryBudgets(): Record<string, ({ category: string; amount: number } & Record<string, unknown>)[]> {
    try {
      const data = readAppValue(STORAGE_KEYS.CATEGORY_BUDGETS);
      if (!data) return {};
      const byMonth = JSON.parse(data) as Record<string, unknown>;
      return Object.fromEntries(Object.keys(byMonth).map((key) => [key, this.getCategoryBudgets(key)]));
    } catch (e) {
      console.error(e);
      return {};
    }
  },

  saveCategoryBudgets(monthKey: string, budgets: { category: string; amount: number }[]): void {
    let byMonth: Record<string, unknown> = {};
    try {
      const data = readAppValue(STORAGE_KEYS.CATEGORY_BUDGETS);
      if (data) byMonth = JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    const previous = Array.isArray(byMonth[monthKey]) ? byMonth[monthKey] as ({ category: string; amount: number } & Record<string, unknown>)[] : [];
    const previousByCategory = new Map(previous.map((budget) => [budget.category, budget]));
    const preserved = budgets.map((budget) => ({ ...(previousByCategory.get(budget.category) || {}), ...budget }));
    byMonth[monthKey] = preserved;
    writeAppValue(STORAGE_KEYS.CATEGORY_BUDGETS, JSON.stringify(byMonth));
    const currentCategories = new Set(budgets.map((budget) => budget.category));
    for (const budget of previous) if (!currentCategories.has(budget.category)) notifyStorageMutation('categoryBudgets', monthKey + ':' + budget.category, 'delete', 'local', budget);
    for (const budget of preserved) notifyStorageMutation('categoryBudgets', monthKey + ':' + budget.category);
  },

  // Transactions
  getTransactions(): Transaction[] {
    try {
      const data = readAppValue(STORAGE_KEYS.TRANSACTIONS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    if (activeStorageScope !== 'demo') return [];
    const seed = getInitialSeedData();
    writeAppValue(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(seed.transactions));
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
    writeAppValue(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
    notifyStorageMutation('transactions', newTx.id);
    return newTx;
  },

  updateTransaction(tx: Transaction): void {
    const list = this.getTransactions();
    const idx = list.findIndex((t) => t.id === tx.id);
    if (idx !== -1) {
      const previous = list[idx];
      const savings = this.getSavingsMovements();
      const linked = previous.relatedSavingsMovementId
        ? savings.find(movement => movement.id === previous.relatedSavingsMovementId && movement.type === 'deposit_from_month')
        : undefined;
      if (linked) {
        if (!Number.isFinite(tx.amount) || tx.amount <= 0) throw new Error('El aporte debe tener un monto válido mayor que cero.');
        const delta = tx.amount - linked.amount;
        const updated = { ...linked, amount: tx.amount, date: tx.date, description: tx.description, monthKey: tx.monthKey };
        const nextSavings = savings.map(movement => movement.id === linked.id ? updated : movement);
        if (linked.goalId && !activeStorageScope.startsWith('account:')) {
          const goals = this.getSavingsGoals();
          const currentGoal = goals.find(goal => goal.id === linked.goalId);
          if (currentGoal && currentGoal.currentAmount + delta < 0) throw new Error('El aporte no puede reducirse por debajo del dinero ya retirado de la meta.');
          this.saveSavingsGoals(goals.map(goal => goal.id === linked.goalId
            ? { ...goal, currentAmount: Math.max(0, goal.currentAmount + delta) } : goal));
        }
        writeAppValue(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(nextSavings));
        notifyStorageMutation('savingsMovements', linked.id);
        tx = { ...tx, type: 'expense', category: 'Aporte al Ahorro', relatedSavingsMovementId: linked.id };
      }
      list[idx] = tx;
      writeAppValue(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
      notifyStorageMutation('transactions', tx.id);
    }
  },

  deleteTransaction(id: string): void {
    const previous = this.getTransactions();
    const deleted = previous.find((item) => item.id === id);
    const linked = deleted?.relatedSavingsMovementId;
    if (linked && this.getSavingsMovements().some(movement => movement.id === linked && movement.type === 'deposit_from_month')) {
      this.deleteSavingsMovement(linked);
      return;
    }
    const list = previous.filter((t) => t.id !== id);
    writeAppValue(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
    notifyStorageMutation('transactions', id, 'delete', 'local', deleted as unknown as Record<string, unknown>);
  },

  // Savings movements
  getSavingsMovements(): SavingsMovement[] {
    try {
      const data = readAppValue(STORAGE_KEYS.SAVINGS_MOVEMENTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    if (activeStorageScope !== 'demo') return [];
    const seed = getInitialSeedData();
    writeAppValue(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(seed.savingsMovements));
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
    writeAppValue(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(list));
    notifyStorageMutation('savingsMovements', newSm.id);

    // Local/demo goal records mirror their full balance. Account records store an opening
    // balance and derive the current balance from this ledger to avoid double counting.
    if (newSm.goalId && !activeStorageScope.startsWith('account:')) {
      const goals = this.getSavingsGoals();
      const goalIndex = goals.findIndex((g) => g.id === newSm.goalId);
      if (goalIndex !== -1) {
        const direction = newSm.type === 'deposit_from_month' ? 1 : -1;
        goals[goalIndex].currentAmount = Math.max(0, (goals[goalIndex].currentAmount || 0) + direction * newSm.amount);
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
    if (target?.type === 'deposit_from_month' && target.balanceAffecting !== false) {
      const goal = target.goalId ? this.getSavingsGoals().find(item => item.id === target.goalId) : undefined;
      if (Math.round(this.getTotalSavingsVault() * 100) < Math.round(target.amount * 100) ||
          (goal && Math.round(goal.currentAmount * 100) < Math.round(target.amount * 100))) {
        throw new Error('No se puede eliminar este aporte: parte del dinero ya se retiró o gastó. Corrige primero esos movimientos.');
      }
    }
    if (target?.goalId && !activeStorageScope.startsWith('account:')) {
      const goals = this.getSavingsGoals();
      const goalIndex = goals.findIndex((g) => g.id === target.goalId);
      if (goalIndex !== -1) {
        const direction = target.type === 'deposit_from_month' ? -1 : 1;
        goals[goalIndex].currentAmount = Math.max(0, (goals[goalIndex].currentAmount || 0) + direction * target.amount);
        this.saveSavingsGoals(goals);
      }
    }

    const filtered = list.filter((m) => m.id !== id);
    writeAppValue(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(filtered));
    notifyStorageMutation('savingsMovements', id, 'delete', 'local', target as unknown as Record<string, unknown>);

    // Also remove any linked transaction in transactions list
    const transactions = this.getTransactions();
    const linkedTransactions = transactions.filter((transaction) => transaction.relatedSavingsMovementId === id);
    writeAppValue(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions.filter((transaction) => transaction.relatedSavingsMovementId !== id)));
    for (const transaction of linkedTransactions) notifyStorageMutation('transactions', transaction.id, 'delete', 'local', transaction as unknown as Record<string, unknown>);
  },

  deleteSavingsGoal(
    id: string,
    resolution: 'general' | 'month' | 'fictional',
    monthKey: string,
  ): void {
    const goals = this.getSavingsGoals();
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;

    const movements = this.getSavingsMovements();
    const linkedMovements = movements.filter((movement) => movement.goalId === id);

    if (resolution === 'fictional') {
      const allTransactions = this.getTransactions();
      const deletionKeys = savingsGoalDeletionKeys(id, [
        ...movements.map((movement) => ({
          collection: 'savingsMovements' as const,
          id: movement.id,
          savingsGoalId: movement.goalId,
        })),
        ...allTransactions.map((transaction) => ({
          collection: 'transactions' as const,
          id: transaction.id,
          relatedSavingsMovementId: transaction.relatedSavingsMovementId,
        })),
      ]);
      this.saveSavingsMovements(movements.filter((movement) =>
        !deletionKeys.has('savingsMovements:' + movement.id),
      ));
      const deletedTransactions = allTransactions.filter((transaction) =>
        deletionKeys.has('transactions:' + transaction.id),
      );
      writeAppValue(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(allTransactions.filter((transaction) =>
        !deletionKeys.has('transactions:' + transaction.id),
      )));
      for (const transaction of deletedTransactions) notifyStorageMutation('transactions', transaction.id, 'delete');
    } else {
      const reassignedMovements = movements.map((movement) =>
        movement.goalId === id
          ? { ...movement, goalId: undefined, destinationType: 'general' as const, balanceAffecting: false }
          : movement,
      );
      this.saveSavingsMovements(reassignedMovements);

      if (goal.currentAmount > 0) {
        this.addSavingsMovement({
          monthKey,
          type: resolution === 'general' ? 'goal_to_general' : 'withdraw_to_month',
          amount: goal.currentAmount,
          description: resolution === 'general'
            ? 'Saldo reasignado al ahorro general al cerrar la meta: ' + goal.title
            : 'Saldo transferido al mes al cerrar la meta: ' + goal.title,
          destinationType: 'general',
          date: new Date().toISOString().slice(0, 10),
        });
      }
    }

    this.saveSavingsGoals(goals.filter((item) => item.id !== id));
  },

  saveSavingsMovements(movements: SavingsMovement[]): void {
    const previous = this.getSavingsMovements();
    const nextIds = new Set(movements.map((movement) => movement.id));
    writeAppValue(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(movements));
    for (const movement of previous) if (!nextIds.has(movement.id)) notifyStorageMutation('savingsMovements', movement.id, 'delete', 'local', movement as unknown as Record<string, unknown>);
    for (const movement of movements) notifyStorageMutation('savingsMovements', movement.id);
  },

  // Savings goals
  getSavingsGoals(): SavingsGoal[] {
    try {
      const data = readAppValue(STORAGE_KEYS.SAVINGS_GOALS);
      if (data) {
        const goals = JSON.parse(data) as SavingsGoal[];
        if (!activeStorageScope.startsWith('account:')) return goals;
        const movements = this.getSavingsMovements();
        return goals.map((goal) => ({ ...goal, currentAmount: deriveSavingsGoalBalance(goal, movements) }));
      }
    } catch (e) {
      console.error(e);
    }
    if (activeStorageScope !== 'demo') return [];
    const seed = getInitialSeedData();
    writeAppValue(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(seed.savingsGoals));
    return seed.savingsGoals;
  },

  saveSavingsGoals(goals: SavingsGoal[]): void {
    const previous = this.getSavingsGoals();
    const nextIds = new Set(goals.map((goal) => goal.id));
    const persistedGoals = activeStorageScope.startsWith('account:')
      ? goals.map((goal) => savingsGoalOpeningBalance(goal, goal.currentAmount, this.getSavingsMovements()))
      : goals;
    writeAppValue(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(persistedGoals));
    for (const goal of previous) if (!nextIds.has(goal.id)) notifyStorageMutation('savingsGoals', goal.id, 'delete', 'local', goal as unknown as Record<string, unknown>);
    for (const goal of goals) notifyStorageMutation('savingsGoals', goal.id);
  },

  // The vault is the sum of goal balances plus unassigned general savings.
  getTotalSavingsVault(): number {
    return calculateSavingsVaultBalance(this.getSavingsGoals(), this.getSavingsMovements(), this.getTransactions());
  },


  /** Stores the cloud revision alongside a local record without scheduling another upload. */
  setCloudRevision(collection: SyncCollection, sourceId: string, revision: string | null): void {
    if (collection === 'userSettings') return;
    const setRevision = <T extends Record<string, unknown>>(items: T[], matches: (item: T) => boolean) => {
      let changed = false;
      const next = items.map((item) => {
        if (!matches(item)) return item;
        const updated = { ...item } as T & { _cloudRevision?: string };
        if (revision === null) delete updated._cloudRevision;
        else updated._cloudRevision = revision;
        changed = true;
        return updated;
      });
      return { next, changed };
    };
    if (collection === 'transactions' || collection === 'savingsMovements' || collection === 'savingsGoals') {
      const key = collection === 'transactions' ? STORAGE_KEYS.TRANSACTIONS : collection === 'savingsMovements' ? STORAGE_KEYS.SAVINGS_MOVEMENTS : STORAGE_KEYS.SAVINGS_GOALS;
      const { next, changed } = setRevision(rawArray<Record<string, unknown>>(key), (item) => String(item.id || '') === sourceId);
      if (changed) writeAppValue(key, JSON.stringify(next));
      return;
    }
    if (collection === 'monthConfigurations') {
      const configs = (() => { try { return JSON.parse(readAppValue(STORAGE_KEYS.MONTH_CONFIGS) || '{}') as Record<string, Record<string, unknown>>; } catch { return {}; } })();
      const current = configs[sourceId];
      if (!current) return;
      if (revision === null) delete current._cloudRevision;
      else current._cloudRevision = revision;
      writeAppValue(STORAGE_KEYS.MONTH_CONFIGS, JSON.stringify(configs));
      return;
    }
    const separator = sourceId.indexOf(':');
    if (separator < 0) return;
    const monthKey = sourceId.slice(0, separator);
    const category = sourceId.slice(separator + 1);
    const byMonth = (() => { try { return JSON.parse(readAppValue(STORAGE_KEYS.CATEGORY_BUDGETS) || '{}') as Record<string, Record<string, unknown>[]>; } catch { return {}; } })();
    const budgets = byMonth[monthKey] || [];
    const { next, changed } = setRevision(budgets, (item) => String(item.category || '') === category);
    if (changed) { byMonth[monthKey] = next; writeAppValue(STORAGE_KEYS.CATEGORY_BUDGETS, JSON.stringify(byMonth)); }
  },

  /** Applies a cloud snapshot without emitting local-upload events or erasing unrelated local records. */
  applyCloudSnapshot(collection: SyncCollection, remoteItems: Record<string, unknown>[], previouslyRemoteIds: Set<string>, protectedLocalIds: Set<string> = new Set()): void {
    const idOf = (item: Record<string, unknown>) => String(item.id || '');
    if (collection === 'transactions') {
      const merged = mergeRemoteRecords(rawArray<Transaction>(STORAGE_KEYS.TRANSACTIONS) as unknown as Record<string, unknown>[], remoteItems, idOf, previouslyRemoteIds, protectedLocalIds);
      writeAppValue(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(merged));
    } else if (collection === 'savingsMovements') {
      const merged = mergeRemoteRecords(rawArray<SavingsMovement>(STORAGE_KEYS.SAVINGS_MOVEMENTS) as unknown as Record<string, unknown>[], remoteItems, idOf, previouslyRemoteIds, protectedLocalIds);
      writeAppValue(STORAGE_KEYS.SAVINGS_MOVEMENTS, JSON.stringify(merged));
    } else if (collection === 'savingsGoals') {
      const merged = mergeRemoteRecords(rawArray<SavingsGoal>(STORAGE_KEYS.SAVINGS_GOALS) as unknown as Record<string, unknown>[], remoteItems, idOf, previouslyRemoteIds, protectedLocalIds);
      writeAppValue(STORAGE_KEYS.SAVINGS_GOALS, JSON.stringify(merged));
    } else if (collection === 'monthConfigurations') {
      const local = Object.values((() => { try { return JSON.parse(readAppValue(STORAGE_KEYS.MONTH_CONFIGS) || '{}') as Record<string, MonthConfig>; } catch { return {}; } })()) as unknown as Record<string, unknown>[];
      const merged = mergeRemoteRecords(local, remoteItems, (item) => String(item.monthKey || ''), previouslyRemoteIds, protectedLocalIds);
      writeAppValue(STORAGE_KEYS.MONTH_CONFIGS, JSON.stringify(Object.fromEntries(merged.map((item) => [String(item.monthKey), item]))));
    } else if (collection === 'categoryBudgets') {
      let localByMonth: Record<string, { category: string; amount: number }[]> = {};
      try { localByMonth = JSON.parse(readAppValue(STORAGE_KEYS.CATEGORY_BUDGETS) || '{}'); } catch { localByMonth = {}; }
      const local = Object.entries(localByMonth).flatMap(([monthKey, budgets]) => budgets.map((budget) => ({ ...budget, monthKey }))) as unknown as Record<string, unknown>[];
      const sourceId = (item: Record<string, unknown>) => String(item.monthKey || '') + ':' + String(item.category || item.categoryName || '');
      const merged = mergeRemoteRecords(local, remoteItems, sourceId, previouslyRemoteIds, protectedLocalIds);
      const next: Record<string, ({ category: string; amount: number } & Record<string, unknown>)[]> = {};
      for (const item of merged) { const monthKey = String(item.monthKey || ''); (next[monthKey] ||= []).push({ ...item, category: String(item.category || item.categoryName || ''), amount: Number(item.amount) || 0 }); }
      writeAppValue(STORAGE_KEYS.CATEGORY_BUDGETS, JSON.stringify(next));
    } else if (collection === 'userSettings') {
      const settings = remoteItems[0];
      if (settings) {
        const current = this.getProfile();
        const updated = { ...current, name: String(settings.displayName || current.name), currency: currencyDisplayFromCode(settings.preferredCurrency, current.currency) };
        writeAppValue(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
        if (typeof settings.theme === 'string') localStorage.setItem('presucontrol_theme_v1', settings.theme);
        if (typeof settings.accentColor === 'string') localStorage.setItem('mischeles_accent_v2', settings.accentColor);
        if (settings.language === 'es' || settings.language === 'en') localStorage.setItem('mischeles_language_v1', settings.language);
      }
    }
    notifyStorageMutation(collection, '*', 'upsert', 'remote');
  },

  // Calculate financial summary for a specific month
  getFinancialSummary(monthKey: string): FinancialSummary {
    const config = this.getMonthConfig(monthKey);
    return calculateFinancialSummary({
      monthKey,
      initialIncome: config?.initialIncome || 0,
      carryover: config?.carryoverFromPrev || 0,
      transactions: this.getTransactionsByMonth(monthKey),
      savingsMovements: this.getSavingsMovements().filter((movement) => movement.monthKey === monthKey),
      totalSavingsVault: this.getTotalSavingsVault(),
    });
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
    if (activeStorageScope.startsWith('account:')) throw new Error('Los datos de una cuenta requieren el flujo específico de gestión de cuenta.');
    for (const key of SCOPED_STORAGE_KEYS) localStorage.removeItem(scopedStorageKey(key));
    sessionStorage.removeItem(STORAGE_KEYS.APP_LOCKED);
  },
};

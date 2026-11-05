import type { CategoryBudget, FinancialSummary, MonthConfig, SavingsGoal, SavingsMovement, Transaction, UserProfile } from '../types';

/** Application port for financial data. UI and use cases depend on this contract, not browser storage. */
export interface FinanceRepository {
  getProfile(): UserProfile; saveProfile(profile: UserProfile): void; takeLegacyLockPin(): string | null;
  getMonthConfigs(): Record<string, MonthConfig>; getMonthConfig(monthKey: string): MonthConfig | null; saveMonthConfig(config: MonthConfig): void;
  getCategoryBudgets(monthKey: string): CategoryBudget[]; getAllCategoryBudgets(): Record<string, CategoryBudget[]>; saveCategoryBudgets(monthKey: string, budgets: CategoryBudget[]): void;
  getTransactions(): Transaction[]; getTransactionsByMonth(monthKey: string): Transaction[]; addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Transaction; updateTransaction(transaction: Transaction): void; deleteTransaction(id: string): void;
  getSavingsMovements(): SavingsMovement[]; addSavingsMovement(movement: Omit<SavingsMovement, 'id' | 'createdAt'>): SavingsMovement; deleteSavingsMovement(id: string): void; saveSavingsMovements(movements: SavingsMovement[]): void;
  getSavingsGoals(): SavingsGoal[]; saveSavingsGoals(goals: SavingsGoal[]): void; deleteSavingsGoal(id: string, resolution: 'general' | 'month' | 'fictional', monthKey: string): void;
  getTotalSavingsVault(): number; getFinancialSummary(monthKey: string): FinancialSummary; getPreviousMonthRemaining(year: number, month: number): number;
  isAppLocked(): boolean; setAppLocked(): void; setAppUnlocked(): void; resetAllData(): void;
}

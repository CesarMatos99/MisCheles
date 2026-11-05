import type { FinanceRepository } from './FinanceRepository';
import { StorageFinanceRepository } from '../infrastructure/StorageFinanceRepository';
import type { CategoryBudget, MonthConfig, SavingsGoal, SavingsMovement, Transaction, UserProfile } from '../types';

/** Use-case facade consumed by React screens. Persistence is replaceable through FinanceRepository. */
export class FinanceApplication {
  constructor(private readonly repository: FinanceRepository) {}
  getProfile(): UserProfile { return this.repository.getProfile(); }
  saveProfile(value: UserProfile): void { this.repository.saveProfile(value); }
  getMonthConfigs(): Record<string, MonthConfig> { return this.repository.getMonthConfigs(); }
  getMonthConfig(key: string): MonthConfig | null { return this.repository.getMonthConfig(key); }
  saveMonthConfig(value: MonthConfig): void { this.repository.saveMonthConfig(value); }
  getCategoryBudgets(key: string): CategoryBudget[] { return this.repository.getCategoryBudgets(key); }
  getAllCategoryBudgets(): Record<string, CategoryBudget[]> { return this.repository.getAllCategoryBudgets(); }
  saveCategoryBudgets(key: string, values: CategoryBudget[]): void { this.repository.saveCategoryBudgets(key, values); }
  getTransactions(): Transaction[] { return this.repository.getTransactions(); }
  getTransactionsByMonth(key: string): Transaction[] { return this.repository.getTransactionsByMonth(key); }
  addTransaction(value: Omit<Transaction, 'id' | 'createdAt'>): Transaction { return this.repository.addTransaction(value); }
  updateTransaction(value: Transaction): void { this.repository.updateTransaction(value); }
  deleteTransaction(id: string): void { this.repository.deleteTransaction(id); }
  getSavingsMovements(): SavingsMovement[] { return this.repository.getSavingsMovements(); }
  addSavingsMovement(value: Omit<SavingsMovement, 'id' | 'createdAt'>): SavingsMovement { return this.repository.addSavingsMovement(value); }
  deleteSavingsMovement(id: string): void { this.repository.deleteSavingsMovement(id); }
  saveSavingsMovements(values: SavingsMovement[]): void { this.repository.saveSavingsMovements(values); }
  getSavingsGoals(): SavingsGoal[] { return this.repository.getSavingsGoals(); }
  saveSavingsGoals(values: SavingsGoal[]): void { this.repository.saveSavingsGoals(values); }
  deleteSavingsGoal(id: string, resolution: 'general' | 'month' | 'fictional', monthKey: string): void { this.repository.deleteSavingsGoal(id, resolution, monthKey); }
  getTotalSavingsVault(): number { return this.repository.getTotalSavingsVault(); }
  getFinancialSummary(key: string) { return this.repository.getFinancialSummary(key); }
  getPreviousMonthRemaining(year: number, month: number): number { return this.repository.getPreviousMonthRemaining(year, month); }
  isAppLocked(): boolean { return this.repository.isAppLocked(); }
  setAppLocked(): void { this.repository.setAppLocked(); }
  setAppUnlocked(): void { this.repository.setAppUnlocked(); }
  resetAllData(): void { this.repository.resetAllData(); }
}

/** Web composition root. Tests can construct FinanceApplication with an isolated repository. */
export const financeApplication = new FinanceApplication(new StorageFinanceRepository());

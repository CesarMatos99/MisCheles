import { storageService } from '../services/storage';
import type { FinanceRepository } from '../application/FinanceRepository';
import type { CategoryBudget, FinancialSummary, MonthConfig, SavingsGoal, SavingsMovement, Transaction, UserProfile } from '../types';

/** Browser localStorage adapter. The existing scoped keys and sync events remain owned by storageService. */
export class StorageFinanceRepository implements FinanceRepository {
  getProfile(): UserProfile { return storageService.getProfile(); }
  takeLegacyLockPin(): string | null { return storageService.takeLegacyLockPin(); }
  saveProfile(value: UserProfile): void { storageService.saveProfile(value); }
  getMonthConfigs(): Record<string, MonthConfig> { return storageService.getMonthConfigs(); }
  getMonthConfig(key: string): MonthConfig | null { return storageService.getMonthConfig(key); }
  saveMonthConfig(value: MonthConfig): void { storageService.saveMonthConfig(value); }
  getCategoryBudgets(key: string): CategoryBudget[] { return storageService.getCategoryBudgets(key); }
  getAllCategoryBudgets(): Record<string, CategoryBudget[]> { return storageService.getAllCategoryBudgets(); }
  saveCategoryBudgets(key: string, values: CategoryBudget[]): void { storageService.saveCategoryBudgets(key, values); }
  getTransactions(): Transaction[] { return storageService.getTransactions(); }
  getTransactionsByMonth(key: string): Transaction[] { return storageService.getTransactionsByMonth(key); }
  addTransaction(value: Omit<Transaction, 'id' | 'createdAt'>): Transaction { return storageService.addTransaction(value); }
  updateTransaction(value: Transaction): void { storageService.updateTransaction(value); }
  deleteTransaction(id: string): void { storageService.deleteTransaction(id); }
  getSavingsMovements(): SavingsMovement[] { return storageService.getSavingsMovements(); }
  addSavingsMovement(value: Omit<SavingsMovement, 'id' | 'createdAt'>): SavingsMovement { return storageService.addSavingsMovement(value); }
  deleteSavingsMovement(id: string): void { storageService.deleteSavingsMovement(id); }
  saveSavingsMovements(values: SavingsMovement[]): void { storageService.saveSavingsMovements(values); }
  getSavingsGoals(): SavingsGoal[] { return storageService.getSavingsGoals(); }
  saveSavingsGoals(values: SavingsGoal[]): void { storageService.saveSavingsGoals(values); }
  deleteSavingsGoal(id: string, resolution: 'general' | 'month' | 'fictional', monthKey: string): void { storageService.deleteSavingsGoal(id, resolution, monthKey); }
  getTotalSavingsVault(): number { return storageService.getTotalSavingsVault(); }
  getFinancialSummary(key: string): FinancialSummary { return storageService.getFinancialSummary(key); }
  getPreviousMonthRemaining(year: number, month: number): number { return storageService.getPreviousMonthRemaining(year, month); }
  isAppLocked(): boolean { return storageService.isAppLocked(); }
  setAppLocked(): void { storageService.setAppLocked(); }
  setAppUnlocked(): void { storageService.setAppUnlocked(); }
  resetAllData(): void { storageService.resetAllData(); }
}

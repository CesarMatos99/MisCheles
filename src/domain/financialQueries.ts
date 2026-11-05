import type { CategoryBudget, SavingsMovement, Transaction } from '../types';
import { isConsumptionExpenseTransaction, normalizeFinancialCategory } from './financialClassification';

export interface CategorySpending { category: string; amount: number; budget?: number; remaining?: number; share: number }

/** One shared interpretation of consumption by category, including payments made directly from savings. */
export function spendingByCategory(transactions: Transaction[], savingsMovements: SavingsMovement[]): Map<string, { category: string; amount: number }> {
  const totals = new Map<string, { category: string; amount: number }>();
  for (const tx of transactions) {
    if (!isConsumptionExpenseTransaction(tx) || !Number.isFinite(tx.amount) || tx.amount <= 0) continue;
    const key = normalizeFinancialCategory(tx.category);
    const current = totals.get(key);
    totals.set(key, { category: current?.category || tx.category, amount: (current?.amount || 0) + tx.amount });
  }
  for (const movement of savingsMovements) {
    if (movement.type !== 'direct_expense' || !Number.isFinite(movement.amount) || movement.amount <= 0) continue;
    const category = movement.category?.trim() || 'Otros';
    const key = normalizeFinancialCategory(category);
    const current = totals.get(key);
    totals.set(key, { category: current?.category || category, amount: (current?.amount || 0) + movement.amount });
  }
  return totals;
}

/** Combines actual spending with assigned category budgets without changing source records. */
export function categorySpendingReport(input: { transactions: Transaction[]; savingsMovements: SavingsMovement[]; budgets: CategoryBudget[]; totalExpenses: number }): CategorySpending[] {
  const spent = spendingByCategory(input.transactions, input.savingsMovements);
  const budgets = new Map(input.budgets.map((item) => [normalizeFinancialCategory(item.category), item]));
  for (const [key, budget] of budgets) if (!spent.has(key)) spent.set(key, { category: budget.category, amount: 0 });
  return [...spent.entries()].map(([key, item]) => {
    const budget = budgets.get(key)?.amount;
    return { category: item.category, amount: item.amount, ...(budget === undefined ? {} : { budget, remaining: budget - item.amount }), share: input.totalExpenses > 0 ? item.amount / input.totalExpenses * 100 : 0 };
  }).sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, 'es'));
}

export interface BudgetProjection { previous: number; projected: number; thresholdCrossed: boolean; exceeded: boolean; }
/** Applies an edited/new expense once when estimating a category budget warning. */
export function projectCategoryBudget(input: { transactions: Transaction[]; category: string; amount: number; editingId?: string | null; budget: number }): BudgetProjection {
  const key = normalizeFinancialCategory(input.category);
  const matching = input.transactions.filter((tx) => isConsumptionExpenseTransaction(tx) && normalizeFinancialCategory(tx.category) === key);
  const previous = matching.reduce((sum, tx) => sum + tx.amount, 0);
  const projected = matching.filter((tx) => tx.id !== input.editingId).reduce((sum, tx) => sum + tx.amount, input.amount);
  return { previous, projected, thresholdCrossed: previous < input.budget * 0.8 && projected >= input.budget * 0.8, exceeded: projected > input.budget };
}

import type { SavingsGoal } from '../types';
export type FinancialInsight = { code: 'category_opportunity' | 'expenses_increased' | 'expenses_reduced' | 'category_increased' | 'budget_exceeded' | 'savings_increased' | 'sustained_high_expenses' | 'goal_near' | 'no_alerts'; category?: string; goal?: string; amount?: number; share?: number };

/** Rule engine for data-backed Statistics guidance; presentation copy stays in the React view. */
export function buildFinancialInsights(input: {
  currentCategoryTotals: Map<string, number>; previousCategoryTotals: Map<string, number>;
  categoryBudgets: Map<string, number>; totalExpenses: number; previousExpenses: number;
  deposits: number; previousDeposits: number; trendExpenses: number[]; averageExpenses: number;
  goals: SavingsGoal[]; hasMovements: boolean;
}): FinancialInsight[] {
  const output: FinancialInsight[] = [];
  const top = [...input.currentCategoryTotals.entries()].sort((a,b)=>b[1]-a[1])[0];
  if (top && input.totalExpenses > 0 && top[1] / input.totalExpenses * 100 >= 35) output.push({ code:'category_opportunity', category:top[0], amount:top[1], share:top[1] / input.totalExpenses * 100 });
  if (input.previousExpenses > 0 && input.totalExpenses > input.previousExpenses * 1.2) output.push({ code:'expenses_increased', amount:input.totalExpenses-input.previousExpenses });
  else if (input.previousExpenses > 0 && input.totalExpenses < input.previousExpenses * .85) output.push({ code:'expenses_reduced', amount:input.previousExpenses-input.totalExpenses });
  input.previousCategoryTotals.forEach((spent, category) => { const current=input.currentCategoryTotals.get(category)||0; if(spent>0&&current>spent*1.25&&current-spent>=500)output.push({code:'category_increased',category,amount:current-spent}); });
  input.categoryBudgets.forEach((budget,category)=>{const spent=input.currentCategoryTotals.get(category)||0;if(spent>budget)output.push({code:'budget_exceeded',category,amount:spent-budget});});
  if(input.deposits>0&&input.deposits>input.previousDeposits)output.push({code:'savings_increased',amount:input.deposits-input.previousDeposits});
  if(input.trendExpenses.length>=3&&input.trendExpenses.slice(-3).every(value=>value>input.averageExpenses*1.15))output.push({code:'sustained_high_expenses'});
  input.goals.filter(goal=>goal.targetAmount>0&&goal.currentAmount>=goal.targetAmount*.8&&goal.currentAmount<goal.targetAmount).forEach(goal=>output.push({code:'goal_near',goal:goal.title,amount:goal.targetAmount-goal.currentAmount}));
  if(!output.length&&input.hasMovements)output.push({code:'no_alerts'});
  return output;
}

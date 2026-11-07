export interface AnalyticsReport {
  reportScope?: 'statistics' | 'configured';
  financialSummary?: { income: number; expenses: number; savingsContributions: number; available?: number };
  expenseBreakdown?: Array<{ category: string; amount: number; share: number; budget?: number; remaining?: number }>;
  query?: { mode: 'month' | 'year' | '6m' | '12m' | 'custom'; year: number; month: number; from: string; to: string; category: string; movementType: 'all' | 'income' | 'expense' | 'savings' };
  breakdown?: { title: string; rows: Array<[string, string, string]> };
  tables?: Array<{ title: string; headers: string[]; rows: Array<Array<string | number>> }>;
  period: string;
  category: string;
  metrics: Array<[string, string]>;
  transactions: import('../types').Transaction[];
  savingsMovements: import('../types').SavingsMovement[];
}

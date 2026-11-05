export interface AnalyticsReport {
  query?: { mode: 'month' | 'year' | '6m' | '12m' | 'custom'; year: number; month: number; from: string; to: string; category: string; movementType: 'all' | 'income' | 'expense' | 'savings' };
  breakdown?: { title: string; rows: Array<[string, string, string]> };
  tables?: Array<{ title: string; headers: string[]; rows: Array<Array<string | number>> }>;
  period: string;
  category: string;
  metrics: Array<[string, string]>;
  transactions: import('../types').Transaction[];
  savingsMovements: import('../types').SavingsMovement[];
}

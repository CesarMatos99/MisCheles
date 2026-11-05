export interface AnalyticsReport {
  breakdown?: { title: string; rows: Array<[string, string, string]> };
  tables?: Array<{ title: string; headers: string[]; rows: Array<Array<string | number>> }>;
  period: string;
  category: string;
  metrics: Array<[string, string]>;
  transactions: import('../types').Transaction[];
  savingsMovements: import('../types').SavingsMovement[];
}

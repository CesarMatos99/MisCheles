export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  monthKey: string; // e.g. "2026-09"
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
  paymentMethod: string; // 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Otro'
  createdAt: number;
  relatedSavingsMovementId?: string; // Links automatic expense to savings movement
}

export type SavingsMovementType = 'deposit_from_month' | 'withdraw_to_month' | 'direct_expense';

export interface SavingsMovement {
  id: string;
  monthKey: string; // Associated month
  type: SavingsMovementType;
  amount: number;
  description: string;
  category?: string;
  date: string;
  createdAt: number;
  destinationType?: 'general' | 'goal';
  goalId?: string;
  goalTitle?: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  icon?: string;
  color?: string;
}

export interface MonthConfig {
  monthKey: string; // "YYYY-MM"
  year: number;
  month: number; // 1 - 12
  initialIncome: number; // Initial amount introduced for this month
  carryoverFromPrev: number; // Leftover balance rolled over from previous month
  autoRolloverEnabled: boolean;
  rolloverAction?: 'rollover_to_month' | 'transfer_to_savings_general' | 'transfer_to_goal' | 'none';
  rolloverGoalId?: string;
  rolloverGoalTitle?: string;
  notes?: string;
  isConfigured: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  photoUrl: string;
  currency: string; // '$', 'RD$', '€', 'MXN', etc.
  pinCode: string; // 4-digit PIN for backup
  biometricsEnabled: boolean;
  pinLockEnabled: boolean;
  monthlyTargetIncome: number;
}

export interface FinancialSummary {
  initialIncome: number;
  carryover: number;
  totalAdditionalIncome: number;
  totalIncome: number; // initial + carryover + additional
  totalExpenses: number;
  savingsTransfersTo: number; // Money sent to savings this month
  savingsTransfersFrom: number; // Money withdrawn back from savings into this month
  availableBalance: number; // Net available in this month
  totalSavingsVault: number; // Total savings balance across all time
  savingsDirectExpenses: number; // Direct payouts from savings
}

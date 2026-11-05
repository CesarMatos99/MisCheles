import { useCallback, useEffect, useState } from 'react';
import type { CategoryBudget, FinancialSummary, MonthConfig, SavingsGoal, SavingsMovement, Transaction } from '../types';
import { financeApplication } from './financeApplication';
import { getMonthKey, storageMutationEvent, type StorageMutation } from '../services/storage';

export interface FinanceWorkspace {
  monthConfig: MonthConfig | null;
  transactions: Transaction[];
  summary: FinancialSummary;
  categoryBudgets: CategoryBudget[];
  allTransactions: Transaction[];
  allSavingsMovements: SavingsMovement[];
  allSavingsGoals: SavingsGoal[];
  refreshMonthData: () => void;
}

/** Coordinates the active period's read model and refreshes it on local/cloud mutations. */
export function useFinanceWorkspace(year: number, month: number): FinanceWorkspace {
  const monthKey = getMonthKey(year, month);
  const [monthConfig, setMonthConfig] = useState(() => financeApplication.getMonthConfig(monthKey));
  const [transactions, setTransactions] = useState(() => financeApplication.getTransactionsByMonth(monthKey));
  const [summary, setSummary] = useState(() => financeApplication.getFinancialSummary(monthKey));
  const [categoryBudgets, setCategoryBudgets] = useState(() => financeApplication.getCategoryBudgets(monthKey));
  const [allTransactions, setAllTransactions] = useState(() => financeApplication.getTransactions());
  const [allSavingsMovements, setAllSavingsMovements] = useState(() => financeApplication.getSavingsMovements());
  const [allSavingsGoals, setAllSavingsGoals] = useState(() => financeApplication.getSavingsGoals());

  const refreshMonthData = useCallback(() => {
    setMonthConfig(financeApplication.getMonthConfig(monthKey));
    setTransactions(financeApplication.getTransactionsByMonth(monthKey));
    setSummary(financeApplication.getFinancialSummary(monthKey));
    setCategoryBudgets(financeApplication.getCategoryBudgets(monthKey));
    setAllTransactions(financeApplication.getTransactions());
    setAllSavingsMovements(financeApplication.getSavingsMovements());
    setAllSavingsGoals(financeApplication.getSavingsGoals());
  }, [monthKey]);

  useEffect(() => { refreshMonthData(); }, [refreshMonthData]);
  useEffect(() => {
    const onRemoteMutation = (event: Event) => {
      const detail = (event as CustomEvent<StorageMutation>).detail;
      if (detail?.origin === 'remote') refreshMonthData();
    };
    window.addEventListener(storageMutationEvent, onRemoteMutation);
    return () => window.removeEventListener(storageMutationEvent, onRemoteMutation);
  }, [refreshMonthData]);

  return { monthConfig, transactions, summary, categoryBudgets, allTransactions, allSavingsMovements, allSavingsGoals, refreshMonthData };
}

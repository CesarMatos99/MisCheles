import { useCallback, useState } from 'react';
import type { AnalyticsReport } from '../domain/analyticsReport';
import type { SavingsDestinationType, SavingsMovementType, Transaction } from '../types';

export type SavingsDraft = { amount: string; description: string; date: string };

/** Keeps modal visibility and draft state out of the application composition component. */
export function useAppModals() {
  const [isMonthSetupOpen, setIsMonthSetupOpen] = useState(false);
  const [isCategoryBudgetModalOpen, setIsCategoryBudgetModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [transactionModalType, setTransactionModalType] = useState<'expense' | 'income'>('expense');
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [savingsModalMode, setSavingsModalMode] = useState<SavingsMovementType>('deposit_from_month');
  const [savingsModalDestinationType, setSavingsModalDestinationType] = useState<SavingsDestinationType>('general');
  const [savingsDraft, setSavingsDraft] = useState<SavingsDraft | undefined>();
  const [savingsModalGoalId, setSavingsModalGoalId] = useState<string | undefined>();
  const [analyticsReport, setAnalyticsReport] = useState<AnalyticsReport | undefined>();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const closeModuleModals = useCallback(() => {
    setIsMonthSetupOpen(false); setIsCategoryBudgetModalOpen(false); setIsTransactionModalOpen(false);
    setIsTransferModalOpen(false); setIsSavingsModalOpen(false); setIsExportModalOpen(false); setIsInstallModalOpen(false);
  }, []);
  return { isMonthSetupOpen, setIsMonthSetupOpen, isCategoryBudgetModalOpen, setIsCategoryBudgetModalOpen, editingCategory, setEditingCategory,
    isTransactionModalOpen, setIsTransactionModalOpen, transactionModalType, setTransactionModalType, transactionToEdit, setTransactionToEdit,
    isTransferModalOpen, setIsTransferModalOpen, isSavingsModalOpen, setIsSavingsModalOpen, savingsModalMode, setSavingsModalMode,
    savingsModalDestinationType, setSavingsModalDestinationType,
    savingsDraft, setSavingsDraft, savingsModalGoalId, setSavingsModalGoalId, analyticsReport, setAnalyticsReport,
    isExportModalOpen, setIsExportModalOpen, isInstallModalOpen, setIsInstallModalOpen, closeModuleModals };
}

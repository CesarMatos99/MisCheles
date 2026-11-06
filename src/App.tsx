import { isSavingsBudgetCategory } from './domain/transactionPresentation';
import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, PiggyBank, PieChart, AlertCircle, X, BarChart3 } from 'lucide-react';
import {
  Transaction,
  UserProfile,
  SavingsMovementType,
} from './types';
import { getMonthKey, notifyStorageMutation, storageMutationEvent, type StorageMutation } from './services/storage';
import { financeApplication } from './application/financeApplication';
import { useFinanceWorkspace } from './application/useFinanceWorkspace';
import { useAppModals } from './application/useAppModals';
import { projectCategoryBudget } from './domain/financialQueries';
import { Header } from './components/layout/Header';
import { BottomNav, ActiveTab } from './components/layout/BottomNav';
import { FloatingActions } from './components/layout/FloatingActions';
import { OfflineIndicator } from './components/layout/OfflineIndicator';
import { SyncConflictResolver } from './components/sync/SyncConflictResolver';
import { DashboardView } from './features/dashboard/DashboardView';
import { CategoryDetailView } from './features/dashboard/CategoryDetailView';
import { TransactionsView } from './features/transactions/TransactionsView';
import { TransactionModal } from './features/transactions/TransactionModal';
import { SavingsView } from './features/savings/SavingsView';
import { SavingsModal } from './features/savings/SavingsModal';
import { ProfileView } from './features/profile/ProfileView';
import { MonthSetupModal } from './components/modals/MonthSetupModal';
import { CategoryBudgetModal } from './components/modals/CategoryBudgetModal';
import { TransferModal } from './components/modals/TransferModal';
import { ExportModal } from './components/modals/ExportModal';
import { PWAInstallModal } from './components/modals/PWAInstallModal';
import { BiometricLockScreen } from './components/modals/BiometricLockScreen';
import { EXPENSE_CATEGORIES, MONTH_NAMES_ES } from './constants/categories';
import { AnalyticsView } from './features/dashboard/AnalyticsView';
import { useLanguage } from './i18n/LanguageContext';
import { useAppNavigation } from './navigation/useAppNavigation';
import { localLockCredential } from './services/localLockCredential';

export default function App() {
  const { t } = useLanguage();
  // Current Date default
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('presucontrol_theme_v1');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  const [accentColor, setAccentColor] = useState<string>(() => {
    try { return localStorage.getItem('mischeles_accent_v2') || localStorage.getItem('mischeles_accent_v1') || '#012677'; } catch { return '#012677'; }
  });

  // App Lock State
  const [isLocked, setIsLocked] = useState<boolean>(() => financeApplication.isAppLocked());

  // User Profile
  const [profile, setProfile] = useState<UserProfile>(() => financeApplication.getProfile());

  // Month data
  const currentMonthKey = getMonthKey(year, month);
  const { monthConfig, transactions, summary, categoryBudgets, allTransactions, allSavingsMovements, allSavingsGoals, refreshMonthData } = useFinanceWorkspace(year, month);
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [startWithNewCategory, setStartWithNewCategory] = useState(false);
  const [budgetNotice, setBudgetNotice] = useState<{ kind: 'near' | 'over'; category: string; amount: number; budgetAmount: number } | null>(null);

  const { isMonthSetupOpen, setIsMonthSetupOpen, isCategoryBudgetModalOpen, setIsCategoryBudgetModalOpen, editingCategory, setEditingCategory,
    isTransactionModalOpen, setIsTransactionModalOpen, transactionModalType, setTransactionModalType, transactionToEdit, setTransactionToEdit,
    isTransferModalOpen, setIsTransferModalOpen, isSavingsModalOpen, setIsSavingsModalOpen, savingsModalMode, setSavingsModalMode,
    savingsDraft, setSavingsDraft, savingsModalGoalId, setSavingsModalGoalId, analyticsReport, setAnalyticsReport,
    isExportModalOpen, setIsExportModalOpen, isInstallModalOpen, setIsInstallModalOpen, closeModuleModals } = useAppModals();
  const [movementError, setMovementError] = useState('');

  const onModuleChange = useCallback(() => {
    closeModuleModals();
    setSelectedCategory(null);
  }, [closeModuleModals]);
  const { activeTab, navigateToTab } = useAppNavigation(onModuleChange);

  useEffect(() => {
    const legacyPin = financeApplication.takeLegacyLockPin();
    if (!legacyPin) return;
    void localLockCredential.setPin(legacyPin).catch(() => {
      const profileWithoutLock = { ...financeApplication.getProfile(), pinLockEnabled: false, biometricsEnabled: false };
      financeApplication.saveProfile(profileWithoutLock);
      financeApplication.setAppUnlocked();
      setProfile(profileWithoutLock);
      setIsLocked(false);
    });
  }, []);

  useEffect(() => {
    if (!profile.pinLockEnabled) return;
    let timer: number | undefined;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        timer = window.setTimeout(() => { financeApplication.setAppLocked(); setIsLocked(true); }, 900);
      } else if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { document.removeEventListener('visibilitychange', onVisibilityChange); if (timer !== undefined) window.clearTimeout(timer); };
  }, [profile.pinLockEnabled]);

  // Synchronize Dark Theme class on html root
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('presucontrol_theme_v1', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('presucontrol_theme_v1', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-primary', accentColor);
    document.documentElement.style.setProperty('--app-accent', accentColor);
    try { localStorage.setItem('mischeles_accent_v2', accentColor); } catch { /* Storage may be unavailable in private browsing. */ }
  }, [accentColor]);

  useEffect(() => {
    const onRemoteSnapshot = (event: Event) => {
      const detail = (event as CustomEvent<StorageMutation>).detail;
      if (detail?.origin !== 'remote') return;
      setProfile(financeApplication.getProfile());
      setIsDarkMode(localStorage.getItem('presucontrol_theme_v1') === 'dark');
      setAccentColor(localStorage.getItem('mischeles_accent_v2') || '#012677');
    };
    window.addEventListener(storageMutationEvent, onRemoteSnapshot);
    return () => window.removeEventListener(storageMutationEvent, onRemoteSnapshot);
  }, []);

  useEffect(() => {
    if (!budgetNotice) return;
    const timeout = window.setTimeout(() => setBudgetNotice(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [budgetNotice]);

  const handleTransactionSaved = (savedTransaction: Transaction) => {
    if (savedTransaction.type === 'expense') {
      const key = savedTransaction.category.trim().toLocaleLowerCase('es-DO');
      const budget = categoryBudgets.find((item) => item.category.trim().toLocaleLowerCase('es-DO') === key);
      if (budget) {
        const projection = projectCategoryBudget({ transactions, category: budget.category, amount: savedTransaction.amount, editingId: savedTransaction.id, budget: budget.amount });
        if (projection.exceeded && projection.projected > projection.previous) {
          setBudgetNotice({ kind: 'over', category: budget.category, amount: projection.projected - budget.amount, budgetAmount: budget.amount });
        } else if (projection.thresholdCrossed) {
          setBudgetNotice({ kind: 'near', category: budget.category, amount: projection.projected, budgetAmount: budget.amount });
        }
      }
    }
    refreshMonthData();
  };

  useEffect(() => {
    setTransactionCategoryFilter(null);
    setSelectedCategory(null);
  }, [year, month]);

  // Handle month/year changes
  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  // Lock handler
  const handleLockApp = () => {
    financeApplication.setAppLocked();
    setIsLocked(true);
  };

  const handleUnlockApp = () => {
    financeApplication.setAppUnlocked();
    setIsLocked(false);
  };

  // Open transaction modals
  const handleOpenTransactionModal = (type: 'expense' | 'income') => {
    setTransactionModalType(type);
    setTransactionToEdit(null);
    setIsTransactionModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setTransactionToEdit(tx);
    setTransactionModalType(tx.type);
    setIsTransactionModalOpen(true);
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('¿Deseas eliminar este registro?')) {
      try { financeApplication.deleteTransaction(id); setMovementError(''); refreshMonthData(); }
      catch (error) { setMovementError(error instanceof Error ? error.message : 'No se pudo eliminar el movimiento.'); }
    }
  };

  const handleOpenSavingsModal = (mode: SavingsMovementType = 'deposit_from_month', goalId?: string) => {
    setSavingsDraft(undefined);
    setSavingsModalMode(mode);
    setSavingsModalGoalId(goalId);
    setIsSavingsModalOpen(true);
  };

  // Render Lock Screen if app is locked
  if (isLocked) {
    return <BiometricLockScreen profile={profile} onUnlock={handleUnlockApp} />;
  }

  return (
    <div className="min-h-screen bg-app-background text-app-foreground flex flex-col selection:bg-primary selection:text-white app-shell-bottom-nav-space transition-colors duration-200">
      {/* Offline Status Toast */}
      <OfflineIndicator />
      <SyncConflictResolver />
      {budgetNotice && (
        <div role={budgetNotice.kind === 'over' ? 'alert' : 'status'} aria-live={budgetNotice.kind === 'over' ? 'assertive' : 'polite'} className={'fixed left-3 right-3 top-20 z-[60] flex items-start gap-3 rounded-xl border p-3 shadow-lg sm:left-auto sm:right-6 sm:top-24 sm:w-96 ' + (budgetNotice.kind === 'over' ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/65 dark:text-rose-100' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/65 dark:text-amber-100')}>
          <AlertCircle className='mt-0.5 h-5 w-5 shrink-0' aria-hidden='true' />
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-semibold'>{budgetNotice.kind === 'over' ? 'Has superado el monto de la categoría' : 'Has gastado cerca del monto asignado'}</p>
            <p className='mt-0.5 text-xs'>{budgetNotice.kind === 'over' ? budgetNotice.category + ': ' + profile.currency + ' ' + budgetNotice.amount.toLocaleString('es-DO') + ' por encima del límite.' : budgetNotice.category + ': ' + profile.currency + ' ' + budgetNotice.amount.toLocaleString('es-DO') + ' de ' + profile.currency + ' ' + budgetNotice.budgetAmount.toLocaleString('es-DO') + '.'}</p>
          </div>
          <button type='button' onClick={() => setBudgetNotice(null)} aria-label='Cerrar notificación' className='rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10'><X className='h-4 w-4' aria-hidden='true' /></button>
        </div>
      )}

      {/* Main Header */}
      <Header
        isDarkMode={isDarkMode}
        onToggleTheme={() => { setIsDarkMode(!isDarkMode); notifyStorageMutation('userSettings', 'theme'); }}
        onOpenProfile={() => navigateToTab('profile')}
        profile={profile}
      />

      {/* Main Navigation Tabs on Desktop */}
      <div className="hidden sm:block border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex gap-2">
            {[
              { id: 'dashboard' as ActiveTab, label: t('home'), icon: PieChart },
              { id: 'transactions' as ActiveTab, label: t('register'), icon: Receipt },
              { id: 'statistics' as ActiveTab, label: t('statistics'), icon: BarChart3 },
              { id: 'savings' as ActiveTab, label: t('savings'), icon: PiggyBank },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigateToTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Main Body Content Container */}
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 space-y-6 p-4 sm:p-6">
        {movementError && <p role="alert" className="mb-3 text-sm text-rose-600 dark:text-rose-300">{movementError}</p>}
        {activeTab === 'dashboard' && (
          selectedCategory ? (
            <CategoryDetailView
              category={selectedCategory}
              monthLabel={MONTH_NAMES_ES[month - 1] + ' ' + year}
              budget={categoryBudgets.find((budget) => budget.category.localeCompare(selectedCategory, 'es-DO', { sensitivity: 'base' }) === 0)}
              transactions={transactions}
              savingsMovements={financeApplication.getSavingsMovements().filter((movement) => movement.monthKey === currentMonthKey)}
            profile={profile}
              onBack={() => setSelectedCategory(null)}
              onEditTransaction={handleEditTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onManageBudget={() => {
                const hasBudget = categoryBudgets.some((budget) => budget.category.localeCompare(selectedCategory, 'es-DO', { sensitivity: 'base' }) === 0);
                setEditingCategory(hasBudget ? selectedCategory : null);
                setIsCategoryBudgetModalOpen(true);
              }}
            />
          ) : (
            <DashboardView
              year={year}
              month={month}
              onMonthChange={handleMonthChange}
              monthConfig={monthConfig}
              summary={summary}
              transactions={transactions}
              savingsMovements={allSavingsMovements.filter((movement) => movement.monthKey === currentMonthKey)}
              profile={profile}
              categoryBudgets={categoryBudgets}
              onOpenMonthSetup={() => setIsMonthSetupOpen(true)}
              onOpenExport={() => setIsExportModalOpen(true)}
              onAddCategory={() => { setEditingCategory(null); setStartWithNewCategory(true); setIsCategoryBudgetModalOpen(true); }}
              onManageBudgets={() => {
                setStartWithNewCategory(false);
                setEditingCategory(null);
                setIsCategoryBudgetModalOpen(true);
              }}
              onOpenCategory={setSelectedCategory}
            />
          )
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            year={year}
            month={month}
            onMonthChange={handleMonthChange}
            transactions={transactions}
            savingsMovements={allSavingsMovements}
            profile={profile}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            initialCategoryFilter={transactionCategoryFilter}
            onCategoryFilterChange={setTransactionCategoryFilter}
          />
        )}

        {activeTab === 'statistics' && (
          <AnalyticsView
            year={year}
            month={month}
            transactions={allTransactions}
            savingsMovements={allSavingsMovements}
            savingsGoals={allSavingsGoals}
            monthConfigs={financeApplication.getMonthConfigs()}
            categoryBudgetsByMonth={financeApplication.getAllCategoryBudgets()}
            profile={profile}
            onOpenExportModal={(report) => { setAnalyticsReport(report); setIsExportModalOpen(true); }}
          />
        )}

        {activeTab === 'savings' && (
          <SavingsView
            summary={summary}
            profile={profile}
            monthKey={currentMonthKey}
            year={year}
            month={month}
            onMonthChange={handleMonthChange}
            onOpenSavingsModal={handleOpenSavingsModal}
            onRefresh={refreshMonthData}
            onOpenExport={() => setIsExportModalOpen(true)}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            profile={profile}
            isDarkMode={isDarkMode}
            accentColor={accentColor}
            onThemeChange={(value) => { setIsDarkMode(value); notifyStorageMutation('userSettings', 'theme'); }}
            onAccentColorChange={(value) => { setAccentColor(value); notifyStorageMutation('userSettings', 'accentColor'); }}
            onProfileUpdated={(updated) => {
              setProfile(updated);
              refreshMonthData();
            }}
            onOpenInstall={() => setIsInstallModalOpen(true)}
            onLockApp={handleLockApp}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={navigateToTab}
      />

      {(activeTab === 'dashboard' || activeTab === 'transactions') && (
        <FloatingActions
          contextAction={selectedCategory ? () => isSavingsBudgetCategory(selectedCategory) ? handleOpenSavingsModal('deposit_from_month') : handleOpenTransactionModal('expense') : undefined}
          contextLabel={selectedCategory ? (isSavingsBudgetCategory(selectedCategory) ? 'Registrar aporte a ahorro' : 'Registrar gasto en ' + selectedCategory) : undefined}
          onExpense={() => handleOpenTransactionModal('expense')}
          onIncome={() => handleOpenTransactionModal('income')}
          onTransfer={() => setIsTransferModalOpen(true)}
        />
      )}

      {/* Modals */}
      <CategoryBudgetModal
        isOpen={isCategoryBudgetModalOpen}
        monthLabel={MONTH_NAMES_ES[month - 1] + ' ' + year}
        currency={profile.currency}
        budgets={editingCategory
          ? categoryBudgets.filter((budget) => budget.category === editingCategory)
          : categoryBudgets}
        isSingleCategory={Boolean(editingCategory)}
        startWithNewCategory={startWithNewCategory}
        reservedCategories={editingCategory
          ? categoryBudgets.filter((budget) => budget.category !== editingCategory).map((budget) => budget.category)
          : []}
        suggestedCategories={[
          ...EXPENSE_CATEGORIES.map((category) => category.name),
          ...transactions.filter((transaction) => transaction.type === 'expense' && transaction.category !== 'Servicios (Luz, Agua, Internet)').map((transaction) => transaction.category),
        ]}
        onClose={() => {
          setIsCategoryBudgetModalOpen(false);
          setEditingCategory(null);
          setStartWithNewCategory(false);
        }}
        onSave={(budgets) => {
          const nextBudgets = editingCategory
            ? categoryBudgets.flatMap((budget) => budget.category === editingCategory ? budgets : [budget])
            : budgets;
          financeApplication.saveCategoryBudgets(currentMonthKey, nextBudgets);
          refreshMonthData();
          setStartWithNewCategory(false);
        }}
      />

      <MonthSetupModal
        isOpen={isMonthSetupOpen}
        onClose={() => setIsMonthSetupOpen(false)}
        year={year}
        month={month}
        profile={profile}
        onSaved={() => refreshMonthData()}
      />

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        monthKey={currentMonthKey}
        profile={profile}
        onSaved={handleTransactionSaved}
        transactionToEdit={transactionToEdit}
        onRequestSavings={(draft) => {
          setIsTransactionModalOpen(false);
          setSavingsDraft(draft);
          setSavingsModalGoalId(undefined);
          setSavingsModalMode('deposit_from_month');
          setIsSavingsModalOpen(true);
        }}
        initialCategory={selectedCategory || undefined}
        defaultType={transactionModalType}
      />

      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        monthKey={currentMonthKey}
        profile={profile}
        summary={summary}
        onSaved={() => refreshMonthData()}
      />

      <SavingsModal
        isOpen={isSavingsModalOpen}
        onClose={() => setIsSavingsModalOpen(false)}
        monthKey={currentMonthKey}
        year={year}
        month={month}
        profile={profile}
        summary={summary}
        initialDraft={savingsDraft}
        initialMode={savingsModalMode}
        initialGoalId={savingsModalGoalId}
        onSaved={() => refreshMonthData()}
      />

      <ExportModal
        analyticsReport={activeTab === 'statistics' ? analyticsReport : undefined}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        year={year}
        month={month}
        allTransactions={allTransactions}
        allSavingsMovements={allSavingsMovements}
        monthConfigs={financeApplication.getMonthConfigs()}
        budgetsByMonth={financeApplication.getAllCategoryBudgets()}
        savingsGoals={allSavingsGoals}
        profile={profile}
      />

      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}

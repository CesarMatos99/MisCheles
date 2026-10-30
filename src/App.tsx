import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  PieChart,
  User,
  Plus,
  Minus,
  Sparkles,
  Sliders,
  Download,
  Smartphone,
} from 'lucide-react';
import {
  FinancialSummary,
  MonthConfig,
  Transaction,
  UserProfile,
  SavingsMovementType,
} from './types';
import { storageService, getMonthKey } from './services/storage';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { SavingsView } from './components/SavingsView';
import { ProfileModal } from './components/ProfileModal';
import { MonthSetupModal } from './components/MonthSetupModal';
import { TransactionModal } from './components/TransactionModal';
import { TransferModal } from './components/TransferModal';
import { SavingsModal } from './components/SavingsModal';
import { ExportModal } from './components/ExportModal';
import { PWAInstallModal } from './components/PWAInstallModal';
import { BiometricLockScreen } from './components/BiometricLockScreen';
import { BottomNav, ActiveTab } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { FloatingActions } from './components/FloatingActions';

export default function App() {
  // Current Date default
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

  // Active Tab for views
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

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
    try { return localStorage.getItem('mischeles_accent_v1') || '#059669'; } catch { return '#059669'; }
  });

  // App Lock State
  const [isLocked, setIsLocked] = useState<boolean>(() => storageService.isAppLocked());

  // User Profile
  const [profile, setProfile] = useState<UserProfile>(() => storageService.getProfile());

  // Month data
  const currentMonthKey = getMonthKey(year, month);
  const [monthConfig, setMonthConfig] = useState<MonthConfig | null>(() =>
    storageService.getMonthConfig(currentMonthKey)
  );
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    storageService.getTransactionsByMonth(currentMonthKey)
  );
  const [summary, setSummary] = useState<FinancialSummary>(() =>
    storageService.getFinancialSummary(currentMonthKey)
  );

  // Selected Category filter for drilldown
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modals
  const [isMonthSetupOpen, setIsMonthSetupOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState<boolean>(false);
  const [transactionModalType, setTransactionModalType] = useState<'expense' | 'income'>('expense');
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState<boolean>(false);
  const [savingsModalMode, setSavingsModalMode] = useState<SavingsMovementType>('deposit_from_month');

  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

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
    document.documentElement.style.setProperty('--app-accent', accentColor);
    try { localStorage.setItem('mischeles_accent_v1', accentColor); } catch { /* Storage may be unavailable in private browsing. */ }
  }, [accentColor]);

  // Refresh current month data
  const refreshMonthData = useCallback(() => {
    const key = getMonthKey(year, month);
    setMonthConfig(storageService.getMonthConfig(key));
    setTransactions(storageService.getTransactionsByMonth(key));
    setSummary(storageService.getFinancialSummary(key));
  }, [year, month]);

  useEffect(() => {
    refreshMonthData();
    setSelectedCategory(null);
  }, [year, month, refreshMonthData]);

  // Handle month/year changes
  const handleMonthChange = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  // Lock handler
  const handleLockApp = () => {
    storageService.setAppLocked();
    setIsLocked(true);
  };

  const handleUnlockApp = () => {
    storageService.setAppUnlocked();
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
      storageService.deleteTransaction(id);
      refreshMonthData();
    }
  };

  const handleOpenSavingsModal = (mode: SavingsMovementType = 'deposit_from_month') => {
    setSavingsModalMode(mode);
    setIsSavingsModalOpen(true);
  };

  // Render Lock Screen if app is locked
  if (isLocked) {
    return <BiometricLockScreen profile={profile} onUnlock={handleUnlockApp} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white pb-20 sm:pb-6 transition-colors duration-200">
      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Main Header */}
      <Header
        year={year}
        month={month}
        onMonthChange={handleMonthChange}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        onLockApp={handleLockApp}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onOpenMonthSetup={() => setIsMonthSetupOpen(true)}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        profile={profile}
      />

      {/* Main Navigation Tabs on Desktop */}
      <div className="hidden sm:block border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex gap-2">
            {[
              { id: 'dashboard' as ActiveTab, label: 'Inicio', icon: PieChart },
              { id: 'transactions' as ActiveTab, label: 'Registro', icon: Receipt },
              { id: 'savings' as ActiveTab, label: 'Ahorro', icon: PiggyBank },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
                    isActive
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 py-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Exportar Reporte</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Body Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            year={year}
            month={month}
            monthConfig={monthConfig}
            summary={summary}
            transactions={transactions}
            profile={profile}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onOpenMonthSetup={() => setIsMonthSetupOpen(true)}
            onOpenTransactionModal={handleOpenTransactionModal}
            onOpenTransferModal={() => setIsTransferModalOpen(true)}
            onOpenSavingsModal={handleOpenSavingsModal}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onViewAllTransactions={() => setActiveTab('transactions')}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            year={year}
            month={month}
            summary={summary}
            transactions={transactions}
            profile={profile}
            onOpenTransactionModal={handleOpenTransactionModal}
            onOpenTransferModal={() => setIsTransferModalOpen(true)}
            onOpenMonthSetup={() => setIsMonthSetupOpen(true)}
            onEditTransaction={handleEditTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenExportModal={() => setIsExportModalOpen(true)}
          />
        )}

        {activeTab === 'savings' && (
          <SavingsView
            summary={summary}
            profile={profile}
            monthKey={currentMonthKey}
            year={year}
            month={month}
            onOpenSavingsModal={handleOpenSavingsModal}
            onRefresh={refreshMonthData}
          />
        )}

        {activeTab === 'profile' && (
          <div className="max-w-md mx-auto">
            {/* Direct access to profile in mobile tab */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-bold overflow-hidden shadow">
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{profile.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{profile.name}</h3>
                  <p className="text-xs text-slate-400">{profile.email || 'Sin correo registrado'}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                    Moneda: {profile.currency}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
                >
                  Editar Perfil, Foto y Seguridad Biométrica
                </button>
                <button
                  onClick={() => setIsInstallModalOpen(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4 text-emerald-500" />
                  <span>Instalar Aplicación Móvil (APK)</span>
                </button>
                <button
                  onClick={handleLockApp}
                  className="w-full py-3 px-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold text-xs transition"
                >
                  Bloquear Ahora con Huella / PIN
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'profile') {
            setIsProfileModalOpen(true);
          }
        }}
      />

      <FloatingActions
        onExpense={() => handleOpenTransactionModal('expense')}
        onIncome={() => handleOpenTransactionModal('income')}
        onTransfer={() => setIsTransferModalOpen(true)}
      />

      {/* Modals */}
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
        onSaved={() => refreshMonthData()}
        transactionToEdit={transactionToEdit}
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
        initialMode={savingsModalMode}
        onSaved={() => refreshMonthData()}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        year={year}
        month={month}
        summary={summary}
        transactions={transactions}
        savingsMovements={storageService.getSavingsMovements().filter((m) => m.monthKey === currentMonthKey)}
        profile={profile}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile}
        accentColor={accentColor}
        onAccentColorChange={setAccentColor}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          refreshMonthData();
        }}
      />

      <PWAInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
      />
    </div>
  );
}

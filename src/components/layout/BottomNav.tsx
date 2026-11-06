import React from 'react';
import { PieChart, Receipt, PiggyBank, BarChart3 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export type ActiveTab = 'dashboard' | 'transactions' | 'statistics' | 'savings' | 'profile';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const { t } = useLanguage();
  const tabs = [
    { id: 'dashboard' as ActiveTab, label: t('home'), icon: PieChart },
    { id: 'transactions' as ActiveTab, label: t('register'), icon: Receipt },
    { id: 'statistics' as ActiveTab, label: t('statistics'), icon: BarChart3 },
    { id: 'savings' as ActiveTab, label: t('savings'), icon: PiggyBank },
  ];

  return (
    <nav aria-label={t('home') + ', ' + t('register') + ', ' + t('statistics') + ', ' + t('savings')} className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-300 bg-white/95 px-3 py-2 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 sm:hidden safe-area-bottom">
      <div className="grid grid-cols-4 gap-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChangeTab(tab.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
                isActive
                  ? 'bg-primary-soft text-primary font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
              <span className="text-[11px] leading-4 tracking-tight sm:text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

import React from 'react';
import { PieChart, Receipt, PiggyBank, User } from 'lucide-react';

export type ActiveTab = 'dashboard' | 'transactions' | 'savings' | 'profile';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'dashboard' as ActiveTab, label: 'Inicio', icon: PieChart },
    { id: 'transactions' as ActiveTab, label: 'Registro', icon: Receipt },
    { id: 'savings' as ActiveTab, label: 'Ahorro', icon: PiggyBank },
    { id: 'profile' as ActiveTab, label: 'Perfil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-900/95 sm:hidden safe-area-bottom">
      <div className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-2 transition-colors ${
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs leading-4 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

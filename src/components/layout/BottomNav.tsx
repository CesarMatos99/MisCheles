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
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-2 sm:hidden safe-area-bottom">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 scale-105 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

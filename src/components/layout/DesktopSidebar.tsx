import React from 'react';
import { BarChart3, ChevronRight, Home, PiggyBank, ReceiptText, Tags, TrendingDown, TrendingUp } from 'lucide-react';
import type { AnalyticsSection } from '../../features/dashboard/AnalyticsView';
import type { ActiveTab } from './BottomNav';

interface DesktopSidebarProps {
  activeTab: ActiveTab;
  analyticsSection: AnalyticsSection;
  onNavigate: (tab: ActiveTab) => void;
  onNavigateAnalytics: (section: AnalyticsSection) => void;
}

const items = [
  { id: 'dashboard' as const, label: 'Inicio', icon: Home },
  { id: 'transactions' as const, label: 'Registro', icon: ReceiptText },
  { id: 'statistics' as const, label: 'Estadísticas', icon: BarChart3 },
  { id: 'savings' as const, label: 'Ahorro', icon: PiggyBank },
];

const analyticsItems = [
  { id: 'categories' as const, label: 'Categorías', icon: Tags },
  { id: 'compare' as const, label: 'Comparar', icon: TrendingUp },
  { id: 'evolution' as const, label: 'Evolución', icon: TrendingDown },
];

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ activeTab, analyticsSection, onNavigate, onNavigateAnalytics }) => (
  <aside className="desktop-sidebar hidden w-60 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:block">
    <div className="sticky top-0 flex h-dvh flex-col px-4 py-6">
      <div className="mb-9 px-3 text-xl font-extrabold tracking-tight text-primary">MisCheles</div>
      <nav aria-label="Navegación principal" className="space-y-1">
        {items.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return <div key={id}>
            <button
              type="button"
              aria-current={isActive ? 'page' : undefined}
              aria-expanded={id === 'statistics' ? isActive : undefined}
              onClick={() => onNavigate(id)}
              className={'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + (isActive ? 'bg-primary/10 font-semibold text-primary dark:bg-primary/20' : 'font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900')}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {id === 'statistics' && <ChevronRight className={'h-4 w-4 transition-transform ' + (isActive ? 'rotate-90' : '')} aria-hidden="true" />}
            </button>
            {id === 'statistics' && isActive && <div className="ml-5 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-800">
              {analyticsItems.map(({ id: section, label: sectionLabel, icon: SectionIcon }) => {
                const sectionActive = analyticsSection === section;
                return <button
                  key={section}
                  type="button"
                  aria-current={sectionActive ? 'page' : undefined}
                  onClick={() => onNavigateAnalytics(section)}
                  className={'flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + (sectionActive ? 'font-semibold text-primary' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white')}
                >
                  <SectionIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{sectionLabel}</span>
                </button>;
              })}
            </div>}
          </div>;
        })}
      </nav>
      <div className="mt-auto border-t border-slate-200 px-3 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Finanzas personales
      </div>
    </div>
  </aside>
);

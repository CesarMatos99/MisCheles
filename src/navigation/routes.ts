import type { ActiveTab } from '../components/layout/BottomNav';

const TAB_PATHS: Record<ActiveTab, string> = {
  dashboard: '/',
  transactions: '/movimientos',
  statistics: '/estadisticas',
  savings: '/ahorros',
  profile: '/perfil',
};
const PATH_TABS = Object.fromEntries(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab])) as Record<string, ActiveTab>;

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

export function activeTabForPath(pathname: string): ActiveTab {
  return PATH_TABS[normalizePath(pathname)] || 'dashboard';
}

export function pathForActiveTab(tab: ActiveTab): string {
  return TAB_PATHS[tab];
}

export function isCanonicalAppPath(pathname: string): boolean {
  const normalized = normalizePath(pathname);
  return Boolean(PATH_TABS[normalized]) && pathname === normalized;
}

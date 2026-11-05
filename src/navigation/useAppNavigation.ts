import { useCallback, useEffect, useState } from 'react';
import type { ActiveTab } from '../components/layout/BottomNav';
import { activeTabForPath, isCanonicalAppPath, pathForActiveTab } from './routes';

/** Owns browser URL/history synchronization while leaving page composition in App. */
export function useAppNavigation(onModuleChange: () => void) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => activeTabForPath(window.location.pathname));
  const synchronizeLocation = useCallback(() => {
    const nextTab = activeTabForPath(window.location.pathname);
    const canonicalPath = pathForActiveTab(nextTab);
    if (!isCanonicalAppPath(window.location.pathname)) window.history.replaceState({}, '', canonicalPath);
    onModuleChange();
    setActiveTab(nextTab);
  }, [onModuleChange]);
  useEffect(() => {
    synchronizeLocation();
    window.addEventListener('popstate', synchronizeLocation);
    return () => window.removeEventListener('popstate', synchronizeLocation);
  }, [synchronizeLocation]);
  const navigateToTab = useCallback((tab: ActiveTab) => {
    const path = pathForActiveTab(tab);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    onModuleChange();
    setActiveTab(tab);
  }, [onModuleChange]);
  return { activeTab, navigateToTab };
}

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppLanguage, getLanguageLocale, translate, TranslationKey } from './catalog';
import { notifyStorageMutation, storageMutationEvent, type StorageMutation } from '../services/storage';

const LANGUAGE_KEY = 'mischeles_language_v1';
interface LanguageContextValue { language: AppLanguage; locale: string; setLanguage: (language: AppLanguage) => void; t: (key: TranslationKey) => string; }
const LanguageContext = createContext<LanguageContextValue | null>(null);

function readLanguage(): AppLanguage {
  try { return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; }
}

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(readLanguage);
  const setLanguage = (value: AppLanguage) => {
    // Persist before dispatching the sync event so account sync reads the new value immediately.
    try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Storage can be unavailable in private browsing. */ }
    setLanguageState(value);
    notifyStorageMutation('userSettings', 'language');
  };
  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Storage can be unavailable in private browsing. */ }
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const onRemoteSettings = (event: Event) => {
      const detail = (event as CustomEvent<StorageMutation>).detail;
      if (detail?.origin === 'remote' && detail.collection === 'userSettings') setLanguageState(readLanguage());
    };
    window.addEventListener(storageMutationEvent, onRemoteSettings);
    return () => window.removeEventListener(storageMutationEvent, onRemoteSettings);
  }, []);
  const value = useMemo(() => ({ language, locale: getLanguageLocale(language), setLanguage, t: (key: TranslationKey) => translate(language, key) }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}

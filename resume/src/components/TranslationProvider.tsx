'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Locale } from '@/i18n.config';
import en from '@/i18n/en.json';
import vi from '@/i18n/vi.json';

type Messages = typeof en;
type TranslationFunction = (key: string, defaultValue?: string) => string;

interface TranslationContextType {
  t: TranslationFunction;
  locale: Locale;
  mounted: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const translations: Record<Locale, Messages> = { en, vi };

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem('locale') as Locale) || 'en';
    setLocale(stored);
    setMounted(true);

    const handleLocaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<Locale>;
      setLocale(customEvent.detail);
    };

    window.addEventListener('localeChange', handleLocaleChange);
    return () => window.removeEventListener('localeChange', handleLocaleChange);
  }, []);

  const t: TranslationFunction = (key: string, defaultValue?: string): string => {
    const keys = key.split('.');
    let value: any = translations[locale];

    for (const k of keys) {
      value = value?.[k];
    }

    return typeof value === 'string' ? value : (defaultValue || key);
  };

  return (
    <TranslationContext.Provider value={{ t, locale, mounted }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
}

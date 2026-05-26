'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Locale } from '@/i18n.config';
import en from '@/i18n/en.json';
import vi from '@/i18n/vi.json';

type Messages = typeof en;

const translations: Record<Locale, Messages> = {
  en,
  vi,
};

export function useI18n() {
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

  const t = useCallback(
    (key: string, defaultValue?: string): string => {
      const keys = key.split('.');
      let value: any = translations[locale];

      for (const k of keys) {
        value = value?.[k];
      }

      return typeof value === 'string' ? value : (defaultValue || key);
    },
    [locale]
  );

  return { t, locale, mounted };
}

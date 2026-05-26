'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n.config';
import { locales, localeLabels } from '@/i18n.config';

export default function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get stored locale or default to browser language
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored && locales.includes(stored)) {
      setLocale(stored);
      document.documentElement.lang = stored;
    } else {
      const browserLang = navigator.language.split('-')[0];
      const detected = locales.includes(browserLang as Locale) ? (browserLang as Locale) : 'en';
      setLocale(detected);
      document.documentElement.lang = detected;
    }
    setMounted(true);
  }, []);

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
    // Trigger a custom event for other components to listen to
    window.dispatchEvent(new CustomEvent('localeChange', { detail: newLocale }));
  }

  return (
    <div className="flex items-center gap-1">
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleLocaleChange(loc)}
          disabled={!mounted}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            locale === loc && mounted
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          title={localeLabels[loc]}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

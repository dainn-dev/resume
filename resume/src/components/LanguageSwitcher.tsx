'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n.config';
import { locales, localeLabels } from '@/i18n.config';
import { focusRing } from '@/components/ui/Button';

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

  const activeIndex = Math.max(0, locales.indexOf(locale));

  return (
    <div className="relative inline-flex items-center rounded-full bg-gray-800 p-0.5">
      {/* Sliding thumb: highlights the active locale and animates between segments. */}
      <span
        aria-hidden
        className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-blue-600 transition-all duration-200 ease-out ${
          mounted ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          width: `calc((100% - 0.25rem) / ${locales.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleLocaleChange(loc)}
          disabled={!mounted}
          aria-pressed={locale === loc && mounted}
          className={`relative z-10 inline-flex items-center justify-center min-h-[32px] min-w-[40px] px-3 rounded-full text-xs font-semibold transition-colors ${focusRing} ${
            locale === loc && mounted ? 'text-white' : 'text-gray-400 hover:text-white'
          }`}
          title={localeLabels[loc]}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

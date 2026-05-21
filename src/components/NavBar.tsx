"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n.config";
import en from "@/i18n/en.json";
import vi from "@/i18n/vi.json";
import LanguageSwitcher from "./LanguageSwitcher";

type Messages = typeof en;

const translations: Record<Locale, Messages> = { en, vi };

const tabs = [
  { label: "scoreResume", href: "/" },
  { label: "buildResume", href: "/build" },
  { label: "jobMatch", href: "/job-match" },
  { label: "coverLetter", href: "/cover-letter" },
  { label: "salaryEstimator", href: "/salary-estimator" },
  { label: "interviewCoach", href: "/interview-coach" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("locale") as Locale) || "en";
    setLocale(stored);
    setMounted(true);

    const handleLocaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<Locale>;
      setLocale(customEvent.detail);
    };

    window.addEventListener("localeChange", handleLocaleChange);
    return () => window.removeEventListener("localeChange", handleLocaleChange);
  }, []);

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[locale];

    for (const k of keys) {
      value = value?.[k];
    }

    return typeof value === "string" ? value : key;
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
        <span className="text-blue-400 font-semibold text-sm">{t("nav.title")}</span>
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.href === "/" ? pathname === "/" : pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  isActive
                    ? "bg-gray-800 text-white rounded-lg px-4 py-1.5 text-sm font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
                }
              >
                {t(`nav.${tab.label}`)}
              </Link>
            );
          })}
        </div>
        {mounted && <LanguageSwitcher />}
      </div>
    </nav>
  );
}

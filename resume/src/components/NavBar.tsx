"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/i18n.config";
import en from "@/i18n/en.json";
import vi from "@/i18n/vi.json";
import LanguageSwitcher from "./LanguageSwitcher";
import { useAuth } from "./AuthProvider";

type Messages = typeof en;

const translations: Record<Locale, Messages> = { en, vi };

const tabs = [
  { label: "scoreResume", href: "/dashboard" },
  { label: "buildResume", href: "/build" },
  { label: "jobMatch", href: "/job-match" },
  { label: "coverLetter", href: "/cover-letter" },
  { label: "salaryEstimator", href: "/salary-estimator" },
  { label: "interviewCoach", href: "/interview-coach" },
  { label: "careerCoach", href: "/career-coach" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = translations[locale];
    for (const k of keys) { value = value?.[k]; }
    return typeof value === "string" ? value : key;
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
        <Link href="/dashboard" className="text-blue-400 font-semibold text-sm hover:text-blue-300 transition-colors">{t("nav.title")}</Link>

        {/* Desktop tabs */}
        <div className="hidden lg:flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  isActive
                    ? "bg-gray-800 text-white rounded-lg px-3 py-1.5 text-xs font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                }
              >
                {t(`nav.${tab.label}`)}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {mounted && <LanguageSwitcher />}
          {mounted && user && (
            <>
              <Link href="/account" className="hidden sm:block p-1.5 text-gray-400 hover:text-white transition-colors" title={t("account.title")}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </Link>
              <button
                onClick={() => { logout(); router.push("/"); }}
                className="hidden sm:block text-gray-400 hover:text-white text-xs font-medium border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                {t("auth.logout")}
              </button>
            </>
          )}
          {/* Hamburger button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-gray-800 bg-gray-900 px-4 pb-4 pt-2 space-y-1">
          {tabs.map((tab) => {
            const isActive = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                }`}
              >
                {t(`nav.${tab.label}`)}
              </Link>
            );
          })}
          {mounted && user && (
            <>
            <Link href="/account" className="block rounded-lg px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
              {t("account.title")}
            </Link>
            <button
              onClick={() => { logout(); router.push("/"); }}
              className="sm:hidden w-full text-left text-gray-400 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              {t("auth.logout")}
            </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

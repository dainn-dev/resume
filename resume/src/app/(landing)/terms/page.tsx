"use client";

import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "@/components/TranslationProvider";
import Footer from "@/components/Footer";

// Section keys map to terms.<key>Title / terms.<key>Body in the i18n dictionaries.
// Body paragraphs/bullets are separated by "|" (same convention as the privacy page).
const SECTIONS = [
  "acceptance",
  "eligibility",
  "accounts",
  "service",
  "ai",
  "plans",
  "acceptableUse",
  "content",
  "ip",
  "thirdParty",
  "disclaimer",
  "liability",
  "termination",
  "changes",
  "governing",
  "contact",
] as const;

// Sections rendered as bulleted lists rather than paragraphs.
const LIST_SECTIONS = new Set<string>(["acceptableUse", "service"]);

export default function TermsOfServicePage() {
  const { t, mounted } = useTranslation();

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <nav className="flex items-center justify-between h-14 px-4 max-w-3xl mx-auto w-full">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="DResume" width={68} height={32} className="h-8 w-auto" priority />
        </Link>
        <LanguageSwitcher />
      </nav>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <header className="mb-10">
            <h1 className="text-3xl font-bold text-white mb-2">{t("terms.title")}</h1>
            <p className="text-gray-500 text-sm">{t("terms.lastUpdated")}</p>
          </header>

          <article className="space-y-10">
            {SECTIONS.map((key, index) => {
              const body = t(`terms.${key}Body`);
              const paragraphs = body.split("|").map((s) => s.trim()).filter(Boolean);
              const isList = LIST_SECTIONS.has(key) && paragraphs.length > 1;

              return (
                <section key={key} className="scroll-mt-20">
                  <h2 className="text-lg font-semibold text-white mb-3">
                    {index + 1}. {t(`terms.${key}Title`)}
                  </h2>
                  {isList ? (
                    <ul className="space-y-2">
                      {paragraphs.map((p, i) => (
                        <li key={i} className="flex gap-3 text-gray-400 text-sm leading-relaxed">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-3">
                      {paragraphs.map((p, i) => (
                        <p key={i} className="text-gray-400 text-sm leading-relaxed">
                          {p}
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </article>

          <div className="mt-12 pt-6 border-t border-gray-800">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t("terms.backHome")}
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

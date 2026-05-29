"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "@/components/TranslationProvider";
import { useReportBug } from "@/components/ReportBugModal";
import Footer from "@/components/Footer";

// Each category lists the question ids it contains. i18n keys follow the shape
// help.<category>.title, help.<category>.<qId>.q and help.<category>.<qId>.a
const CATEGORIES: { key: string; icon: string; questions: string[] }[] = [
  {
    key: "gettingStarted",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    questions: ["whatIs", "createAccount", "freeVsPaid", "languages"],
  },
  {
    key: "scoring",
    icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
    questions: ["howScoring", "ats", "improveScore", "fileTypes"],
  },
  {
    key: "building",
    icon: "M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z",
    questions: ["howBuilder", "editResume", "tailorJob"],
  },
  {
    key: "tools",
    icon: "M22 12h-4l-3 9L9 3l-3 9H2",
    questions: ["jobMatch", "coverLetter", "salary", "interview", "career"],
  },
  {
    key: "billing",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    questions: ["plans", "paymentMethods", "cancel", "refund"],
  },
  {
    key: "account",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    questions: ["changePassword", "deleteAccount", "privacy"],
  },
];

export default function HelpCenterPage() {
  const { t, mounted } = useTranslation();
  const { open: openReportBug } = useReportBug();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // Flatten all questions once for searching.
  const allItems = useMemo(
    () =>
      CATEGORIES.flatMap((cat) =>
        cat.questions.map((qId) => {
          const id = `${cat.key}.${qId}`;
          return {
            id,
            category: cat.key,
            question: t(`help.${cat.key}.${qId}.q`),
            answer: t(`help.${cat.key}.${qId}.a`),
          };
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mounted]
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? allItems.filter((it) => it.question.toLowerCase().includes(q) || it.answer.toLowerCase().includes(q))
    : null;

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <nav className="flex items-center justify-between h-14 px-4 max-w-4xl mx-auto w-full">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="DResume" width={120} height={32} className="h-8 w-auto" priority />
        </Link>
        <LanguageSwitcher />
      </nav>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-4xl mx-auto w-full">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{t("help.title")}</h1>
            <p className="text-gray-400 text-sm">{t("help.subtitle")}</p>
          </header>

          <div className="relative mb-10 max-w-xl mx-auto">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("help.searchPlaceholder")}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {filtered ? (
            <section className="space-y-3">
              <p className="text-gray-500 text-sm mb-2">
                {filtered.length} {t("help.resultsFor")} “{query.trim()}”
              </p>
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">{t("help.noResults")}</div>
              ) : (
                filtered.map((it) => (
                  <FaqItem
                    key={it.id}
                    question={it.question}
                    answer={it.answer}
                    isOpen={open === it.id}
                    onToggle={() => setOpen(open === it.id ? null : it.id)}
                  />
                ))
              )}
            </section>
          ) : (
            <div className="space-y-10">
              {CATEGORIES.map((cat) => (
                <section key={cat.key}>
                  <h2 className="flex items-center gap-2.5 text-lg font-semibold text-white mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                      </svg>
                    </span>
                    {t(`help.${cat.key}.title`)}
                  </h2>
                  <div className="space-y-3">
                    {cat.questions.map((qId) => {
                      const id = `${cat.key}.${qId}`;
                      return (
                        <FaqItem
                          key={id}
                          question={t(`help.${cat.key}.${qId}.q`)}
                          answer={t(`help.${cat.key}.${qId}.a`)}
                          isOpen={open === id}
                          onToggle={() => setOpen(open === id ? null : id)}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* Still need help CTA */}
          <div className="mt-12 bg-gradient-to-b from-blue-600/10 to-transparent border border-blue-500/20 rounded-2xl p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">{t("help.ctaTitle")}</h2>
            <p className="text-gray-400 text-sm mb-5">{t("help.ctaSubtitle")}</p>
            <button
              onClick={openReportBug}
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors text-sm"
            >
              {t("reportBug.title")}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-white">{question}</span>
        <svg
          className={`w-5 h-5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-4 -mt-1">
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{answer}</p>
        </div>
      )}
    </div>
  );
}

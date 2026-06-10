"use client";

import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";

// Global 404 — rendered by Next.js App Router for any unmatched route.
// Wrapped by the root layout, so TranslationProvider is available here.
export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <p className="text-7xl font-extrabold tracking-tight text-amber-400 mb-4">404</p>
        <h1 className="text-2xl font-bold mb-3">{t("notFound.title")}</h1>
        <p className="text-gray-400 mb-6 leading-relaxed">{t("notFound.body")}</p>

        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-sm font-semibold text-gray-950 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          {t("notFound.home")}
        </Link>
      </div>
    </div>
  );
}

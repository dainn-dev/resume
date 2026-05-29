"use client";

import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import { useReportBug } from "@/components/ReportBugModal";

const LINKS = [
  { href: "/help", key: "landing.footerHelp" },
  { href: "/privacy", key: "landing.footerPrivacy" },
  { href: "/terms", key: "landing.footerTerms" },
];

const linkClass = "text-gray-500 hover:text-gray-300 transition-colors text-xs";

export default function Footer() {
  const { t } = useTranslation();
  const { open } = useReportBug();

  return (
    <footer className="border-t border-gray-800 py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-2">
        <p className="text-center text-gray-500 text-xs">{t("landing.footerCopyright")}</p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {LINKS.map((link, i) => (
            <span key={link.href} className="flex items-center gap-4">
              {i > 0 && <span className="text-gray-700 text-xs">·</span>}
              <Link href={link.href} className={linkClass}>
                {t(link.key)}
              </Link>
            </span>
          ))}
          <span className="text-gray-700 text-xs">·</span>
          <button type="button" onClick={open} className={linkClass}>
            {t("landing.footerReportBug")}
          </button>
        </div>
      </div>
    </footer>
  );
}

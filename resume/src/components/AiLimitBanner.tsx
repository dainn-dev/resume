"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import { focusRing } from "@/components/ui/Button";
import type { AccountSummaryAiUsage, AccountSummaryPlan } from "@/lib/accountClient";

interface AiUsageState {
  usage: AccountSummaryAiUsage;
  plan: AccountSummaryPlan;
}

export default function AiLimitBanner() {
  const { t } = useTranslation();
  const [state, setState] = useState<AiUsageState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me/summary", { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (cancelled || !body?.success || !body.data) return;
        const { aiUsage, plan } = body.data;
        if (aiUsage && aiUsage.limit !== null) {
          setState({ usage: aiUsage, plan });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (!state || dismissed) return null;

  const { used, limit } = state.usage;
  const pct = limit! > 0 ? (used / limit!) * 100 : 0;

  // Show at 80% or above
  if (pct < 80) return null;

  const isAtLimit = used >= limit!;
  const planName = state.plan.name;

  const bgClass = isAtLimit
    ? "bg-red-500/10 border-red-500/30 text-red-300"
    : "bg-amber-500/10 border-amber-500/30 text-amber-300";

  const raw = isAtLimit ? t("aiLimit.reached") : t("aiLimit.approaching");
  const message = raw
    .replace("{used}", String(used))
    .replace("{limit}", String(limit))
    .replace("{plan}", planName);

  return (
    <div className={`${bgClass} border-b`}>
      <div className="px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <span className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isAtLimit ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-7.5 12.99A1.5 1.5 0 004.14 19.5h15.72a1.5 1.5 0 001.3-2.57l-7.5-12.99a1.5 1.5 0 00-2.6 0z" />
            )}
          </svg>
          <span className="truncate">{message}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {state.plan.code !== "Premium" && (
            <Link
              href="/account"
              className={`rounded bg-white/10 px-2 py-0.5 text-xs font-medium hover:bg-white/20 transition-colors ${focusRing}`}
            >
              {t("aiLimit.upgrade")}
            </Link>
          )}
          <button
            onClick={() => setDismissed(true)}
            className={`opacity-60 hover:opacity-100 transition-opacity ${focusRing} rounded`}
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      </div>
    </div>
  );
}

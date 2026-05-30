"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/components/TranslationProvider";
import BillingPanel from "@/components/BillingPanel";
import { fetchAccountSummary, type AccountSummary } from "@/lib/accountClient";

export default function AccountPage() {
  const { t, mounted } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccountSummary();
      if (!data) { setError(t("account.loadError")); return; }
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const checkout = searchParams.get("checkout");
      const sessionId = searchParams.get("session_id");
      try {
        if (checkout === "success" && sessionId) {
          await fetch("/api/billing/sync-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (!cancelled) router.replace("/account");
        } else {
          await fetch("/api/billing/sync-current", { method: "POST" });
        }
      } catch { /* fall through to DB state */ }
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [searchParams, load, router]);

  // Auto-refresh usage every 60s
  useEffect(() => {
    const id = setInterval(async () => {
      const data = await fetchAccountSummary();
      if (data) setSummary(data);
    }, 60_000);
    return () => clearInterval(id);
  }, []);


  if (!mounted || loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="h-12 bg-gray-900 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  const displayName = summary?.user.displayName || summary?.user.firstName || user?.name || "";
  const email = summary?.user.email || user?.email || "";

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
          {(displayName || email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{t("account.title")}</h1>
          {email && <p className="text-gray-400 text-sm truncate">{email}</p>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {summary && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              summary.plan.code === "Free"
                ? "text-gray-400 bg-gray-800 border-gray-700"
                : summary.plan.code === "Pro"
                  ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                  : "text-amber-300 bg-amber-500/10 border-amber-500/30"
            }`}>
              {summary.plan.name}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}{" "}
          <button onClick={() => void load()} className="underline">{t("account.retry")}</button>
        </div>
      )}

      {/* AI Usage */}
      {summary?.aiUsage && summary.aiUsage.limit !== null && (
        <AiUsageCard used={summary.aiUsage.used} limit={summary.aiUsage.limit} planName={summary.plan.name} />
      )}

      {/* Billing */}
      <BillingPanel />

    </main>
  );
}

function AiUsageCard({ used, limit, planName }: { used: number; limit: number; planName: string }) {
  const { t } = useTranslation();
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isAtLimit = used >= limit;

  const barColor = isAtLimit
    ? "bg-red-500"
    : pct >= 80
      ? "bg-amber-500"
      : "bg-blue-500";

  const label = t("account.aiUsageLabel")
    .replace("{used}", String(used))
    .replace("{limit}", String(limit));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{t("billing.aiCallsLabel")}</h2>
        <span className="text-xs text-gray-400">{planName}</span>
      </div>

      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={isAtLimit ? "text-red-400 font-medium" : "text-gray-400"}>
          {label}
        </span>
        <span className="text-gray-500">{Math.round(pct)}%</span>
      </div>

      {isAtLimit && (
        <p className="text-xs text-red-400/80">
          {t("account.aiUsageExhausted")}
        </p>
      )}
    </div>
  );
}

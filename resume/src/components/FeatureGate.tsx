"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/components/TranslationProvider";
import { fetchAccountSummary, type AccountSummary, type FeatureKey } from "@/lib/accountClient";

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

// Gates a feature page: shows its children when the current plan includes `feature`, otherwise an
// upsell card pointing at the lowest plan that unlocks it (admin-configured in /admin/plans).
// Children only mount when access is granted, so their data-loading effects don't run while gated.
export default function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAccountSummary().then((s) => {
      if (!cancelled) { setSummary(s); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  if (!loaded) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  // Fail open if access info is unavailable — the backend still enforces the gate (HTTP 402).
  const allowed = summary?.plan.features?.[feature] ?? true;
  if (allowed) return <>{children}</>;

  const planName = summary?.plan.featurePlans?.[feature] || "Premium";

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white">{interpolate(t("featureGate.title"), { plan: planName })}</h2>
        <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">{interpolate(t("featureGate.body"), { plan: planName })}</p>
        <Link href="/billing" className="inline-block mt-5">
          <Button>{interpolate(t("featureGate.cta"), { plan: planName })}</Button>
        </Link>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

interface PlanLimits {
  maxResumes: number | null;
  monthlyAiCalls: number | null;
  jobMatchEnabled: boolean;
  coverLetterEnabled: boolean;
  careerCoachEnabled: boolean;
  interviewCoachEnabled: boolean;
  salaryEstimatorEnabled: boolean;
  priorityQueue: boolean;
}

interface Plan {
  code: string;
  lookupKey: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: string;
  isPaid: boolean;
  limits: PlanLimits;
}

interface MyPlan {
  plan: { code: string; name: string; lookupKey: string };
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
}

function formatPrice(cents: number, currency: string) {
  if (cents === 0) return "Free";
  const amount = (cents / 100).toFixed(2);
  const symbol = currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${symbol}${amount}/mo`;
}

export default function BillingPanel() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [me, setMe] = useState<MyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [plansRes, meRes] = await Promise.all([
        fetch("/api/billing/plans").then(r => r.json()).catch(() => ({ success: false })),
        fetch("/api/billing/me").then(r => r.json()).catch(() => ({ success: false })),
      ]);
      if (plansRes?.success) setPlans(plansRes.data ?? []);
      if (meRes?.success) setMe(meRes.data ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function upgrade(planCode: string) {
    setError(null);
    setBusyCode(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Failed to start checkout.");
        return;
      }
      if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setError("Stripe did not return a checkout URL.");
      }
    } finally {
      setBusyCode(null);
    }
  }

  async function cancel() {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the current period.")) return;
    setError(null);
    setBusyCode("cancel");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Failed to cancel.");
        return;
      }
      await load();
    } finally {
      setBusyCode(null);
    }
  }

  if (loading) {
    return <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse h-64" />;
  }

  const currentCode = me?.plan.code ?? "Free";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Plan & Billing</h2>
        {me && (
          <span className="text-xs text-gray-400">
            Current: <span className="text-white font-medium">{me.plan.name}</span>
            {me.cancelAtPeriodEnd && <span className="ml-2 text-amber-400">(cancels at period end)</span>}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {plans.map(plan => {
          const isCurrent = plan.code === currentCode;
          const isFree = !plan.isPaid;
          return (
            <div
              key={plan.code}
              className={`rounded-2xl border p-5 flex flex-col ${
                isCurrent ? "border-blue-500 bg-blue-500/5" : "border-gray-800 bg-gray-900"
              }`}
            >
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-white font-semibold">{plan.name}</h3>
                <span className="text-xs text-gray-400">{formatPrice(plan.monthlyPriceCents, plan.currency)}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">{plan.description}</p>
              <ul className="text-xs text-gray-300 space-y-1 mb-4 flex-1">
                <li>• Resumes: {plan.limits.maxResumes ?? "Unlimited"}</li>
                <li>• AI calls/month: {plan.limits.monthlyAiCalls ?? "Unlimited"}</li>
                <li className={plan.limits.jobMatchEnabled ? "text-gray-300" : "text-gray-600 line-through"}>• Job Match</li>
                <li className={plan.limits.coverLetterEnabled ? "text-gray-300" : "text-gray-600 line-through"}>• Cover Letter</li>
                <li className={plan.limits.careerCoachEnabled ? "text-gray-300" : "text-gray-600 line-through"}>• Career Coach</li>
                <li className={plan.limits.interviewCoachEnabled ? "text-gray-300" : "text-gray-600 line-through"}>• Interview Coach</li>
                <li className={plan.limits.salaryEstimatorEnabled ? "text-gray-300" : "text-gray-600 line-through"}>• Salary Estimator</li>
                {plan.limits.priorityQueue && <li className="text-amber-300">• Priority queue</li>}
              </ul>

              {isCurrent ? (
                isFree ? (
                  <button disabled className="w-full bg-gray-800 text-gray-500 text-sm font-semibold py-2 rounded-lg cursor-default">
                    Current plan
                  </button>
                ) : (
                  <button
                    onClick={cancel}
                    disabled={busyCode === "cancel"}
                    className="w-full border border-red-500/40 hover:bg-red-500/10 text-red-400 text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    {busyCode === "cancel" ? "…" : "Cancel subscription"}
                  </button>
                )
              ) : isFree ? (
                <button disabled className="w-full bg-gray-800 text-gray-500 text-sm font-semibold py-2 rounded-lg cursor-default">
                  Default
                </button>
              ) : (
                <button
                  onClick={() => upgrade(plan.code)}
                  disabled={busyCode === plan.code}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-300 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                >
                  {busyCode === plan.code ? "…" : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

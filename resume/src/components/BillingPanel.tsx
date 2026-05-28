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

interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface InvoiceInfo {
  id: string;
  number: string | null;
  status: string;
  amountPaid: number;
  amountDue: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  description: string | null;
}

interface MyPlan {
  plan: { code: string; name: string; lookupKey: string };
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
  paymentMethod: PaymentMethodInfo | null;
  invoices: InvoiceInfo[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

function formatUnixDate(unix: number): string {
  try {
    return new Date(unix * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return String(unix); }
}

function formatAmount(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  const symbol = currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${symbol}${amount}`;
}

function cardBrandIcon(brand: string): string {
  const b = brand.toLowerCase();
  if (b === "visa") return "VISA";
  if (b === "mastercard") return "MC";
  if (b === "amex") return "AMEX";
  if (b === "discover") return "DISC";
  return brand.toUpperCase();
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
      if (data.data?.updated) {
        // In-place subscription swap — no Stripe redirect needed
        await load();
      } else if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setError("Unexpected response from billing service.");
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

  async function resume() {
    setError(null);
    setBusyCode("resume");
    try {
      const res = await fetch("/api/billing/resume", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error ?? "Failed to resume.");
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
  const tierOrder: Record<string, number> = { Free: 0, Pro: 1, Enterprise: 2 };
  const currentTier = tierOrder[currentCode] ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Plan & Billing</h2>
        {me && (
          <span className="text-xs text-gray-400">
            Current: <span className="text-white font-medium">{me.plan.name}</span>
          </span>
        )}
      </div>

      {/* Subscription status banner */}
      {me && me.currentPeriodEnd && me.plan.code !== "Free" && (
        <div className={`rounded-xl border p-3 text-xs flex items-center justify-between gap-3 ${
          me.cancelAtPeriodEnd
            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
            : "bg-blue-500/10 border-blue-500/30 text-blue-200"
        }`}>
          <span>
            {me.cancelAtPeriodEnd ? (
              <>Your plan will be <span className="font-semibold">canceled</span> on {formatDate(me.currentPeriodEnd)}.</>
            ) : (
              <>Your plan will <span className="font-semibold">renew</span> on {formatDate(me.currentPeriodEnd)}.</>
            )}
          </span>
          {me.cancelAtPeriodEnd && (
            <button
              onClick={resume}
              disabled={busyCode === "resume"}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {busyCode === "resume" ? "…" : "Resume subscription"}
            </button>
          )}
        </div>
      )}

      {/* Payment method */}
      {me?.paymentMethod && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-gray-800 text-gray-200 text-[10px] font-bold tracking-wider">
              {cardBrandIcon(me.paymentMethod.brand)}
            </span>
            <div>
              <p className="text-sm text-white font-medium">•••• {me.paymentMethod.last4}</p>
              <p className="text-[11px] text-gray-500">
                Expires {String(me.paymentMethod.expMonth).padStart(2, "0")}/{me.paymentMethod.expYear}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">Default payment</span>
        </div>
      )}

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
                ) : me?.cancelAtPeriodEnd ? (
                  <button disabled className="w-full bg-gray-800 text-gray-500 text-sm font-semibold py-2 rounded-lg cursor-default">
                    Cancellation scheduled
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
                  {busyCode === plan.code ? "…" : `${(tierOrder[plan.code] ?? 0) < currentTier ? "Downgrade" : "Upgrade"} to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Billing history */}
      {me && me.invoices.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Billing history</h3>
          <div className="space-y-1.5">
            {me.invoices.map(inv => {
              const statusColor =
                inv.status === "paid" ? "text-green-400 bg-green-500/10 border-green-500/30"
                : inv.status === "open" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                : inv.status === "void" || inv.status === "uncollectible" ? "text-gray-500 bg-gray-500/10 border-gray-500/30"
                : "text-blue-400 bg-blue-500/10 border-blue-500/30";
              return (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-b-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-400 w-24 shrink-0">{formatUnixDate(inv.created)}</span>
                    <span className="text-sm text-white font-medium">
                      {formatAmount(inv.amountPaid > 0 ? inv.amountPaid : inv.amountDue, inv.currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${statusColor}`}>
                      {inv.status}
                    </span>
                    {inv.hostedInvoiceUrl && (
                      <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                        View →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/TranslationProvider";
import DiscountCountdown, { isPromoLive, isSoldOut, remainingRedemptions, effectiveDiscountPercent } from "@/components/DiscountCountdown";

interface PlanLimits {
  maxResumes: number | null;
  monthlyAiCalls: number | null;
  jobMatchEnabled: boolean;
  coverLetterEnabled: boolean;
  careerCoachEnabled: boolean;
  interviewCoachEnabled: boolean;
  salaryEstimatorEnabled: boolean;
  calendarEnabled: boolean;
  companyReviewEnabled: boolean;
  priorityQueue: boolean;
}

interface BankTier {
  months: number;
  discountPercent: number;
  startDate?: string | null;
  endDate?: string | null;
  maxRedemptions?: number | null;
  redemptions?: number | null;
}

interface Plan {
  code: string;
  lookupKey: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: string;
  monthlyPriceVnd: number;
  isPaid: boolean;
  bankTiers: BankTier[];
  limits: PlanLimits;
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

function computeBankAmount(monthlyVnd: number, months: number, discountPct: number): number {
  const gross = monthlyVnd * months;
  const net = (gross * (100 - discountPct)) / 100;
  return Math.round(net / 1000) * 1000;
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

interface BankPaymentItem {
  id: string;
  planCode: string;
  durationMonths: number;
  amountVnd: number;
  transactionCode: string;
  status: string;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
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

export default function BillingPanel() {
  const router = useRouter();
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [me, setMe] = useState<MyPlan | null>(null);
  const [bankPayments, setBankPayments] = useState<BankPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bankModalPlan, setBankModalPlan] = useState<Plan | null>(null);
  const [bankMonths, setBankMonths] = useState<number>(1);
  const [bankBusy, setBankBusy] = useState(false);
  const [methods, setMethods] = useState<{
    cardPaymentsEnabled: boolean;
    bankQrEnabled: boolean;
    testPlanEnabled?: boolean;
    testPlanPriceVnd?: number;
  }>({ cardPaymentsEnabled: true, bankQrEnabled: true });

  function formatPrice(cents: number, currency: string) {
    if (cents === 0) return t("billing.freePrice");
    const amount = (cents / 100).toFixed(2);
    const symbol = currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
    return `${symbol}${amount}${t("billing.perMonthSuffix")}`;
  }

  function durationLabel(months: number): string {
    if (months === 0) return t("billing.oneDay");
    if (months === 1) return t("billing.oneMonth");
    return interpolate(t("billing.nMonths"), { count: months });
  }

  function bankStatusLabel(status: string): string {
    const key = `billing.status${status.charAt(0).toUpperCase()}${status.slice(1).toLowerCase()}`;
    return t(key, status);
  }

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [plansRes, meRes, cfgRes, bankRes] = await Promise.all([
        fetch("/api/billing/plans").then(r => r.json()).catch(() => ({ success: false })),
        fetch("/api/billing/me").then(r => r.json()).catch(() => ({ success: false })),
        fetch("/api/billing/config").then(r => r.json()).catch(() => ({ success: false })),
        fetch("/api/billing/bank/payments/my").then(r => r.json()).catch(() => ({ success: false })),
      ]);
      if (plansRes?.success) setPlans(plansRes.data ?? []);
      if (meRes?.success) setMe(meRes.data ?? null);
      if (cfgRes?.success && cfgRes.data) setMethods(cfgRes.data);
      if (bankRes?.success) setBankPayments(bankRes.data ?? []);
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
        setError(data?.error ?? t("billing.errCheckout"));
        return;
      }
      if (data.data?.updated) {
        // In-place subscription swap — no Stripe redirect needed
        await load();
      } else if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        setError(t("billing.errUnexpected"));
      }
    } finally {
      setBusyCode(null);
    }
  }

  async function bankCheckout() {
    if (!bankModalPlan) return;
    setBankBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/bank/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: bankModalPlan.code, durationMonths: bankMonths }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error ?? t("billing.errBankCheckout"));
        return;
      }
      const paymentId = data.data?.paymentId;
      if (paymentId) {
        setBankModalPlan(null);
        router.push(`/billing/bank/${paymentId}`);
      }
    } finally {
      setBankBusy(false);
    }
  }

  async function cancel() {
    if (!confirm(t("billing.cancelConfirm"))) return;
    setError(null);
    setBusyCode("cancel");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.error ?? t("billing.errCancel"));
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
        setError(data?.error ?? t("billing.errResume"));
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
  // Bank QR / non-Stripe paid plan: no auto-renew, no subscription to cancel — it simply ends.
  const isBankPlan = !!me && me.plan.code !== "Free" && !me.stripeSubscriptionId;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t("billing.heading")}</h2>
        {me && (
          <span className="text-xs text-gray-400">
            {t("billing.currentLabel")} <span className="text-white font-medium">{me.plan.name}</span>
          </span>
        )}
      </div>

      {/* Subscription status banner */}
      {me && me.currentPeriodEnd && me.plan.code !== "Free" && (
        <div className={`rounded-xl border p-3 text-xs flex items-center justify-between gap-3 ${
          me.cancelAtPeriodEnd || isBankPlan
            ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
            : "bg-blue-500/10 border-blue-500/30 text-blue-200"
        }`}>
          <span>
            {isBankPlan
              ? interpolate(t("billing.willEnd"), { date: formatDate(me.currentPeriodEnd) })
              : me.cancelAtPeriodEnd
                ? interpolate(t("billing.willCancel"), { date: formatDate(me.currentPeriodEnd) })
                : interpolate(t("billing.willRenew"), { date: formatDate(me.currentPeriodEnd) })}
          </span>
          {!isBankPlan && me.cancelAtPeriodEnd && (
            <button
              onClick={resume}
              disabled={busyCode === "resume"}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              {busyCode === "resume" ? "…" : t("billing.resumeSubscription")}
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
                {interpolate(t("billing.expires"), {
                  date: `${String(me.paymentMethod.expMonth).padStart(2, "0")}/${me.paymentMethod.expYear}`,
                })}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-gray-600 uppercase tracking-wider">{t("billing.defaultPayment")}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {plans.map(plan => {
          const isCurrent = plan.code === currentCode;
          const isFree = !plan.isPaid;
          const featureRows = [
            { label: t("billing.featureJobMatch"), on: plan.limits.jobMatchEnabled },
            { label: t("billing.featureCoverLetter"), on: plan.limits.coverLetterEnabled },
            { label: t("billing.featureCareerCoach"), on: plan.limits.careerCoachEnabled },
            { label: t("billing.featureInterviewCoach"), on: plan.limits.interviewCoachEnabled },
            { label: t("billing.featureSalaryEstimator"), on: plan.limits.salaryEstimatorEnabled },
            { label: t("billing.featureCalendar"), on: plan.limits.calendarEnabled },
            { label: t("billing.featureCompanyReviews"), on: plan.limits.companyReviewEnabled },
          ].sort((a, b) => Number(b.on) - Number(a.on));
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
              <ul className="text-xs text-gray-300 space-y-1 mb-1 flex-1">
                <li>• {t("billing.resumesLabel")}: {plan.limits.maxResumes ?? t("billing.unlimited")}</li>
                <li>• {t("billing.aiCallsLabel")}: {plan.limits.monthlyAiCalls ?? t("billing.unlimited")}</li>
                <li className="hidden sm:list-item">&nbsp;</li>
                {featureRows.map(f => (
                  <li key={f.label} className={`hidden sm:list-item ${f.on ? "text-gray-300" : "text-gray-600 line-through"}`}>• {f.label}</li>
                ))}
                {plan.limits.priorityQueue && <li className="hidden sm:list-item text-amber-300">• {t("billing.priorityQueue")}</li>}
              </ul>
              <details className="sm:hidden mb-3 text-xs">
                <summary className="text-blue-400 cursor-pointer">{t("billing.seeFeatures")}</summary>
                <ul className="mt-2 space-y-1 text-gray-300">
                  {featureRows.map(f => (
                    <li key={f.label} className={f.on ? "text-gray-300" : "text-gray-600 line-through"}>• {f.label}</li>
                  ))}
                  {plan.limits.priorityQueue && <li className="text-amber-300">• {t("billing.priorityQueue")}</li>}
                </ul>
              </details>

              {isCurrent ? (
                isFree ? (
                  <button disabled className="w-full bg-gray-800 text-gray-500 text-sm font-semibold py-2 rounded-lg cursor-default">
                    {t("billing.currentPlan")}
                  </button>
                ) : isBankPlan ? (
                  <button disabled className="w-full bg-gray-800 text-gray-500 text-sm font-semibold py-2 rounded-lg cursor-default">
                    {t("billing.currentPlan")}
                  </button>
                ) : me?.cancelAtPeriodEnd ? (
                  <button disabled className="w-full bg-gray-800 text-gray-500 text-sm font-semibold py-2 rounded-lg cursor-default">
                    {t("billing.cancellationScheduled")}
                  </button>
                ) : (
                  <button
                    onClick={cancel}
                    disabled={busyCode === "cancel"}
                    className="w-full border border-red-500/40 hover:bg-red-500/10 text-red-400 text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    {busyCode === "cancel" ? "…" : t("billing.cancelSubscription")}
                  </button>
                )
              ) : isFree ? (
                <button disabled className="w-full bg-gray-800 text-gray-500 text-sm font-semibold py-2 rounded-lg cursor-default">
                  {t("billing.defaultBadge")}
                </button>
              ) : (
                <div className="space-y-2">
                  {methods.cardPaymentsEnabled && (
                    <button
                      onClick={() => upgrade(plan.code)}
                      disabled={busyCode === plan.code}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-300 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      {busyCode === plan.code ? "…" : interpolate(t("billing.payWithCard"), { price: formatPrice(plan.monthlyPriceCents, plan.currency) })}
                    </button>
                  )}
                  {methods.bankQrEnabled && plan.monthlyPriceVnd > 0 && plan.bankTiers.length > 0 && (
                    <button
                      onClick={() => { setBankModalPlan(plan); setBankMonths(plan.bankTiers[0]?.months ?? 1); }}
                      className="w-full border border-purple-500/40 hover:bg-purple-500/10 text-purple-300 text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      {interpolate(t("billing.payWithBankQr"), { price: formatVnd(plan.monthlyPriceVnd) })}
                    </button>
                  )}
                  {!methods.cardPaymentsEnabled && !(methods.bankQrEnabled && plan.monthlyPriceVnd > 0 && plan.bankTiers.length > 0) && (
                    <p className="text-xs text-gray-500 text-center py-2">{t("billing.noPaymentMethod")}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bank QR duration picker modal */}
      {bankModalPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !bankBusy && setBankModalPlan(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="text-white font-semibold text-lg">{t("billing.bankModalTitle")}</h3>
              <p className="text-gray-400 text-sm mt-1">
                {interpolate(t("billing.bankModalSubtitle"), { plan: bankModalPlan.name })}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(methods.testPlanEnabled && bankModalPlan.code === "Pro"
                ? [{ months: 0, discountPercent: 0 }, ...bankModalPlan.bankTiers]
                : bankModalPlan.bankTiers
              ).map(opt => {
                const isTest = opt.months === 0;
                const isSelected = bankMonths === opt.months;
                const eff = isTest ? 0 : effectiveDiscountPercent(opt);
                const total = isTest
                  ? (methods.testPlanPriceVnd ?? 2000)
                  : computeBankAmount(bankModalPlan.monthlyPriceVnd, opt.months, eff);
                return (
                  <button
                    key={opt.months}
                    onClick={() => setBankMonths(opt.months)}
                    className={`relative rounded-xl border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-gray-700 hover:border-gray-600 bg-gray-800/40"
                    }`}
                  >
                    {isTest ? (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-gray-950 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {t("billing.testBadge")}
                      </span>
                    ) : eff > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-gray-950 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        -{eff}%
                      </span>
                    )}
                    <p className="text-white text-sm font-semibold">{durationLabel(opt.months)}</p>
                    <p className="mt-1 flex items-baseline flex-wrap gap-x-1.5">
                      <span className="text-purple-300 text-sm font-bold">{formatVnd(total)}</span>
                      {opt.months > 1 && (
                        <span className="text-gray-500 text-[10px]">
                          {interpolate(t("billing.perMonthApprox"), { price: formatVnd(Math.round(total / opt.months / 1000) * 1000) })}
                        </span>
                      )}
                    </p>
                    {!isTest && (isPromoLive(opt) || (opt.maxRedemptions != null && !isSoldOut(opt.maxRedemptions, opt.redemptions))) && (
                      <p className="flex items-center gap-1.5 text-amber-300 text-[10px] font-semibold mt-1">
                        {isPromoLive(opt) && (
                          <DiscountCountdown endDate={opt.endDate} label={(r) => `⏳ ${r}`} />
                        )}
                        {isPromoLive(opt) && opt.maxRedemptions != null && !isSoldOut(opt.maxRedemptions, opt.redemptions) && (
                          <span className="text-amber-300/50">·</span>
                        )}
                        {opt.maxRedemptions != null && !isSoldOut(opt.maxRedemptions, opt.redemptions) && (
                          <span className="text-amber-300/80">{remainingRedemptions(opt.maxRedemptions, opt.redemptions)} left</span>
                        )}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-red-400 text-xs">{error}</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setBankModalPlan(null)}
                disabled={bankBusy}
                className="flex-1 border border-gray-700 hover:bg-gray-800 text-gray-300 text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {t("billing.cancel")}
              </button>
              <button
                onClick={bankCheckout}
                disabled={bankBusy}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {bankBusy ? t("billing.generatingQr") : t("billing.continue")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing history (Stripe invoices) */}
      {me && me.invoices.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">{t("billing.billingHistory")}</h3>
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
                        {t("billing.view")} →
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bank transfer history */}
      {bankPayments.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">{t("billing.bankHistory")}</h3>
          <div className="space-y-1.5">
            {bankPayments.map(p => {
              const statusColor =
                p.status === "Confirmed" ? "text-green-400 bg-green-500/10 border-green-500/30"
                : p.status === "Pending" ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                : p.status === "Failed" ? "text-red-400 bg-red-500/10 border-red-500/30"
                : "text-gray-500 bg-gray-500/10 border-gray-500/30";
              const isPending = p.status === "Pending";
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-b-0 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-400 w-24 shrink-0">{formatDate(p.paidAt ?? p.createdAt)}</span>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">
                        {formatVnd(p.amountVnd)} <span className="text-gray-500 font-normal">· {p.planCode} · {durationLabel(p.durationMonths)}</span>
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono truncate">{p.transactionCode}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase ${statusColor}`}>
                      {bankStatusLabel(p.status)}
                    </span>
                    {isPending && (
                      <button
                        onClick={() => router.push(`/billing/bank/${p.id}`)}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        {t("billing.view")} →
                      </button>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/components/TranslationProvider";
import AdminNav from "@/components/AdminNav";

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

interface BankAccountSummary {
  bankCode: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountHolder: string;
}

interface BankPayment {
  id: string;
  userId: string;
  userEmail: string | null;
  planCode: string;
  durationMonths: number;
  amountVnd: number;
  transactionCode: string;
  bank: BankAccountSummary;
  status: string;
  paidAt: string | null;
  confirmedByEmail: string | null;
  notes: string | null;
  webhookRaw: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_FILTERS = ["", "Pending", "Confirmed", "Failed", "Cancelled", "Expired"];

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Pending: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    Confirmed: "bg-green-500/10 border-green-500/30 text-green-300",
    Failed: "bg-red-500/10 border-red-500/30 text-red-300",
    Cancelled: "bg-gray-500/10 border-gray-500/30 text-gray-400",
    Expired: "bg-gray-500/10 border-gray-500/30 text-gray-500",
  };
  return map[status] ?? "bg-gray-500/10 border-gray-500/30 text-gray-400";
}

export default function AdminBankPaymentsPage() {
  const { t } = useTranslation();
  const statusLabel = (status: string): string => {
    const map: Record<string, string> = {
      Pending: t("adminBankPayments.statusPending"),
      Confirmed: t("adminBankPayments.statusConfirmed"),
      Failed: t("adminBankPayments.statusFailed"),
      Cancelled: t("adminBankPayments.statusCancelled"),
      Expired: t("adminBankPayments.statusExpired"),
    };
    return map[status] ?? status;
  };
  const [payments, setPayments] = useState<BankPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("Pending");
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/admin/bank-payments${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? t("adminBankPayments.failed"));
      setPayments(json.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminBankPayments.error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function confirmPayment(p: BankPayment) {
    if (!confirm(interpolate(t("adminBankPayments.confirmPrompt"), { code: p.transactionCode, amount: formatVnd(p.amountVnd), plan: p.planCode, months: p.durationMonths }))) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/admin/bank-payments/${p.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: t("adminBankPayments.manuallyConfirmedNote") }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? t("adminBankPayments.confirmFailed"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminBankPayments.error"));
    } finally {
      setBusy(null);
    }
  }

  async function cancelPayment(p: BankPayment) {
    const notes = prompt(t("adminBankPayments.cancelReasonPrompt")) ?? "";
    if (notes === null) return;
    setBusy(p.id);
    try {
      const res = await fetch(`/api/admin/bank-payments/${p.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? t("adminBankPayments.cancelFailed"));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminBankPayments.error"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-2xl font-bold text-white">{t("adminBankPayments.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("adminBankPayments.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-400 w-full sm:w-auto">{t("adminBankPayments.filterLabel")}</span>
        {STATUS_FILTERS.map(s => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === s ? "border-blue-500 bg-blue-500/10 text-blue-300" : "border-gray-700 text-gray-400 hover:border-gray-600"
            }`}
          >
            {s ? statusLabel(s) : t("adminBankPayments.all")}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto text-xs text-blue-400 hover:text-blue-300">{t("adminBankPayments.refresh")}</button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="h-64 bg-gray-900 rounded-2xl animate-pulse" />
      ) : payments.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400 text-sm">
          {t("adminBankPayments.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(p => {
            const isOpen = expandedId === p.id;
            return (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase shrink-0 ${statusBadge(p.status)}`}>{statusLabel(p.status)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-mono text-sm font-bold">{p.transactionCode}</span>
                      <span className="text-gray-500 text-xs">{p.planCode} · {interpolate(t("adminBankPayments.monthsShort"), { count: p.durationMonths })}</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">
                      {p.userEmail ?? p.userId} · {new Date(p.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <span className="text-green-400 text-sm font-bold shrink-0">{formatVnd(p.amountVnd)}</span>
                  <button onClick={() => setExpandedId(isOpen ? null : p.id)} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">
                    {isOpen ? t("adminBankPayments.close") : t("adminBankPayments.details")}
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-800 p-4 space-y-3 bg-gray-950/40">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500">{t("adminBankPayments.bank")}</p>
                        <p className="text-white">{p.bank.bankName} · {p.bank.accountNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t("adminBankPayments.holder")}</p>
                        <p className="text-white">{p.bank.accountHolder}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t("adminBankPayments.userId")}</p>
                        <p className="text-gray-300 font-mono">{p.userId}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{t("adminBankPayments.expires")}</p>
                        <p className="text-gray-300">{new Date(p.expiresAt).toLocaleString("vi-VN")}</p>
                      </div>
                      {p.paidAt && (
                        <div>
                          <p className="text-gray-500">{t("adminBankPayments.paidAt")}</p>
                          <p className="text-gray-300">{new Date(p.paidAt).toLocaleString("vi-VN")}</p>
                        </div>
                      )}
                      {p.confirmedByEmail && (
                        <div>
                          <p className="text-gray-500">{t("adminBankPayments.confirmedBy")}</p>
                          <p className="text-gray-300">{p.confirmedByEmail}</p>
                        </div>
                      )}
                    </div>
                    {p.notes && (
                      <div>
                        <p className="text-xs text-gray-500">{t("adminBankPayments.notes")}</p>
                        <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap">{p.notes}</p>
                      </div>
                    )}
                    {p.webhookRaw && (
                      <details>
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">{t("adminBankPayments.webhookRaw")}</summary>
                        <pre className="text-[10px] text-gray-400 bg-gray-900 p-2 rounded mt-1 overflow-auto">{p.webhookRaw}</pre>
                      </details>
                    )}
                    {p.status === "Pending" && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => void confirmPayment(p)}
                          disabled={busy === p.id}
                          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                        >
                          {busy === p.id ? "…" : t("adminBankPayments.confirmActivate")}
                        </button>
                        <button
                          onClick={() => void cancelPayment(p)}
                          disabled={busy === p.id}
                          className="border border-red-500/40 hover:bg-red-500/10 text-red-400 text-xs font-semibold px-4 py-2 rounded-lg"
                        >
                          {t("adminBankPayments.cancelPayment")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

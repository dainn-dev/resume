"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import { Button, buttonClasses } from "@/components/ui/Button";

interface BankAccountSummary {
  bankCode: string;
  bankName: string;
  bankBin: string;
  accountNumber: string;
  accountHolder: string;
}

interface BankPaymentDetail {
  id: string;
  planCode: string;
  durationMonths: number;
  amountVnd: number;
  transactionCode: string;
  bank: BankAccountSummary;
  qrUrl: string;
  status: string;
  paidAt: string | null;
  expiresAt: string;
  createdAt: string;
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="link"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs ml-2"
    >
      {copied ? t("bankPay.copied") : t("bankPay.copy")}
    </Button>
  );
}

export default function BankPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const id = (params?.id as string) ?? "";
  const [payment, setPayment] = useState<BankPaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [cancelling, setCancelling] = useState(false);

  function durationLabel(months: number): string {
    if (months === 0) return t("bankPay.oneDay"); // test plan sentinel
    if (months === 1) return t("bankPay.oneMonth");
    return interpolate(t("bankPay.nMonths"), { count: months });
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/bank/payments/${id}`);
      const data = await res.json();
      if (!data.success) { setError(data.error ?? t("bankPay.loadFailed")); return; }
      setPayment(data.data);
    } catch {
      setError(t("bankPay.networkError"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Poll every 5s while pending
  useEffect(() => {
    if (!payment || payment.status !== "Pending") return;
    const interval = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(interval);
  }, [payment, load]);

  // Countdown ticker
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleCancel() {
    if (!payment || !confirm(t("bankPay.cancelConfirm"))) return;
    setCancelling(true);
    try {
      await fetch(`/api/billing/bank/payments/${payment.id}/cancel`, { method: "POST" });
      await load();
    } finally {
      setCancelling(false);
    }
  }

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
        <p className="text-red-400">{error}</p>
        <Link href="/account" className="text-blue-400 hover:text-blue-300 text-sm">{t("bankPay.backToAccount")}</Link>
      </main>
    );
  }

  if (!payment) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="h-96 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  // Success
  if (payment.status === "Confirmed") {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
          <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{t("bankPay.confirmedTitle")}</h1>
          <p className="text-gray-400 text-sm mt-2">
            {interpolate(t("bankPay.confirmedBody"), { plan: payment.planCode, duration: durationLabel(payment.durationMonths) })}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => router.push("/account")} className="px-6">
            {t("bankPay.goToAccount")}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/dashboard")} className="px-6">
            {t("bankPay.dashboard")}
          </Button>
        </div>
      </main>
    );
  }

  if (payment.status === "Cancelled" || payment.status === "Expired" || payment.status === "Failed") {
    const label = payment.status === "Failed" ? t("bankPay.failed") : payment.status === "Expired" ? t("bankPay.expired") : t("bankPay.cancelled");
    return (
      <main className="max-w-2xl mx-auto px-4 py-10 text-center space-y-6">
        <p className="text-amber-400 text-lg">{label}</p>
        <Link href="/account" className={`${buttonClasses({ variant: "primary" })} px-6`}>
          {t("bankPay.backToAccountBtn")}
        </Link>
      </main>
    );
  }

  // Pending UI
  const expiresMs = new Date(payment.expiresAt).getTime() - now;
  const expiresMin = Math.max(0, Math.floor(expiresMs / 60000));
  const expiresHr = Math.floor(expiresMin / 60);
  const expiresMinRem = expiresMin % 60;
  const expiresText = `${expiresHr > 0 ? `${expiresHr}h ` : ""}${expiresMinRem}m`;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t("bankPay.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">
          {t("bankPay.subtitle")}
        </p>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
        <span className="text-amber-300">
          {interpolate(t("bankPay.expiresIn"), { time: expiresText })}
        </span>
        <span className="text-amber-400/70">{t("bankPay.autoRefresh")}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-2 rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={payment.qrUrl} alt="VietQR" className="w-full max-w-[260px]" />
          </div>
          <p className="text-xs text-gray-500 text-center">
            {t("bankPay.scanHint")}
          </p>
        </div>

        {/* Manual transfer details */}
        <div className="space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{t("bankPay.bank")}</p>
            <p className="text-white text-sm font-medium">{payment.bank.bankName} ({payment.bank.bankCode})</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{t("bankPay.accountNumber")}</p>
            <p className="text-white text-sm font-medium flex items-center">
              {payment.bank.accountNumber}
              <CopyButton text={payment.bank.accountNumber} />
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{t("bankPay.accountHolder")}</p>
            <p className="text-white text-sm font-medium">{payment.bank.accountHolder}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{t("bankPay.amount")}</p>
            <p className="text-green-400 text-lg font-bold flex items-center">
              {formatVnd(payment.amountVnd)}
              <CopyButton text={String(payment.amountVnd)} />
            </p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-purple-400/70">{t("bankPay.transferNote")}</p>
            <p className="text-purple-200 text-base font-bold mt-0.5 flex items-center">
              {payment.transactionCode}
              <CopyButton text={payment.transactionCode} />
            </p>
            <p className="text-[11px] text-purple-300/70 mt-1">
              {t("bankPay.transferNoteHint")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-between items-center text-xs text-gray-500">
        <p>{t("bankPay.planLabel")} <span className="text-white">{payment.planCode}</span> · {durationLabel(payment.durationMonths)}</p>
        <Button variant="link" loading={cancelling} onClick={handleCancel} className="text-red-400 hover:text-red-300">
          {t("bankPay.cancelPayment")}
        </Button>
      </div>

      <p className="text-center text-xs text-gray-600">
        {t("bankPay.alreadyTransferred")}
      </p>
    </main>
  );
}

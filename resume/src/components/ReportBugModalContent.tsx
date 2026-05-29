"use client";

import { useEffect, useRef, useState } from "react";
import type ReCAPTCHA from "react-google-recaptcha";
import { useTranslation } from "@/components/TranslationProvider";
import { useAuth } from "@/components/AuthProvider";
import Recaptcha, { RECAPTCHA_ENABLED } from "@/components/Recaptcha";

const CATEGORIES = ["ui", "ai", "billing", "account", "performance", "other"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export default function ReportBugModalContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("ui");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("medium");
  const [pageUrl, setPageUrl] = useState(() => (typeof window !== "undefined" ? window.location.pathname : ""));
  const [email, setEmail] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<ReCAPTCHA>(null);

  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (RECAPTCHA_ENABLED && !captchaToken) {
      setStatus("error");
      setError(t("auth.errorCaptchaRequired"));
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          severity: SEVERITIES.indexOf(severity),
          pageUrl: pageUrl.trim() || null,
          email: isLoggedIn ? null : email.trim() || null,
          recaptchaToken: captchaToken,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? t("reportBug.errorGeneric"));
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : t("reportBug.errorGeneric"));
    } finally {
      captchaRef.current?.reset();
      setCaptchaToken(null);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("ui");
    setSeverity("medium");
    setPageUrl(typeof window !== "undefined" ? window.location.pathname : "");
    if (!isLoggedIn) setEmail("");
    setStatus("idle");
    setError(null);
  }

  const inputClass =
    "w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-800 sticky top-0 bg-gray-900">
          <div>
            <h2 className="text-lg font-bold text-white">{t("reportBug.title")}</h2>
            <p className="text-gray-400 text-sm mt-0.5">{t("reportBug.subtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1.5 text-gray-400 hover:text-white transition-colors" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === "success" ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{t("reportBug.successTitle")}</h3>
            <p className="text-gray-400 text-sm mb-6">{t("reportBug.successBody")}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={resetForm}
                className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                {t("reportBug.submitAnother")}
              </button>
              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                {t("reportBug.done")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("reportBug.fieldTitle")}</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("reportBug.fieldTitlePlaceholder")}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("reportBug.fieldCategory")}</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={inputClass}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`reportBug.category.${c}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("reportBug.fieldSeverity")}</label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className={inputClass}>
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {t(`reportBug.severity.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("reportBug.fieldDescription")}</label>
              <textarea
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("reportBug.fieldDescriptionPlaceholder")}
                className={`${inputClass} resize-y`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t("reportBug.fieldPageUrl")} <span className="text-gray-500 font-normal">{t("reportBug.optional")}</span>
              </label>
              <input
                type="text"
                maxLength={2048}
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder={t("reportBug.fieldPageUrlPlaceholder")}
                className={inputClass}
              />
            </div>

            {isLoggedIn ? (
              <p className="text-xs text-gray-500">
                {t("reportBug.signedInAs")} <span className="text-gray-300">{user?.email}</span>
              </p>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  {t("reportBug.fieldEmail")} <span className="text-gray-500 font-normal">{t("reportBug.optional")}</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("reportBug.fieldEmailPlaceholder")}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-gray-500">{t("reportBug.emailHint")}</p>
              </div>
            )}

            {status === "error" && error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <Recaptcha ref={captchaRef} onChange={setCaptchaToken} />
            <button
              type="submit"
              disabled={status === "submitting" || (RECAPTCHA_ENABLED && !captchaToken)}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {status === "submitting" ? t("reportBug.submitting") : t("reportBug.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { CoverLetterFormData } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useTranslation } from "@/components/TranslationProvider";
import {
  getCoverLetterForm,
  getCoverLetterResult,
  getJobMatchContext,
  setCoverLetterForm,
  setCoverLetterResult,
  type JobMatchContext,
} from "@/lib/pipeline";

const TONES: CoverLetterFormData["tone"][] = ["Professional", "Enthusiastic", "Concise"];

const INITIAL_FORM: CoverLetterFormData = {
  jobTitle: "",
  company: "",
  jobDescription: "",
  aboutYourself: "",
  tone: "Professional",
};

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

function mergeJobContext(
  form: CoverLetterFormData,
  ctx: JobMatchContext,
): CoverLetterFormData {
  return {
    ...form,
    jobTitle: ctx.jobTitle || form.jobTitle,
    company: ctx.company || form.company,
    jobDescription: ctx.jobDescription || form.jobDescription,
  };
}

export default function CoverLetterPage() {
  const { t, mounted } = useTranslation();
  const [form, setForm] = useState<CoverLetterFormData>(INITIAL_FORM);
  const [result, setResult] = useState<string | null>(null);
  const [edited, setEdited] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);
  const hydratedRef = useRef(false);

  if (!mounted) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <LoadingSpinner message="Loading cover letter generator..." subMessage="Preparing your job details" />
      </main>
    );
  }

  // Auto-sync from previous steps on mount. We restore any in-progress
  // edits first, then fold in any new job-match context on top so the
  // user never has to click an "Import" button.
  useEffect(() => {
    const stored = getCoverLetterForm();
    const ctx = getJobMatchContext();
    const hasCtx = !!(ctx && (ctx.jobTitle || ctx.company || ctx.jobDescription));

    let next: CoverLetterFormData = stored ?? INITIAL_FORM;
    if (hasCtx && ctx) {
      next = mergeJobContext(next, ctx);
      setSynced(true);
    } else if (stored) {
      setSynced(true);
    }
    setForm(next);

    const cachedResult = getCoverLetterResult();
    if (cachedResult) {
      setResult(cachedResult);
      setEdited(cachedResult);
    }

    hydratedRef.current = true;
  }, []);

  // Persist form edits so navigating between steps doesn't lose state.
  useEffect(() => {
    if (!hydratedRef.current) return;
    setCoverLetterForm(form);
  }, [form]);

  function updateField(field: keyof CoverLetterFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Generation failed.");
      setResult(data.data.text);
      setEdited(data.data.text);
      setCoverLetterResult(data.data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(edited);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t("coverLetter.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("coverLetter.subtitle")}</p>
      </div>

      {/* Auto-synced job context */}
      {synced && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">{t("coverLetter.jobDetailsSync")}</span>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {loading ? (
          <LoadingSpinner message={t("coverLetter.generating")} subMessage={t("coverLetter.generatingSubtext")} />
        ) : result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{t("coverLetter.yourCoverLetter")}</h2>
              <button
                onClick={() => {
                  setResult(null);
                  setEdited("");
                  if (typeof window !== "undefined") {
                    sessionStorage.removeItem("coverLetterResult");
                  }
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {t("coverLetter.regenerate")}
              </button>
            </div>
            <textarea
              className="bg-gray-950 border border-gray-800 rounded-xl p-5 text-gray-200 text-sm leading-relaxed font-mono w-full resize-none focus:outline-none focus:border-blue-500"
              rows={14}
              value={edited}
              onChange={e => setEdited(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{edited.length} {t("coverLetter.characters")}</span>
              <button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                {copied ? t("common.copied") : t("common.copy")}
              </button>
            </div>

            <div className="border-t border-gray-800 pt-6 flex gap-3">
              <Link
                href="/salary-estimator"
                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors text-center"
              >
                {t("salary.nextStep")}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass()}>{t("coverLetter.jobTitle")}</label>
                <input className={inputClass()} placeholder={t("coverLetter.jobTitlePlaceholder")} value={form.jobTitle} onChange={e => updateField("jobTitle", e.target.value)} required />
              </div>
              <div>
                <label className={labelClass()}>{t("coverLetter.company")}</label>
                <input className={inputClass()} placeholder={t("coverLetter.companyPlaceholder")} value={form.company} onChange={e => updateField("company", e.target.value)} required />
              </div>
            </div>

            <div>
              <label className={labelClass()}>{t("coverLetter.jobDescription")}</label>
              <textarea className={inputClass("resize-none")} rows={7} placeholder={t("coverLetter.jobDescriptionPlaceholder")} value={form.jobDescription} onChange={e => updateField("jobDescription", e.target.value)} required />
            </div>

            <div>
              <label className={labelClass()}>{t("coverLetter.aboutYourself")}</label>
              <textarea className={inputClass("resize-none")} rows={4} placeholder={t("coverLetter.aboutYourselfPlaceholder")} value={form.aboutYourself} onChange={e => updateField("aboutYourself", e.target.value)} required />
            </div>

            <div>
              <label className={labelClass()}>{t("coverLetter.tone")}</label>
              <div className="flex gap-2">
                {TONES.map(tone => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => updateField("tone", tone)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.tone === tone
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {t(`coverLetter.tones.${tone.toLowerCase()}`)}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
              {t("coverLetter.generateCoverLetter")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

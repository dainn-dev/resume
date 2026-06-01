"use client";

import { useState, useEffect, useRef } from "react";
import type { InterviewCoachFormData, InterviewCoachResult } from "@/types/builder";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import PipelineWorkflow from "@/components/PipelineWorkflow";
import { useTranslation } from "@/components/TranslationProvider";
import { Button, buttonClasses, focusRing } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  getInterviewCoachForm,
  getInterviewCoachResult,
  getInterviewCoachAnalysis,
  getJobMatchContext,
  getResumeText,
  getCurrentResumeId,
  setCurrentResumeId,
  setInterviewCoachForm,
  setInterviewCoachResult,
  setInterviewCoachAnalysis,
  type JobMatchContext,
} from "@/lib/pipeline";

const INTERVIEW_TYPES: InterviewCoachFormData["interviewType"][] = ["behavioral", "technical", "mixed"];

const INITIAL_FORM: InterviewCoachFormData = {
  jobTitle: "",
  company: "",
  jobDescription: "",
  interviewType: "mixed",
  resumeSummary: "",
};

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

function categoryColor(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("technical")) return "bg-blue-500/20 text-blue-400";
  if (lower.includes("behavioral")) return "bg-purple-500/20 text-purple-400";
  if (lower.includes("situational")) return "bg-yellow-500/20 text-yellow-400";
  return "bg-gray-500/20 text-gray-400";
}

function mergeJobContext(
  form: InterviewCoachFormData,
  ctx: JobMatchContext,
  resumeText: string,
): InterviewCoachFormData {
  return {
    ...form,
    jobTitle: ctx.jobTitle || form.jobTitle,
    company: ctx.company || form.company,
    jobDescription: ctx.jobDescription || form.jobDescription,
    resumeSummary: form.resumeSummary || resumeText.slice(0, 8000),
  };
}

export default function InterviewCoachPage() {
  const { t, mounted } = useTranslation();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<InterviewCoachFormData>(INITIAL_FORM);
  const [result, setResult] = useState<InterviewCoachResult | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const hydratedRef = useRef(false);
  const skipPersistRef = useRef(false);

  useEffect(() => {
    hydratedRef.current = false;
    skipPersistRef.current = true;
    const urlResumeId = searchParams.get("resumeId");
    if (urlResumeId) setCurrentResumeId(urlResumeId);

    if (!urlResumeId) {
      setForm(INITIAL_FORM);
      setResult(null);
      setAnalysis("");
      setSynced(false);
      hydratedRef.current = true;
      return;
    }

    const stored = getInterviewCoachForm();
    const ctx = getJobMatchContext();
    const resumeText = getResumeText();
    const hasCtx = !!(ctx && (ctx.jobTitle || ctx.company || ctx.jobDescription));

    let next: InterviewCoachFormData = stored ?? INITIAL_FORM;
    if (hasCtx && ctx) {
      next = mergeJobContext(next, ctx, resumeText);
      setSynced(true);
    } else if (stored) {
      setSynced(true);
    }
    setForm(next);

    const cachedResult = getInterviewCoachResult();
    const cachedAnalysis = getInterviewCoachAnalysis();
    if (cachedResult) setResult(cachedResult);
    if (cachedAnalysis) setAnalysis(cachedAnalysis);

    hydratedRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipPersistRef.current) { skipPersistRef.current = false; return; }
    setInterviewCoachForm(form);
  }, [form]);

  if (!mounted) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  function updateField(field: keyof InterviewCoachFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysis("");
    try {
      const res = await fetch("/api/interview-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Generation failed.");
      setResult(data.data.result);
      setAnalysis(data.data.analysis);
      setInterviewCoachResult(data.data.result);
      setInterviewCoachAnalysis(data.data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;

    const sections: string[] = [
      `═══════════════════════════════════════`,
      `${t("interviewCoach.prepareTitle")} ${form.company}`,
      `═══════════════════════════════════════`,
      "",
    ];

    sections.push(`${t("interviewCoach.questionsSection")}:`);
    result.questions.forEach(q => {
      sections.push(`\n[${q.category}]`);
      sections.push(`Q: ${q.question}`);
      sections.push(`${t("interviewCoach.tip")} ${q.tip}`);
    });

    sections.push(`\n${t("interviewCoach.strengthsSection")}:`);
    result.keyStrengths.forEach(s => {
      sections.push(`• ${s}`);
    });

    sections.push(`\n${t("interviewCoach.pitfallsSection")}:`);
    result.commonPitfalls.forEach(p => {
      sections.push(`• ${p}`);
    });

    sections.push(`\n${t("interviewCoach.closingSection")}:`);
    result.closingQuestions.forEach(q => {
      sections.push(`• ${q}`);
    });

    sections.push(`\n${t("interviewCoach.narrativeSection")}:`);
    sections.push(analysis);

    navigator.clipboard.writeText(sections.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleAddMore() {
    if (!result) return;
    setLoadingMore(true);
    try {
      const res = await fetch("/api/interview-coach/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          existingQuestions: result.questions.map(q => q.question),
        }),
      });
      const data = await res.json();
      if (!data.success || !data.data?.questions) throw new Error(data.error ?? "Failed");
      const merged: InterviewCoachResult = {
        ...result,
        questions: [...result.questions, ...data.data.questions],
      };
      setResult(merged);
      setInterviewCoachResult(merged);
    } catch {
      setError(t("interviewCoach.failed"));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <PipelineWorkflow />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t("interviewCoach.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("interviewCoach.subtitle")}</p>
      </div>

      {synced && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">{t("interviewCoach.syncedBanner")}</span>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {loading ? (
          <LoadingSpinner message={t("interviewCoach.analyzing")} subMessage={t("interviewCoach.analyzingSubtext")} />
        ) : result ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                {t("interviewCoach.prepareTitle")} <span className="text-blue-400">{form.company}</span>
              </h2>
              <Button
                variant="link"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setResult(null);
                  setAnalysis("");
                }}
              >
                {t("interviewCoach.prepareAnother")}
              </Button>
            </div>

            {/* Questions Accordion */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white mb-3">{t("interviewCoach.questionsSection")}</h3>
              {result.questions.map((q, idx) => {
                const isOpen = expandedIdx === idx;
                return (
                  <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedIdx(isOpen ? null : idx)}
                      className={`w-full p-4 text-left hover:bg-gray-700/50 transition-colors ${focusRing}`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide shrink-0 ${categoryColor(q.category)}`}>
                          {q.category}
                        </span>
                        <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      <p className={`text-sm text-white leading-relaxed ${isOpen ? "" : "line-clamp-2"}`}>{q.question}</p>
                    </button>
                    {isOpen && (
                      <div className="border-t border-gray-700 bg-gray-900 px-4 py-3">
                        <p className="text-xs font-semibold text-gray-400 mb-1">{t("interviewCoach.tip")}</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{q.tip}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={handleAddMore}
                disabled={loadingMore}
                className={`w-full mt-2 border border-dashed border-gray-600 hover:border-blue-500 text-gray-400 hover:text-blue-400 text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${focusRing}`}
              >
                {loadingMore ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {t("interviewCoach.addingMore")}
                  </>
                ) : (
                  <>+ {t("interviewCoach.addMore")}</>
                )}
              </button>
            </div>

            {/* Key Strengths */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t("interviewCoach.strengthsSection")}</h3>
              <ul className="space-y-2">
                {result.keyStrengths.map((strength, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Pitfalls */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t("interviewCoach.pitfallsSection")}</h3>
              <ul className="space-y-2">
                {result.commonPitfalls.map((pitfall, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    <span>{pitfall}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Closing Questions */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t("interviewCoach.closingSection")}</h3>
              <ul className="space-y-2">
                {result.closingQuestions.map((question, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Narrative */}
            {analysis && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-3">{t("interviewCoach.narrativeSection")}</h3>
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{analysis}</div>
              </div>
            )}

            <Button onClick={handleCopy} size="lg" fullWidth>
              {copied ? t("interviewCoach.copied") : t("interviewCoach.copyReport")}
            </Button>

            <div className="border-t border-gray-800 pt-6 flex gap-3">
              <Link
                href={`/career-coach${getCurrentResumeId() ? `?resumeId=${encodeURIComponent(getCurrentResumeId()!)}` : ""}`}
                className={`${buttonClasses({ variant: "success", size: "lg" })} flex-1 text-center`}
              >
                {t("interviewCoach.nextStep")}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("interviewCoach.jobTitle")} labelClassName={labelClass()}>
                <input
                  className={inputClass()}
                  placeholder={t("interviewCoach.jobTitlePlaceholder")}
                  value={form.jobTitle}
                  onChange={e => updateField("jobTitle", e.target.value)}
                  required
                />
              </Field>
              <Field label={t("interviewCoach.company")} labelClassName={labelClass()}>
                <input
                  className={inputClass()}
                  placeholder={t("interviewCoach.companyPlaceholder")}
                  value={form.company}
                  onChange={e => updateField("company", e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field label={t("interviewCoach.jobDescription")} labelClassName={labelClass()}>
              <textarea
                className={inputClass("resize-none")}
                rows={7}
                placeholder={t("interviewCoach.jobDescriptionPlaceholder")}
                value={form.jobDescription}
                onChange={e => updateField("jobDescription", e.target.value)}
                required
              />
            </Field>

            <Field
              label={t("interviewCoach.resumeSummary")}
              hint={t("interviewCoach.resumeSummaryHint")}
              labelClassName={labelClass()}
            >
              <textarea
                className={inputClass("resize-none")}
                rows={5}
                placeholder={t("interviewCoach.resumeSummaryPlaceholder")}
                value={form.resumeSummary}
                onChange={e => updateField("resumeSummary", e.target.value)}
                required
              />
            </Field>

            <div>
              <p className={labelClass()}>{t("interviewCoach.interviewType")}</p>
              <div className="flex gap-2">
                {INTERVIEW_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => updateField("interviewType", type)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${focusRing} ${
                      form.interviewType === type
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {t(`interviewCoach.type${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" size="lg" fullWidth>
              {t("interviewCoach.submit")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

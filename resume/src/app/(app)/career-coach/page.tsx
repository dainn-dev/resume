"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { CareerCoachFormData, CareerCoachResult } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";
import PipelineWorkflow from "@/components/PipelineWorkflow";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useTranslation } from "@/components/TranslationProvider";
import {
  getCareerCoachForm,
  getCareerCoachResult,
  getCareerCoachAnalysis,
  getJobMatchContext,
  getJobMatchResult,
  getResumeText,
  getBuilderForm,
  getSalaryEstimatorResult,
  setCareerCoachForm,
  setCareerCoachResult,
  setCareerCoachAnalysis,
} from "@/lib/pipeline";

const TIMELINES: CareerCoachFormData["timeline"][] = ["1 year", "2-3 years", "5+ years"];
const TIMELINE_KEYS: Record<string, string> = {
  "1 year": "careerCoach.timeline1Year",
  "2-3 years": "careerCoach.timeline2to3Years",
  "5+ years": "careerCoach.timeline5PlusYears",
};

const FOCUS_OPTIONS = [
  { value: "careerPath", label: "careerCoach.focusCareerPath" },
  { value: "skills", label: "careerCoach.focusSkills" },
  { value: "jobSearch", label: "careerCoach.focusJobSearch" },
  { value: "networking", label: "careerCoach.focusNetworking" },
];

const INITIAL_FORM: CareerCoachFormData = {
  careerGoal: "",
  timeline: "2-3 years",
  focusAreas: ["careerPath", "skills"],
  additionalContext: "",
  resumeSummary: "",
  currentSkills: "",
  experienceSummary: "",
  jobMatchGaps: "",
  salaryInsights: "",
};

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

function priorityColor(priority: string): string {
  if (priority === "high") return "bg-red-500/20 text-red-400";
  if (priority === "medium") return "bg-yellow-500/20 text-yellow-400";
  return "bg-green-500/20 text-green-400";
}

export default function CareerCoachPage() {
  const { t, mounted } = useTranslation();
  const [form, setForm] = useState<CareerCoachFormData>(INITIAL_FORM);
  const [result, setResult] = useState<CareerCoachResult | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);
  const hydratedRef = useRef(false);

  if (!mounted) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  useEffect(() => {
    const stored = getCareerCoachForm();
    const ctx = getJobMatchContext();
    const resumeText = getResumeText();
    const builderForm = getBuilderForm();
    const jobMatchResult = getJobMatchResult<{ gaps?: string[] }>();
    const salaryResult = getSalaryEstimatorResult();

    let next: CareerCoachFormData = stored ?? INITIAL_FORM;

    if (ctx?.jobTitle) next = { ...next, careerGoal: next.careerGoal || ctx.jobTitle };
    if (builderForm) {
      next = {
        ...next,
        currentSkills: next.currentSkills || builderForm.technicalSkills,
        experienceSummary: next.experienceSummary ||
          builderForm.workEntries.map(w => `${w.title} at ${w.company}`).join("; "),
      };
    }
    next = {
      ...next,
      resumeSummary: next.resumeSummary || resumeText.slice(0, 8000),
    };
    if (jobMatchResult?.gaps) {
      next = { ...next, jobMatchGaps: next.jobMatchGaps || jobMatchResult.gaps.join(", ") };
    }
    if (salaryResult?.marketInsights) {
      next = { ...next, salaryInsights: next.salaryInsights || salaryResult.marketInsights };
    }

    if (ctx || builderForm || resumeText) setSynced(true);
    setForm(next);

    const cachedResult = getCareerCoachResult();
    const cachedAnalysis = getCareerCoachAnalysis();
    if (cachedResult) setResult(cachedResult);
    if (cachedAnalysis) setAnalysis(cachedAnalysis);

    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setCareerCoachForm(form);
  }, [form]);

  function updateField(field: keyof CareerCoachFormData, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleFocus(area: string) {
    setForm(prev => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(area)
        ? prev.focusAreas.filter(a => a !== area)
        : [...prev.focusAreas, area],
    }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysis("");
    try {
      const res = await fetch("/api/career-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Generation failed.");
      setResult(data.data.result);
      setAnalysis(data.data.analysis);
      setCareerCoachResult(data.data.result);
      setCareerCoachAnalysis(data.data.analysis);
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
      `${t("careerCoach.resultTitle")} — ${form.careerGoal}`,
      `═══════════════════════════════════════`,
      "",
    ];

    sections.push(`${t("careerCoach.roadmapSection")}:`);
    result.careerRoadmap.forEach(m => {
      sections.push(`\n[${m.timeframe}] ${m.goal}`);
      m.actions.forEach(a => sections.push(`  • ${a}`));
    });

    sections.push(`\n${t("careerCoach.skillsSection")}:`);
    result.skillDevelopment.forEach(s => {
      sections.push(`\n[${s.priority.toUpperCase()}] ${s.skill}`);
      sections.push(`  ${s.reason}`);
      if (s.resources.length) sections.push(`  ${t("careerCoach.resources")} ${s.resources.join(", ")}`);
    });

    sections.push(`\n${t("careerCoach.jobSearchSection")}:`);
    result.jobSearchStrategy.forEach((s, i) => sections.push(`${i + 1}. ${s}`));

    sections.push(`\n${t("careerCoach.quickWinsSection")}:`);
    result.quickWins.forEach(q => sections.push(`⚡ ${q}`));

    sections.push(`\n${t("careerCoach.industrySection")}:`);
    sections.push(result.industryOutlook);

    sections.push(`\n${t("careerCoach.narrativeSection")}:`);
    sections.push(analysis);

    navigator.clipboard.writeText(sections.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <PipelineWorkflow />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t("careerCoach.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("careerCoach.subtitle")}</p>
      </div>

      {synced && !result && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">{t("careerCoach.syncedBanner")}</span>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {loading ? (
          <LoadingSpinner message={t("careerCoach.analyzing")} subMessage={t("careerCoach.analyzingSubtext")} />
        ) : result ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{t("careerCoach.resultTitle")}</h2>
              <button
                onClick={() => {
                  setResult(null);
                  setAnalysis("");
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {t("careerCoach.startOver")}
              </button>
            </div>

            {/* Career Roadmap */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-white mb-3">{t("careerCoach.roadmapSection")}</h3>
              {result.careerRoadmap.map((milestone, idx) => (
                <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedMilestone(expandedMilestone === idx ? null : idx)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-750 transition-colors"
                  >
                    <span className="text-xs font-bold px-2 py-1 rounded bg-blue-500/20 text-blue-400 mt-0.5 shrink-0">
                      {milestone.timeframe}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-white">{milestone.goal}</p>
                    </div>
                    <span className="text-gray-500 text-lg">{expandedMilestone === idx ? "−" : "+"}</span>
                  </button>
                  {expandedMilestone === idx && (
                    <div className="border-t border-gray-700 bg-gray-900 px-4 py-3">
                      <ul className="space-y-1.5">
                        {milestone.actions.map((action, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Skill Development */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t("careerCoach.skillsSection")}</h3>
              <div className="space-y-3">
                {result.skillDevelopment.map((skill, idx) => (
                  <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${priorityColor(skill.priority)}`}>
                        {t(`careerCoach.priority${skill.priority.charAt(0).toUpperCase() + skill.priority.slice(1)}`)}
                      </span>
                      <span className="text-sm font-medium text-white">{skill.skill}</span>
                    </div>
                    <p className="text-sm text-gray-400">{skill.reason}</p>
                    {skill.resources.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">{t("careerCoach.resources")}</p>
                        <ul className="mt-1 space-y-1">
                          {skill.resources.map((res, i) => (
                            <li key={i} className="text-xs text-blue-400">→ {res}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Job Search Strategy */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t("careerCoach.jobSearchSection")}</h3>
              <ol className="space-y-2">
                {result.jobSearchStrategy.map((strategy, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-3">
                    <span className="text-blue-400 font-bold shrink-0">{idx + 1}.</span>
                    <span>{strategy}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Quick Wins */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t("careerCoach.quickWinsSection")}</h3>
              <ul className="space-y-2">
                {result.quickWins.map((win, idx) => (
                  <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5 shrink-0">⚡</span>
                    <span>{win}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Industry Outlook */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3">{t("careerCoach.industrySection")}</h3>
              <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{result.industryOutlook}</div>
            </div>

            {/* Narrative */}
            {analysis && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-3">{t("careerCoach.narrativeSection")}</h3>
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{analysis}</div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleCopy} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors">
                {copied ? t("careerCoach.copied") : t("careerCoach.copyReport")}
              </button>
              <Link
                href="/calendar"
                className={`${buttonClasses({ variant: "success", size: "lg" })} flex-1 text-center`}
              >
                {t("careerCoach.buildGoals")}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}

            <Field label={t("careerCoach.careerGoal")} labelClassName={labelClass()}>
              <input
                className={inputClass()}
                placeholder={t("careerCoach.careerGoalPlaceholder")}
                value={form.careerGoal}
                onChange={e => updateField("careerGoal", e.target.value)}
                required
              />
            </Field>

            <div>
              <p className={labelClass()}>{t("careerCoach.timeline")}</p>
              <div className="flex gap-2">
                {TIMELINES.map(tl => (
                  <button
                    key={tl}
                    type="button"
                    onClick={() => updateField("timeline", tl)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
                      form.timeline === tl
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {t(TIMELINE_KEYS[tl])}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className={labelClass()}>{t("careerCoach.focusAreas")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FOCUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleFocus(opt.value)}
                    className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
                      form.focusAreas.includes(opt.value)
                        ? "bg-blue-600/20 border-blue-500/50 text-blue-400"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
                    }`}
                  >
                    {form.focusAreas.includes(opt.value) ? "✓ " : ""}{t(opt.label)}
                  </button>
                ))}
              </div>
            </div>

            <Field
              label={t("careerCoach.additionalContext")}
              hint={t("careerCoach.additionalContextHint")}
              labelClassName={labelClass()}
            >
              <textarea
                className={inputClass("resize-none")}
                rows={4}
                placeholder={t("careerCoach.additionalContextPlaceholder")}
                value={form.additionalContext}
                onChange={e => updateField("additionalContext", e.target.value)}
              />
            </Field>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => window.history.back()}>
                ← {t("common.back")}
              </Button>
              <Button
                type="submit"
                className="flex-1 leading-tight"
                disabled={!form.careerGoal.trim() || form.focusAreas.length === 0}
              >
                {t("careerCoach.submit")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

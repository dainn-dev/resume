"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/components/TranslationProvider";
import BillingPanel from "@/components/BillingPanel";
import {
  fetchAccountSummary,
  fetchResumeDetail,
  deleteResume,
  formatRelativeTime,
  type AccountSummary,
  type AccountSummaryResume,
} from "@/lib/accountClient";
import {
  clearPipeline,
  setCurrentResumeId,
  setResumeAnalysis,
} from "@/lib/pipeline";

function scoreColor(score: number) {
  if (score >= 75) return "text-green-400 bg-green-500/10 border-green-500/30";
  if (score >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-red-400 bg-red-500/10 border-red-500/30";
}

const STEP_KEYS = ["score", "build", "jobMatch", "coverLetter", "salary", "interview", "career"] as const;
type StepKey = (typeof STEP_KEYS)[number];

const STEP_I18N: Record<StepKey, string> = {
  score: "account.stepScore",
  build: "account.stepBuild",
  jobMatch: "account.stepJobMatch",
  coverLetter: "account.stepCoverLetter",
  salary: "account.stepSalary",
  interview: "account.stepInterview",
  career: "account.stepCareer",
};

export default function AccountPage() {
  const { t, mounted } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccountSummary();
      if (!data) { setError("Could not load your account."); return; }
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const checkout = searchParams.get("checkout");
      const sessionId = searchParams.get("session_id");
      try {
        if (checkout === "success" && sessionId) {
          await fetch("/api/billing/sync-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
          });
          if (!cancelled) router.replace("/account");
        } else {
          await fetch("/api/billing/sync-current", { method: "POST" });
        }
      } catch { /* fall through to DB state */ }
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [searchParams, load, router]);

  function isStepDone(resume: AccountSummaryResume, step: StepKey, recent: AccountSummary["recent"]): boolean {
    switch (step) {
      case "score": return !!resume.latestAnalysis;
      case "build": return resume.hasParsedData;
      case "jobMatch": return resume.jobMatchCount > 0;
      case "coverLetter": return resume.coverLetterCount > 0;
      case "salary": return !!recent.salary;
      case "interview": return !!recent.interview;
      case "career": return !!recent.career;
      default: return false;
    }
  }

  function completedCount(resume: AccountSummaryResume, recent: AccountSummary["recent"]): number {
    return STEP_KEYS.reduce((n, key) => n + (isStepDone(resume, key, recent) ? 1 : 0), 0);
  }

  async function handleContinue(resume: AccountSummaryResume) {
    setBusyId(resume.id);
    try {
      const detail = await fetchResumeDetail(resume.id);
      if (!detail) { setError("Could not load that resume."); return; }
      clearPipeline();
      setCurrentResumeId(detail.id);
      if (detail.latestAnalysis) setResumeAnalysis(detail.latestAnalysis, detail.rawText);
      router.push("/results");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(resume: AccountSummaryResume) {
    if (!confirm(`Delete "${resume.title ?? resume.sourceFileName ?? "this resume"}" and all of its analysis history?`)) return;
    setBusyId(resume.id);
    try {
      const ok = await deleteResume(resume.id);
      if (!ok) { setError("Failed to delete that resume."); return; }
      await load();
      if (expandedId === resume.id) setExpandedId(null);
    } finally {
      setBusyId(null);
    }
  }

  if (!mounted || loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="h-12 bg-gray-900 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
        <div className="h-64 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  const displayName = summary?.user.displayName || summary?.user.firstName || user?.name || "";
  const email = summary?.user.email || user?.email || "";

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
          {(displayName || email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{t("account.title")}</h1>
          {email && <p className="text-gray-400 text-sm truncate">{email}</p>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {summary && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              summary.plan.code === "Free"
                ? "text-gray-400 bg-gray-800 border-gray-700"
                : summary.plan.code === "Pro"
                  ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
                  : "text-amber-300 bg-amber-500/10 border-amber-500/30"
            }`}>
              {summary.plan.name}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}{" "}
          <button onClick={() => void load()} className="underline">Retry</button>
        </div>
      )}

      {/* Billing */}
      <BillingPanel />

      {/* My Resumes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t("account.myResumes")}</h2>
          <Link href="/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
            {t("account.goToScore")}
          </Link>
        </div>

        {!summary || summary.resumes.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm">{t("account.noResumes")}</p>
            <Link href="/dashboard" className="inline-block mt-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
              {t("account.goToScore")}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.resumes.map(resume => {
              const isExpanded = expandedId === resume.id;
              const score = resume.latestAnalysis?.score ?? 0;
              const completed = completedCount(resume, summary.recent);
              const title = resume.title ?? resume.sourceFileName ?? "Untitled resume";
              return (
                <div key={resume.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg border ${scoreColor(score)}`}>
                      {score || "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{title}</p>
                      <p className="text-gray-500 text-xs">
                        {t("account.uploadedOn")} {formatRelativeTime(resume.createdAt)} · {completed}/{STEP_KEYS.length} {t("account.stepsCompleted")}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1">
                      {STEP_KEYS.map(step => (
                        <div
                          key={step}
                          title={t(STEP_I18N[step])}
                          className={`w-2.5 h-2.5 rounded-full ${isStepDone(resume, step, summary.recent) ? "bg-green-500" : "bg-gray-700"}`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : resume.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
                    >
                      {isExpanded ? t("account.collapse") : t("account.viewDetails")}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-800 px-5 py-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <StepCard
                          done={!!resume.latestAnalysis}
                          label={t("account.stepScore")}
                          detail={resume.latestAnalysis ? `${t("account.overallScore")}: ${resume.latestAnalysis.score}/100` : undefined}
                          sub={resume.latestAnalysis?.result?.overallSummary?.slice(0, 100)}
                          notDoneLabel={t("account.notCompleted")}
                        />
                        <StepCard
                          done={resume.hasParsedData}
                          label={t("account.stepBuild")}
                          detail={resume.hasParsedData ? t("account.resumeGenerated") : undefined}
                          notDoneLabel={t("account.notCompleted")}
                        />
                        <StepCard
                          done={!!resume.latestJobMatch}
                          label={t("account.stepJobMatch")}
                          detail={resume.latestJobMatch ? `${t("account.matchScore")}: ${resume.latestJobMatch.matchScore}/100` : undefined}
                          sub={resume.latestJobMatch?.result?.summary?.slice(0, 100)}
                          notDoneLabel={t("account.notCompleted")}
                        />
                        <StepCard
                          done={!!resume.latestCoverLetter}
                          label={t("account.stepCoverLetter")}
                          detail={resume.latestCoverLetter ? `${resume.latestCoverLetter.jobTitle}${resume.latestCoverLetter.company ? ` @ ${resume.latestCoverLetter.company}` : ""}` : undefined}
                          sub={resume.latestCoverLetter?.text?.slice(0, 100)}
                          notDoneLabel={t("account.notCompleted")}
                        />
                        <StepCard
                          done={!!summary.recent.salary}
                          label={t("account.stepSalary")}
                          detail={summary.recent.salary?.estimate
                            ? `${summary.recent.salary.estimate.currency === "VND"
                                ? `${(summary.recent.salary.estimate.minSalary / 1e6).toFixed(0)}M – ${(summary.recent.salary.estimate.maxSalary / 1e6).toFixed(0)}M ${summary.recent.salary.estimate.currency}`
                                : `$${summary.recent.salary.estimate.minSalary.toLocaleString()} – $${summary.recent.salary.estimate.maxSalary.toLocaleString()}`}`
                            : undefined}
                          notDoneLabel={t("account.notCompleted")}
                          accountWide
                        />
                        <StepCard
                          done={!!summary.recent.interview}
                          label={t("account.stepInterview")}
                          detail={summary.recent.interview ? `${summary.recent.interview.result?.questions?.length ?? 0} ${t("account.questions")}` : undefined}
                          sub={summary.recent.interview?.result?.keyStrengths?.slice(0, 3).join(", ")}
                          notDoneLabel={t("account.notCompleted")}
                          accountWide
                        />
                        <StepCard
                          done={!!summary.recent.career}
                          label={t("account.stepCareer")}
                          detail={summary.recent.career ? `${summary.recent.career.result?.careerRoadmap?.length ?? 0} ${t("account.milestones")}` : undefined}
                          sub={summary.recent.career?.result?.quickWins?.slice(0, 2).join("; ")}
                          notDoneLabel={t("account.notCompleted")}
                          accountWide
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleContinue(resume)}
                          disabled={busyId === resume.id}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-300 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                        >
                          {busyId === resume.id ? "…" : t("account.continueWorking")}
                        </button>
                        <button
                          onClick={() => void handleDelete(resume)}
                          disabled={busyId === resume.id}
                          className="border border-red-500/40 hover:bg-red-500/10 text-red-400 text-sm font-semibold py-2.5 px-4 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function StepCard({
  done,
  label,
  detail,
  sub,
  notDoneLabel,
  accountWide,
}: {
  done: boolean;
  label: string;
  detail?: string;
  sub?: string;
  notDoneLabel: string;
  accountWide?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${done ? "bg-gray-800/50 border-gray-700" : "bg-gray-900/50 border-gray-800 opacity-60"}`}>
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${done ? "bg-green-500" : "bg-gray-700"}`}>
          {done && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
        <span className="text-xs font-medium text-white flex-1">{label}</span>
        {accountWide && (
          <span className="text-[10px] uppercase tracking-wide text-gray-500" title="Latest across all of your resumes">latest</span>
        )}
      </div>
      {done && detail ? (
        <p className="text-xs text-gray-400 pl-6">{detail}</p>
      ) : !done ? (
        <p className="text-xs text-gray-600 pl-6">{notDoneLabel}</p>
      ) : null}
      {sub && <p className="text-xs text-gray-500 pl-6 truncate">{sub}</p>}
    </div>
  );
}

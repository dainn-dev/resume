"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/components/TranslationProvider";
import { Button, buttonClasses, focusRing } from "@/components/ui/Button";
import type { JobMatchAnalysis } from "@/types/jobMatch";
import {
  fetchAccountSummary,
  fetchResumeDetail,
  deleteResume,
  deleteResumeFile,
  resumeFileUrl,
  formatFileSize,
  formatRelativeTime,
  type AccountSummary,
  type AccountSummaryResume,
} from "@/lib/accountClient";
import {
  clearPipeline,
  setCurrentResumeId,
  setResumeAnalysis,
} from "@/lib/pipeline";

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

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

export default function ResumesPage() {
  const { t, mounted } = useTranslation();
  const router = useRouter();
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
      if (!data) { setError(t("account.loadError")); return; }
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function isStepDone(resume: AccountSummaryResume, step: StepKey, recent: AccountSummary["recent"]): boolean {
    switch (step) {
      case "score": return !!resume.latestAnalysis;
      case "build": return resume.hasParsedData;
      case "jobMatch": return resume.jobMatches.length > 0;
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
      if (!detail) { setError(t("account.loadResumeError")); return; }
      clearPipeline();
      setCurrentResumeId(detail.id);
      if (detail.latestAnalysis) setResumeAnalysis(detail.latestAnalysis, detail.rawText);
      router.push(`/results?resumeId=${encodeURIComponent(detail.id)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(resume: AccountSummaryResume) {
    const title = resume.title ?? resume.sourceFileName ?? t("account.untitledResume");
    if (!confirm(interpolate(t("account.deleteConfirm"), { title }))) return;
    setBusyId(resume.id);
    try {
      const ok = await deleteResume(resume.id);
      if (!ok) { setError(t("account.deleteError")); return; }
      await load();
      if (expandedId === resume.id) setExpandedId(null);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteFile(resume: AccountSummaryResume) {
    if (!confirm(t("account.deleteFileConfirm"))) return;
    setBusyId(resume.id);
    try {
      const ok = await deleteResumeFile(resume.id);
      if (!ok) { setError(t("account.deleteFileError")); return; }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (!mounted || loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <div className="h-12 bg-gray-900 rounded-2xl animate-pulse" />
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("account.myResumes")}</h1>
          <p className="text-gray-400 text-sm mt-1">{summary?.resumes.length ?? 0} {(summary?.resumes.length ?? 0) === 1 ? (t("account.resumeCountOne") ?? "resume") : (t("account.resumeCount") ?? "resumes")}</p>
        </div>
        <Link href="/dashboard" className={buttonClasses({ variant: "primary", size: "md" })}>
          {t("account.goToScore")}
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}{" "}
          <button onClick={() => void load()} className={`underline ${focusRing}`}>{t("account.retry")}</button>
        </div>
      )}

      {!summary || summary.resumes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">{t("account.noResumes")}</p>
          <Link href="/dashboard" className={`mt-4 ${buttonClasses({ variant: "primary", size: "md" })}`}>
            {t("account.goToScore")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {summary.resumes.map(resume => {
            const isExpanded = expandedId === resume.id;
            const score = resume.latestAnalysis?.score ?? 0;
            const completed = completedCount(resume, summary.recent);
            const title = resume.title ?? resume.sourceFileName ?? t("account.untitledResume");
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
                  <Button
                    variant="link"
                    onClick={() => setExpandedId(isExpanded ? null : resume.id)}
                    className="text-xs shrink-0"
                  >
                    {isExpanded ? t("account.collapse") : t("account.viewDetails")}
                  </Button>
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
                      {resume.jobMatches.length === 0 ? (
                        <StepCard
                          done={false}
                          label={t("account.stepJobMatch")}
                          notDoneLabel={t("account.notCompleted")}
                        />
                      ) : resume.jobMatches.length === 1 ? (
                        <StepCard
                          done
                          label={t("account.stepJobMatch")}
                          detail={`${t("account.matchScore")}: ${resume.jobMatches[0].matchScore}/100`}
                          sub={resume.jobMatches[0].result?.summary?.slice(0, 100)}
                          notDoneLabel=""
                        />
                      ) : (
                        <JobMatchList matches={resume.jobMatches} />
                      )}
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

                    <FileSection resume={resume} busy={busyId === resume.id} onDeleteFile={() => void handleDeleteFile(resume)} />

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        onClick={() => void handleContinue(resume)}
                        loading={busyId === resume.id}
                        className="flex-1"
                      >
                        {t("account.continueWorking")}
                      </Button>
                      <Button
                        variant="dangerOutline"
                        onClick={() => void handleDelete(resume)}
                        disabled={busyId === resume.id}
                      >
                        {t("account.delete")}
                      </Button>
                    </div>
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

function FileSection({
  resume,
  busy,
  onDeleteFile,
}: {
  resume: AccountSummaryResume;
  busy: boolean;
  onDeleteFile: () => void;
}) {
  const { t } = useTranslation();
  const isPdf = (resume.fileContentType ?? "").includes("pdf") || (resume.sourceFileName ?? "").toLowerCase().endsWith(".pdf");

  if (!resume.hasFile) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-3 flex items-center gap-2">
        <FileIcon className="w-4 h-4 text-gray-600 shrink-0" />
        <span className="text-xs text-gray-600">{t("account.fileUnavailable")}</span>
      </div>
    );
  }

  const ext = (resume.sourceFileName?.split(".").pop() ?? "file").toUpperCase();
  const size = formatFileSize(resume.fileSizeBytes);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-3 space-y-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-xs text-white truncate flex-1">{resume.sourceFileName ?? t("account.originalFile")}</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-700/60 px-1.5 py-0.5 rounded shrink-0">{ext}</span>
        {size && <span className="text-[11px] text-gray-500 shrink-0">{size}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {isPdf && (
          <a
            href={resumeFileUrl(resume.id, true)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {t("account.previewFile")}
          </a>
        )}
        <a
          href={resumeFileUrl(resume.id)}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          {t("account.downloadFile")}
        </a>
        <Button
          variant="dangerOutline"
          size="sm"
          onClick={onDeleteFile}
          disabled={busy}
        >
          {t("account.deleteFile")}
        </Button>
      </div>
    </div>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
    </svg>
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

function JobMatchList({ matches }: { matches: AccountSummaryResume["jobMatches"] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? matches : matches.slice(0, 2);

  return (
    <div className="rounded-xl border bg-gray-800/50 border-gray-700 p-3 space-y-2 sm:col-span-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5" />
          </svg>
        </div>
        <span className="text-xs font-medium text-white flex-1">{t("account.stepJobMatch")}</span>
        <span className="text-[10px] text-gray-500">{matches.length} {t("account.jobMatchCount")}</span>
      </div>
      <div className="space-y-1.5 pl-6">
        {shown.map(m => (
          <div key={m.id} className="flex items-center gap-2 text-xs">
            <span className={`font-bold tabular-nums px-1.5 py-0.5 rounded border ${scoreColor(m.matchScore)}`}>
              {m.matchScore}
            </span>
            <span className="text-gray-300 truncate flex-1">
              {m.result?.jobTitle ?? "—"}{m.result?.company ? ` @ ${m.result.company}` : ""}
            </span>
            <span className="text-gray-600 shrink-0">{formatRelativeTime(m.createdAt)}</span>
          </div>
        ))}
      </div>
      {matches.length > 2 && (
        <Button
          variant="link"
          onClick={() => setExpanded(prev => !prev)}
          className="text-[11px] pl-6"
        >
          {expanded
            ? t("account.collapse")
            : interpolate(t("account.showAllMatches"), { count: matches.length })}
        </Button>
      )}
    </div>
  );
}

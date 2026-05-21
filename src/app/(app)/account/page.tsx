"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/components/TranslationProvider";
import { getRecentAnalyses, type RecentAnalysis, formatRelativeTime, getBuilderCache } from "@/lib/recentAnalyses";
import { getStepResults, type StepResults } from "@/lib/stepResults";
import { clearPipeline, setResumeAnalysis, setCurrentResumeId } from "@/lib/pipeline";

function scoreColor(score: number) {
  if (score >= 75) return "text-green-400 bg-green-500/10 border-green-500/30";
  if (score >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-red-400 bg-red-500/10 border-red-500/30";
}

const STEP_KEYS = ["score", "build", "jobMatch", "coverLetter", "salary", "interview", "career"] as const;
const STEP_I18N: Record<string, string> = {
  score: "account.stepScore",
  build: "account.stepBuild",
  jobMatch: "account.stepJobMatch",
  coverLetter: "account.stepCoverLetter",
  salary: "account.stepSalary",
  interview: "account.stepInterview",
  career: "account.stepCareer",
};

interface ResumeWithSteps {
  resume: RecentAnalysis;
  steps: StepResults | null;
  hasBuilder: boolean;
}

export default function AccountPage() {
  const { t, mounted } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeWithSteps[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const analyses = getRecentAnalyses();
    const items = analyses.map(resume => ({
      resume,
      steps: getStepResults(resume.id),
      hasBuilder: !!getBuilderCache(resume.id),
    }));
    setResumes(items);
  }, []);

  if (!mounted) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  function getCompletedCount(item: ResumeWithSteps): number {
    let count = 1; // score always completed
    if (item.hasBuilder) count++;
    if (item.steps?.jobMatch) count++;
    if (item.steps?.coverLetter) count++;
    if (item.steps?.salary) count++;
    if (item.steps?.interview) count++;
    if (item.steps?.career) count++;
    return count;
  }

  function isStepDone(item: ResumeWithSteps, step: string): boolean {
    if (step === "score") return true;
    if (step === "build") return item.hasBuilder;
    if (step === "jobMatch") return !!item.steps?.jobMatch;
    if (step === "coverLetter") return !!item.steps?.coverLetter;
    if (step === "salary") return !!item.steps?.salary;
    if (step === "interview") return !!item.steps?.interview;
    if (step === "career") return !!item.steps?.career;
    return false;
  }

  function handleContinue(item: ResumeWithSteps) {
    clearPipeline();
    setCurrentResumeId(item.resume.id);
    setResumeAnalysis(item.resume.analysis, item.resume.resumeText);
    router.push("/results");
  }

  const expanded = resumes.find(r => r.resume.id === expandedId);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        {user && (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{t("account.title")}</h1>
          {user && <p className="text-gray-400 text-sm">{user.email}</p>}
        </div>
      </div>

      {/* My Resumes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t("account.myResumes")}</h2>
          <Link href="/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
            {t("account.goToScore")}
          </Link>
        </div>

        {resumes.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-400 text-sm">{t("account.noResumes")}</p>
            <Link href="/dashboard" className="inline-block mt-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors">
              {t("account.goToScore")}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map(item => {
              const isExpanded = expandedId === item.resume.id;
              const completed = getCompletedCount(item);
              return (
                <div key={item.resume.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                  {/* Card header */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg border ${scoreColor(item.resume.overallScore)}`}>
                      {item.resume.overallScore}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.resume.filename}</p>
                      <p className="text-gray-500 text-xs">{t("account.uploadedOn")} {formatRelativeTime(item.resume.timestamp)} · {completed}/7 {t("account.stepsCompleted")}</p>
                    </div>
                    {/* Step dots */}
                    <div className="hidden sm:flex items-center gap-1">
                      {STEP_KEYS.map(step => (
                        <div
                          key={step}
                          title={t(STEP_I18N[step])}
                          className={`w-2.5 h-2.5 rounded-full ${isStepDone(item, step) ? "bg-green-500" : "bg-gray-700"}`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.resume.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
                    >
                      {isExpanded ? t("account.collapse") : t("account.viewDetails")}
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-800 px-5 py-4 space-y-4">
                      {/* Step grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Score */}
                        <StepCard
                          done
                          label={t("account.stepScore")}
                          detail={`${t("account.overallScore")}: ${item.resume.overallScore}/100`}
                          sub={item.resume.analysis.overallSummary.slice(0, 100) + "..."}
                        />

                        {/* Build */}
                        <StepCard
                          done={item.hasBuilder}
                          label={t("account.stepBuild")}
                          detail={item.hasBuilder ? t("account.resumeGenerated") : undefined}
                        />

                        {/* Job Match */}
                        <StepCard
                          done={!!item.steps?.jobMatch}
                          label={t("account.stepJobMatch")}
                          detail={item.steps?.jobMatch ? `${t("account.matchScore")}: ${item.steps.jobMatch.matchScore}/100` : undefined}
                          sub={item.steps?.jobMatch?.summary?.slice(0, 100)}
                        />

                        {/* Cover Letter */}
                        <StepCard
                          done={!!item.steps?.coverLetter}
                          label={t("account.stepCoverLetter")}
                          detail={item.steps?.coverLetter ? t("account.coverLetterPreview") : undefined}
                          sub={item.steps?.coverLetter?.text?.slice(0, 100)}
                        />

                        {/* Salary */}
                        <StepCard
                          done={!!item.steps?.salary}
                          label={t("account.stepSalary")}
                          detail={item.steps?.salary ? `${t("account.salaryRange")}: ${item.steps.salary.currency === "VND" ? `${(item.steps.salary.minSalary / 1e6).toFixed(0)}M - ${(item.steps.salary.maxSalary / 1e6).toFixed(0)}M ${item.steps.salary.currency}` : `$${item.steps.salary.minSalary.toLocaleString()} - $${item.steps.salary.maxSalary.toLocaleString()}`}` : undefined}
                        />

                        {/* Interview */}
                        <StepCard
                          done={!!item.steps?.interview}
                          label={t("account.stepInterview")}
                          detail={item.steps?.interview ? `${item.steps.interview.questionCount} ${t("account.questions")}` : undefined}
                          sub={item.steps?.interview?.keyStrengths?.slice(0, 3).join(", ")}
                        />

                        {/* Career */}
                        <StepCard
                          done={!!item.steps?.career}
                          label={t("account.stepCareer")}
                          detail={item.steps?.career ? `${item.steps.career.milestoneCount} ${t("account.milestones")}` : undefined}
                          sub={item.steps?.career?.quickWins?.slice(0, 2).join("; ")}
                        />
                      </div>

                      <button
                        onClick={() => handleContinue(item)}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                      >
                        {t("account.continueWorking")}
                      </button>
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

function StepCard({ done, label, detail, sub }: { done: boolean; label: string; detail?: string; sub?: string }) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${done ? "bg-gray-800/50 border-gray-700" : "bg-gray-900/50 border-gray-800 opacity-50"}`}>
      <div className="flex items-center gap-2">
        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${done ? "bg-green-500" : "bg-gray-700"}`}>
          {done && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
        <span className="text-xs font-medium text-white">{label}</span>
      </div>
      {done && detail ? (
        <p className="text-xs text-gray-400 pl-6">{detail}</p>
      ) : !done ? (
        <p className="text-xs text-gray-600 pl-6">{t("account.notCompleted")}</p>
      ) : null}
      {sub && <p className="text-xs text-gray-500 pl-6 truncate">{sub}</p>}
    </div>
  );
}

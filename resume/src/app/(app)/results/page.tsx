"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ScoreDashboard from "@/components/ScoreDashboard";
import RecommendationList from "@/components/RecommendationList";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useTranslation } from "@/components/TranslationProvider";
import type { ResumeAnalysis } from "@/types/resume";
import { clearPipeline, getResumeAnalysis, getCurrentResumeId, setResumeAnalysis, setCurrentResumeId } from "@/lib/pipeline";
import { fetchResumeDetail } from "@/lib/accountClient";
import PipelineWorkflow from "@/components/PipelineWorkflow";

export default function ResultsPage() {
  const { t, mounted } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [analysis, setAnalysisState] = useState<ResumeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const resumeId = searchParams.get("resumeId");

    if (!resumeId) {
      router.replace("/dashboard");
      return;
    }

    (async () => {
      setCurrentResumeId(resumeId);

      const stored = getResumeAnalysis();
      if (stored) {
        setAnalysisState(stored);
        setLoading(false);
        return;
      }

      try {
        const detail = await fetchResumeDetail(resumeId);
        if (cancelled) return;
        if (!detail?.latestAnalysis) {
          router.replace("/dashboard");
          return;
        }
        setCurrentResumeId(detail.id);
        setResumeAnalysis(detail.latestAnalysis, detail.rawText);
        setAnalysisState(detail.latestAnalysis);
      } catch {
        if (!cancelled) router.replace("/dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, searchParams]);

  function handleReset() {
    clearPipeline();
    router.push("/dashboard");
  }

  if (!mounted || loading) {
    return (
      <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  if (!analysis) return null;

  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-8">
      <PipelineWorkflow />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("results.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">{t("results.subtitle")}</p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
        >
          {t("results.analyzeAnother")}
        </button>
      </div>

      <ScoreDashboard analysis={analysis} />
      <RecommendationList sections={analysis.sections} />

      <div className="pb-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={handleReset}
          className="px-6 py-3 rounded-xl font-semibold text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
        >
          {t("results.analyzeAnotherResume")}
        </button>
        <Link
          href={`/build${getCurrentResumeId() ? `?resumeId=${encodeURIComponent(getCurrentResumeId()!)}` : ""}`}
          className="px-6 py-3 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          {t("results.buildResume")}
        </Link>
        <Link
          href={`/salary-estimator${getCurrentResumeId() ? `?resumeId=${encodeURIComponent(getCurrentResumeId()!)}` : ""}`}
          className="px-6 py-3 rounded-xl font-semibold text-sm bg-green-600 hover:bg-green-500 text-white transition-colors"
        >
          {t("results.estimateSalary")}
        </Link>
      </div>
    </main>
  );
}

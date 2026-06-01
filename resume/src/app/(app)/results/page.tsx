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
import { Button, buttonClasses } from "@/components/ui/Button";

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("results.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">{t("results.subtitle")}</p>
        </div>
        {/* Redundant with the bottom "Analyze another" CTA — hide on mobile to give the heading full width. */}
        <div className="hidden sm:block shrink-0">
          <Button variant="secondary" onClick={handleReset}>
            {t("results.analyzeAnother")}
          </Button>
        </div>
      </div>

      <ScoreDashboard analysis={analysis} />
      <RecommendationList sections={analysis.sections} />

      <div className="pb-8 space-y-3">
        <Button variant="secondary" size="lg" fullWidth onClick={handleReset}>
          {t("results.analyzeAnotherResume")}
        </Button>
        <div className="flex gap-3">
          <Link
            href={`/build${getCurrentResumeId() ? `?resumeId=${encodeURIComponent(getCurrentResumeId()!)}` : ""}`}
            className={`${buttonClasses({ variant: "primary", size: "md" })} flex-1 whitespace-nowrap`}
          >
            {t("results.buildResume")}
          </Link>
          <Link
            href={`/salary-estimator${getCurrentResumeId() ? `?resumeId=${encodeURIComponent(getCurrentResumeId()!)}` : ""}`}
            className={`${buttonClasses({ variant: "success", size: "md" })} flex-1 whitespace-nowrap`}
          >
            {t("results.estimateSalary")}
          </Link>
        </div>
      </div>
    </main>
  );
}

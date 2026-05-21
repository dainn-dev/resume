"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ScoreDashboard from "@/components/ScoreDashboard";
import RecommendationList from "@/components/RecommendationList";
import type { ResumeAnalysis } from "@/types/resume";
import { clearPipeline, getResumeAnalysis } from "@/lib/pipeline";

export default function ResultsPage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);

  useEffect(() => {
    const stored = getResumeAnalysis();
    if (!stored) {
      router.replace("/");
      return;
    }
    setAnalysis(stored);
  }, [router]);

  function handleReset() {
    clearPipeline();
    router.push("/");
  }

  if (!analysis) return null;

  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Resume Analysis</h1>
          <p className="text-gray-400 text-sm mt-1">Powered by Claude AI</p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Analyze Another
        </button>
      </div>

      <ScoreDashboard analysis={analysis} />
      <RecommendationList sections={analysis.sections} />

      <div className="pb-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={handleReset}
          className="px-6 py-3 rounded-xl font-semibold text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
        >
          Analyze Another Resume
        </button>
        <Link
          href="/build"
          className="px-6 py-3 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Build Resume →
        </Link>
      </div>
    </main>
  );
}

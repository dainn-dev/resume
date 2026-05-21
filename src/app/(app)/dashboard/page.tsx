"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/FileUpload";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AnalyzeApiResponse } from "@/types/resume";
import {
  getRecentAnalyses,
  saveRecentAnalysis,
  formatRelativeTime,
  type RecentAnalysis,
} from "@/lib/recentAnalyses";
import { clearPipeline, setResumeAnalysis, setCurrentResumeId } from "@/lib/pipeline";

function scoreColor(score: number) {
  if (score >= 75) return "text-green-400 bg-green-500/10 border-green-500/30";
  if (score >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-red-400 bg-red-500/10 border-red-500/30";
}

function RecentCard({ item, onSelect }: { item: RecentAnalysis; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl px-4 py-3 flex items-center gap-4 transition-colors group"
    >
      {/* Score badge */}
      <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg border ${scoreColor(item.overallScore)}`}>
        {item.overallScore}
      </span>

      {/* Filename + time */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate group-hover:text-blue-300 transition-colors">
          {item.filename}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{formatRelativeTime(item.timestamp)}</p>
      </div>

      {/* Arrow */}
      <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentAnalysis[]>([]);

  useEffect(() => {
    setRecents(getRecentAnalyses());
  }, []);

  function restoreRecent(item: RecentAnalysis) {
    clearPipeline();
    setCurrentResumeId(item.id);
    setResumeAnalysis(item.analysis, item.resumeText);
    router.push("/results");
  }

  async function handleAnalyze(file: File) {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const json: AnalyzeApiResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Analysis failed.");
      }

      // A new analysis starts a fresh pipeline run — wipe any cached
      // builder / job-match / cover-letter state from a previous resume.
      clearPipeline();
      setResumeAnalysis(json.data, json.resumeText ?? "");
      if (json.resumeText) {
        const savedId = saveRecentAnalysis({
          filename: file.name,
          timestamp: Date.now(),
          overallScore: json.data.overallScore,
          analysis: json.data,
          resumeText: json.resumeText,
        });
        setCurrentResumeId(savedId);
      }

      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center px-4 py-8">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col items-center gap-6 w-full max-w-xl">
          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Powered by Claude AI
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">
              AI Resume Scorer
            </h1>
            <p className="text-gray-400 text-lg">
              Upload your resume and get instant AI-powered feedback on every section.
            </p>
          </div>

          <FileUpload onAnalyze={handleAnalyze} disabled={loading} />

          {error && (
            <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Recent analyses */}
          {recents.length > 0 && (
            <div className="w-full space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Recent</p>
              {recents.map((item) => (
                <RecentCard key={item.id} item={item} onSelect={() => restoreRecent(item)} />
              ))}
            </div>
          )}

        </div>
      )}
    </main>
  );
}

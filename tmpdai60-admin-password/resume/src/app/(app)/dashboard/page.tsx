"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import FileUpload from "@/components/FileUpload";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AnalyzeApiResponse } from "@/types/resume";
import { clearPipeline, setResumeAnalysis, setCurrentResumeId } from "@/lib/pipeline";
import { focusRing } from "@/components/ui/Button";

interface ResumeListItem {
  id: string;
  title: string | null;
  sourceFileName: string | null;
  lastScore: number | null;
  createdAt: string;
  updatedAt: string;
}

function scoreColor(score: number) {
  if (score >= 75) return "text-green-400 bg-green-500/10 border-green-500/30";
  if (score >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-red-400 bg-red-500/10 border-red-500/30";
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function RecentCard({ item, onSelect }: { item: ResumeListItem; onSelect: () => void }) {
  const title = item.title ?? item.sourceFileName ?? "Untitled";
  const ariaLabel = [
    item.lastScore !== null ? `Score ${item.lastScore}` : null,
    title,
    `updated ${formatRelativeTime(item.updatedAt)}`,
  ].filter(Boolean).join(" — ");
  return (
    <button
      onClick={onSelect}
      aria-label={ariaLabel}
      className={`w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl px-4 py-3 flex items-center gap-4 transition-colors group ${focusRing}`}
    >
      {item.lastScore !== null && (
        <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-lg border ${scoreColor(item.lastScore)}`}>
          {item.lastScore}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate group-hover:text-blue-300 transition-colors">
          {title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{formatRelativeTime(item.updatedAt)}</p>
      </div>

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
  const [recents, setRecents] = useState<ResumeListItem[]>([]);

  useEffect(() => {
    fetch("/api/resumes")
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) setRecents(json.data.slice(0, 10));
      })
      .catch(() => {});
  }, []);

  async function handleSelectRecent(item: ResumeListItem) {
    setLoading(true);
    try {
      const res = await fetch(`/api/resumes/${item.id}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load resume.");

      clearPipeline();
      const detail = json.data;
      if (detail.latestAnalysis) {
        setResumeAnalysis(detail.latestAnalysis, detail.rawText ?? "");
      }
      setCurrentResumeId(item.id);
      router.push(`/results?resumeId=${encodeURIComponent(item.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
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

      clearPipeline();
      setResumeAnalysis(json.data, json.resumeText ?? "");
      const resumeId = json.id ?? `${Date.now()}`;
      setCurrentResumeId(resumeId);

      router.push(`/results?resumeId=${encodeURIComponent(resumeId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-start sm:justify-center px-4 py-8">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="flex flex-col items-center gap-6 w-full max-w-xl">
          {/* Hero */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Powered by DResume AI
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

          {/* Recent resumes from backend */}
          {recents.length > 0 && (
            <div className="w-full space-y-2">
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Recent</h2>
              {recents.map((item) => (
                <RecentCard key={item.id} item={item} onSelect={() => handleSelectRecent(item)} />
              ))}
            </div>
          )}

        </div>
      )}
    </main>
  );
}

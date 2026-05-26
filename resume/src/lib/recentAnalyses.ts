import type { ResumeAnalysis } from "@/types/resume";
import type { ResumeFormData } from "@/types/builder";

export interface RecentAnalysis {
  id: string;
  filename: string;
  timestamp: number;
  overallScore: number;
  analysis: ResumeAnalysis;
  resumeText: string;
}

interface BuilderCache {
  parsedForm: ResumeFormData;
  builderForm?: ResumeFormData;
  builtMarkdown?: string;
}

const KEY = "recentAnalyses";
const BUILDER_CACHE_PREFIX = "builderCache_";
const MAX = 10;

export function getRecentAnalyses(): RecentAnalysis[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentAnalysis[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentAnalysis(entry: Omit<RecentAnalysis, "id">, id?: string): string {
  const entryId = id ?? `${Date.now()}`;
  try {
    const existing = getRecentAnalyses();
    const updated = [
      { ...entry, id: entryId },
      ...existing.filter(e => e.id !== entryId),
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (SSR, private mode quota)
  }
  return entryId;
}

export function getBuilderCache(resumeId: string): BuilderCache | null {
  try {
    const raw = localStorage.getItem(BUILDER_CACHE_PREFIX + resumeId);
    return raw ? (JSON.parse(raw) as BuilderCache) : null;
  } catch {
    return null;
  }
}

export function saveBuilderCache(resumeId: string, cache: BuilderCache): void {
  try {
    localStorage.setItem(BUILDER_CACHE_PREFIX + resumeId, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

export function updateBuilderCache(resumeId: string, partial: Partial<BuilderCache>): void {
  const existing = getBuilderCache(resumeId);
  if (!existing) return;
  saveBuilderCache(resumeId, { ...existing, ...partial });
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

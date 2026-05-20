import type { ResumeAnalysis } from "@/types/resume";

export interface RecentAnalysis {
  id: string;
  filename: string;
  timestamp: number;
  overallScore: number;
  analysis: ResumeAnalysis;
  resumeText: string;
}

const KEY = "recentAnalyses";
const MAX = 3;

export function getRecentAnalyses(): RecentAnalysis[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentAnalysis[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentAnalysis(entry: Omit<RecentAnalysis, "id">): void {
  try {
    const existing = getRecentAnalyses();
    const updated = [
      { ...entry, id: `${Date.now()}` },
      ...existing,
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (SSR, private mode quota)
  }
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

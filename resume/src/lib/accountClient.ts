import type { ResumeAnalysis } from "@/types/resume";
import type { ResumeFormData, CareerCoachResult, InterviewCoachResult, SalaryEstimate } from "@/types/builder";
import type { JobMatchAnalysis } from "@/types/jobMatch";

export interface AccountSummaryUser {
  id: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface AccountSummaryPlan {
  code: "Free" | "Pro" | "Premium";
  name: string;
  lookupKey: string;
  isPaid: boolean;
}

export interface AccountSummarySubscription {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeSubscriptionId: string | null;
}

export interface AccountSummaryTotals {
  resumes: number;
  jobMatches: number;
  coverLetters: number;
  careerCoach: number;
  interviewCoach: number;
  salaryEstimates: number;
}

export interface AccountSummaryResume {
  id: string;
  title: string | null;
  sourceFileName: string | null;
  createdAt: string;
  updatedAt: string;
  hasParsedData: boolean;
  latestAnalysis: {
    id: string;
    score: number;
    createdAt: string;
    result: ResumeAnalysis | null;
  } | null;
  jobMatchCount: number;
  coverLetterCount: number;
  latestJobMatch: {
    id: string;
    matchScore: number;
    createdAt: string;
    result: JobMatchAnalysis | null;
  } | null;
  latestCoverLetter: {
    id: string;
    jobTitle: string;
    company: string | null;
    text: string;
    createdAt: string;
  } | null;
}

export interface AccountSummary {
  user: AccountSummaryUser;
  plan: AccountSummaryPlan;
  subscription: AccountSummarySubscription;
  totals: AccountSummaryTotals;
  resumes: AccountSummaryResume[];
  recent: {
    career: { id: string; createdAt: string; analysis: string; result: CareerCoachResult | null } | null;
    interview: { id: string; createdAt: string; analysis: string; result: InterviewCoachResult | null } | null;
    salary: { id: string; createdAt: string; analysis: string; estimate: SalaryEstimate | null } | null;
  };
}

export interface ResumeDetail {
  id: string;
  title: string | null;
  sourceFileName: string | null;
  rawText: string;
  parsed: ResumeFormData | null;
  latestAnalysis: ResumeAnalysis | null;
  createdAt: string;
  updatedAt: string;
}

interface Envelope<T> { success: boolean; data?: T; error?: string }

export async function fetchAccountSummary(): Promise<AccountSummary | null> {
  const res = await fetch("/api/users/me/summary", { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as Envelope<AccountSummary> | null;
  if (!res.ok || !body?.success || !body.data) return null;
  return body.data;
}

export async function fetchResumeDetail(id: string): Promise<ResumeDetail | null> {
  const res = await fetch(`/api/resumes/${encodeURIComponent(id)}`, { cache: "no-store" });
  const body = (await res.json().catch(() => null)) as Envelope<ResumeDetail> | null;
  if (!res.ok || !body?.success || !body.data) return null;
  return body.data;
}

export async function deleteResume(id: string): Promise<boolean> {
  const res = await fetch(`/api/resumes/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) return false;
  const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
  return !!body?.success;
}

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

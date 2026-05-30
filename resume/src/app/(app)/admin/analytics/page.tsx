"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

interface AnalyticsData {
  totals: {
    users: number; verifiedUsers: number; paidUsers: number; freeUsers: number;
    resumes: number; analyses: number; jobMatches: number;
    coverLetters: number; careerCoach: number; interviewCoach: number; salaryEstimates: number;
  };
  planDistribution: Array<{ plan: string; count: number }>;
  signupsByDay: Array<{ date: string; count: number }>;
  featureUsageByDay: Array<{
    date: string; resumes: number; analyses: number; jobMatches: number;
    coverLetters: number; careerCoach: number; interviewCoach: number; salaryEstimates: number;
  }>;
  scoreBuckets: Array<{ range: string; count: number }>;
  revenue: { mrrCents: number; byPlan: Array<{ plan: string; count: number; revenueCents: number }> };
}

const PLAN_COLORS: Record<string, string> = {
  Free: "#6b7280",
  Pro: "#3b82f6",
  Premium: "#f59e0b",
};

const FEATURE_COLORS = {
  resumes: "#3b82f6",
  analyses: "#10b981",
  jobMatches: "#f59e0b",
  coverLetters: "#a855f7",
  careerCoach: "#ec4899",
  interviewCoach: "#ef4444",
  salaryEstimates: "#06b6d4",
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="h-72">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/analytics?days=${days}`);
        const json = await res.json();
        if (!cancelled) {
          if (!json.success) setError(json.error ?? "Failed to load analytics.");
          else setData(json.data as AnalyticsData);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "An error occurred.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [days]);

  if (loading) return <main className="max-w-6xl mx-auto px-4 py-10"><div className="h-40 bg-gray-900 rounded-2xl animate-pulse" /></main>;
  if (error || !data) return <main className="max-w-6xl mx-auto px-4 py-10"><div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div></main>;

  const t = data.totals;
  const mrr = (data.revenue.mrrCents / 100).toFixed(2);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 text-sm mt-1 hidden sm:block">Site-wide usage and revenue metrics.</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 shrink-0"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total users" value={t.users} sub={`${t.verifiedUsers} verified`} />
        <StatCard label="Paid users" value={t.paidUsers} sub={`${Math.round((t.paidUsers / Math.max(1, t.users)) * 100)}% of total`} />
        <StatCard label="MRR" value={`$${mrr}`} sub="Monthly recurring revenue" />
        <StatCard label="Total resumes" value={t.resumes} sub={`${t.analyses} analyses`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Job matches" value={t.jobMatches} />
        <StatCard label="Cover letters" value={t.coverLetters} />
        <StatCard label="Career coach" value={t.careerCoach} />
        <StatCard label="Interview coach" value={t.interviewCoach} />
        <StatCard label="Salary est." value={t.salaryEstimates} />
        <StatCard label="Analyses" value={t.analyses} />
      </div>

      {/* Signups + Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="User signups">
          <ResponsiveContainer>
            <LineChart data={data.signupsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={10} />
              <YAxis stroke="#6b7280" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} name="Signups" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Plan distribution">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data.planDistribution} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={90} label={(e: { plan?: string; count?: number; name?: string; value?: number }) => `${e.plan ?? e.name}: ${e.count ?? e.value}`}>
                {data.planDistribution.map((p, i) => (
                  <Cell key={i} fill={PLAN_COLORS[p.plan] ?? "#6b7280"} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Feature usage stacked line */}
      <ChartCard title="Feature usage over time">
        <ResponsiveContainer>
          <LineChart data={data.featureUsageByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" stroke="#6b7280" fontSize={10} />
            <YAxis stroke="#6b7280" fontSize={10} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="resumes" stroke={FEATURE_COLORS.resumes} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="analyses" stroke={FEATURE_COLORS.analyses} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="jobMatches" stroke={FEATURE_COLORS.jobMatches} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="coverLetters" stroke={FEATURE_COLORS.coverLetters} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="careerCoach" stroke={FEATURE_COLORS.careerCoach} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="interviewCoach" stroke={FEATURE_COLORS.interviewCoach} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="salaryEstimates" stroke={FEATURE_COLORS.salaryEstimates} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Score distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Resume score distribution">
          <ResponsiveContainer>
            <BarChart data={data.scoreBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="range" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#f59e0b" name="Resumes" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue by plan (MRR)">
          <ResponsiveContainer>
            <BarChart data={data.revenue.byPlan.map(p => ({ plan: p.plan, revenue: p.revenueCents / 100, count: p.count }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="plan" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={10} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Bar dataKey="revenue" fill="#10b981" name="MRR ($)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </main>
  );
}

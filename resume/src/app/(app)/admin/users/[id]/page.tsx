"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button, focusRing } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface UserDetail {
  user: {
    id: string; email: string; username: string; emailVerified: boolean;
    status: string; isLocked: boolean; lockoutEnd: string | null;
    failedLoginAttempts: number;
    createdAt: string; updatedAt: string; lastLoginAt: string | null;
  };
  profile: { firstName: string; lastName: string; displayName: string; avatarUrl: string; language: string; timezone: string; bio: string; website: string } | null;
  subscription: { plan: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null; updatedAt: string; isAdminGranted: boolean; grantedByEmail: string | null; grantedAt: string | null; grantNote: string | null } | null;
  totals: { resumes: number; jobMatches: number; coverLetters: number; careerCoach: number; interviewCoach: number; salaryEstimates: number };
  resumes: Array<{ id: string; title: string | null; sourceFileName: string | null; createdAt: string; updatedAt: string; hasParsedData: boolean; hasFile: boolean; latestAnalysis: { id: string; score: number; createdAt: string } | null }>;
}

function planColor(plan: string): string {
  if (plan === "Premium") return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  if (plan === "Pro") return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  return "text-gray-400 bg-gray-800 border-gray-700";
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ mode: string; tempPassword?: string; email?: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load user.");
      setData(json.data as UserDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) void load(); }, [id, load]);

  const [grantDuration, setGrantDuration] = useState(12);
  const [grantNote, setGrantNote] = useState("");

  async function grantPlan(planCode: string) {
    const durationText = grantDuration === 0 ? "forever (no expiration)" : `${grantDuration} month${grantDuration > 1 ? "s" : ""}`;
    if (!confirm(`Grant ${planCode} plan for ${durationText}? User will be notified via email.`)) return;
    setBusy(`plan-${planCode}`);
    try {
      const res = await fetch(`/api/admin/users/${id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, durationMonths: grantDuration, note: grantNote.trim() || null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed.");
      setGrantNote("");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setBusy(null); }
  }

  async function toggleLockout(locked: boolean) {
    const msg = locked ? "Lock this account?" : "Unlock this account?";
    if (!confirm(msg)) return;
    setBusy("lockout");
    try {
      const res = await fetch(`/api/admin/users/${id}/lockout`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locked, minutes: locked ? null : null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setBusy(null); }
  }

  async function resetPassword(mode: "email" | "temp") {
    const msg = mode === "email"
      ? "Send password reset email to this user?"
      : "Generate a temporary password? It will be shown ONCE — copy + share with user via secure channel. All active sessions will be revoked.";
    if (!confirm(msg)) return;
    setBusy(`reset-${mode}`);
    setResetResult(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to reset.");
      setResetResult(json.data);
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setBusy(null); }
  }

  async function deleteResume(resumeId: string) {
    if (!confirm("Delete this resume? Cannot be undone.")) return;
    setBusy(`del-${resumeId}`);
    try {
      const res = await fetch(`/api/admin/resumes/${resumeId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setBusy(null); }
  }

  if (loading) return <main className="max-w-5xl mx-auto px-4 py-10"><div className="h-40 bg-gray-900 rounded-2xl animate-pulse" /></main>;
  if (error || !data) return <main className="max-w-5xl mx-auto px-4 py-10"><div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error ?? "User not found."}</div></main>;

  const u = data.user;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link href="/admin/users" className="text-blue-400 text-sm hover:text-blue-300">← Back to users</Link>
      </div>

      {/* User header */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{data.profile?.displayName || u.username}</h1>
            <p className="text-gray-400 text-sm">{u.email}{!u.emailVerified && <span className="ml-2 text-amber-400 text-xs">(unverified)</span>}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded border ${planColor(data.subscription?.plan ?? "Free")}`}>
              {data.subscription?.plan ?? "Free"}
            </span>
            {u.isLocked ? (
              <button onClick={() => toggleLockout(false)} disabled={busy === "lockout"} className={`text-xs bg-green-500/20 text-green-300 hover:bg-green-500/30 px-3 py-1 rounded border border-green-500/40 disabled:opacity-50 ${focusRing}`}>
                {busy === "lockout" ? "…" : "Unlock"}
              </button>
            ) : (
              <button onClick={() => toggleLockout(true)} disabled={busy === "lockout"} className={`text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 px-3 py-1 rounded border border-red-500/40 disabled:opacity-50 ${focusRing}`}>
                {busy === "lockout" ? "…" : "Lock account"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-gray-500 mb-1">Joined</p><p className="text-gray-200">{new Date(u.createdAt).toLocaleDateString()}</p></div>
          <div><p className="text-xs text-gray-500 mb-1">Last login</p><p className="text-gray-200">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-xs text-gray-500 mb-1">Status</p><p className={u.isLocked ? "text-red-400" : "text-green-400"}>{u.isLocked ? "Locked" : u.status}</p></div>
          <div><p className="text-xs text-gray-500 mb-1">Failed logins</p><p className="text-gray-200">{u.failedLoginAttempts}</p></div>
        </div>
      </div>

      {/* Password reset */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Password reset</h2>
        <p className="text-xs text-gray-500 mb-3">Email mode: standard reset link. Temp mode: generate a one-time password (revokes all sessions).</p>
        <div className="flex gap-2">
          <button
            onClick={() => resetPassword("email")}
            disabled={busy === "reset-email"}
            className={`text-xs font-semibold px-4 py-2 rounded-lg border border-blue-500/40 hover:bg-blue-500/10 text-blue-400 transition-colors disabled:opacity-50 ${focusRing}`}
          >
            {busy === "reset-email" ? "…" : "Send reset email"}
          </button>
          <button
            onClick={() => resetPassword("temp")}
            disabled={busy === "reset-temp"}
            className={`text-xs font-semibold px-4 py-2 rounded-lg border border-amber-500/40 hover:bg-amber-500/10 text-amber-400 transition-colors disabled:opacity-50 ${focusRing}`}
          >
            {busy === "reset-temp" ? "…" : "Generate temp password"}
          </button>
        </div>
        {resetResult && (
          <div className={`mt-4 rounded-xl border p-4 ${resetResult.mode === "temp" ? "bg-amber-500/10 border-amber-500/40" : "bg-green-500/10 border-green-500/40"}`}>
            <p className="text-xs text-gray-300 mb-2">{resetResult.message}</p>
            {resetResult.tempPassword && (
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 mt-2">
                <code className="flex-1 font-mono text-sm text-amber-200 select-all">{resetResult.tempPassword}</code>
                <Button
                  variant="link"
                  onClick={() => navigator.clipboard.writeText(resetResult.tempPassword!)}
                  className="text-xs"
                >
                  Copy
                </Button>
              </div>
            )}
            <button onClick={() => setResetResult(null)} className={`text-[10px] text-gray-500 hover:text-gray-300 mt-2 rounded ${focusRing}`}>Dismiss</button>
          </div>
        )}
      </div>

      {/* Plan management */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Plan management (Admin grant)</h2>
        <p className="text-xs text-gray-500 mb-4">Grant complimentary access (bypasses payment). User gets email notification.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Duration" labelClassName="block text-xs text-gray-400 mb-1">
            <select
              value={grantDuration}
              onChange={(e) => setGrantDuration(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value={1}>1 month</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months (default)</option>
              <option value={24}>24 months</option>
              <option value={0}>Permanent (no expiry)</option>
            </select>
          </Field>
          <Field label="Note (visible to user in email)" labelClassName="block text-xs text-gray-400 mb-1">
            <input
              type="text"
              value={grantNote}
              onChange={(e) => setGrantNote(e.target.value)}
              placeholder="e.g. Compensation for outage, beta tester, partner..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </Field>
        </div>

        <div className="flex gap-2">
          {["Free", "Pro", "Premium"].map(p => (
            <button
              key={p}
              onClick={() => grantPlan(p)}
              disabled={busy?.startsWith("plan-") || (data.subscription?.plan === p && !data.subscription?.isAdminGranted)}
              className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${focusRing} ${
                data.subscription?.plan === p && !data.subscription?.isAdminGranted
                  ? "bg-blue-600/40 text-blue-200 cursor-default"
                  : "border border-gray-700 hover:border-blue-500 hover:bg-blue-500/10 text-gray-300"
              }`}
            >
              {busy === `plan-${p}` ? "…" : (p === "Free" ? "Revoke to Free" : `Grant ${p}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Subscription */}
      {data.subscription && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Subscription</h2>
            {data.subscription.isAdminGranted && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border border-purple-500/40 bg-purple-500/10 text-purple-300">
                🎁 Admin granted
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-gray-500 mb-1">Plan</p><p className="text-gray-200">{data.subscription.plan}</p></div>
            <div><p className="text-xs text-gray-500 mb-1">Status</p><p className="text-gray-200">{data.subscription.status}</p></div>
            <div><p className="text-xs text-gray-500 mb-1">Cancel at period end</p><p className="text-gray-200">{data.subscription.cancelAtPeriodEnd ? "Yes" : "No"}</p></div>
            <div><p className="text-xs text-gray-500 mb-1">{data.subscription.isAdminGranted ? "Expires" : "Period end"}</p><p className="text-gray-200">{data.subscription.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString() : "—"}</p></div>
            {data.subscription.isAdminGranted && (
              <>
                <div className="col-span-2"><p className="text-xs text-gray-500 mb-1">Granted by</p><p className="text-gray-200 text-xs">{data.subscription.grantedByEmail ?? "—"}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-500 mb-1">Granted at</p><p className="text-gray-200 text-xs">{data.subscription.grantedAt ? new Date(data.subscription.grantedAt).toLocaleString() : "—"}</p></div>
                {data.subscription.grantNote && (
                  <div className="col-span-4"><p className="text-xs text-gray-500 mb-1">Note</p><p className="text-gray-200 text-xs italic">"{data.subscription.grantNote}"</p></div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Activity totals</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center text-sm">
          {Object.entries(data.totals).map(([k, v]) => (
            <div key={k} className="bg-gray-800/40 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1 capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
              <p className="text-lg text-white font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Resumes */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-white mb-3">Resumes ({data.resumes.length})</h2>
        {data.resumes.length === 0 ? (
          <p className="text-gray-500 text-sm">No resumes.</p>
        ) : (
          <div className="space-y-2">
            {data.resumes.map(r => (
              <div key={r.id} className="flex items-center justify-between border-b border-gray-800 last:border-b-0 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{r.title ?? r.sourceFileName ?? "Untitled"}</p>
                  <p className="text-xs text-gray-500">{new Date(r.updatedAt).toLocaleDateString()} · {r.hasParsedData ? "parsed" : "raw"}</p>
                </div>
                {r.latestAnalysis && <span className="text-xs font-semibold text-amber-400 px-2 mr-3">Score: {r.latestAnalysis.score}</span>}
                <a
                  href={`/api/admin/resumes/${r.id}/file`}
                  className={`text-xs text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline mr-4 rounded ${focusRing}`}
                >
                  {r.hasFile ? "Download" : "Download .txt"}
                </a>
                <Button
                  variant="link"
                  onClick={() => deleteResume(r.id)}
                  loading={busy === `del-${r.id}`}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

    </main>
  );
}

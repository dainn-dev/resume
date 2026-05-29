"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Plan {
  code: "Free" | "Pro" | "Premium";
  lookupKey: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: string;
  limits: {
    maxResumes: number;
    monthlyAiCalls: number;
    jobMatchEnabled: boolean;
    coverLetterEnabled: boolean;
    careerCoachEnabled: boolean;
    interviewCoachEnabled: boolean;
    salaryEstimatorEnabled: boolean;
    calendarEnabled: boolean;
    companyReviewEnabled: boolean;
    priorityQueue: boolean;
  };
  activeStripePriceId: string | null;
  updatedAt: string | null;
}

interface StripePrice {
  stripePriceId: string;
  unitAmountCents: number;
  currency: string;
  lookupKey: string | null;
  active: boolean;
  isDefault: boolean;
  created: string;
}

function formatPrice(cents: number, currency: string) {
  const symbol = currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function MAX(v: number) { return v === 2147483647 ? "Unlimited" : v.toLocaleString(); }

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [prices, setPrices] = useState<Record<string, StripePrice[]>>({});
  const [migCounts, setMigCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load plans.");
      setPlans(json.data as Plan[]);
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function loadPrices(code: string) {
    try {
      const res = await fetch(`/api/admin/plans/${code}/prices`);
      const json = await res.json();
      if (json.success) setPrices(prev => ({ ...prev, [code]: json.data as StripePrice[] }));
    } catch { /* ignore */ }
  }

  async function savePlan(p: Plan) {
    setBusy("save");
    try {
      const res = await fetch(`/api/admin/plans/${p.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, description: p.description,
          maxResumes: p.limits.maxResumes, monthlyAiCalls: p.limits.monthlyAiCalls,
          jobMatchEnabled: p.limits.jobMatchEnabled,
          coverLetterEnabled: p.limits.coverLetterEnabled,
          careerCoachEnabled: p.limits.careerCoachEnabled,
          interviewCoachEnabled: p.limits.interviewCoachEnabled,
          salaryEstimatorEnabled: p.limits.salaryEstimatorEnabled,
          calendarEnabled: p.limits.calendarEnabled,
          companyReviewEnabled: p.limits.companyReviewEnabled,
          priorityQueue: p.limits.priorityQueue,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Save failed.");
      setEditing(null);
      await load();
    } catch (err) { alert(err instanceof Error ? err.message : "Save failed."); }
    finally { setBusy(null); }
  }

  async function changePrice(code: string, newDollarStr: string) {
    const dollars = parseFloat(newDollarStr);
    if (isNaN(dollars) || dollars <= 0) { alert("Enter a valid price > 0"); return; }
    const cents = Math.round(dollars * 100);
    if (!confirm(`Create a new Stripe price of ${formatPrice(cents, "usd")} for ${code}? Old price stays active for existing subscribers.`)) return;
    setBusy(`price-${code}`);
    try {
      const res = await fetch(`/api/admin/plans/${code}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyPriceCents: cents }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed.");
      await load();
      await loadPrices(code);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  async function archivePrice(code: string, priceId: string) {
    if (!confirm("Archive this Stripe price? Existing subscriptions on this price continue but no new checkouts will use it.")) return;
    setBusy(`arch-${priceId}`);
    try {
      const res = await fetch(`/api/admin/plans/${code}/prices/${priceId}/archive`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed.");
      await loadPrices(code);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  async function loadMigrationPreview(code: string) {
    try {
      const res = await fetch(`/api/admin/plans/${code}/migration-preview`);
      const json = await res.json();
      if (json.success) setMigCounts(prev => ({ ...prev, [code]: json.data.subscribersOnOldPrices ?? 0 }));
    } catch { /* ignore */ }
  }

  async function migrateSubscribers(code: string) {
    const count = migCounts[code] ?? 0;
    if (count === 0) { alert("No active subscriptions on old prices."); return; }
    if (!confirm(`Migrate ${count} active subscriber(s) of ${code} to the current default price?\n\n• New price takes effect at each user's NEXT renewal (no immediate charge).\n• Each user gets an email notification.\n• This cannot be undone in bulk — would have to set new default + migrate again.`)) return;
    setBusy(`mig-${code}`);
    try {
      const res = await fetch(`/api/admin/plans/${code}/migrate-to-default`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Migration failed.");
      alert(`Migrated: ${json.data.migrated}\nFailed: ${json.data.failed}${json.data.failed > 0 ? `\n\nFailed IDs:\n${json.data.failedSubscriptionIds.join("\n")}` : ""}`);
      await loadMigrationPreview(code);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  async function setDefault(code: string, priceId: string) {
    if (!confirm("Set this as the default price for new checkouts? Plan's display price will update to this amount.")) return;
    setBusy(`def-${priceId}`);
    try {
      const res = await fetch(`/api/admin/plans/${code}/prices/${priceId}/set-default`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed.");
      await load();
      await loadPrices(code);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  if (loading) return <main className="max-w-5xl mx-auto px-4 py-10"><div className="h-40 bg-gray-900 rounded-2xl animate-pulse" /></main>;
  if (error) return <main className="max-w-5xl mx-auto px-4 py-10"><div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div></main>;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin · Plans</h1>
          <p className="text-gray-400 text-sm mt-1">Edit plan info, limits, and Stripe prices.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/users" className="text-blue-400 hover:text-blue-300">Users</Link>
          <Link href="/admin/analytics" className="text-blue-400 hover:text-blue-300">Analytics</Link>
          <Link href="/admin/bug-reports" className="text-blue-400 hover:text-blue-300">Bug Reports</Link>
        </div>
      </div>

      {plans.map(p => (
        <div key={p.code} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">{p.name}<span className="ml-2 text-xs font-mono text-gray-500">({p.code})</span></h2>
              <p className="text-xs text-gray-400 mt-1">{p.description}</p>
              <p className="text-[10px] text-gray-600 mt-1 font-mono">{p.lookupKey} · default Stripe price: {p.activeStripePriceId ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{formatPrice(p.monthlyPriceCents, p.currency)}</p>
              <p className="text-xs text-gray-500">/mo</p>
            </div>
          </div>

          {/* Limits summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
            <Stat label="Resumes" value={MAX(p.limits.maxResumes)} />
            <Stat label="AI calls/mo" value={MAX(p.limits.monthlyAiCalls)} />
            <Toggle label="Job Match" on={p.limits.jobMatchEnabled} />
            <Toggle label="Cover Letter" on={p.limits.coverLetterEnabled} />
            <Toggle label="Career Coach" on={p.limits.careerCoachEnabled} />
            <Toggle label="Interview Coach" on={p.limits.interviewCoachEnabled} />
            <Toggle label="Salary Estimator" on={p.limits.salaryEstimatorEnabled} />
            <Toggle label="Goals & Tasks" on={p.limits.calendarEnabled} />
            <Toggle label="Company Review" on={p.limits.companyReviewEnabled} />
            <Toggle label="Priority Queue" on={p.limits.priorityQueue} />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEditing(p)} className="text-xs bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/40 px-3 py-1.5 rounded-lg">Edit info & limits</button>
            {p.code !== "Free" && (
              <PriceForm planCode={p.code} currentCents={p.monthlyPriceCents} onChange={changePrice} busy={busy === `price-${p.code}`} />
            )}
            <button onClick={() => loadPrices(p.code)} className="text-xs text-gray-400 hover:text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg">
              {prices[p.code] ? "Refresh prices" : "Show Stripe prices"}
            </button>
            {p.code !== "Free" && (
              <button onClick={() => loadMigrationPreview(p.code)} className="text-xs text-gray-400 hover:text-gray-300 border border-gray-700 px-3 py-1.5 rounded-lg">
                {migCounts[p.code] !== undefined ? `Refresh count (${migCounts[p.code]} on old prices)` : "Check migration"}
              </button>
            )}
            {p.code !== "Free" && migCounts[p.code] !== undefined && migCounts[p.code] > 0 && (
              <button onClick={() => migrateSubscribers(p.code)} disabled={busy === `mig-${p.code}`}
                className="text-xs bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/40 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {busy === `mig-${p.code}` ? "Migrating…" : `Migrate ${migCounts[p.code]} subscriber(s) → default price`}
              </button>
            )}
          </div>

          {/* Stripe prices list */}
          {prices[p.code] && (
            <div className="mt-4 bg-gray-800/40 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">Stripe prices ({prices[p.code].length})</h3>
              <div className="space-y-1.5">
                {prices[p.code].map(sp => (
                  <div key={sp.stripePriceId} className="flex items-center justify-between border-b border-gray-800 last:border-0 py-1.5 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      {sp.isDefault && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/40">DEFAULT</span>}
                      {!sp.active && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 border border-gray-600">ARCHIVED</span>}
                      <span className="text-white font-medium">{formatPrice(sp.unitAmountCents, sp.currency)}</span>
                      <span className="text-gray-500 font-mono text-[10px] truncate">{sp.stripePriceId}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {sp.active && !sp.isDefault && (
                        <button onClick={() => setDefault(p.code, sp.stripePriceId)} disabled={busy === `def-${sp.stripePriceId}`} className="text-[10px] text-blue-400 hover:text-blue-300 px-2 py-1">Set default</button>
                      )}
                      {sp.active && (
                        <button onClick={() => archivePrice(p.code, sp.stripePriceId)} disabled={busy === `arch-${sp.stripePriceId}`} className="text-[10px] text-amber-400 hover:text-amber-300 px-2 py-1">Archive</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {editing && <EditModal plan={editing} onClose={() => setEditing(null)} onSave={savePlan} busy={busy === "save"} />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/40 rounded-lg px-3 py-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-white font-semibold">{value}</p>
    </div>
  );
}

function Toggle({ label, on }: { label: string; on: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${on ? "bg-green-500/10 border border-green-500/30" : "bg-gray-800/40 border border-gray-700"}`}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold ${on ? "text-green-300" : "text-gray-500"}`}>{on ? "✓ Enabled" : "✗ Off"}</p>
    </div>
  );
}

function PriceForm({ planCode, currentCents, onChange, busy }: { planCode: string; currentCents: number; onChange: (code: string, dollar: string) => void; busy: boolean }) {
  const [val, setVal] = useState((currentCents / 100).toFixed(2));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onChange(planCode, val); }} className="flex gap-1 items-center">
      <span className="text-xs text-gray-500">$</span>
      <input type="number" step="0.01" min="0.01" value={val} onChange={(e) => setVal(e.target.value)} className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
      <button type="submit" disabled={busy} className="text-xs bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/40 px-3 py-1.5 rounded-lg disabled:opacity-50">
        {busy ? "…" : "Update price"}
      </button>
    </form>
  );
}

function EditModal({ plan, onClose, onSave, busy }: { plan: Plan; onClose: () => void; onSave: (p: Plan) => void; busy: boolean }) {
  const [p, setP] = useState<Plan>(plan);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg my-8">
        <h2 className="text-lg font-bold text-white mb-4">Edit {plan.name}</h2>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Description</label>
            <textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Max resumes</label>
              <input type="number" value={p.limits.maxResumes} onChange={(e) => setP({ ...p, limits: { ...p.limits, maxResumes: Number(e.target.value) } })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">AI calls / month</label>
              <input type="number" value={p.limits.monthlyAiCalls} onChange={(e) => setP({ ...p, limits: { ...p.limits, monthlyAiCalls: Number(e.target.value) } })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ["jobMatchEnabled", "Job Match"],
              ["coverLetterEnabled", "Cover Letter"],
              ["careerCoachEnabled", "Career Coach"],
              ["interviewCoachEnabled", "Interview Coach"],
              ["salaryEstimatorEnabled", "Salary Estimator"],
              ["calendarEnabled", "Goals & Tasks"],
              ["companyReviewEnabled", "Company Review"],
              ["priorityQueue", "Priority queue"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={p.limits[key]} onChange={(e) => setP({ ...p, limits: { ...p.limits, [key]: e.target.checked } })} className="rounded" />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-6 justify-end">
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-300 px-4 py-2">Cancel</button>
          <button onClick={() => onSave(p)} disabled={busy} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

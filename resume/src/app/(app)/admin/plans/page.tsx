"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import DiscountCountdown, { isDiscountActive, isSoldOut, remainingRedemptions } from "@/components/DiscountCountdown";
import { Button, focusRing } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface BankTier {
  id: string;
  months: number;
  discountPercent: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  maxRedemptions: number | null;
  redemptions: number;
}

interface Plan {
  code: "Free" | "Pro" | "Premium";
  lookupKey: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  currency: string;
  monthlyPriceVnd: number;
  bankTiers: BankTier[];
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
  updatedAt: string | null;
}

function formatPrice(cents: number, currency: string) {
  const symbol = currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

function computeBankAmount(monthlyVnd: number, months: number, discountPct: number): number {
  const net = (monthlyVnd * months * (100 - discountPct)) / 100;
  return Math.round(net / 1000) * 1000;
}

function MAX(v: number) { return v === 2147483647 ? "Unlimited" : v.toLocaleString(); }

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // Briefly flag a tier as "saved" so the auto-save (on blur) gives visible feedback.
  function flashSaved(key: string) {
    setSavedFlash(key);
    setTimeout(() => setSavedFlash(cur => (cur === key ? null : cur)), 2500);
  }

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

  async function savePlan(p: Plan) {
    setBusy("save");
    try {
      const res = await fetch(`/api/admin/plans/${p.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: p.name, description: p.description,
          monthlyPriceVnd: p.monthlyPriceVnd,
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

  // Patch a single plan's bankTiers in local state — avoids a full reload (which flashes
  // the page skeleton and would discard the input the admin is mid-editing).
  function setTiers(code: string, fn: (tiers: BankTier[]) => BankTier[]) {
    setPlans(prev => prev.map(pl => pl.code === code ? { ...pl, bankTiers: fn(pl.bankTiers) } : pl));
  }

  async function addTier(code: string, months: number, discountPercent: number, startDate: string | null, endDate: string | null, maxRedemptions: number | null) {
    setBusy(`tier-add-${code}`);
    try {
      const res = await fetch(`/api/admin/plans/${code}/bank-tiers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months, discountPercent, startDate, endDate, maxRedemptions }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to add tier.");
      const created = json.data as BankTier;
      setTiers(code, tiers => [...tiers, created].sort((a, b) => a.months - b.months));
      flashSaved(`tier-${created.id}`);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  async function updateTier(code: string, id: string, patch: { discountPercent?: number; active?: boolean; startDate?: string | null; endDate?: string | null; maxRedemptions?: number | null; clearStartDate?: boolean; clearEndDate?: boolean; clearMaxRedemptions?: boolean }) {
    setBusy(`tier-${id}`);
    try {
      const res = await fetch(`/api/admin/plans/${code}/bank-tiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to update tier.");
      const updated = json.data as BankTier;
      setTiers(code, tiers => tiers.map(t => t.id === id ? updated : t));
      flashSaved(`tier-${id}`);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  async function deleteTier(code: string, id: string) {
    if (!confirm("Delete this duration option? Existing payments are unaffected.")) return;
    setBusy(`tier-${id}`);
    try {
      const res = await fetch(`/api/admin/plans/${code}/bank-tiers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to delete tier.");
      setTiers(code, tiers => tiers.filter(t => t.id !== id));
    } catch (err) { alert(err instanceof Error ? err.message : "Failed."); }
    finally { setBusy(null); }
  }

  if (loading) return <main className="max-w-5xl mx-auto px-4 py-10"><div className="h-40 bg-gray-900 rounded-2xl animate-pulse" /></main>;
  if (error) return <main className="max-w-5xl mx-auto px-4 py-10"><div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div></main>;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <AdminNav />
      <div>
        <h1 className="text-2xl font-bold text-white">Plans</h1>
        <p className="text-gray-400 text-sm mt-1">Edit plan info, limits, and bank-transfer pricing.</p>
      </div>

      {plans.map(p => (
        <div key={p.code} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">{p.name}<span className="ml-2 text-xs font-mono text-gray-500">({p.code})</span></h2>
              <p className="text-xs text-gray-400 mt-1">{p.description}</p>
              <p className="text-[10px] text-gray-600 mt-1 font-mono">{p.lookupKey}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{formatPrice(p.monthlyPriceCents, p.currency)}</p>
              <p className="text-xs text-gray-500">/mo</p>
              {p.code !== "Free" && (
                <p className="text-xs text-purple-300 mt-1">{formatVnd(p.monthlyPriceVnd)}<span className="text-gray-500">/mo</span></p>
              )}
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
            <button onClick={() => setEditing(p)} className={`text-xs bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/40 px-3 py-1.5 rounded-lg ${focusRing}`}>Edit info & limits</button>
          </div>

          {/* Bank-transfer duration tiers */}
          {p.code !== "Free" && (
            <BankTierEditor
              plan={p}
              busy={busy}
              savedFlash={savedFlash}
              onAdd={addTier}
              onUpdate={updateTier}
              onDelete={deleteTier}
            />
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

// ISO string -> value for <input type="datetime-local"> (local time, no seconds/zone).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// <input type="datetime-local"> value -> ISO string (or null if empty).
function localInputToIso(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function BankTierEditor({ plan, busy, savedFlash, onAdd, onUpdate, onDelete }: {
  plan: Plan;
  busy: string | null;
  savedFlash: string | null;
  onAdd: (code: string, months: number, discountPercent: number, startDate: string | null, endDate: string | null, maxRedemptions: number | null) => void;
  onUpdate: (code: string, id: string, patch: { discountPercent?: number; active?: boolean; startDate?: string | null; endDate?: string | null; maxRedemptions?: number | null; clearStartDate?: boolean; clearEndDate?: boolean; clearMaxRedemptions?: boolean }) => void;
  onDelete: (code: string, id: string) => void;
}) {
  const [newMonths, setNewMonths] = useState("");
  const [newDiscount, setNewDiscount] = useState("0");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newQty, setNewQty] = useState("");

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    const m = parseInt(newMonths, 10);
    const d = parseInt(newDiscount, 10);
    if (isNaN(m) || m < 1) { alert("Months must be ≥ 1"); return; }
    if (isNaN(d) || d < 0 || d > 100) { alert("Discount must be 0–100"); return; }
    const q = newQty.trim() === "" ? null : parseInt(newQty, 10);
    if (q !== null && (isNaN(q) || q < 1)) { alert("Quantity must be ≥ 1 (blank = unlimited)"); return; }
    onAdd(plan.code, m, d, localInputToIso(newStart), localInputToIso(newEnd), q);
    setNewMonths(""); setNewDiscount("0"); setNewStart(""); setNewEnd(""); setNewQty("");
  }

  function patchEnd(t: BankTier, val: string) {
    const iso = localInputToIso(val);
    if (iso === null) onUpdate(plan.code, t.id, { clearEndDate: true });
    else onUpdate(plan.code, t.id, { endDate: iso });
  }

  function patchQty(t: BankTier, val: string) {
    if (val.trim() === "") { onUpdate(plan.code, t.id, { clearMaxRedemptions: true }); return; }
    const q = parseInt(val, 10);
    if (isNaN(q) || q < 1) { alert("Quantity must be ≥ 1 (blank = unlimited)"); return; }
    onUpdate(plan.code, t.id, { maxRedemptions: q });
  }

  return (
    <div className="mt-4 bg-gray-800/40 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 tracking-wider">
        Bank transfer durations ({plan.bankTiers.length})
      </h3>
      <p className="text-[10px] text-gray-600 mb-3">
        Total = monthly VND × months × (100 − discount)%, rounded to 1,000₫. Set an end date and/or quantity to show a discount countdown; the countdown hides once the date passes or the quantity sells out. Blank quantity = unlimited.
        <span className="text-gray-500"> · Fields save automatically when you click away (no Save button).</span>
      </p>
      <div className="space-y-1.5">
        {plan.bankTiers.map(t => {
          const total = computeBankAmount(plan.monthlyPriceVnd, t.months, t.discountPercent);
          const soldOut = isSoldOut(t.maxRedemptions, t.redemptions);
          const remaining = remainingRedemptions(t.maxRedemptions, t.redemptions);
          const live = isDiscountActive(t.endDate) && !soldOut;
          return (
            <div key={t.id} className={`border-b border-gray-800 last:border-0 py-2 ${t.active ? "" : "opacity-50"}`}>
              <div className="sm:flex sm:items-center sm:gap-2 text-sm space-y-2 sm:space-y-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium w-20">{t.months} mo</span>
                  <label className="flex items-center gap-1 text-xs text-gray-400">
                    <span>−</span>
                    <input
                      type="number" min="0" max="100" defaultValue={t.discountPercent}
                      onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v !== t.discountPercent) onUpdate(plan.code, t.id, { discountPercent: v }); }}
                      className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white"
                    />
                    <span>%</span>
                  </label>
                  <span className="text-purple-300 font-semibold flex-1">{formatVnd(total)}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => onUpdate(plan.code, t.id, { active: !t.active })} disabled={busy === `tier-${t.id}`}
                    className={`text-[10px] px-2 py-1 rounded disabled:opacity-50 ${focusRing} ${t.active ? "text-amber-400 hover:text-amber-300" : "text-green-400 hover:text-green-300"}`}>
                    {t.active ? "Disable" : "Enable"}
                  </button>
                  <Button variant="link" onClick={() => onDelete(plan.code, t.id)} disabled={busy === `tier-${t.id}`}
                    className="text-[10px] text-red-400 hover:text-red-300">Delete</Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 pl-0 sm:pl-2">
                <label className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="uppercase tracking-wide">Ends</span>
                  <input
                    type="datetime-local"
                    defaultValue={isoToLocalInput(t.endDate)}
                    onBlur={(e) => { const cur = isoToLocalInput(t.endDate); if (e.target.value !== cur) patchEnd(t, e.target.value); }}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white text-[11px]"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="uppercase tracking-wide">Qty</span>
                  <input
                    type="number" min="1" placeholder="∞"
                    defaultValue={t.maxRedemptions ?? ""}
                    onBlur={(e) => { const cur = t.maxRedemptions == null ? "" : String(t.maxRedemptions); if (e.target.value !== cur) patchQty(t, e.target.value); }}
                    className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white text-[11px]"
                  />
                </label>
                <span className="text-[10px] text-gray-500">
                  {t.redemptions} sold{t.maxRedemptions != null ? ` · ${remaining} left` : ""}
                </span>
                {live && (
                  <DiscountCountdown endDate={t.endDate} className="text-[10px] text-amber-300" label={(r) => `⏳ ends in ${r}`} />
                )}
                {t.endDate && !isDiscountActive(t.endDate) && (
                  <span className="text-[10px] text-gray-600">(time ended)</span>
                )}
                {soldOut && (
                  <span className="text-[10px] text-gray-600">(sold out)</span>
                )}
                {busy === `tier-${t.id}` ? (
                  <span className="text-[10px] font-semibold text-gray-300 bg-gray-700/60 px-1.5 py-0.5 rounded">Saving…</span>
                ) : savedFlash === `tier-${t.id}` ? (
                  <span className="text-[10px] font-semibold text-green-300 bg-green-500/15 border border-green-500/30 px-1.5 py-0.5 rounded">✓ Saved</span>
                ) : null}
              </div>
            </div>
          );
        })}
        {plan.bankTiers.length === 0 && (
          <p className="text-xs text-gray-500 py-2">No durations configured — bank transfer is hidden for this plan.</p>
        )}
      </div>
      <form onSubmit={submitNew} className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-gray-800">
        <Field label="Months" labelClassName="block text-[10px] text-gray-500 mb-0.5">
          <input type="number" min="1" value={newMonths} onChange={(e) => setNewMonths(e.target.value)} placeholder="e.g. 24"
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
        </Field>
        <Field label="Discount %" labelClassName="block text-[10px] text-gray-500 mb-0.5">
          <input type="number" min="0" max="100" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
        </Field>
        <Field label="Ends (optional)" labelClassName="block text-[10px] text-gray-500 mb-0.5">
          <input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
        </Field>
        <Field label="Qty (blank = ∞)" labelClassName="block text-[10px] text-gray-500 mb-0.5">
          <input type="number" min="1" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="∞"
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
        </Field>
        <button type="submit" disabled={busy === `tier-add-${plan.code}`}
          className={`text-xs bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/40 px-3 py-1.5 rounded-lg disabled:opacity-50 ${focusRing}`}>
          {busy === `tier-add-${plan.code}` ? "…" : "Add duration"}
        </button>
      </form>
    </div>
  );
}

function EditModal({ plan, onClose, onSave, busy }: { plan: Plan; onClose: () => void; onSave: (p: Plan) => void; busy: boolean }) {
  const [p, setP] = useState<Plan>(plan);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg my-8">
        <h2 className="text-lg font-bold text-white mb-4">Edit {plan.name}</h2>
        <div className="space-y-3 text-sm">
          <Field label="Name" labelClassName="block text-xs text-gray-400 mb-1">
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
          </Field>
          <Field label="Description" labelClassName="block text-xs text-gray-400 mb-1">
            <textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
          </Field>
          {plan.code !== "Free" && (
            <Field label="Monthly price (VND) — base for bank transfer" labelClassName="block text-xs text-gray-400 mb-1"
              hint={`${formatVnd(p.monthlyPriceVnd)} / month. Bank-transfer totals derive from this.`}>
              <input type="number" min="0" step="1000" value={p.monthlyPriceVnd}
                onChange={(e) => setP({ ...p, monthlyPriceVnd: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max resumes" labelClassName="block text-xs text-gray-400 mb-1">
              <input type="number" value={p.limits.maxResumes} onChange={(e) => setP({ ...p, limits: { ...p.limits, maxResumes: Number(e.target.value) } })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </Field>
            <Field label="AI calls / month" labelClassName="block text-xs text-gray-400 mb-1">
              <input type="number" value={p.limits.monthlyAiCalls} onChange={(e) => setP({ ...p, limits: { ...p.limits, monthlyAiCalls: Number(e.target.value) } })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white" />
            </Field>
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
          <button onClick={onClose} className={`text-xs text-gray-400 hover:text-gray-300 px-4 py-2 rounded ${focusRing}`}>Cancel</button>
          <Button onClick={() => onSave(p)} loading={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

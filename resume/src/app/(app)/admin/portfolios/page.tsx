"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { Button, focusRing } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import type { PublicPortfolio } from "@/types/portfolio";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN ?? "dainn.online";

interface AdminPortfolio {
  id: string;
  userId: string;
  userEmail: string | null;
  subdomain: string;
  theme: string;
  status: "Pending" | "Approved" | "Rejected";
  resumeId: string;
  resumeTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUSES = ["Pending", "Approved", "Rejected", ""] as const;
const STATUS_LABEL: Record<string, string> = { Pending: "Pending", Approved: "Approved", Rejected: "Rejected", "": "All" };

function statusColor(s: string): string {
  switch (s) {
    case "Approved": return "text-green-400 bg-green-500/10 border-green-500/30";
    case "Rejected": return "text-red-400 bg-red-500/10 border-red-500/30";
    default: return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  }
}

export default function AdminPortfoliosPage() {
  const [rows, setRows] = useState<AdminPortfolio[]>([]);
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminPortfolio | null>(null);
  const [previewing, setPreviewing] = useState<AdminPortfolio | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await fetch(`/api/admin/portfolios${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load portfolios.");
      setRows((json.data as AdminPortfolio[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  // Auto-dismiss the success notice.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const approve = useCallback(async (p: AdminPortfolio) => {
    setBusyId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/portfolios/${p.id}/approve`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Approve failed.");
      setNotice(`Approved ${p.subdomain}.${BASE_DOMAIN} — it’s now live.`);
      setPreviewing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const emptyLabel = statusFilter
    ? `No ${STATUS_LABEL[statusFilter].toLowerCase()} portfolios.`
    : "No portfolios yet.";

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <AdminNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio Requests</h1>
        <p className="text-gray-400 text-sm mt-1">Review and approve premium portfolio subdomains.</p>
      </div>

      {/* Filter segmented control + result count */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {STATUSES.map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s || "all"}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${focusRing} ${
                  active ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
        {!loading && (
          <span className="text-xs text-gray-500">{rows.length} {rows.length === 1 ? "result" : "results"}</span>
        )}
      </div>

      {notice && <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 text-green-400 text-sm">{notice}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Subdomain</th>
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Résumé</th>
              <th className="text-left px-4 py-3 font-medium">Theme</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Requested</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center text-gray-500 py-12">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 py-12">{emptyLabel}</td></tr>}
            {!loading && rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  {p.status === "Approved" ? (
                    <a href={`https://${p.subdomain}.${BASE_DOMAIN}`} target="_blank" rel="noopener noreferrer"
                       className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline">
                      {p.subdomain}.{BASE_DOMAIN}
                    </a>
                  ) : (
                    // Not live yet — linking would 404, so show plain text.
                    <span className="text-gray-300">{p.subdomain}.{BASE_DOMAIN}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">{p.userEmail ?? p.userId}</td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-[14rem] truncate">{p.resumeTitle ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400 text-xs capitalize">{p.theme}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded border ${statusColor(p.status)}`}>{p.status}</span></td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    <Button variant="secondary" onClick={() => setPreviewing(p)} disabled={busyId !== null} className="text-xs px-3 py-1">Preview</Button>
                    {p.status !== "Approved" && (
                      <Button variant="success" onClick={() => approve(p)} loading={busyId === p.id} disabled={busyId !== null} className="text-xs px-3 py-1">Approve</Button>
                    )}
                    {p.status !== "Rejected" && (
                      <Button variant="dangerOutline" onClick={() => setRejecting(p)} disabled={busyId !== null} className="text-xs px-3 py-1">Reject</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewing && (
        <PreviewModal
          portfolio={previewing}
          busy={busyId !== null}
          onClose={() => setPreviewing(null)}
          onApprove={() => approve(previewing)}
          onReject={() => { setRejecting(previewing); setPreviewing(null); }}
        />
      )}

      {rejecting && (
        <RejectModal
          portfolio={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(sub) => { setRejecting(null); setNotice(`Rejected ${sub}.${BASE_DOMAIN}.`); void load(); }}
        />
      )}
    </main>
  );
}

function PreviewModal({
  portfolio, busy, onClose, onApprove, onReject,
}: {
  portfolio: AdminPortfolio;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [data, setData] = useState<PublicPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/admin/portfolios/${portfolio.id}/preview`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error ?? "Could not load preview.");
        if (!cancelled) setData(json.data as PublicPortfolio);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "An error occurred.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [portfolio.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{portfolio.subdomain}.{BASE_DOMAIN}</h2>
            <p className="text-xs text-gray-500 truncate">
              {portfolio.userEmail ?? portfolio.userId} · <span className="capitalize">{portfolio.theme}</span> theme
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${statusColor(portfolio.status)}`}>{portfolio.status}</span>
            <button onClick={onClose} className={`p-1.5 text-gray-400 hover:text-white ${focusRing}`} aria-label="Close">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Live render of the portfolio exactly as it will appear publicly. */}
        <div className="flex-1 overflow-y-auto bg-gray-950">
          {loading && <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500" /></div>}
          {err && <div className="m-6 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{err}</div>}
          {data && <PortfolioRenderer data={data.resume} theme={data.theme} hideContact={data.hideContact} />}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800 shrink-0">
          {portfolio.status !== "Rejected" && (
            <Button variant="dangerOutline" onClick={onReject} disabled={busy}>Reject</Button>
          )}
          {portfolio.status !== "Approved" && (
            <Button variant="success" onClick={onApprove} loading={busy}>Approve</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function RejectModal({ portfolio, onClose, onDone }: { portfolio: AdminPortfolio; onClose: () => void; onDone: (subdomain: string) => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/portfolios/${portfolio.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Reject failed.");
      onDone(portfolio.subdomain);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "An error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white">Reject {portfolio.subdomain}.{BASE_DOMAIN}</h2>
          <button onClick={onClose} className={`p-1.5 text-gray-400 hover:text-white ${focusRing}`} aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Reason (shown to the user)" hint="Leave blank to send a generic rejection.">
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Subdomain name not allowed."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
            />
          </Field>
          {err && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{err}</div>}
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={saving}>Reject</Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { Button, focusRing } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

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
  const [rejecting, setRejecting] = useState<AdminPortfolio | null>(null);
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

  const approve = useCallback(async (p: AdminPortfolio) => {
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/admin/portfolios/${p.id}/approve`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Approve failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setBusyId(null);
    }
  }, [load]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <AdminNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio Requests</h1>
        <p className="text-gray-400 text-sm mt-1">Review and approve premium portfolio subdomains.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
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
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 py-12">No portfolios.</td></tr>}
            {!loading && rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <a href={`https://${p.subdomain}.${BASE_DOMAIN}`} target="_blank" rel="noopener noreferrer"
                     className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline">
                    {p.subdomain}.{BASE_DOMAIN}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">{p.userEmail ?? p.userId}</td>
                <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{p.resumeTitle ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400 text-xs capitalize">{p.theme}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded border ${statusColor(p.status)}`}>{p.status}</span></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
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

      {rejecting && (
        <RejectModal
          portfolio={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => { setRejecting(null); void load(); }}
        />
      )}
    </main>
  );
}

function RejectModal({ portfolio, onClose, onDone }: { portfolio: AdminPortfolio; onClose: () => void; onDone: () => void }) {
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
      onDone();
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
          <Field label="Reason (shown to the user)">
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

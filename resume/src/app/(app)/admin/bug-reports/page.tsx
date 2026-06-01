"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/components/TranslationProvider";
import AdminNav from "@/components/AdminNav";
import { Button, focusRing } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

const SEVERITY_KEYS = ["severityLow", "severityMedium", "severityHigh", "severityCritical"];
const STATUS_KEYS = ["statusNew", "statusInProgress", "statusResolved", "statusClosed"];

interface BugReportRow {
  id: string;
  userId: string | null;
  reporterEmail: string | null;
  title: string;
  description: string;
  severity: number; // 0 Low, 1 Medium, 2 High, 3 Critical
  category: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  status: number; // 0 New, 1 In Progress, 2 Resolved, 3 Closed
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  total: number;
  page: number;
  size: number;
  newCount: number;
  reports: BugReportRow[];
}

function severityColor(s: number): string {
  switch (s) {
    case 3: return "text-red-400 bg-red-500/10 border-red-500/30";
    case 2: return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    case 1: return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    default: return "text-gray-400 bg-gray-800 border-gray-700";
  }
}

function statusColor(s: number): string {
  switch (s) {
    case 0: return "text-blue-400 bg-blue-500/10 border-blue-500/30";
    case 1: return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case 2: return "text-green-400 bg-green-500/10 border-green-500/30";
    default: return "text-gray-400 bg-gray-800 border-gray-700";
  }
}

export default function AdminBugReportsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ListResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BugReportRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      const res = await fetch(`/api/admin/bug-reports?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? t("adminBugReports.loadFailed"));
      setData(json.data as ListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminBugReports.errorOccurred"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, severityFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <AdminNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {t("adminBugReports.title")}
          {data && data.newCount > 0 && (
            <span className="ml-3 align-middle text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
              {interpolate(t("adminBugReports.newBadge"), { count: data.newCount })}
            </span>
          )}
        </h1>
        <p className="text-gray-400 text-sm mt-1">{t("adminBugReports.subtitle")}</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">{t("adminBugReports.allStatuses")}</option>
          {STATUS_KEYS.map((key, i) => <option key={i} value={i}>{t(`adminBugReports.${key}`)}</option>)}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => { setPage(1); setSeverityFilter(e.target.value); }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">{t("adminBugReports.allSeverities")}</option>
          {SEVERITY_KEYS.map((key, i) => <option key={i} value={i}>{t(`adminBugReports.${key}`)}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t("adminBugReports.colSeverity")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminBugReports.colTitle")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminBugReports.colReporter")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminBugReports.colCategory")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminBugReports.colStatus")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminBugReports.colSubmitted")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center text-gray-500 py-12">{t("adminBugReports.loading")}</td></tr>}
            {!loading && data && data.reports.length === 0 && <tr><td colSpan={6} className="text-center text-gray-500 py-12">{t("adminBugReports.empty")}</td></tr>}
            {!loading && data && data.reports.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${severityColor(r.severity)}`}>{t(`adminBugReports.${SEVERITY_KEYS[r.severity]}`)}</span>
                </td>
                <td className="px-4 py-3 text-white font-medium max-w-xs truncate">{r.title}</td>
                <td className="px-4 py-3 text-gray-300 text-xs">{r.reporterEmail ?? t("adminBugReports.anonymous")}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.category ?? t("adminBugReports.dash")}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${statusColor(r.status)}`}>{t(`adminBugReports.${STATUS_KEYS[r.status]}`)}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">{interpolate(t("adminBugReports.pageInfo"), { page, total: totalPages, count: data.total })}</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="text-sm px-3 py-1">{t("adminBugReports.prev")}</Button>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="text-sm px-3 py-1">{t("adminBugReports.next")}</Button>
          </div>
        </div>
      )}

      {selected && (
        <ReportDetail
          report={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { void load(); }}
        />
      )}
    </main>
  );
}

function ReportDetail({
  report,
  onClose,
  onChanged,
}: {
  report: BugReportRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(report.status);
  const [notes, setNotes] = useState(report.adminNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/bug-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes: notes }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? t("adminBugReports.saveFailed"));
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("adminBugReports.errorOccurred"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(t("adminBugReports.deleteConfirm"))) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/bug-reports/${report.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? t("adminBugReports.deleteFailed"));
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("adminBugReports.errorOccurred"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div className="pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${severityColor(report.severity)}`}>{t(`adminBugReports.${SEVERITY_KEYS[report.severity]}`)}</span>
              {report.category && <span className="text-xs text-gray-400">· {report.category}</span>}
            </div>
            <h2 className="text-lg font-bold text-white">{report.title}</h2>
          </div>
          <button onClick={onClose} className={`p-1.5 text-gray-400 hover:text-white ${focusRing}`} aria-label={t("adminBugReports.close")}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1.5">{t("adminBugReports.descriptionLabel")}</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{report.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Meta label={t("adminBugReports.metaReporter")} value={report.reporterEmail ?? t("adminBugReports.anonymous")} />
            <Meta label={t("adminBugReports.metaUserId")} value={report.userId ?? t("adminBugReports.dash")} />
            <Meta label={t("adminBugReports.metaPage")} value={report.pageUrl ?? t("adminBugReports.dash")} breakAll />
            <Meta label={t("adminBugReports.metaSubmitted")} value={new Date(report.createdAt).toLocaleString()} />
          </div>

          {report.userAgent && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1.5">{t("adminBugReports.userAgentLabel")}</h3>
              <p className="text-xs text-gray-500 break-all">{report.userAgent}</p>
            </div>
          )}

          <Field label={t("adminBugReports.statusLabel")} labelClassName="block text-xs uppercase tracking-wider text-gray-500 mb-1.5">
            <select
              value={status}
              onChange={(e) => setStatus(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {STATUS_KEYS.map((key, i) => <option key={i} value={i}>{t(`adminBugReports.${key}`)}</option>)}
            </select>
          </Field>

          <Field label={t("adminBugReports.internalNotesLabel")} labelClassName="block text-xs uppercase tracking-wider text-gray-500 mb-1.5">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("adminBugReports.notesPlaceholder")}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
            />
          </Field>

          {err && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{err}</div>}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <Button variant="link" onClick={remove} disabled={saving} className="text-red-400 hover:text-red-300">{t("adminBugReports.delete")}</Button>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving}>{t("adminBugReports.cancel")}</Button>
            <Button onClick={save} loading={saving}>
              {saving ? t("adminBugReports.saving") : t("adminBugReports.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, breakAll }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
      <p className={`text-gray-300 ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}

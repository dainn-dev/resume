"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import AdminNav from "@/components/AdminNav";
import { Button } from "@/components/ui/Button";

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

interface UserRow {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  status: string;
  isLocked: boolean;
  lockoutEnd: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  plan: string;
  subStatus: string | null;
  resumeCount: number;
}

interface ListResponse {
  total: number;
  page: number;
  size: number;
  users: UserRow[];
}

function planColor(plan: string): string {
  if (plan === "Premium") return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  if (plan === "Pro") return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  return "text-gray-400 bg-gray-800 border-gray-700";
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (search.trim()) p.set("search", search.trim());
    if (planFilter) p.set("plan", planFilter);
    if (statusFilter) p.set("status", statusFilter);
    return p;
  }, [search, planFilter, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filterParams();
      params.set("page", String(page));
      params.set("size", "20");
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? t("adminUsers.loadFailed"));
      setData(json.data as ListResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("adminUsers.errorOccurred"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  const pageIds = data?.users.map((u) => u.id) ?? [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleSelectAllOnPage() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  }

  function exportCsv() {
    const p = filterParams();
    if (selected.size > 0) p.set("ids", Array.from(selected).join(","));
    window.location.href = `/api/admin/users/export?${p.toString()}`;
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <AdminNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("adminUsers.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("adminUsers.subtitle")}</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }} className="flex gap-2 w-full sm:flex-1 sm:w-auto sm:min-w-[220px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminUsers.searchPlaceholder")}
            className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <Button type="submit" size="sm">{t("adminUsers.search")}</Button>
        </form>

        <select
          value={planFilter}
          onChange={(e) => { setPage(1); setPlanFilter(e.target.value); }}
          className="flex-1 sm:flex-none min-w-[120px] bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">{t("adminUsers.filterAllPlans")}</option>
          <option value="Free">Free</option>
          <option value="Pro">Pro</option>
          <option value="Premium">Premium</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
          className="flex-1 sm:flex-none min-w-[120px] bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">{t("adminUsers.filterAllStatuses")}</option>
          <option value="active">{t("adminUsers.filterActive")}</option>
          <option value="locked">{t("adminUsers.filterLocked")}</option>
          <option value="unverified">{t("adminUsers.filterUnverified")}</option>
        </select>

        <Button variant="secondary" size="sm" onClick={exportCsv}>
          {t("adminUsers.export")}{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-400 hover:text-white"
          >
            {interpolate(t("adminUsers.selectedCount"), { count: selected.size })} · {t("adminUsers.clearSelection")}
          </button>
        )}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  aria-label={t("adminUsers.selectAll")}
                  checked={allOnPageSelected}
                  onChange={toggleSelectAllOnPage}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="text-left px-3 py-2 font-medium">{t("adminUsers.colEmail")}</th>
              <th className="text-left px-3 py-2 font-medium">{t("adminUsers.colUsername")}</th>
              <th className="text-left px-3 py-2 font-medium">{t("adminUsers.colPlan")}</th>
              <th className="text-left px-3 py-2 font-medium">{t("adminUsers.colStatus")}</th>
              <th className="text-right px-3 py-2 font-medium">{t("adminUsers.colResumes")}</th>
              <th className="text-left px-3 py-2 font-medium">{t("adminUsers.colJoined")}</th>
              <th className="text-left px-3 py-2 font-medium">{t("adminUsers.colLastLogin")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center text-gray-500 py-12">{t("adminUsers.loading")}</td></tr>}
            {!loading && data && data.users.length === 0 && <tr><td colSpan={8} className="text-center text-gray-500 py-12">{t("adminUsers.empty")}</td></tr>}
            {!loading && data && data.users.map((u) => (
              <tr key={u.id} className={`border-t border-gray-800 transition-colors ${selected.has(u.id) ? "bg-blue-500/5" : "hover:bg-gray-800/30"}`}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={u.email}
                    checked={selected.has(u.id)}
                    onChange={() => toggleSelect(u.id)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/users/${u.id}`} className="text-blue-400 hover:text-blue-300 font-medium">{u.email}</Link>
                  {!u.emailVerified && <span className="ml-2 text-[10px] text-amber-400">{t("adminUsers.unverified")}</span>}
                </td>
                <td className="px-3 py-2 text-gray-300">{u.username}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${planColor(u.plan)}`}>{u.plan}</span>
                </td>
                <td className="px-3 py-2">
                  {u.isLocked
                    ? <span className="text-xs text-red-400">{t("adminUsers.locked")}</span>
                    : <span className="text-xs text-green-400">{t("adminUsers.active")}</span>}
                </td>
                <td className="px-3 py-2 text-right text-gray-300">{u.resumeCount}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : t("adminUsers.dash")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">{interpolate(t("adminUsers.pageInfo"), { page, total: totalPages, count: data.total })}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>{t("adminUsers.prev")}</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t("adminUsers.next")}</Button>
          </div>
        </div>
      )}
    </main>
  );
}

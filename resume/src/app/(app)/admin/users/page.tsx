"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import AdminNav from "@/components/AdminNav";

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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: "20" });
      if (search.trim()) params.set("search", search.trim());
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
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = data ? Math.ceil(data.total / data.size) : 0;

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <AdminNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("adminUsers.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("adminUsers.subtitle")}</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); void load(); }} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminUsers.searchPlaceholder")}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 rounded-lg">{t("adminUsers.search")}</button>
        </form>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-medium">{t("adminUsers.colEmail")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminUsers.colUsername")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminUsers.colPlan")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminUsers.colStatus")}</th>
              <th className="text-right px-4 py-3 font-medium">{t("adminUsers.colResumes")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminUsers.colJoined")}</th>
              <th className="text-left px-4 py-3 font-medium">{t("adminUsers.colLastLogin")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center text-gray-500 py-12">{t("adminUsers.loading")}</td></tr>}
            {!loading && data && data.users.length === 0 && <tr><td colSpan={7} className="text-center text-gray-500 py-12">{t("adminUsers.empty")}</td></tr>}
            {!loading && data && data.users.map((u) => (
              <tr key={u.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="text-blue-400 hover:text-blue-300 font-medium">{u.email}</Link>
                  {!u.emailVerified && <span className="ml-2 text-[10px] text-amber-400">{t("adminUsers.unverified")}</span>}
                </td>
                <td className="px-4 py-3 text-gray-300">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${planColor(u.plan)}`}>{u.plan}</span>
                </td>
                <td className="px-4 py-3">
                  {u.isLocked
                    ? <span className="text-xs text-red-400">{t("adminUsers.locked")}</span>
                    : <span className="text-xs text-green-400">{t("adminUsers.active")}</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">{u.resumeCount}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : t("adminUsers.dash")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">{interpolate(t("adminUsers.pageInfo"), { page, total: totalPages, count: data.total })}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-800">{t("adminUsers.prev")}</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-gray-700 rounded-lg disabled:opacity-30 hover:bg-gray-800">{t("adminUsers.next")}</button>
          </div>
        </div>
      )}
    </main>
  );
}

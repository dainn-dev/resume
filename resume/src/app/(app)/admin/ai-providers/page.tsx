"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/components/TranslationProvider";
import AdminNav from "@/components/AdminNav";

interface AiProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyPreview: string;
  models: string[];
  isEnabled: boolean;
  roundRobin: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string;
  isEnabled: boolean;
  roundRobin: boolean;
  priority: number;
}

const EMPTY_FORM: FormState = {
  name: "",
  baseUrl: "",
  apiKey: "",
  models: "",
  isEnabled: true,
  roundRobin: false,
  priority: 0,
};

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

export default function AdminAiProvidersPage() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AiProvider | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai-providers");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");
      setProviders(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowCreate(true);
  }

  function openEdit(p: AiProvider) {
    setShowCreate(false);
    setEditing(p);
    setForm({
      name: p.name,
      baseUrl: p.baseUrl,
      apiKey: p.apiKeyPreview,
      models: p.models.join(", "),
      isEnabled: p.isEnabled,
      roundRobin: p.roundRobin,
      priority: p.priority,
    });
  }

  function closeForm() {
    setEditing(null);
    setShowCreate(false);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    const body = {
      name: form.name,
      baseUrl: form.baseUrl,
      apiKey: form.apiKey,
      models: form.models.split(",").map(s => s.trim()).filter(Boolean),
      isEnabled: form.isEnabled,
      roundRobin: form.roundRobin,
      priority: form.priority,
    };
    try {
      const url = editing
        ? `/api/admin/ai-providers/${editing.id}`
        : "/api/admin/ai-providers";
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");
      closeForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(p: AiProvider) {
    if (!confirm(t("adminAi.deleteConfirm").replace("{name}", p.name))) return;
    try {
      const res = await fetch(`/api/admin/ai-providers/${p.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  const isFormOpen = showCreate || editing;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <AdminNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("adminAi.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">{t("adminAi.subtitle")}</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          {t("adminAi.add")}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Form */}
      {isFormOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">
            {editing ? t("adminAi.editTitle") : t("adminAi.addTitle")}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t("adminAi.fieldName")}</label>
              <input className={inputClass()} placeholder="OpenAI, Anthropic, ..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t("adminAi.fieldPriority")}</label>
              <input className={inputClass()} type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">{t("adminAi.fieldBaseUrl")}</label>
            <input className={inputClass()} placeholder="https://api.openai.com/v1" value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">{t("adminAi.fieldApiKey")}</label>
            <input className={inputClass()} placeholder="sk-..." value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
            {editing && <p className="text-[11px] text-gray-600 mt-1">{t("adminAi.apiKeyHint")}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">{t("adminAi.fieldModels")}</label>
            <input className={inputClass()} placeholder="gpt-4o, gpt-4o-mini, claude-sonnet-4-6" value={form.models} onChange={e => setForm(f => ({ ...f, models: e.target.value }))} />
            <p className="text-[11px] text-gray-600 mt-1">{t("adminAi.modelsHint")}</p>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.isEnabled} onChange={e => setForm(f => ({ ...f, isEnabled: e.target.checked }))} className="rounded bg-gray-800 border-gray-600" />
              {t("adminAi.enabled")}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input type="checkbox" checked={form.roundRobin} onChange={e => setForm(f => ({ ...f, roundRobin: e.target.checked }))} className="rounded bg-gray-800 border-gray-600" />
              {t("adminAi.roundRobin")}
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={busy || !form.name || !form.baseUrl} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              {busy ? t("adminAi.saving") : t("adminAi.save")}
            </button>
            <button onClick={closeForm} className="text-gray-400 hover:text-white text-sm px-4 py-2 transition-colors">
              {t("adminAi.cancel")}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      ) : providers.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 text-sm">{t("adminAi.empty")}</p>
          <p className="text-gray-500 text-xs mt-2">{t("adminAi.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.id} className={`bg-gray-900 border rounded-2xl px-5 py-4 ${p.isEnabled ? "border-gray-800" : "border-gray-800 opacity-50"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.isEnabled ? "bg-green-500" : "bg-gray-600"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{p.name}</span>
                    <span className="text-gray-600 text-xs">P{p.priority}</span>
                    {p.roundRobin && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 uppercase">RR</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs truncate mt-0.5">{p.baseUrl}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.models.map(m => (
                      <span key={m} className="text-[11px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{m}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors" title={t("adminAi.edit")}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                    </svg>
                  </button>
                  <button onClick={() => void handleDelete(p)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title={t("adminAi.delete")}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

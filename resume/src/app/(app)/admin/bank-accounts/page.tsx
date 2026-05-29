"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface BankAccount {
  id: string;
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
  isDefault: boolean;
}

const EMPTY_FORM: FormState = {
  bankBin: "",
  bankCode: "",
  bankName: "",
  accountNumber: "",
  accountHolder: "",
  isActive: true,
  isDefault: false,
};

const BANK_PRESETS = [
  { bin: "970436", code: "VCB", name: "Vietcombank" },
  { bin: "970422", code: "MB", name: "MB Bank" },
  { bin: "970418", code: "BIDV", name: "BIDV" },
  { bin: "970415", code: "VTB", name: "VietinBank" },
  { bin: "970432", code: "VPB", name: "VPBank" },
  { bin: "970407", code: "TCB", name: "Techcombank" },
  { bin: "970423", code: "TPB", name: "TPBank" },
  { bin: "970416", code: "ACB", name: "ACB" },
  { bin: "970403", code: "STB", name: "Sacombank" },
  { bin: "970426", code: "MSB", name: "MSB" },
];

export default function AdminBankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bank-accounts");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed.");
      setAccounts(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowCreate(true);
  }

  function openEdit(account: BankAccount) {
    setForm({
      bankBin: account.bankBin,
      bankCode: account.bankCode,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
      isActive: account.isActive,
      isDefault: account.isDefault,
    });
    setEditing(account);
    setShowCreate(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const url = editing ? `/api/admin/bank-accounts/${editing.id}` : "/api/admin/bank-accounts";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Save failed.");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(account: BankAccount) {
    if (!confirm(`Delete bank account "${account.bankName} - ${account.accountNumber}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bank-accounts/${account.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Delete failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function applyPreset(p: typeof BANK_PRESETS[number]) {
    setForm(f => ({ ...f, bankBin: p.bin, bankCode: p.code, bankName: p.name }));
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/users" className="text-xs text-blue-400 hover:text-blue-300">← Admin</Link>
          <h1 className="text-2xl font-bold text-white mt-1">Bank Accounts</h1>
          <p className="text-gray-400 text-sm mt-1">Accounts that receive VietQR transfer payments. Mark one as default.</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + Add bank account
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="h-64 bg-gray-900 rounded-2xl animate-pulse" />
      ) : accounts.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400 text-sm">
          No bank accounts yet. Add one to enable bank QR payments.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(a => (
            <div key={a.id} className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 ${a.isDefault ? "border-blue-500/40" : "border-gray-800"}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{a.bankName}</span>
                  <span className="text-xs text-gray-500">({a.bankCode})</span>
                  {a.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">DEFAULT</span>}
                  {!a.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 font-semibold">INACTIVE</span>}
                </div>
                <p className="text-gray-300 text-sm mt-1">{a.accountNumber} · {a.accountHolder}</p>
                <p className="text-gray-500 text-xs mt-0.5">BIN: {a.bankBin}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(a)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                <button onClick={() => remove(a)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !busy && setShowCreate(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-lg">{editing ? "Edit" : "Add"} bank account</h3>

            <div>
              <p className="text-xs text-gray-400 mb-1.5">Quick presets</p>
              <div className="flex flex-wrap gap-1">
                {BANK_PRESETS.map(p => (
                  <button key={p.code} onClick={() => applyPreset(p)} className="text-xs border border-gray-700 hover:border-gray-600 hover:bg-gray-800 text-gray-300 px-2 py-1 rounded">
                    {p.code}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Bank BIN *</label>
                <input value={form.bankBin} onChange={e => setForm(f => ({ ...f, bankBin: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Bank code (e.g. VCB) *</label>
                <input value={form.bankCode} onChange={e => setForm(f => ({ ...f, bankCode: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400">Bank name *</label>
                <input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400">Account number *</label>
                <input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400">Account holder name *</label>
                <input value={form.accountHolder} onChange={e => setForm(f => ({ ...f, accountHolder: e.target.value }))} placeholder="UPPERCASE recommended" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))} />
                Default for new payments
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} disabled={busy} className="flex-1 border border-gray-700 hover:bg-gray-800 text-gray-300 text-sm font-semibold py-2.5 rounded-lg">
                Cancel
              </button>
              <button onClick={save} disabled={busy} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

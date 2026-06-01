"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, focusRing } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { fetchAccountSummary, type AccountSummary } from "@/lib/accountClient";
import {
  fetchMyPortfolio, createPortfolio, updatePortfolio, deletePortfolio, checkSubdomain,
} from "@/lib/portfolioClient";
import { PORTFOLIO_THEMES, type Portfolio, type PortfolioTheme, type SubdomainAvailability } from "@/types/portfolio";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN ?? "dainn.online";

export default function PortfolioManagePage() {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([fetchAccountSummary(), fetchMyPortfolio()]);
      setSummary(s);
      setPortfolio(p);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500 mx-auto mt-20" />
      </main>
    );
  }

  const isPremium = summary?.plan.code === "Premium";

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio Website</h1>
        <p className="text-gray-400 text-sm mt-1">
          Publish one of your résumés as a public portfolio at <span className="text-gray-300">your-name.{BASE_DOMAIN}</span>.
        </p>
      </header>

      {!isPremium ? (
        <UpsellCard />
      ) : (
        <PortfolioEditor
          summary={summary!}
          portfolio={portfolio}
          onChanged={(p) => setPortfolio(p)}
        />
      )}
    </main>
  );
}

function UpsellCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
      <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
        <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-white">A Premium feature</h2>
      <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
        Portfolio websites are available on the Premium plan. Upgrade to claim your subdomain and share your résumé as a polished site.
      </p>
      <Link href="/billing" className="inline-block mt-5">
        <Button>Upgrade to Premium</Button>
      </Link>
    </div>
  );
}

function PortfolioEditor({
  summary,
  portfolio,
  onChanged,
}: {
  summary: AccountSummary;
  portfolio: Portfolio | null;
  onChanged: (p: Portfolio | null) => void;
}) {
  const resumes = summary.resumes;
  const [subdomain, setSubdomain] = useState(portfolio?.subdomain ?? "");
  const [resumeId, setResumeId] = useState(portfolio?.resumeId ?? resumes[0]?.id ?? "");
  const [theme, setTheme] = useState<PortfolioTheme>(portfolio?.theme ?? "minimal");
  const [hideContact, setHideContact] = useState(portfolio?.hideContact ?? false);
  const [avail, setAvail] = useState<SubdomainAvailability | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEditing = portfolio !== null;
  const subdomainChanged = subdomain !== (portfolio?.subdomain ?? "");

  // Debounced availability check whenever the (changed) subdomain is non-empty.
  useEffect(() => {
    if (!subdomainChanged || subdomain.trim().length === 0) { setAvail(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const r = await checkSubdomain(subdomain.trim());
      setAvail(r);
      setChecking(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [subdomain, subdomainChanged]);

  const canSubmit = useMemo(() => {
    if (!resumeId || subdomain.trim().length < 3) return false;
    if (subdomainChanged && (checking || (avail && !avail.available))) return false;
    return true;
  }, [resumeId, subdomain, subdomainChanged, checking, avail]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = isEditing
        ? await updatePortfolio({ subdomain: subdomain.trim(), resumeId, theme, hideContact })
        : await createPortfolio({ subdomain: subdomain.trim(), resumeId, theme });
      if (!result.ok) { setError(result.error ?? "Could not save."); return; }
      onChanged(result.data ?? null);
      setAvail(null);
    } finally {
      setSaving(false);
    }
  }, [isEditing, subdomain, resumeId, theme, hideContact, onChanged]);

  const remove = useCallback(async () => {
    if (!confirm("Delete your portfolio? The subdomain will be released.")) return;
    setSaving(true);
    const ok = await deletePortfolio();
    setSaving(false);
    if (ok) {
      onChanged(null);
      setSubdomain(""); setAvail(null);
    }
  }, [onChanged]);

  if (resumes.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
        You need at least one résumé first.{" "}
        <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline">Score a résumé</Link>{" "}
        to get started.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {portfolio && <StatusBanner portfolio={portfolio} />}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <Field label="Subdomain" required hint={`Lowercase letters, numbers and hyphens. 3–63 characters.`}>
          <div className="flex items-stretch">
            <input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
              placeholder="your-name"
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-l-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <span className="inline-flex items-center px-3 rounded-r-lg border border-l-0 border-gray-700 bg-gray-800/60 text-sm text-gray-400">
              .{BASE_DOMAIN}
            </span>
          </div>
        </Field>

        {subdomainChanged && subdomain.trim().length >= 3 && (
          <AvailabilityHint checking={checking} avail={avail} />
        )}

        <Field label="Résumé to display" required>
          <select
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>{r.title ?? r.sourceFileName ?? "Untitled résumé"}</option>
            ))}
          </select>
        </Field>

        <div>
          <span className="block text-xs font-medium text-gray-400 mb-2">Theme</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PORTFOLIO_THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                onClick={() => setTheme(th.id)}
                className={`text-left rounded-xl border p-3 transition-colors ${focusRing} ${
                  theme === th.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 bg-gray-800/40 hover:border-gray-600"
                }`}
              >
                <span className="block text-sm font-semibold text-white">{th.label}</span>
                <span className="block text-xs text-gray-400 mt-0.5">{th.blurb}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hideContact}
            onChange={(e) => setHideContact(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Hide my email &amp; phone on the public page</span>
        </label>

        {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}

        <div className="flex items-center justify-between pt-1">
          {isEditing ? (
            <Button variant="link" onClick={remove} disabled={saving} className="text-red-400 hover:text-red-300">Delete portfolio</Button>
          ) : <span />}
          <Button onClick={save} loading={saving} disabled={!canSubmit || saving}>
            {isEditing ? "Save changes" : "Submit for review"}
          </Button>
        </div>
      </div>

      {!isEditing && (
        <p className="text-xs text-gray-500">
          New portfolios are reviewed by our team before going live. You’ll see the status here once submitted.
        </p>
      )}
    </div>
  );
}

function AvailabilityHint({ checking, avail }: { checking: boolean; avail: SubdomainAvailability | null }) {
  if (checking) return <p className="text-xs text-gray-500 -mt-2">Checking availability…</p>;
  if (!avail) return null;
  return avail.available
    ? <p className="text-xs text-green-400 -mt-2">✓ Available</p>
    : <p className="text-xs text-red-400 -mt-2">✕ {avail.reason}</p>;
}

function StatusBanner({ portfolio }: { portfolio: Portfolio }) {
  const url = `https://${portfolio.subdomain}.${BASE_DOMAIN}`;
  if (portfolio.status === "Approved") {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
        <p className="text-sm font-semibold text-green-400">Live</p>
        <p className="text-sm text-gray-300 mt-1">
          Your portfolio is published at{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-green-300 hover:text-green-200 underline-offset-2 hover:underline">{url}</a>
        </p>
      </div>
    );
  }
  if (portfolio.status === "Rejected") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
        <p className="text-sm font-semibold text-red-400">Request rejected</p>
        {portfolio.rejectReason && <p className="text-sm text-gray-300 mt-1">{portfolio.rejectReason}</p>}
        <p className="text-xs text-gray-500 mt-1">Adjust the details below and save to resubmit.</p>
      </div>
    );
  }
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
      <p className="text-sm font-semibold text-amber-400">Pending review</p>
      <p className="text-sm text-gray-300 mt-1">Your request for <span className="text-gray-200">{url}</span> is awaiting admin approval.</p>
    </div>
  );
}

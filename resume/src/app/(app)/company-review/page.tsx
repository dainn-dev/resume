"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import { Button, buttonClasses, focusRing } from "@/components/ui/Button";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { CompanyReviewResponse, ReviewItem, SourceStatus, TopTechCompany } from "@/types/companyReview";

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function StarRow({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-gray-600 text-xs">—</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400 text-sm">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full || (i === full && half);
        return <span key={i}>{filled ? "★" : "☆"}</span>;
      })}
      <span className="ml-1 text-gray-300 text-xs">{rating.toFixed(1)}</span>
    </span>
  );
}

function SourceChip({ s, t }: { s: SourceStatus; t: (k: string) => string }) {
  const ok = s.status === "ok";
  const blocked = s.status === "blocked";
  const color = ok
    ? "text-green-400 bg-green-500/10 border-green-500/30"
    : blocked
      ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
      : "text-red-400 bg-red-500/10 border-red-500/30";
  const icon = ok ? "✓" : blocked ? "⊘" : "✗";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${color}`} title={s.error ?? ""}>
      <span>{icon}</span>
      <span>{s.source}</span>
      <span className="opacity-70">
        {ok ? `${s.reviewCount} reviews` : blocked ? t("companyReview.sourceBlocked") : t("companyReview.sourceError")}
      </span>
    </span>
  );
}

function ReviewCard({ r, t }: { r: ReviewItem; t: (k: string) => string }) {
  const initials = (r.reviewerName || r.reviewerPosition || "?").split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "?";
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{r.reviewerName || t("companyReview.anonymous")}</p>
            <p className="text-gray-500 text-xs truncate">{r.reviewerPosition || "—"}</p>
          </div>
        </div>
        <StarRow rating={r.rating} />
      </div>

      {r.pros && (
        <div className="border-l-2 border-green-500 pl-3">
          <p className="text-xs font-semibold text-green-400 mb-1">{t("companyReview.pros")}</p>
          <p className="text-sm text-gray-300 leading-relaxed">{r.pros}</p>
        </div>
      )}

      {r.cons && (
        <div className="border-l-2 border-red-500 pl-3">
          <p className="text-xs font-semibold text-red-400 mb-1">{t("companyReview.cons")}</p>
          <p className="text-sm text-gray-300 leading-relaxed">{r.cons}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
        <span className="inline-flex items-center gap-2 text-gray-500">
          <span className="font-medium text-gray-400">{r.source}</span>
          {r.date && <span>· {r.date}</span>}
        </span>
        {r.url && (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
            {t("companyReview.viewOriginal")} →
          </a>
        )}
      </div>
    </div>
  );
}

export default function CompanyReviewPage() {
  const { t, mounted } = useTranslation();
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyReviewResponse | null>(null);
  const [topTech, setTopTech] = useState<TopTechCompany[]>([]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/company-review/top-tech");
        const json = await res.json();
        if (!cancelled && json.success && json.data?.companies) {
          setTopTech(json.data.companies);
        }
      } catch { /* silent — block is optional inspiration */ }
    })();
    return () => { cancelled = true; };
  }, [mounted]);

  async function runSearch(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCompanyName(trimmed);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/company-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: trimmed }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Search failed.");
      setResult(json.data as CompanyReviewResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    await runSearch(companyName);
  }

  if (!mounted) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  const showFreeBanner = result && result.limitApplied < result.totalAvailable;
  const noReviews = result && result.reviews.length === 0;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t("companyReview.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("companyReview.subtitle")}</p>
      </div>

      <form onSubmit={handleSearch} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            aria-label={t("companyReview.searchPlaceholder")}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder={t("companyReview.searchPlaceholder")}
            disabled={loading}
            className={inputClass("flex-1")}
          />
          <Button
            type="submit"
            disabled={loading || !companyName.trim()}
            className="px-6"
          >
            {t("companyReview.searchButton")}
          </Button>
        </div>
      </form>

      {!result && !loading && topTech.length > 0 && (
        <section className="mb-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-white">{t("companyReview.topTechTitle")}</h2>
              <p className="text-xs text-gray-500">{t("companyReview.topTechSubtitle")}</p>
            </div>
            <span className="text-[10px] text-gray-600">{t("companyReview.topTechHint")}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topTech.map((c, i) => (
              <button
                key={c.name}
                type="button"
                onClick={() => runSearch(c.name)}
                className={`text-left bg-gray-900 border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800/50 rounded-xl p-4 transition-colors group ${focusRing}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-blue-400 shrink-0">#{i + 1}</span>
                    <span className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{c.name}</span>
                  </div>
                  <StarRow rating={c.rating} />
                </div>
                {c.industry && <p className="text-[11px] text-gray-500 mb-2 truncate">{c.industry} {c.headquarters ? `· ${c.headquarters}` : ""}</p>}
                {c.summary && <p className="text-xs text-gray-300 leading-snug mb-2 line-clamp-2">{c.summary}</p>}
                {c.perks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.perks.slice(0, 4).map((p, j) => (
                      <span key={j} className="text-[10px] bg-green-500/10 border border-green-500/30 text-green-300 px-1.5 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <LoadingSpinner message={t("companyReview.loading")} />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Disclaimer banner */}
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 flex gap-3 items-start">
            <span className="text-amber-400 text-xl shrink-0">⚠</span>
            <p className="text-amber-200 text-sm leading-relaxed">{t("companyReview.disclaimer")}</p>
          </div>

          {/* Sources */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">{t("companyReview.sourcesUsed")}</p>
            <div className="flex flex-wrap gap-2">
              {result.sources.map((s) => <SourceChip key={s.source} s={s} t={t} />)}
            </div>
          </div>

          {/* Company info */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">{result.info.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("companyReview.overallRating")}</p>
                <StarRow rating={result.info.rating} />
                {result.totalAvailable > 0 && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    {t("companyReview.fromReviewsCount").replace("{n}", String(result.totalAvailable))}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("companyReview.employees")}</p>
                <p className="text-sm text-gray-200">{result.info.employeeCount?.toLocaleString() ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("companyReview.industry")}</p>
                <p className="text-sm text-gray-200 truncate">{result.info.industry || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t("companyReview.headquarters")}</p>
                <p className="text-sm text-gray-200 truncate">{result.info.headquarters || "—"}</p>
              </div>
            </div>
            {result.fromCache && (
              <p className="text-xs text-gray-600 mt-4">{t("companyReview.cachedNote")}</p>
            )}
          </div>

          {/* Benefits */}
          {result.info.benefits && result.info.benefits.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <div className="flex items-end justify-between mb-4">
                <h3 className="text-sm font-bold text-white">{t("companyReview.benefitsTitle")}</h3>
                <span className="text-[10px] text-gray-600">{t("companyReview.benefitsLegend")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...result.info.benefits].sort((a, b) => Number(b.highlight) - Number(a.highlight)).map((b, i) => (
                  <span
                    key={i}
                    title={b.category ?? ""}
                    className={
                      b.highlight
                        ? "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-yellow-500/10 text-amber-200 shadow-[0_0_12px_-2px_rgba(251,191,36,0.4)]"
                        : "inline-flex items-center text-xs text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/50"
                    }
                  >
                    {b.highlight && <span className="text-amber-400">★</span>}
                    {b.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Free tier upgrade banner */}
          {showFreeBanner && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-blue-200 text-sm font-medium">
                  {t("companyReview.freeTierBanner")
                    .replace("{shown}", String(result.reviews.length))
                    .replace("{total}", String(result.totalAvailable))}
                </p>
              </div>
              <Link href="/account" className={`${buttonClasses({ variant: "primary", size: "sm" })} whitespace-nowrap`}>
                {t("companyReview.upgradeCta")}
              </Link>
            </div>
          )}

          {/* Reviews grid or empty state */}
          {noReviews ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
              <p className="text-gray-400 text-sm">{t("companyReview.noResults")}</p>
              <p className="text-gray-600 text-xs mt-2">{t("companyReview.noResultsHint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.reviews.map((r, i) => <ReviewCard key={`${r.source}-${i}`} r={r} t={t} />)}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

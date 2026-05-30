"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import PipelineWorkflow from "@/components/PipelineWorkflow";
import { useTranslation } from "@/components/TranslationProvider";
import { formatRelativeTime } from "@/lib/accountClient";
import type { JobMatchAnalysis } from "@/types/jobMatch";
import {
  getJobMatchInput,
  getJobMatchResult,
  getResumeText,
  getCurrentResumeId,
  setJobMatchContext,
  setJobMatchInput,
  setJobMatchResult,
  setCurrentResumeId,
} from "@/lib/pipeline";

type InputMode = "url" | "paste";

interface HistoryItem {
  id: string;
  title: string | null;
  matchScore: number;
  createdAt: string;
  jobTitle: string | null;
  company: string | null;
}

function scoreColor(score: number) {
  if (score >= 75) return { ring: "#22c55e", bg: "bg-green-500/10", text: "text-green-400" };
  if (score >= 50) return { ring: "#f59e0b", bg: "bg-amber-500/10", text: "text-amber-400" };
  return { ring: "#ef4444", bg: "bg-red-500/10", text: "text-red-400" };
}

function ScoreRing({ score }: { score: number }) {
  const { ring, bg, text } = scoreColor(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className={`relative w-40 h-40 flex items-center justify-center rounded-full ${bg}`}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={ring} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="text-center relative z-10">
        <span className={`text-4xl font-bold ${text}`}>{score}</span>
        <span className="block text-xs text-gray-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function ScoreLabel({ score, t }: { score: number; t: (key: string) => string }) {
  if (score >= 75) return <span className="text-green-400 font-semibold">{t("jobMatch.strongMatch")}</span>;
  if (score >= 50) return <span className="text-amber-400 font-semibold">{t("jobMatch.moderateMatch")}</span>;
  return <span className="text-red-400 font-semibold">{t("jobMatch.weakMatch")}</span>;
}

function KeywordChip({ label, matched }: { label: string; matched: boolean }) {
  return (
    <span className={`inline-block text-xs px-2.5 py-1 rounded-full border ${matched ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-gray-800 border-gray-700 text-gray-400"}`}>
      {matched ? "✓ " : ""}{label}
    </span>
  );
}

function ResultView({
  result,
  onReset,
  onWriteCoverLetter,
  t,
}: {
  result: JobMatchAnalysis;
  onReset: () => void;
  onWriteCoverLetter: () => void;
  t: (key: string) => string;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Score hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreRing score={result.matchScore} />
        <div className="flex-1 text-center sm:text-left space-y-2">
          {(result.jobTitle || result.company) && (
            <div>
              <p className="text-white font-semibold text-base">
                {result.jobTitle}{result.jobTitle && result.company ? " · " : ""}{result.company}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{t("jobMatch.matchScore")}</p>
            <ScoreLabel score={result.matchScore} t={t} />
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
          <button onClick={onReset} className="text-xs text-gray-500 hover:text-gray-300 underline">
            {t("jobMatch.reanalyze")}
          </button>
        </div>
      </div>

      {/* CTA: Write Cover Letter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-medium text-blue-300">{t("jobMatch.coverLetterCTA")}</p>
          <p className="text-xs text-blue-400/70 mt-0.5">
            {t("jobMatch.coverLetterHint")}
          </p>
        </div>
        <button
          onClick={onWriteCoverLetter}
          className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {t("jobMatch.writeCoverLetter")}
        </button>
      </div>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">{t("jobMatch.strengths")}</h3>
          <ul className="space-y-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-green-400 shrink-0 mt-0.5">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">{t("jobMatch.gaps")}</h3>
          <ul className="space-y-2">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-300">
                <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Keyword match */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white">{t("jobMatch.keywordMatch")}</h3>
        <div className="flex flex-wrap gap-2">
          {result.keywordMatch.matched.map(k => <KeywordChip key={k} label={k} matched />)}
          {result.keywordMatch.missing.map(k => <KeywordChip key={k} label={k} matched={false} />)}
        </div>
        <p className="text-xs text-gray-500">
          {result.keywordMatch.matched.length} {t("jobMatch.matched")} · {result.keywordMatch.missing.length} {t("jobMatch.missing")}
        </p>
      </div>

      {/* Suggestions accordion */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white px-1">{t("jobMatch.recommendations")}</h3>
        {result.suggestions.map((s, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
            >
              <span className="text-sm font-medium text-white">{s.area}</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${openIdx === i ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {openIdx === i && (
              <div className="px-5 pb-4 pt-0 border-t border-gray-800">
                <p className="text-sm text-gray-300 leading-relaxed mt-3 whitespace-pre-wrap">{s.improvement}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JobMatchPage() {
  const { t, mounted } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<InputMode>("url");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobMatchAnalysis | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [loadingHistoryItem, setLoadingHistoryItem] = useState(false);
  const hydratedRef = useRef(false);
  const skipPersistRef = useRef(false);

  const loadHistory = useCallback(async () => {
    const resumeId = getCurrentResumeId();
    const qs = resumeId ? `?resumeId=${encodeURIComponent(resumeId)}` : "";
    try {
      const res = await fetch(`/api/job-match${qs}`);
      const body = await res.json();
      if (body.success && Array.isArray(body.data)) setHistory(body.data);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    skipPersistRef.current = true;
    const urlResumeId = searchParams.get("resumeId");
    if (urlResumeId) setCurrentResumeId(urlResumeId);

    if (!urlResumeId) {
      setResumeText("");
      setHasResume(false);
      setResult(null);
      setMode("url");
      setLinkedinUrl("");
      setJobDescription("");
      hydratedRef.current = true;
      return;
    }

    const stored = getResumeText();
    if (stored) {
      setResumeText(stored);
      setHasResume(true);
    } else {
      fetch(`/api/resumes/${urlResumeId}`)
        .then(r => r.json())
        .then(json => {
          if (!cancelled && json.success && json.data?.rawText) {
            setResumeText(json.data.rawText);
            setHasResume(true);
          }
        })
        .catch(() => {});
    }

    const input = getJobMatchInput();
    if (input) {
      setMode(input.mode);
      setLinkedinUrl(input.linkedinUrl);
      setJobDescription(input.jobDescription);
    }

    const cached = getJobMatchResult<JobMatchAnalysis>();
    if (cached) setResult(cached);

    hydratedRef.current = true;
    void loadHistory();
    return () => { cancelled = true; };
  }, [searchParams, loadHistory]);

  // Persist input state every time it changes.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipPersistRef.current) { skipPersistRef.current = false; return; }
    setJobMatchInput({ mode, linkedinUrl, jobDescription });
  }, [mode, linkedinUrl, jobDescription]);

  if (!mounted) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  async function handleAnalyze() {
    if (!resumeText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, string | undefined> = { resumeText, resumeId: getCurrentResumeId() ?? undefined };
      if (mode === "url" && linkedinUrl.trim()) {
        body.linkedinUrl = linkedinUrl.trim();
      } else {
        body.jobDescription = jobDescription;
      }

      const res = await fetch("/api/job-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Analysis failed.");

      const match = data.data;
      setJobMatchContext({
        jobTitle: match.jobTitle ?? "",
        company: match.company ?? "",
        jobDescription: match.jobDescription ?? jobDescription,
      });

      setJobMatchResult(match);
      setResult(match);
      setActiveHistoryId(null);
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadHistoryItem(item: HistoryItem) {
    if (activeHistoryId === item.id) return;
    setLoadingHistoryItem(true);
    try {
      const res = await fetch(`/api/job-match/${encodeURIComponent(item.id)}`);
      const body = await res.json();
      if (body.success && body.data?.data) {
        setResult(body.data.data);
        setActiveHistoryId(item.id);
        if (body.data.data.jobTitle || body.data.data.company) {
          setJobMatchContext({
            jobTitle: body.data.data.jobTitle ?? "",
            company: body.data.data.company ?? "",
            jobDescription: body.data.jobDescription ?? "",
          });
        }
      }
    } catch {}
    setLoadingHistoryItem(false);
  }

  async function handleDeleteHistoryItem(item: HistoryItem) {
    const label = item.title || item.jobTitle || "—";
    if (!confirm(t("jobMatch.deleteConfirm").replace("{name}", label))) return;
    try {
      const res = await fetch(`/api/job-match/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!body.success) return;
      if (activeHistoryId === item.id) {
        setResult(null);
        setActiveHistoryId(null);
      }
      void loadHistory();
    } catch {}
  }

  async function handleRenameHistoryItem(item: HistoryItem) {
    const current = item.title || item.jobTitle || "";
    const newTitle = prompt(t("jobMatch.renamePrompt"), current);
    if (newTitle === null) return;
    try {
      const res = await fetch(`/api/job-match/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      const body = await res.json();
      if (body.success) void loadHistory();
    } catch {}
  }

  function handleWriteCoverLetter() {
    const rid = getCurrentResumeId();
    router.push(`/cover-letter${rid ? `?resumeId=${encodeURIComponent(rid)}` : ""}`);
  }

  const canSubmit = resumeText.trim() && (mode === "url" ? linkedinUrl.trim() : jobDescription.trim());

  if (result) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">{t("jobMatch.title")}</h1>
          <p className="text-gray-400 text-sm mt-1">{t("jobMatch.subtitle")}</p>
        </div>
        {history.length > 1 && (
          <HistoryBar
            items={history}
            activeId={activeHistoryId}
            loading={loadingHistoryItem}
            onSelect={handleLoadHistoryItem}
            onNewAnalysis={() => { setResult(null); setActiveHistoryId(null); }}
            onDelete={handleDeleteHistoryItem}
            onRename={handleRenameHistoryItem}
            t={t}
          />
        )}
        <ResultView
          result={result}
          t={t}
          onReset={() => {
            setResult(null);
            setActiveHistoryId(null);
          }}
          onWriteCoverLetter={handleWriteCoverLetter}
        />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <PipelineWorkflow />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t("jobMatch.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("jobMatch.subtitle")}</p>
      </div>

      {/* Resume status */}
      {hasResume ? (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">{t("jobMatch.resumeLoadedMessage")}</span>
        </div>
      ) : (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4">
          <p className="text-amber-400 text-sm font-medium">{t("jobMatch.noResumeWarning")}</p>
          <p className="text-amber-400/70 text-xs mt-1">
            <Link href="/dashboard" className="underline hover:text-amber-300">{t("jobMatch.scoreResumeLinkText")}</Link> {t("jobMatch.noResumeHint")}
          </p>
          <textarea
            className="mt-3 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            rows={5}
            placeholder={t("jobMatch.resumePastePlaceholder")}
            value={resumeText}
            onChange={e => {
              const v = e.target.value;
              setResumeText(v);
              setHasResume(!!v.trim());
            }}
          />
        </div>
      )}

      {loading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10">
          <LoadingSpinner message={t("jobMatch.analyzing")} subMessage={t("jobMatch.analyzingSubtext")} />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-gray-800 rounded-xl w-fit">
            {(["url", "paste"] as InputMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === m ? "bg-gray-900 text-white shadow" : "text-gray-400 hover:text-white"}`}
              >
                {m === "url" ? t("jobMatch.jobUrl") : t("jobMatch.paste")}
              </button>
            ))}
          </div>

          {mode === "url" ? (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t("jobMatch.linkedinUrl")}</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder={t("jobMatch.jobUrlPlaceholder")}
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1.5">{t("jobMatch.jobUrlHint")}</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">{t("jobMatch.jobDescription")}</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                rows={10}
                placeholder={t("jobMatch.jobDescriptionPlaceholder")}
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t("jobMatch.analyze")}
          </button>
        </div>
      )}

      {/* History list on form view */}
      {!result && history.length > 0 && (
        <div className="mt-6">
          <HistoryBar
            items={history}
            activeId={null}
            loading={loadingHistoryItem}
            onSelect={handleLoadHistoryItem}
            onNewAnalysis={() => {}}
            onDelete={handleDeleteHistoryItem}
            onRename={handleRenameHistoryItem}
            t={t}
            showNewButton={false}
          />
        </div>
      )}
    </main>
  );
}

function historyScoreColor(score: number) {
  if (score >= 75) return "text-green-400 bg-green-500/10 border-green-500/30";
  if (score >= 50) return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-red-400 bg-red-500/10 border-red-500/30";
}

function HistoryBar({
  items,
  activeId,
  loading,
  onSelect,
  onNewAnalysis,
  onDelete,
  onRename,
  t,
  showNewButton = true,
}: {
  items: HistoryItem[];
  activeId: string | null;
  loading: boolean;
  onSelect: (item: HistoryItem) => void;
  onNewAnalysis: () => void;
  onDelete: (item: HistoryItem) => void;
  onRename: (item: HistoryItem) => void;
  t: (key: string) => string;
  showNewButton?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 3);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{t("jobMatch.history")}</h3>
        {showNewButton && (
          <button onClick={onNewAnalysis} className="text-xs text-blue-400 hover:text-blue-300">
            + {t("jobMatch.newAnalysis")}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {shown.map(item => {
          const isActive = activeId === item.id;
          const displayName = item.title || (item.jobTitle ?? "—") + (item.company ? ` @ ${item.company}` : "");
          return (
            <div
              key={item.id}
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-500/10 border border-blue-500/30"
                  : "hover:bg-gray-800 border border-transparent"
              }`}
            >
              <button
                onClick={() => onSelect(item)}
                disabled={loading}
                className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:opacity-50"
              >
                <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded border shrink-0 ${historyScoreColor(item.matchScore)}`}>
                  {item.matchScore}
                </span>
                <span className="text-sm text-gray-300 truncate flex-1">{displayName}</span>
                <span className="text-xs text-gray-600 shrink-0">{formatRelativeTime(item.createdAt)}</span>
              </button>
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); onRename(item); }}
                  className="p-1 text-gray-500 hover:text-blue-400 transition-colors"
                  title={t("jobMatch.rename")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                  </svg>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(item); }}
                  className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                  title={t("jobMatch.delete")}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {items.length > 3 && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          {expanded ? t("account.collapse") : `${t("jobMatch.showAll")} (${items.length})`}
        </button>
      )}
    </div>
  );
}

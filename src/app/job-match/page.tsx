"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { JobMatchAnalysis } from "@/types/jobMatch";
import {
  getJobMatchInput,
  getJobMatchResult,
  getResumeText,
  setJobMatchContext,
  setJobMatchInput,
  setJobMatchResult,
} from "@/lib/pipeline";

type InputMode = "url" | "paste";

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

function ScoreLabel({ score }: { score: number }) {
  if (score >= 75) return <span className="text-green-400 font-semibold">Strong Match</span>;
  if (score >= 50) return <span className="text-amber-400 font-semibold">Moderate Match</span>;
  return <span className="text-red-400 font-semibold">Weak Match</span>;
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
}: {
  result: JobMatchAnalysis;
  onReset: () => void;
  onWriteCoverLetter: () => void;
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
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Match Score</p>
            <ScoreLabel score={result.matchScore} />
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
          <button onClick={onReset} className="text-xs text-gray-500 hover:text-gray-300 underline">
            ← Analyze another job
          </button>
        </div>
      </div>

      {/* CTA: Write Cover Letter */}
      <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-medium text-blue-300">Ready to apply?</p>
          <p className="text-xs text-blue-400/70 mt-0.5">
            Job details are pre-loaded — generate a tailored cover letter in one click.
          </p>
        </div>
        <button
          onClick={onWriteCoverLetter}
          className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Write Cover Letter →
        </button>
      </div>

      {/* Strengths & Gaps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">What you have</h3>
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
          <h3 className="text-sm font-semibold text-white">What&apos;s missing</h3>
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
        <h3 className="text-sm font-semibold text-white">Keyword Match</h3>
        <div className="flex flex-wrap gap-2">
          {result.keywordMatch.matched.map(k => <KeywordChip key={k} label={k} matched />)}
          {result.keywordMatch.missing.map(k => <KeywordChip key={k} label={k} matched={false} />)}
        </div>
        <p className="text-xs text-gray-500">
          {result.keywordMatch.matched.length} matched · {result.keywordMatch.missing.length} missing
        </p>
      </div>

      {/* Suggestions accordion */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-white px-1">How to improve your match</h3>
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
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>("url");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [hasResume, setHasResume] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobMatchAnalysis | null>(null);
  const hydratedRef = useRef(false);

  // Auto-sync inputs and any previous match result from sessionStorage
  // so navigating between pipeline steps never loses progress.
  useEffect(() => {
    const stored = getResumeText();
    setResumeText(stored);
    setHasResume(!!stored);

    const input = getJobMatchInput();
    if (input) {
      setMode(input.mode);
      setLinkedinUrl(input.linkedinUrl);
      setJobDescription(input.jobDescription);
    }

    const cached = getJobMatchResult<JobMatchAnalysis>();
    if (cached) setResult(cached);

    hydratedRef.current = true;
  }, []);

  // Persist input state every time it changes.
  useEffect(() => {
    if (!hydratedRef.current) return;
    setJobMatchInput({ mode, linkedinUrl, jobDescription });
  }, [mode, linkedinUrl, jobDescription]);

  async function handleAnalyze() {
    if (!resumeText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, string> = { resumeText };
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

      // Store context for Cover Letter pre-fill (auto-synced on the next step)
      setJobMatchContext({
        jobTitle: data.data.jobTitle ?? "",
        company: data.data.company ?? "",
        jobDescription: data.jobDescription ?? jobDescription,
      });

      setJobMatchResult(data.data);
      setResult(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleWriteCoverLetter() {
    router.push("/cover-letter");
  }

  const canSubmit = resumeText.trim() && (mode === "url" ? linkedinUrl.trim() : jobDescription.trim());

  if (result) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Job Match Score</h1>
          <p className="text-gray-400 text-sm mt-1">See how well your resume fits the role.</p>
        </div>
        <ResultView
          result={result}
          onReset={() => {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("jobMatchContext");
              sessionStorage.removeItem("jobMatchResult");
            }
            setResult(null);
          }}
          onWriteCoverLetter={handleWriteCoverLetter}
        />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Job Match Score</h1>
        <p className="text-gray-400 text-sm mt-1">Paste a job URL or description — Claude scores how well your resume fits.</p>
      </div>

      {/* Resume status */}
      {hasResume ? (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">✓ Resume loaded from your last score.</span>
        </div>
      ) : (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4">
          <p className="text-amber-400 text-sm font-medium">No resume detected.</p>
          <p className="text-amber-400/70 text-xs mt-1">
            <Link href="/" className="underline hover:text-amber-300">Score your resume first</Link> so we can load it here, or paste it below.
          </p>
          <textarea
            className="mt-3 w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            rows={5}
            placeholder="Paste your resume text here…"
            value={resumeText}
            onChange={e => {
              const v = e.target.value;
              setResumeText(v);
              setHasResume(!!v.trim());
              if (typeof window !== "undefined") {
                sessionStorage.setItem("resumeText", v);
              }
            }}
          />
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        {/* Mode toggle */}
        <div className="flex gap-2 p-1 bg-gray-800 rounded-xl w-fit">
          {(["url", "paste"] as InputMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === m ? "bg-gray-900 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              {m === "url" ? "Job URL" : "Paste Description"}
            </button>
          ))}
        </div>

        {mode === "url" ? (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">LinkedIn or job posting URL</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="https://www.linkedin.com/jobs/view/..."
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
            />
            <p className="text-xs text-gray-600 mt-1.5">If the URL is blocked, switch to &quot;Paste Description&quot;.</p>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Job description *</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              rows={10}
              placeholder="Paste the full job description here…"
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          <LoadingSpinner message="Analyzing job match…" subMessage="Claude AI is comparing your resume to the job" />
        ) : (
          <button
            onClick={handleAnalyze}
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Analyze Match
          </button>
        )}
      </div>
    </main>
  );
}

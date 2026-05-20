"use client";

import { useState, useEffect } from "react";
import type { CoverLetterFormData } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";

const TONES: CoverLetterFormData["tone"][] = ["Professional", "Enthusiastic", "Concise"];

const INITIAL_FORM: CoverLetterFormData = {
  jobTitle: "",
  company: "",
  jobDescription: "",
  aboutYourself: "",
  tone: "Professional",
};

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

interface JobContext {
  jobTitle: string;
  company: string;
  jobDescription: string;
}

export default function CoverLetterPage() {
  const [form, setForm] = useState<CoverLetterFormData>(INITIAL_FORM);
  const [result, setResult] = useState<string | null>(null);
  const [edited, setEdited] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [jobContext, setJobContext] = useState<JobContext | null>(null);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("jobMatchContext");
      if (raw) {
        const ctx = JSON.parse(raw) as JobContext;
        if (ctx.jobTitle || ctx.company || ctx.jobDescription) {
          setJobContext(ctx);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  function handleImportContext() {
    if (!jobContext) return;
    setForm(prev => ({
      ...prev,
      jobTitle: jobContext.jobTitle || prev.jobTitle,
      company: jobContext.company || prev.company,
      jobDescription: jobContext.jobDescription || prev.jobDescription,
    }));
    setImported(true);
  }

  function updateField(field: keyof CoverLetterFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Generation failed.");
      setResult(data.data.text);
      setEdited(data.data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(edited);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Cover Letter Generator</h1>
        <p className="text-gray-400 text-sm mt-1">Describe the role and yourself — Claude writes a tailored cover letter.</p>
      </div>

      {/* Job Match import banner */}
      {jobContext && !imported && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-300">Job detected from your match analysis</p>
            <p className="text-xs text-blue-400/70 mt-0.5 truncate">
              {[jobContext.jobTitle, jobContext.company].filter(Boolean).join(" · ") || "Job details available"}
            </p>
          </div>
          <button
            onClick={handleImportContext}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Import Job Details
          </button>
        </div>
      )}
      {imported && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">✓ Job details imported — add your personal pitch below.</span>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {loading ? (
          <LoadingSpinner message="Writing your cover letter…" subMessage="Claude AI is tailoring it to the role" />
        ) : result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Your Cover Letter</h2>
              <button onClick={() => { setResult(null); setEdited(""); }} className="text-xs text-blue-400 hover:text-blue-300">
                ↺ Regenerate
              </button>
            </div>
            <textarea
              className="bg-gray-950 border border-gray-800 rounded-xl p-5 text-gray-200 text-sm leading-relaxed font-mono w-full resize-none focus:outline-none focus:border-blue-500"
              rows={14}
              value={edited}
              onChange={e => setEdited(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{edited.length} characters</span>
              <button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass()}>Job Title *</label>
                <input className={inputClass()} placeholder="Senior Software Engineer" value={form.jobTitle} onChange={e => updateField("jobTitle", e.target.value)} required />
              </div>
              <div>
                <label className={labelClass()}>Company *</label>
                <input className={inputClass()} placeholder="Stripe" value={form.company} onChange={e => updateField("company", e.target.value)} required />
              </div>
            </div>

            <div>
              <label className={labelClass()}>Job Description *</label>
              <textarea className={inputClass("resize-none")} rows={7} placeholder="Paste the job description here…" value={form.jobDescription} onChange={e => updateField("jobDescription", e.target.value)} required />
            </div>

            <div>
              <label className={labelClass()}>About Yourself *</label>
              <textarea className={inputClass("resize-none")} rows={4} placeholder="Your current role, years of experience, top relevant skills…" value={form.aboutYourself} onChange={e => updateField("aboutYourself", e.target.value)} required />
            </div>

            <div>
              <label className={labelClass()}>Tone</label>
              <div className="flex gap-2">
                {TONES.map(tone => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => updateField("tone", tone)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      form.tone === tone
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
              Generate Cover Letter
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

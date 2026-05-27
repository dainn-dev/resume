"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { ResumeFormData, WorkEntry, EducationEntry } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useTranslation } from "@/components/TranslationProvider";
import {
  getBuilderForm,
  getBuiltResumeMarkdown,
  getParsedResumeForm,
  getResumeText,
  getCurrentResumeId,
  getResumeAnalysis,
  setBuilderForm,
  setBuiltResumeMarkdown,
  setParsedResumeForm,
  clearPipeline,
} from "@/lib/pipeline";

type Step = 1 | 2 | 3 | 4 | 5;

const EMPTY_WORK: WorkEntry = { company: "", projectName: "", title: "", startDate: "", endDate: "", bullets: [""] };
const EMPTY_EDUCATION: EducationEntry = { school: "", degree: "", graduationYear: "", gpa: "" };

const INITIAL_FORM: ResumeFormData = {
  fullName: "", email: "", phone: "", location: "", linkedIn: "", github: "", summary: "",
  workEntries: [{ ...EMPTY_WORK, bullets: [""] }],
  educationEntries: [{ ...EMPTY_EDUCATION }],
  technicalSkills: "", softSkills: "", certifications: "", languages: "", projects: "",
};

const STEP_LABEL_KEYS = ["build.personalInfo", "build.experience", "build.education", "build.skills", "build.generate"];

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

function StepBar({ step, onStepClick, t }: { step: Step; onStepClick: (s: Step) => void; t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABEL_KEYS.map((key, i) => {
        const label = t(key);
        const num = (i + 1) as Step;
        const isCompleted = num < step;
        const isCurrent = num === step;
        const isClickable = num <= step;
        return (
          <div key={num} className="flex items-center">
            <div
              className={`flex flex-col items-center ${isClickable ? "cursor-pointer" : ""}`}
              onClick={() => isClickable && onStepClick(num)}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  isCompleted
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : isCurrent
                    ? "border-2 border-blue-500 bg-blue-500/10 text-blue-400"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {isCompleted ? "✓" : num}
              </div>
              <span className={`text-xs mt-1 ${isCurrent ? "text-blue-400" : isCompleted ? "text-blue-400" : "text-gray-500"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABEL_KEYS.length - 1 && (
              <div className={`w-12 h-px mt-[-16px] mx-1 ${num < step ? "bg-blue-600" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function normalizeParsed(data: Partial<ResumeFormData>): ResumeFormData {
  return {
    ...INITIAL_FORM,
    ...data,
    workEntries: data.workEntries?.length ? data.workEntries : [{ ...EMPTY_WORK, bullets: [""] }],
    educationEntries: data.educationEntries?.length ? data.educationEntries : [{ ...EMPTY_EDUCATION }],
  };
}

export default function BuildPage() {
  const { t, mounted } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<ResumeFormData>(INITIAL_FORM);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"md" | "txt" | null>(null);
  const [syncStep, setSyncStep] = useState<"idle" | "reading" | "parsing" | "filling" | "done" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [improving, setImproving] = useState(false);
  const [scoreComparison, setScoreComparison] = useState<{
    beforeOverall: number; afterOverall: number;
    beforeSections: Record<string, number>; afterSections: Record<string, number>;
  } | null>(null);
  const hydratedRef = useRef(false);
  const resumePreviewRef = useRef<HTMLDivElement>(null);

  const hasAnalysis = !!getResumeAnalysis();

  async function handleApplyRecommendations() {
    const analysis = getResumeAnalysis();
    if (!analysis) return;
    setImproving(true);
    setError(null);
    setScoreComparison(null);
    try {
      const res = await fetch("/api/build/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: form, analysis }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to apply recommendations.");
      const { resume: improved, comparison } = data.data;
      setForm(normalizeParsed(improved));
      setBuilderForm(normalizeParsed(improved));
      if (comparison) setScoreComparison(comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setImproving(false);
    }
  }

  if (!mounted) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  useEffect(() => {
    const resumeId = getCurrentResumeId();

    // 1. Check in-memory pipeline first (in-progress edits from this session)
    const inProgress = getBuilderForm();
    if (inProgress) {
      setForm(inProgress);
      setSynced(true);
      hydratedRef.current = true;
      const cachedMarkdown = getBuiltResumeMarkdown();
      if (cachedMarkdown) setMarkdown(cachedMarkdown);
      return;
    }

    // 2. Check in-memory parsed form
    const cachedParse = getParsedResumeForm();
    if (cachedParse) {
      const normalized = normalizeParsed(cachedParse);
      setForm(normalized);
      setSynced(true);
      hydratedRef.current = true;
      return;
    }

    // 3. Try fetching from backend API if we have a resumeId
    if (resumeId) {
      let cancelled = false;
      setSyncError(null);
      (async () => {
        try {
          setSyncStep("reading");
          const res = await fetch(`/api/resumes/${resumeId}`);
          const json = await res.json();
          if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load resume.");
          if (cancelled) return;

          const detail = json.data;
          if (detail.parsed) {
            setSyncStep("filling");
            const normalized = normalizeParsed(detail.parsed);
            setParsedResumeForm(normalized);
            setForm(normalized);
            setSyncStep("done");
            setSynced(true);
          } else if (detail.rawText) {
            setSyncStep("parsing");
            const parseRes = await fetch("/api/parse-resume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ resumeText: detail.rawText }),
            });
            const parseData = await parseRes.json();
            if (!parseData.success) throw new Error(parseData.error ?? "Sync failed.");
            if (cancelled) return;

            setSyncStep("filling");
            const parsed = normalizeParsed(parseData.data);
            setParsedResumeForm(parsed);
            setForm(parsed);
            setSyncStep("done");
            setSynced(true);
          }
        } catch (err) {
          if (!cancelled) {
            setSyncStep("error");
            setSyncError(err instanceof Error ? err.message : "Sync failed.");
          }
        } finally {
          if (!cancelled) hydratedRef.current = true;
        }
      })();
      return () => { cancelled = true; };
    }

    // 4. Last resort: parse resume text from in-memory pipeline
    const resumeText = getResumeText();
    if (!resumeText.trim()) {
      hydratedRef.current = true;
      return;
    }

    let cancelled = false;
    setSyncError(null);
    (async () => {
      try {
        setSyncStep("parsing");
        const res = await fetch("/api/parse-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Sync failed.");
        if (cancelled) return;

        setSyncStep("filling");
        const parsed = normalizeParsed(data.data);
        setParsedResumeForm(parsed);
        setForm(parsed);
        setSyncStep("done");
        setSynced(true);
      } catch (err) {
        if (!cancelled) {
          setSyncStep("error");
          setSyncError(err instanceof Error ? err.message : "Sync failed.");
        }
      } finally {
        if (!cancelled) hydratedRef.current = true;
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setBuilderForm(form);
  }, [form]);

  function updateField(field: keyof ResumeFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function updateWork(idx: number, field: keyof WorkEntry, value: string) {
    setForm(prev => ({
      ...prev,
      workEntries: prev.workEntries.map((e, i) => i === idx ? { ...e, [field]: value } : e),
    }));
  }

  function updateBullet(workIdx: number, bulletIdx: number, value: string) {
    setForm(prev => ({
      ...prev,
      workEntries: prev.workEntries.map((e, i) =>
        i === workIdx
          ? { ...e, bullets: e.bullets.map((b, j) => j === bulletIdx ? value : b) }
          : e
      ),
    }));
  }

  function addBullet(workIdx: number) {
    setForm(prev => ({
      ...prev,
      workEntries: prev.workEntries.map((e, i) =>
        i === workIdx ? { ...e, bullets: [...e.bullets, ""] } : e
      ),
    }));
  }

  function removeBullet(workIdx: number, bulletIdx: number) {
    setForm(prev => ({
      ...prev,
      workEntries: prev.workEntries.map((e, i) =>
        i === workIdx ? { ...e, bullets: e.bullets.filter((_, j) => j !== bulletIdx) } : e
      ),
    }));
  }

  function updateEducation(idx: number, field: keyof EducationEntry, value: string) {
    setForm(prev => ({
      ...prev,
      educationEntries: prev.educationEntries.map((e, i) => i === idx ? { ...e, [field]: value } : e),
    }));
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setMarkdown(null);
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Generation failed.");
      setMarkdown(data.data.markdown);
      setBuiltResumeMarkdown(data.data.markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function copyMarkdown() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown);
    setCopied("md");
    setTimeout(() => setCopied(null), 2000);
  }

  function copyPlainText() {
    if (!markdown) return;
    const plain = markdown
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^[-*]\s+/gm, "• ")
      .trim();
    navigator.clipboard.writeText(plain);
    setCopied("txt");
    setTimeout(() => setCopied(null), 2000);
  }

  async function downloadPdf() {
    if (!markdown) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mx = 16;
    const mTop = 14;
    const mBot = 14;
    const maxW = pageW - mx * 2;
    let y = mTop;
    let isFirstSection = true;

    function checkPage(needed: number) {
      if (y + needed > pageH - mBot) { doc.addPage(); y = mTop; }
    }

    function renderBoldLine(text: string, x: number, fontSize: number, maxWidth: number) {
      doc.setFontSize(fontSize);
      const parts = text.split(/(\*\*[^*]+\*\*)/g);
      let cx = x;
      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          doc.setFont("helvetica", "bold");
          const clean = part.slice(2, -2);
          doc.text(clean, cx, y);
          cx += doc.getTextWidth(clean);
        } else if (part) {
          doc.setFont("helvetica", "normal");
          const clean = part.replace(/\*(.+?)\*/g, "$1");
          doc.text(clean, cx, y);
          cx += doc.getTextWidth(clean);
        }
      }
    }

    function renderWrappedWithBold(text: string, x: number, fontSize: number, availW: number): number {
      const clean = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
      doc.setFontSize(fontSize).setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(clean, availW);
      if (wrapped.length === 1) {
        renderBoldLine(text, x, fontSize, availW);
        return 1;
      }
      doc.text(wrapped, x, y);
      return wrapped.length;
    }

    const lines = markdown.split("\n");
    let contactDone = false;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) { y += 2; continue; }
      if (/^[-*_]{3,}$/.test(trimmed)) continue;

      // --- Name (H1) ---
      if (trimmed.startsWith("# ")) {
        const name = trimmed.slice(2).toUpperCase();
        checkPage(14);
        doc.setFontSize(22).setFont("helvetica", "bold").setTextColor(33, 33, 33);
        doc.text(name, pageW / 2, y, { align: "center" });
        y += 9;

      // --- Contact lines (lines between H1 and first H2) ---
      } else if (i > 0 && !trimmed.startsWith("#") && !contactDone) {
        const allContactParts: string[] = [];
        for (let ci = i; ci < lines.length; ci++) {
          const cl = lines[ci].trim();
          if (!cl || cl.startsWith("#") || /^[-*_]{3,}$/.test(cl)) { i = ci - 1; break; }
          const sub = cl.split("|").map(s => s.trim()).filter(Boolean);
          allContactParts.push(...sub);
          i = ci;
        }
        contactDone = true;

        const basics: string[] = [];
        const links: string[] = [];
        for (let p of allContactParts) {
          p = p.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
          p = p.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
            const short = url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
            return `${label}: ${short}`;
          });
          p = p.replace(/https?:\/\/(www\.)?/gi, "").replace(/\/$/g, "");

          if (/linkedin|github|portfolio/i.test(p)) {
            links.push(p);
          } else if (p.includes("@") || /^Email:/i.test(p)) {
            basics.push(/^Email:/i.test(p) ? p : `Email: ${p}`);
          } else if (/^Phone:/i.test(p) || /^[+\d][\d\s().,-]+$/.test(p)) {
            basics.push(/^Phone:/i.test(p) ? p : `Phone: ${p}`);
          } else if (/^Location:/i.test(p)) {
            basics.push(p);
          } else {
            basics.push(p);
          }
        }

        checkPage(10);
        doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(80, 80, 80);
        const stripBold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        if (basics.length) {
          doc.text(stripBold(basics.join(" | ")), mx, y);
          y += 4;
        }
        if (links.length) {
          doc.text(stripBold(links.join(" | ")), mx, y);
          y += 4;
        }
        doc.setTextColor(0);
        y += 1;

      // --- Section header (H2) ---
      } else if (trimmed.startsWith("## ")) {
        const sectionName = trimmed.slice(3).toUpperCase();
        if (isFirstSection) { isFirstSection = false; } else { y += 2; }
        checkPage(28);
        doc.setDrawColor(50, 50, 50).setLineWidth(0.5);
        doc.line(mx, y, mx + maxW, y);
        y += 5;
        doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(33, 33, 33);
        doc.text(sectionName, mx, y);
        doc.setTextColor(0);
        y += 5;

      // --- Subsection / Job title (H3) ---
      } else if (trimmed.startsWith("### ")) {
        checkPage(12);
        y += 1;
        const heading = trimmed.slice(4);
        doc.setFontSize(10.5).setFont("helvetica", "bold").setTextColor(33, 33, 33);
        const headClean = heading.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        const headWrapped = doc.splitTextToSize(headClean, maxW);
        doc.text(headWrapped, mx, y);
        doc.setTextColor(0);
        y += headWrapped.length * 4.5;

      // --- Bullet points ---
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        const text = trimmed.replace(/^[-*•]\s+/, "");
        const clean = text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
        doc.setFontSize(9.5).setFont("helvetica", "normal").setTextColor(40, 40, 40);
        const wrapped = doc.splitTextToSize(clean, maxW - 7);
        checkPage(wrapped.length * 4.2 + 1);
        doc.text("•", mx + 1.5, y);
        doc.text(wrapped, mx + 6, y);
        doc.setTextColor(0);
        y += wrapped.length * 4.2;

      // --- Regular text ---
      } else {
        doc.setTextColor(40, 40, 40);
        doc.setFontSize(9.5);
        const lineCount = renderWrappedWithBold(trimmed, mx, 9.5, maxW);
        doc.setTextColor(0);
        y += lineCount * 4.2 + 0.5;
      }
    }

    doc.save(`${form.fullName || "resume"}.pdf`);
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("build.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("build.subtitle")}</p>
      </div>

      {/* Auto-sync status */}
      {syncStep !== "idle" && syncStep !== "done" && syncStep !== "error" && (
        <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-blue-300 text-sm font-medium">{t("build.syncingMessage")}</span>
          </div>
          <div className="flex items-center gap-2">
            {(["reading", "parsing", "filling"] as const).map((s, i) => {
              const labels = [t("build.syncStepReading"), t("build.syncStepParsing"), t("build.syncStepFilling")];
              const steps: typeof syncStep[] = ["reading", "parsing", "filling"];
              const currentIdx = steps.indexOf(syncStep);
              const isDone = i < currentIdx;
              const isCurrent = i === currentIdx;
              return (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isDone ? "bg-green-500 text-white" : isCurrent ? "bg-blue-500 text-white animate-pulse" : "bg-gray-700 text-gray-500"
                  }`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs ${isCurrent ? "text-blue-300" : isDone ? "text-green-400" : "text-gray-500"}`}>{labels[i]}</span>
                  {i < 2 && <div className={`flex-1 h-px ${isDone ? "bg-green-500/50" : "bg-gray-700"}`} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {syncStep === "done" && synced && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">{t("build.syncedMessage")}</span>
        </div>
      )}
      {syncStep === "error" && syncError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-red-400 text-sm">{syncError}</div>
      )}

      <StepBar step={step} onStepClick={setStep} t={t} />

      {hasAnalysis && step <= 4 && (
        <div className="mb-6 flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-4">
          <div>
            <p className="text-sm font-medium text-blue-300">{t("build.applyRecommendationsTitle")}</p>
            <p className="text-xs text-blue-400/70 mt-0.5">{t("build.applyRecommendationsHint")}</p>
          </div>
          <button
            onClick={handleApplyRecommendations}
            disabled={improving}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {improving ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Applying...
              </>
            ) : (
              "Apply All Recommendations"
            )}
          </button>
        </div>
      )}

      {scoreComparison && (
        <div className="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Score Improvement</h3>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">{scoreComparison.beforeOverall}</span>
              <span className="text-gray-600">→</span>
              <span className={`text-lg font-bold ${scoreComparison.afterOverall > scoreComparison.beforeOverall ? "text-green-400" : scoreComparison.afterOverall < scoreComparison.beforeOverall ? "text-red-400" : "text-gray-400"}`}>
                {scoreComparison.afterOverall}
              </span>
              {scoreComparison.afterOverall !== scoreComparison.beforeOverall && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${scoreComparison.afterOverall > scoreComparison.beforeOverall ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                  {scoreComparison.afterOverall > scoreComparison.beforeOverall ? "+" : ""}{scoreComparison.afterOverall - scoreComparison.beforeOverall}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(scoreComparison.afterSections).map(([key, after]) => {
              const before = scoreComparison.beforeSections[key] ?? 0;
              const diff = after - before;
              const labels: Record<string, string> = {
                contactInfo: "Contact", summary: "Summary", workExperience: "Experience",
                education: "Education", skills: "Skills", formatting: "Formatting",
              };
              return (
                <div key={key} className="bg-gray-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">{labels[key] ?? key}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-gray-500 text-sm">{before}</span>
                    <span className="text-gray-600 text-xs">→</span>
                    <span className={`text-sm font-semibold ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-gray-400"}`}>{after}</span>
                    {diff !== 0 && (
                      <span className={`text-xs ${diff > 0 ? "text-green-500" : "text-red-500"}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => setScoreComparison(null)} className="text-xs text-gray-500 hover:text-gray-400">Dismiss</button>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-4">{t("build.personalInfoSection")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass()}>{t("build.fullName")} *</label>
                <input className={inputClass()} placeholder={t("build.fullNamePlaceholder")} value={form.fullName} onChange={e => updateField("fullName", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>{t("build.email")} *</label>
                <input className={inputClass()} type="email" placeholder={t("build.emailPlaceholder")} value={form.email} onChange={e => updateField("email", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>{t("build.phone")}</label>
                <input className={inputClass()} placeholder={t("build.phonePlaceholder")} value={form.phone} onChange={e => updateField("phone", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>{t("build.location")}</label>
                <input className={inputClass()} placeholder={t("build.locationPlaceholder")} value={form.location} onChange={e => updateField("location", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>{t("build.linkedIn")}</label>
                <input className={inputClass()} placeholder={t("build.linkedInPlaceholder")} value={form.linkedIn} onChange={e => updateField("linkedIn", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>{t("build.github")}</label>
                <input className={inputClass()} placeholder={t("build.gitHubPlaceholder")} value={form.github} onChange={e => updateField("github", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass()}>{t("build.summary")}</label>
              <textarea className={inputClass("resize-none")} rows={4} placeholder={t("build.summaryPlaceholder")} value={form.summary} onChange={e => updateField("summary", e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 2: Work Experience */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-white">{t("build.workExperienceSection")}</h2>
            {form.workEntries.map((entry, idx) => (
              <div key={idx} className="border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">{t("build.positionPrefix")} {idx + 1}</span>
                  {form.workEntries.length > 1 && (
                    <button onClick={() => setForm(prev => ({ ...prev, workEntries: prev.workEntries.filter((_, i) => i !== idx) }))} className="text-xs text-red-400 hover:text-red-300">{t("build.removeWork")}</button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass()}>{t("build.companyRequired")}</label>
                    <input className={inputClass()} placeholder={t("build.companyPlaceholder")} value={entry.company} onChange={e => updateWork(idx, "company", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>{t("build.titleRequired")}</label>
                    <input className={inputClass()} placeholder={t("build.titlePlaceholder")} value={entry.title} onChange={e => updateWork(idx, "title", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass()}>{t("build.projectName")}</label>
                    <input className={inputClass()} placeholder={t("build.projectNamePlaceholder")} value={entry.projectName ?? ""} onChange={e => updateWork(idx, "projectName", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>{t("build.startDate")}</label>
                    <input className={inputClass()} placeholder={t("build.startDatePlaceholder")} value={entry.startDate} onChange={e => updateWork(idx, "startDate", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>{t("build.endDate")}</label>
                    <input className={inputClass()} placeholder={t("build.endDatePlaceholder")} value={entry.endDate} onChange={e => updateWork(idx, "endDate", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass()}>{t("build.achievementBullets")}</label>
                  <div className="space-y-2">
                    {entry.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-2">
                        <input className={inputClass("flex-1")} placeholder={t("build.bulletPlaceholder")} value={bullet} onChange={e => updateBullet(idx, bIdx, e.target.value)} />
                        {entry.bullets.length > 1 && (
                          <button onClick={() => removeBullet(idx, bIdx)} className="text-gray-500 hover:text-red-400 px-2">✕</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addBullet(idx)} className="text-xs text-blue-400 hover:text-blue-300">{t("build.addBulletButton")}</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setForm(prev => ({ ...prev, workEntries: [...prev.workEntries, { ...EMPTY_WORK, bullets: [""] }] }))} className="text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-4 py-2 w-full">
              {t("build.addPositionButton")}
            </button>
          </div>
        )}

        {/* Step 3: Education */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-white">{t("build.educationSection")}</h2>
            {form.educationEntries.map((entry, idx) => (
              <div key={idx} className="border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">{t("build.entryPrefix")} {idx + 1}</span>
                  {form.educationEntries.length > 1 && (
                    <button onClick={() => setForm(prev => ({ ...prev, educationEntries: prev.educationEntries.filter((_, i) => i !== idx) }))} className="text-xs text-red-400 hover:text-red-300">{t("build.removeEducation")}</button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass()}>{t("build.schoolRequired")}</label>
                    <input className={inputClass()} placeholder={t("build.schoolPlaceholder")} value={entry.school} onChange={e => updateEducation(idx, "school", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>{t("build.degreeRequired")}</label>
                    <input className={inputClass()} placeholder={t("build.degreePlaceholder")} value={entry.degree} onChange={e => updateEducation(idx, "degree", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>{t("build.graduationYear")}</label>
                    <input className={inputClass()} placeholder={t("build.graduationYearPlaceholder")} value={entry.graduationYear} onChange={e => updateEducation(idx, "graduationYear", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>{t("build.gpa")}</label>
                    <input className={inputClass()} placeholder={t("build.gpaPlaceholder")} value={entry.gpa} onChange={e => updateEducation(idx, "gpa", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setForm(prev => ({ ...prev, educationEntries: [...prev.educationEntries, { ...EMPTY_EDUCATION }] }))} className="text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-4 py-2 w-full">
              {t("build.addEducationButton")}
            </button>
          </div>
        )}

        {/* Step 4: Skills */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-4">{t("build.skillsSection")}</h2>
            <div>
              <label className={labelClass()}>{t("build.technicalSkills")}</label>
              <textarea className={inputClass("resize-none")} rows={3} placeholder={t("build.technicalSkillsPlaceholder")} value={form.technicalSkills} onChange={e => updateField("technicalSkills", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>{t("build.softSkills")}</label>
              <textarea className={inputClass("resize-none")} rows={2} placeholder={t("build.softSkillsPlaceholder")} value={form.softSkills} onChange={e => updateField("softSkills", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>{t("build.certifications")}</label>
              <textarea className={inputClass("resize-none")} rows={2} placeholder={t("build.certificationsPlaceholder")} value={form.certifications} onChange={e => updateField("certifications", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>{t("build.languages")}</label>
              <input className={inputClass()} placeholder={t("build.languagesPlaceholder")} value={form.languages} onChange={e => updateField("languages", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>{t("build.projects")}</label>
              <textarea className={inputClass("resize-none")} rows={3} placeholder={t("build.projectsPlaceholder")} value={form.projects} onChange={e => updateField("projects", e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 5: Generate */}
        {step === 5 && (
          <div>
            {loading && (
              <LoadingSpinner message={t("build.generatingResume")} subMessage={t("build.generatingSubtext")} />
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}
            {!loading && !markdown && !error && (
              <div className="text-center py-12 space-y-4">
                <p className="text-gray-300">{t("build.readyToGenerateMessage")}</p>
                <p className="text-gray-500 text-sm">{t("build.generateInstructionMessage")}</p>
                <button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
                  {t("build.generateButton")}
                </button>
              </div>
            )}
            {markdown && (
              <div className="space-y-4">
                {/* Icon toolbar */}
                <div className="flex items-center gap-2">
                  {/* Copy Markdown */}
                  <button onClick={copyMarkdown} title={t("build.copyMarkdownButton")} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                    {copied === "md" ? (
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    )}
                  </button>
                  {/* Copy Plain Text */}
                  <button onClick={copyPlainText} title={t("build.copyPlainTextButton")} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                    {copied === "txt" ? (
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    )}
                  </button>
                  {/* Regenerate */}
                  <button onClick={handleGenerate} title={t("build.regenerate")} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>

                  <div className="flex-1" />

                  {/* Download PDF */}
                  <button onClick={downloadPdf} title={t("build.downloadResume")} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-red-400 hover:text-red-300 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </button>
                  {/* Start Over */}
                  <button onClick={() => {
                    setStep(1);
                    setMarkdown(null);
                    setForm(INITIAL_FORM);
                    setError(null);
                    clearPipeline();
                  }} title={t("build.startOverButton")} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>

                  </button>
                </div>

                {/* Resume preview */}
                <div ref={resumePreviewRef} className="overflow-auto max-h-[70vh] bg-gray-950 border border-gray-800 rounded-xl p-5 scrollbar-dark">
                  <MarkdownRenderer content={markdown} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
          <button
            onClick={() => setStep(prev => (prev - 1) as Step)}
            disabled={step === 1}
            className="text-sm text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors disabled:hover:border-gray-700 disabled:hover:text-gray-400"
          >
            {t("build.backButton")}
          </button>
          {step < 5 ? (
            <button
              onClick={() => {
                if (step === 4) { setStep(5); handleGenerate(); }
                else setStep(prev => (prev + 1) as Step);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              {step === 4 ? t("build.generateResumeButton") : t("build.continueButton")}
            </button>
          ) : markdown && (
            <Link href="/job-match" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors">
              {t("build.jobMatchButton")}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

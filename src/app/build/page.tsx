"use client";

import { useState, useEffect } from "react";
import type { ResumeFormData, WorkEntry, EducationEntry } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";
import MarkdownRenderer from "@/components/MarkdownRenderer";

type Step = 1 | 2 | 3 | 4 | 5;

const EMPTY_WORK: WorkEntry = { company: "", title: "", startDate: "", endDate: "", bullets: [""] };
const EMPTY_EDUCATION: EducationEntry = { school: "", degree: "", graduationYear: "", gpa: "" };

const INITIAL_FORM: ResumeFormData = {
  fullName: "", email: "", phone: "", location: "", linkedIn: "", github: "", summary: "",
  workEntries: [{ ...EMPTY_WORK, bullets: [""] }],
  educationEntries: [{ ...EMPTY_EDUCATION }],
  technicalSkills: "", softSkills: "", certifications: "", languages: "", projects: "",
};

const STEP_LABELS = ["Personal Info", "Experience", "Education", "Skills", "Generate"];

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

function StepBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => {
        const num = (i + 1) as Step;
        const isCompleted = num < step;
        const isCurrent = num === step;
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  isCompleted
                    ? "bg-blue-600 text-white"
                    : isCurrent
                    ? "border-2 border-blue-500 bg-blue-500/10 text-blue-400"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {isCompleted ? "✓" : num}
              </div>
              <span className={`text-xs mt-1 ${isCurrent ? "text-blue-400" : "text-gray-500"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`w-12 h-px mt-[-16px] mx-1 ${num < step ? "bg-blue-600" : "bg-gray-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function BuildPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<ResumeFormData>(INITIAL_FORM);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"md" | "txt" | null>(null);
  const [hasStoredResume, setHasStoredResume] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasStoredResume(!!sessionStorage.getItem("resumeText"));
    }
  }, []);

  async function handleImport() {
    const resumeText = sessionStorage.getItem("resumeText");
    if (!resumeText) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Import failed.");
      // Ensure arrays always have at least one entry
      const parsed: ResumeFormData = {
        ...data.data,
        workEntries: data.data.workEntries?.length ? data.data.workEntries : [{ ...EMPTY_WORK, bullets: [""] }],
        educationEntries: data.data.educationEntries?.length ? data.data.educationEntries : [{ ...EMPTY_EDUCATION }],
      };
      setForm(parsed);
      setImported(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

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
      sessionStorage.setItem("builtResume", "1");
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">AI Resume Builder</h1>
        <p className="text-gray-400 text-sm mt-1">Fill in your details and Claude will craft a polished resume.</p>
      </div>

      {/* Import banner */}
      {hasStoredResume && !imported && (
        <div className="mb-6 flex items-center justify-between gap-4 bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-4">
          <div>
            <p className="text-sm font-medium text-blue-300">Resume detected from your last score</p>
            <p className="text-xs text-blue-400/70 mt-0.5">Import it to pre-fill all fields automatically.</p>
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {importing ? "Importing…" : "Import Resume"}
          </button>
        </div>
      )}
      {imported && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">✓ Resume imported — review and edit each step as needed.</span>
        </div>
      )}
      {importError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-red-400 text-sm">{importError}</div>
      )}

      <StepBar step={step} />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-4">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass()}>Full Name *</label>
                <input className={inputClass()} placeholder="Jane Smith" value={form.fullName} onChange={e => updateField("fullName", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>Email *</label>
                <input className={inputClass()} type="email" placeholder="jane@example.com" value={form.email} onChange={e => updateField("email", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>Phone</label>
                <input className={inputClass()} placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => updateField("phone", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>Location</label>
                <input className={inputClass()} placeholder="New York, NY" value={form.location} onChange={e => updateField("location", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>LinkedIn URL</label>
                <input className={inputClass()} placeholder="linkedin.com/in/janesmith" value={form.linkedIn} onChange={e => updateField("linkedIn", e.target.value)} />
              </div>
              <div>
                <label className={labelClass()}>GitHub URL</label>
                <input className={inputClass()} placeholder="github.com/janesmith" value={form.github} onChange={e => updateField("github", e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass()}>Professional Summary</label>
              <textarea className={inputClass("resize-none")} rows={4} placeholder="Brief overview of your experience and goals…" value={form.summary} onChange={e => updateField("summary", e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 2: Work Experience */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-white">Work Experience</h2>
            {form.workEntries.map((entry, idx) => (
              <div key={idx} className="border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Position {idx + 1}</span>
                  {form.workEntries.length > 1 && (
                    <button onClick={() => setForm(prev => ({ ...prev, workEntries: prev.workEntries.filter((_, i) => i !== idx) }))} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass()}>Company *</label>
                    <input className={inputClass()} placeholder="Acme Corp" value={entry.company} onChange={e => updateWork(idx, "company", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>Job Title *</label>
                    <input className={inputClass()} placeholder="Software Engineer" value={entry.title} onChange={e => updateWork(idx, "title", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>Start Date</label>
                    <input className={inputClass()} placeholder="Jan 2022" value={entry.startDate} onChange={e => updateWork(idx, "startDate", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>End Date</label>
                    <input className={inputClass()} placeholder="Present" value={entry.endDate} onChange={e => updateWork(idx, "endDate", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass()}>Achievement Bullets</label>
                  <div className="space-y-2">
                    {entry.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-2">
                        <input className={inputClass("flex-1")} placeholder="Reduced load time by 40% by implementing…" value={bullet} onChange={e => updateBullet(idx, bIdx, e.target.value)} />
                        {entry.bullets.length > 1 && (
                          <button onClick={() => removeBullet(idx, bIdx)} className="text-gray-500 hover:text-red-400 px-2">✕</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addBullet(idx)} className="text-xs text-blue-400 hover:text-blue-300">+ Add bullet</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setForm(prev => ({ ...prev, workEntries: [...prev.workEntries, { ...EMPTY_WORK, bullets: [""] }] }))} className="text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-4 py-2 w-full">
              + Add another position
            </button>
          </div>
        )}

        {/* Step 3: Education */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-white">Education</h2>
            {form.educationEntries.map((entry, idx) => (
              <div key={idx} className="border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Entry {idx + 1}</span>
                  {form.educationEntries.length > 1 && (
                    <button onClick={() => setForm(prev => ({ ...prev, educationEntries: prev.educationEntries.filter((_, i) => i !== idx) }))} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass()}>School *</label>
                    <input className={inputClass()} placeholder="MIT" value={entry.school} onChange={e => updateEducation(idx, "school", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>Degree *</label>
                    <input className={inputClass()} placeholder="B.S. Computer Science" value={entry.degree} onChange={e => updateEducation(idx, "degree", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>Graduation Year</label>
                    <input className={inputClass()} placeholder="2022" value={entry.graduationYear} onChange={e => updateEducation(idx, "graduationYear", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>GPA (optional)</label>
                    <input className={inputClass()} placeholder="3.8" value={entry.gpa} onChange={e => updateEducation(idx, "gpa", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setForm(prev => ({ ...prev, educationEntries: [...prev.educationEntries, { ...EMPTY_EDUCATION }] }))} className="text-sm text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-lg px-4 py-2 w-full">
              + Add another entry
            </button>
          </div>
        )}

        {/* Step 4: Skills */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-4">Skills & Other</h2>
            <div>
              <label className={labelClass()}>Technical Skills</label>
              <textarea className={inputClass("resize-none")} rows={3} placeholder="React, TypeScript, Node.js, PostgreSQL, Docker…" value={form.technicalSkills} onChange={e => updateField("technicalSkills", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>Soft Skills</label>
              <textarea className={inputClass("resize-none")} rows={2} placeholder="Leadership, cross-functional collaboration, mentoring…" value={form.softSkills} onChange={e => updateField("softSkills", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>Certifications</label>
              <textarea className={inputClass("resize-none")} rows={2} placeholder="AWS Certified Solutions Architect (2023)…" value={form.certifications} onChange={e => updateField("certifications", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>Languages</label>
              <input className={inputClass()} placeholder="English (native), Vietnamese (fluent)" value={form.languages} onChange={e => updateField("languages", e.target.value)} />
            </div>
            <div>
              <label className={labelClass()}>Notable Projects</label>
              <textarea className={inputClass("resize-none")} rows={3} placeholder="Open-source contributions, side projects, links…" value={form.projects} onChange={e => updateField("projects", e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 5: Generate */}
        {step === 5 && (
          <div>
            {loading && (
              <LoadingSpinner message="Building your resume…" subMessage="Claude AI is crafting your professional resume" />
            )}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}
            {!loading && !markdown && !error && (
              <div className="text-center py-12 space-y-4">
                <p className="text-gray-300">Ready to generate your resume!</p>
                <p className="text-gray-500 text-sm">Claude will craft a polished Markdown resume from your information.</p>
                <button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors">
                  Generate Resume
                </button>
              </div>
            )}
            {markdown && (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 overflow-auto max-h-[70vh] bg-gray-950 border border-gray-800 rounded-xl p-5">
                  <MarkdownRenderer content={markdown} />
                </div>
                <div className="lg:w-48 flex flex-col gap-3 lg:sticky lg:top-24 h-fit">
                  <button onClick={copyMarkdown} className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                    {copied === "md" ? "Copied!" : "Copy Markdown"}
                  </button>
                  <button onClick={copyPlainText} className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                    {copied === "txt" ? "Copied!" : "Copy Plain Text"}
                  </button>
                  <div className="border-t border-gray-700 pt-3 mt-1 flex flex-col gap-2">
                    <a href="/job-match" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors text-center">
                      Job Match →
                    </a>
                    <button onClick={() => { setStep(1); setMarkdown(null); setForm(INITIAL_FORM); setError(null); sessionStorage.removeItem("builtResume"); }} className="w-full border border-gray-700 text-gray-400 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                      Start Over
                    </button>
                  </div>
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
            ← Back
          </button>
          {step < 5 && (
            <button
              onClick={() => {
                if (step === 4) { setStep(5); handleGenerate(); }
                else setStep(prev => (prev + 1) as Step);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              {step === 4 ? "Generate Resume →" : "Continue →"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import type { ResumeFormData, WorkEntry, EducationEntry } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { useTranslation } from "@/components/TranslationProvider";
import {
  getBuilderForm,
  getBuiltResumeMarkdown,
  getParsedResumeForm,
  getResumeText,
  setBuilderForm,
  setBuiltResumeMarkdown,
  setParsedResumeForm,
  PIPELINE_KEYS,
} from "@/lib/pipeline";

type Step = 1 | 2 | 3 | 4 | 5;

const EMPTY_WORK: WorkEntry = { company: "", title: "", startDate: "", endDate: "", bullets: [""] };
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

function StepBar({ step, t }: { step: Step; t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABEL_KEYS.map((key, i) => {
        const label = t(key);
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
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const hydratedRef = useRef(false);

  if (!mounted) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  // Step 1: hydrate the form from session storage on mount. We prefer
  // in-progress builder edits over a freshly-parsed resume so the user's
  // work is never overwritten when they navigate between steps.
  useEffect(() => {
    const inProgress = getBuilderForm();
    if (inProgress) {
      setForm(inProgress);
      setSynced(true);
      hydratedRef.current = true;
      const cachedMarkdown = getBuiltResumeMarkdown();
      if (cachedMarkdown) setMarkdown(cachedMarkdown);
      return;
    }

    const cachedParse = getParsedResumeForm();
    if (cachedParse) {
      const normalized = normalizeParsed(cachedParse);
      setForm(normalized);
      setSynced(true);
      hydratedRef.current = true;
      return;
    }

    // Step 2: no cached form — auto-import from the previous (Score) step
    // exactly once, so the user never has to click "Import".
    const resumeText = getResumeText();
    if (!resumeText.trim()) {
      hydratedRef.current = true;
      return;
    }

    let cancelled = false;
    setSyncing(true);
    setSyncError(null);
    (async () => {
      try {
        const res = await fetch("/api/parse-resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Sync failed.");
        if (cancelled) return;
        const parsed = normalizeParsed(data.data);
        setParsedResumeForm(parsed);
        setForm(parsed);
        setSynced(true);
      } catch (err) {
        if (!cancelled) setSyncError(err instanceof Error ? err.message : "Sync failed.");
      } finally {
        if (!cancelled) {
          setSyncing(false);
          hydratedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist every form edit so navigating away never loses progress and
  // the next visit doesn't need to re-import from the previous step.
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{t("build.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("build.subtitle")}</p>
      </div>

      {/* Auto-sync status */}
      {syncing && (
        <div className="mb-6 flex items-center gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-3">
          <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-blue-300 text-sm">{t("build.syncingMessage")}</span>
        </div>
      )}
      {!syncing && synced && (
        <div className="mb-6 flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-3">
          <span className="text-green-400 text-sm">{t("build.syncedMessage")}</span>
        </div>
      )}
      {syncError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-3 text-red-400 text-sm">{syncError}</div>
      )}

      <StepBar step={step} t={t} />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-white mb-4">{t("build.personalInfoSection")}</h2>
            <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass()}>{t("build.companyRequired")}</label>
                    <input className={inputClass()} placeholder={t("build.companyPlaceholder")} value={entry.company} onChange={e => updateWork(idx, "company", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass()}>{t("build.titleRequired")}</label>
                    <input className={inputClass()} placeholder={t("build.titlePlaceholder")} value={entry.title} onChange={e => updateWork(idx, "title", e.target.value)} />
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
                <div className="grid grid-cols-2 gap-3">
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
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 overflow-auto max-h-[70vh] bg-gray-950 border border-gray-800 rounded-xl p-5">
                  <MarkdownRenderer content={markdown} />
                </div>
                <div className="lg:w-48 flex flex-col gap-3 lg:sticky lg:top-24 h-fit">
                  <button onClick={copyMarkdown} className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                    {copied === "md" ? t("common.copied") : t("build.copyMarkdownButton")}
                  </button>
                  <button onClick={copyPlainText} className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                    {copied === "txt" ? t("common.copied") : t("build.copyPlainTextButton")}
                  </button>
                  <div className="border-t border-gray-700 pt-3 mt-1 flex flex-col gap-2">
                    <a href="/job-match" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors text-center">
                      {t("build.jobMatchButton")}
                    </a>
                    <button onClick={() => {
                      setStep(1);
                      setMarkdown(null);
                      setForm(INITIAL_FORM);
                      setError(null);
                      if (typeof window !== "undefined") {
                        sessionStorage.removeItem(PIPELINE_KEYS.builtResume);
                        sessionStorage.removeItem(PIPELINE_KEYS.builtResumeMarkdown);
                        sessionStorage.removeItem(PIPELINE_KEYS.builderForm);
                      }
                    }} className="w-full border border-gray-700 text-gray-400 hover:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                      {t("build.startOverButton")}
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
            {t("build.backButton")}
          </button>
          {step < 5 && (
            <button
              onClick={() => {
                if (step === 4) { setStep(5); handleGenerate(); }
                else setStep(prev => (prev + 1) as Step);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
            >
              {step === 4 ? t("build.generateResumeButton") : t("build.continueButton")}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SalaryEstimatorFormData, SalaryEstimate, ResumeFormData, WorkEntry, EducationEntry } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";
import PipelineWorkflow from "@/components/PipelineWorkflow";
import { useI18n } from "@/hooks/useI18n";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { fetchResumeDetail } from "@/lib/accountClient";
import {
  getSalaryEstimatorForm,
  getSalaryEstimatorResult,
  getSalaryEstimatorAnalysis,
  setCoverLetterForm,
  getCoverLetterForm,
  getCurrentResumeId,
  setCurrentResumeId,
  setSalaryEstimatorForm,
  setSalaryEstimatorResult,
  setSalaryEstimatorAnalysis,
  getBuilderForm,
  getParsedResumeForm,
} from "@/lib/pipeline";

const EXPERIENCE_KEYS = [
  { value: "0-2 years", label: "salary.experience_0_2" },
  { value: "2-5 years", label: "salary.experience_2_5" },
  { value: "5-10 years", label: "salary.experience_5_10" },
  { value: "10-15 years", label: "salary.experience_10_15" },
  { value: "15+ years", label: "salary.experience_15_plus" },
];

const EDUCATION_KEYS = [
  { value: "High School", label: "salary.edu_highSchool" },
  { value: "Associate's Degree", label: "salary.edu_associate" },
  { value: "Bachelor's Degree", label: "salary.edu_bachelor" },
  { value: "Master's Degree", label: "salary.edu_master" },
  { value: "PhD", label: "salary.edu_phd" },
  { value: "Bootcamp/Certification", label: "salary.edu_bootcamp" },
];

const INITIAL_FORM: SalaryEstimatorFormData = {
  jobTitle: "",
  industry: "",
  experience: "5-10 years",
  location: "United States",
  skills: "",
  education: "Bachelor's Degree",
};

// --- Résumé → Salary form autofill helpers -------------------------------------------------

// The current/most-recent role: prefer an entry still ongoing ("Present"/empty end date),
// otherwise fall back to the first listed (CVs conventionally list most-recent first).
function mostRecentTitle(entries: WorkEntry[] | undefined): string {
  if (!entries?.length) return "";
  const ongoing = entries.find((e) => /present|current|now|hiện tại|nay|đang/i.test(e.endDate ?? "") || !e.endDate?.trim());
  return (ongoing ?? entries[0]).title?.trim() ?? "";
}

function mostRecentDegree(entries: EducationEntry[] | undefined): string {
  return entries?.find((e) => e.degree?.trim())?.degree?.trim() ?? "";
}

// Map a free-text degree to one of the EDUCATION_KEYS select values. Returns "" when unsure
// so the caller keeps the default rather than showing an unmatched value.
function mapDegreeToOption(degree: string): string {
  const d = degree.toLowerCase();
  if (!d) return "";
  if (/ph\.?d|doctor|doctoral|tiến sĩ/.test(d)) return "PhD";
  if (/master|msc|m\.s|m\.eng|mba|thạc sĩ/.test(d)) return "Master's Degree";
  if (/bachelor|bsc|b\.s|b\.a|b\.eng|btech|b\.tech|kỹ sư|cử nhân|đại học/.test(d)) return "Bachelor's Degree";
  if (/associate|cao đẳng/.test(d)) return "Associate's Degree";
  if (/bootcamp|certificat|chứng chỉ/.test(d)) return "Bootcamp/Certification";
  if (/high school|secondary|thpt|trung học/.test(d)) return "High School";
  return "";
}

// Best-effort industry inference from titles, skills and companies. Returns "" when nothing
// clearly matches (the user can fill it in). Free-text field, so any string is acceptable.
function inferIndustry(p: ResumeFormData): string {
  const haystack = [
    ...(p.workEntries ?? []).flatMap((w) => [w.title, w.company]),
    p.technicalSkills,
    p.summary,
  ].filter(Boolean).join(" ").toLowerCase();
  if (!haystack.trim()) return "";
  const RULES: { industry: string; re: RegExp }[] = [
    { industry: "Technology", re: /software|developer|engineer|programmer|devops|data|frontend|back ?end|full ?stack|web|mobile|cloud|machine learning|\bai\b|\bml\b|\bit\b|qa|sre/ },
    { industry: "Finance", re: /finance|financial|accountant|accounting|banking|investment|fintech|audit|kế toán|tài chính/ },
    { industry: "Healthcare", re: /nurse|doctor|medical|health|clinical|pharma|hospital|y tế|bác sĩ/ },
    { industry: "Marketing", re: /marketing|seo|content|brand|social media|copywriter|quảng cáo/ },
    { industry: "Sales", re: /\bsales\b|account executive|business development|bán hàng/ },
    { industry: "Design", re: /designer|ux|ui|graphic|product design|thiết kế/ },
    { industry: "Education", re: /teacher|professor|lecturer|education|tutor|giáo viên|giảng viên/ },
  ];
  return RULES.find((r) => r.re.test(haystack))?.industry ?? "";
}

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

export default function SalaryEstimatorPage() {
  const { t, mounted } = useI18n();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<SalaryEstimatorFormData>(INITIAL_FORM);
  const [result, setResult] = useState<SalaryEstimate | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hydratedRef = useRef(false);
  const skipPersistRef = useRef(false);

  useEffect(() => {
    hydratedRef.current = false;
    skipPersistRef.current = true;
    const urlResumeId = searchParams.get("resumeId");
    if (urlResumeId) setCurrentResumeId(urlResumeId);

    if (!urlResumeId) {
      setForm(INITIAL_FORM);
      setResult(null);
      setAnalysis("");
      hydratedRef.current = true;
      return;
    }

    const stored = getSalaryEstimatorForm();
    const freshNoStored = !stored;
    setForm(stored ? { ...stored } : { ...INITIAL_FORM });

    const cachedResult = getSalaryEstimatorResult();
    const cachedAnalysis = getSalaryEstimatorAnalysis();
    if (cachedResult) setResult(cachedResult);
    if (cachedAnalysis) setAnalysis(cachedAnalysis);

    hydratedRef.current = true;

    // Autofill from the uploaded résumé's parsed data. Blank text fields are filled;
    // location/education (which have sensible defaults) are overridden only on a fresh
    // form so we never clobber a value the user previously saved.
    const applyParsed = (p: ResumeFormData) => {
      const title = mostRecentTitle(p.workEntries);
      const skills = p.technicalSkills?.trim() ?? "";
      const loc = p.location?.trim() ?? "";
      const edu = mapDegreeToOption(mostRecentDegree(p.educationEntries));
      const industry = inferIndustry(p);
      setForm((prev) => ({
        ...prev,
        jobTitle: prev.jobTitle || title,
        skills: prev.skills || skills,
        industry: prev.industry || industry,
        location: freshNoStored && loc ? loc : prev.location,
        education: freshNoStored && edu ? edu : prev.education,
      }));
    };

    const inMemory = getParsedResumeForm() ?? getBuilderForm();
    if (inMemory) {
      applyParsed(inMemory);
    } else {
      // Score-Resume flow only caches the analysis, not the parsed form — fetch it by id.
      fetchResumeDetail(urlResumeId).then((detail) => {
        if (detail?.parsed) applyParsed(detail.parsed);
      }).catch(() => {});
    }
  }, [searchParams]);

  // Persist form edits
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipPersistRef.current) { skipPersistRef.current = false; return; }
    setSalaryEstimatorForm(form);
  }, [form]);

  function updateField(field: keyof SalaryEstimatorFormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysis("");
    try {
      const res = await fetch("/api/salary-estimator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Estimation failed.");
      setResult(data.data.estimate);
      setAnalysis(data.data.analysis);
      setSalaryEstimatorResult(data.data.estimate);
      setSalaryEstimatorAnalysis(data.data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;

    const mainCurrency = result.currency === 'VND'
      ? `${(result.minSalary / 1000000).toFixed(1)}M - ${(result.maxSalary / 1000000).toFixed(1)}M VND/tháng (Median: ${(result.medianSalary / 1000000).toFixed(1)}M VND)`
      : `$${result.minSalary.toLocaleString()} - $${result.maxSalary.toLocaleString()}/month (Median: $${result.medianSalary.toLocaleString()})`;

    const altCurrency = result.alternativeCurrency && result.medianSalaryAlt
      ? `\n\nAlternative Currency (${result.alternativeCurrency}):\n${result.alternativeCurrency === 'USD' ? '$' : ''}${result.minSalaryAlt?.toLocaleString()} - $${result.maxSalaryAlt?.toLocaleString()}/month (Median: ${result.alternativeCurrency === 'USD' ? '$' : ''}${result.medianSalaryAlt?.toLocaleString()})`
      : '';

    const text = `═══════════════════════════════════════
${t("salary.title")} - ${form.jobTitle.toUpperCase()}
═══════════════════════════════════════

${t("salary.location_text")} ${form.location}
${t("salary.experience_text")} ${form.experience}
${t("salary.industry_text")} ${form.industry}

${t("salary.salaryRange")}
${mainCurrency}
${altCurrency}

${t("salary.confidenceLabel")} ${result.confidence}

${t("salary.marketInsights")}:
${result.marketInsights}

${t("salary.factors_title")}
${result.factors.map((f, i) => `${i + 1}. ${f}`).join('\n')}

═══════════════════════════════════════`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!mounted) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-900 rounded-2xl animate-pulse" />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <PipelineWorkflow />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{t("salary.title")}</h1>
        <p className="text-gray-400 text-sm mt-1">{t("salary.subtitle")}</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {loading ? (
          <LoadingSpinner message={t("salary.analyzing")} subMessage={t("salary.analyzingSubtext")} />
        ) : result ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">{t("salary.salaryEstimateHeading")}</h2>
              <Button
                variant="link"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setResult(null);
                  setAnalysis("");
                }}
              >
                {t("salary.reEstimate")}
              </Button>
            </div>

            {/* Salary Estimate Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{t("salary.monthlyLabel")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400 mb-2">{t("salary.minimum")}</p>
                  <p className="text-xl font-bold text-green-400">
                    {result.currency === 'VND'
                      ? `${(result.minSalary / 1000000).toFixed(1)}M`
                      : `$${result.minSalary.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{result.currency}</p>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 text-center border border-blue-500/30">
                  <p className="text-xs text-gray-400 mb-2">{t("salary.median")}</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {result.currency === 'VND'
                      ? `${(result.medianSalary / 1000000).toFixed(1)}M`
                      : `$${result.medianSalary.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{result.currency}</p>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-400 mb-2">{t("salary.maximum")}</p>
                  <p className="text-xl font-bold text-orange-400">
                    {result.currency === 'VND'
                      ? `${(result.maxSalary / 1000000).toFixed(1)}M`
                      : `$${result.maxSalary.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{result.currency}</p>
                </div>
              </div>

              {/* Alternative Currency */}
              {result.alternativeCurrency && result.medianSalaryAlt && (
                <div className="border-t border-gray-700 pt-4 mt-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">{t("salary.alsoIn")} {result.alternativeCurrency}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-green-400">
                        {result.alternativeCurrency === 'USD' ? '$' : ''}
                        {(result.minSalaryAlt || 0).toLocaleString()}
                        {result.alternativeCurrency === 'VND' ? ' VND' : ''}
                      </p>
                      <p className="text-xs text-gray-500">{t("salary.min")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-blue-400">
                        {result.alternativeCurrency === 'USD' ? '$' : ''}
                        {(result.medianSalaryAlt || 0).toLocaleString()}
                        {result.alternativeCurrency === 'VND' ? ' VND' : ''}
                      </p>
                      <p className="text-xs text-gray-500">{t("salary.med")}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-orange-400">
                        {result.alternativeCurrency === 'USD' ? '$' : ''}
                        {(result.maxSalaryAlt || 0).toLocaleString()}
                        {result.alternativeCurrency === 'VND' ? ' VND' : ''}
                      </p>
                      <p className="text-xs text-gray-500">{t("salary.max")}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400">{t("salary.confidenceLevel")}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    result.confidence === "HIGH"
                      ? "bg-green-500/20 text-green-400"
                      : result.confidence === "MEDIUM"
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "bg-orange-500/20 text-orange-400"
                  }`}>
                    {result.confidence}
                  </span>
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{result.marketInsights}</p>
              </div>

              {result.factors.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <p className="text-xs font-semibold text-gray-400 mb-2">{t("salary.salaryFactors")}</p>
                  <ul className="space-y-2">
                    {result.factors.map((factor, idx) => (
                      <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Career Guidance */}
            {analysis && (
              <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-3">
                <h3 className="text-sm font-semibold text-white">{t("salary.careerGuidance")}</h3>
                <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{analysis}</div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleCopy} size="lg" className="flex-1">
                {copied ? t("salary.copied") : t("salary.copySalaryReport")}
              </Button>
              <Link
                href={`/interview-coach${getCurrentResumeId() ? `?resumeId=${encodeURIComponent(getCurrentResumeId()!)}` : ""}`}
                className={`${buttonClasses({ variant: "success", size: "lg" })} flex-1 text-center`}
              >
                {t("salary.nextStep") ?? "Interview Coach →"}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("salary.jobTitle")} required labelClassName={labelClass()}>
                <input
                  className={inputClass()}
                  placeholder={t("salary.jobTitlePlaceholder")}
                  value={form.jobTitle}
                  onChange={e => updateField("jobTitle", e.target.value)}
                  required
                />
              </Field>
              <Field label={t("salary.industry")} required labelClassName={labelClass()}>
                <input
                  className={inputClass()}
                  placeholder={t("salary.industryPlaceholder")}
                  value={form.industry}
                  onChange={e => updateField("industry", e.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("salary.yearsOfExperience")} required labelClassName={labelClass()}>
                <select
                  className={inputClass()}
                  value={form.experience}
                  onChange={e => updateField("experience", e.target.value)}
                  required
                >
                  {EXPERIENCE_KEYS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("salary.location")} required labelClassName={labelClass()}>
                <input
                  className={inputClass()}
                  placeholder={t("salary.locationPlaceholder")}
                  value={form.location}
                  onChange={e => updateField("location", e.target.value)}
                  required
                />
              </Field>
            </div>

            <Field label={t("salary.skills")} labelClassName={labelClass()}>
              <textarea
                className={inputClass("resize-none")}
                rows={3}
                placeholder={t("salary.skillsPlaceholder")}
                value={form.skills}
                onChange={e => updateField("skills", e.target.value)}
              />
            </Field>

            <Field label={t("salary.education")} labelClassName={labelClass()}>
              <select
                className={inputClass()}
                value={form.education}
                onChange={e => updateField("education", e.target.value)}
              >
                {EDUCATION_KEYS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </Field>

            <Button type="submit" size="lg" fullWidth>
              {t("salary.estimateSalary")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

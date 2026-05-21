"use client";

import { useState, useEffect, useRef } from "react";
import type { SalaryEstimatorFormData, SalaryEstimate } from "@/types/builder";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useI18n } from "@/hooks/useI18n";
import {
  getSalaryEstimatorForm,
  getSalaryEstimatorResult,
  getSalaryEstimatorAnalysis,
  setCoverLetterForm,
  getCoverLetterForm,
  setSalaryEstimatorForm,
  setSalaryEstimatorResult,
  setSalaryEstimatorAnalysis,
  getBuilderForm,
} from "@/lib/pipeline";

const EXPERIENCE_LEVELS = ["0-2 years", "2-5 years", "5-10 years", "10-15 years", "15+ years"];

const INITIAL_FORM: SalaryEstimatorFormData = {
  jobTitle: "",
  industry: "",
  experience: "5-10 years",
  location: "United States",
  skills: "",
  education: "Bachelor's Degree",
};

function inputClass(extra = "") {
  return `w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${extra}`;
}

function labelClass() {
  return "block text-xs font-medium text-gray-400 mb-1";
}

export default function SalaryEstimatorPage() {
  const { t, mounted } = useI18n();
  const [form, setForm] = useState<SalaryEstimatorFormData>(INITIAL_FORM);
  const [result, setResult] = useState<SalaryEstimate | null>(null);
  const [analysis, setAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hydratedRef = useRef(false);

  // Auto-sync from previous steps on mount
  useEffect(() => {
    const stored = getSalaryEstimatorForm();
    const builderForm = getBuilderForm();

    let next: SalaryEstimatorFormData = stored ?? INITIAL_FORM;

    // Pre-fill from builder form if available
    if (builderForm) {
      next = {
        ...next,
        jobTitle: form.jobTitle || builderForm.technicalSkills.split(",")[0]?.trim() || "",
        skills: next.skills || builderForm.technicalSkills,
        education: next.education || (builderForm.educationEntries[0]?.degree ?? "Bachelor's Degree"),
      };
    }

    setForm(next);

    const cachedResult = getSalaryEstimatorResult();
    const cachedAnalysis = getSalaryEstimatorAnalysis();
    if (cachedResult) {
      setResult(cachedResult);
    }
    if (cachedAnalysis) {
      setAnalysis(cachedAnalysis);
    }

    hydratedRef.current = true;
  }, []);

  // Persist form edits
  useEffect(() => {
    if (!hydratedRef.current) return;
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
        <LoadingSpinner message="Loading salary estimator..." subMessage="Preparing market analysis" />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
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
              <h2 className="text-sm font-semibold text-white">Salary Estimate</h2>
              <button
                onClick={() => {
                  setResult(null);
                  setAnalysis("");
                  if (typeof window !== "undefined") {
                    sessionStorage.removeItem("salaryEstimatorResult");
                    sessionStorage.removeItem("salaryEstimatorAnalysis");
                  }
                }}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {t("salary.reEstimate")}
              </button>
            </div>

            {/* Salary Estimate Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">{t("salary.monthlyLabel")}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                  <div className="grid grid-cols-3 gap-3">
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

            <button onClick={handleCopy} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors">
              {copied ? t("salary.copied") : t("salary.copySalaryReport")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass()}>{t("salary.jobTitle")} *</label>
                <input
                  className={inputClass()}
                  placeholder={t("salary.jobTitlePlaceholder")}
                  value={form.jobTitle}
                  onChange={e => updateField("jobTitle", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass()}>{t("salary.industry")} *</label>
                <input
                  className={inputClass()}
                  placeholder={t("salary.industryPlaceholder")}
                  value={form.industry}
                  onChange={e => updateField("industry", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass()}>{t("salary.yearsOfExperience")} *</label>
                <select
                  className={inputClass()}
                  value={form.experience}
                  onChange={e => updateField("experience", e.target.value)}
                  required
                >
                  {EXPERIENCE_LEVELS.map(level => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass()}>{t("salary.location")} *</label>
                <input
                  className={inputClass()}
                  placeholder={t("salary.locationPlaceholder")}
                  value={form.location}
                  onChange={e => updateField("location", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelClass()}>{t("salary.skills")}</label>
              <textarea
                className={inputClass("resize-none")}
                rows={3}
                placeholder={t("salary.skillsPlaceholder")}
                value={form.skills}
                onChange={e => updateField("skills", e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass()}>{t("salary.education")}</label>
              <select
                className={inputClass()}
                value={form.education}
                onChange={e => updateField("education", e.target.value)}
              >
                <option value="High School">High School</option>
                <option value="Associate's Degree">Associate's Degree</option>
                <option value="Bachelor's Degree">Bachelor's Degree</option>
                <option value="Master's Degree">Master's Degree</option>
                <option value="PhD">PhD</option>
                <option value="Bootcamp/Certification">Bootcamp/Certification</option>
              </select>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors">
              {t("salary.estimateSalary")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

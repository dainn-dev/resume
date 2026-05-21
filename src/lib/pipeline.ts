import type { ResumeAnalysis } from "@/types/resume";
import type { CoverLetterFormData, ResumeFormData, SalaryEstimatorFormData, SalaryEstimate } from "@/types/builder";

/**
 * Session-storage keys shared by every step of the resume pipeline.
 *
 * The pipeline flows: Score (upload) → Build → Job Match → Cover Letter → Salary Estimator.
 * Each step reads what the previous step wrote so the user never has to
 * re-import data between steps.
 */
export const PIPELINE_KEYS = {
  // Score / upload step
  resumeAnalysis: "resumeAnalysis",
  resumeText: "resumeText",

  // Build step
  parsedResumeForm: "parsedResumeForm",
  builderForm: "builderForm",
  builtResumeMarkdown: "builtResumeMarkdown",
  builtResume: "builtResume",

  // Job match step
  jobMatchContext: "jobMatchContext",
  jobMatchInput: "jobMatchInput",
  jobMatchResult: "jobMatchResult",

  // Cover letter step
  coverLetterForm: "coverLetterForm",
  coverLetterResult: "coverLetterResult",

  // Salary estimator step
  salaryEstimatorForm: "salaryEstimatorForm",
  salaryEstimatorResult: "salaryEstimatorResult",
  salaryEstimatorAnalysis: "salaryEstimatorAnalysis",
} as const;

export interface JobMatchContext {
  jobTitle: string;
  company: string;
  jobDescription: string;
}

export interface JobMatchInput {
  mode: "url" | "paste";
  linkedinUrl: string;
  jobDescription: string;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sessionStorage may be unavailable or full — fail silently
  }
}

function readString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function remove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------- Score / upload ----------

export function getResumeAnalysis(): ResumeAnalysis | null {
  return readJson<ResumeAnalysis>(PIPELINE_KEYS.resumeAnalysis);
}

export function getResumeText(): string {
  return readString(PIPELINE_KEYS.resumeText) ?? "";
}

export function setResumeAnalysis(analysis: ResumeAnalysis, resumeText: string): void {
  writeJson(PIPELINE_KEYS.resumeAnalysis, analysis);
  writeString(PIPELINE_KEYS.resumeText, resumeText);
}

// ---------- Build ----------

export function getParsedResumeForm(): ResumeFormData | null {
  return readJson<ResumeFormData>(PIPELINE_KEYS.parsedResumeForm);
}

export function setParsedResumeForm(form: ResumeFormData): void {
  writeJson(PIPELINE_KEYS.parsedResumeForm, form);
}

export function getBuilderForm(): ResumeFormData | null {
  return readJson<ResumeFormData>(PIPELINE_KEYS.builderForm);
}

export function setBuilderForm(form: ResumeFormData): void {
  writeJson(PIPELINE_KEYS.builderForm, form);
}

export function getBuiltResumeMarkdown(): string | null {
  return readString(PIPELINE_KEYS.builtResumeMarkdown);
}

export function setBuiltResumeMarkdown(markdown: string): void {
  writeString(PIPELINE_KEYS.builtResumeMarkdown, markdown);
  writeString(PIPELINE_KEYS.builtResume, "1");
}

// ---------- Job Match ----------

export function getJobMatchContext(): JobMatchContext | null {
  return readJson<JobMatchContext>(PIPELINE_KEYS.jobMatchContext);
}

export function setJobMatchContext(ctx: JobMatchContext): void {
  writeJson(PIPELINE_KEYS.jobMatchContext, ctx);
}

export function getJobMatchInput(): JobMatchInput | null {
  return readJson<JobMatchInput>(PIPELINE_KEYS.jobMatchInput);
}

export function setJobMatchInput(input: JobMatchInput): void {
  writeJson(PIPELINE_KEYS.jobMatchInput, input);
}

export function getJobMatchResult<T = unknown>(): T | null {
  return readJson<T>(PIPELINE_KEYS.jobMatchResult);
}

export function setJobMatchResult(result: unknown): void {
  writeJson(PIPELINE_KEYS.jobMatchResult, result);
}

// ---------- Cover Letter ----------

export function getCoverLetterForm(): CoverLetterFormData | null {
  return readJson<CoverLetterFormData>(PIPELINE_KEYS.coverLetterForm);
}

export function setCoverLetterForm(form: CoverLetterFormData): void {
  writeJson(PIPELINE_KEYS.coverLetterForm, form);
}

export function getCoverLetterResult(): string | null {
  return readString(PIPELINE_KEYS.coverLetterResult);
}

export function setCoverLetterResult(text: string): void {
  writeString(PIPELINE_KEYS.coverLetterResult, text);
}

// ---------- Salary Estimator ----------

export function getSalaryEstimatorForm(): SalaryEstimatorFormData | null {
  return readJson<SalaryEstimatorFormData>(PIPELINE_KEYS.salaryEstimatorForm);
}

export function setSalaryEstimatorForm(form: SalaryEstimatorFormData): void {
  writeJson(PIPELINE_KEYS.salaryEstimatorForm, form);
}

export function getSalaryEstimatorResult(): SalaryEstimate | null {
  return readJson<SalaryEstimate>(PIPELINE_KEYS.salaryEstimatorResult);
}

export function setSalaryEstimatorResult(result: SalaryEstimate): void {
  writeJson(PIPELINE_KEYS.salaryEstimatorResult, result);
}

export function getSalaryEstimatorAnalysis(): string | null {
  return readString(PIPELINE_KEYS.salaryEstimatorAnalysis);
}

export function setSalaryEstimatorAnalysis(text: string): void {
  writeString(PIPELINE_KEYS.salaryEstimatorAnalysis, text);
}

// ---------- Reset ----------

/**
 * Clears every key written by the pipeline.
 *
 * Called when the user wants to start over from the upload step. Each
 * downstream page re-syncs from the previous step's data, so clearing
 * upstream data here cascades naturally.
 */
export function clearPipeline(): void {
  for (const key of Object.values(PIPELINE_KEYS)) {
    remove(key);
  }
}

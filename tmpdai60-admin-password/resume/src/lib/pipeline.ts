import type { ResumeAnalysis } from "@/types/resume";
import type { CoverLetterFormData, ResumeFormData, SalaryEstimatorFormData, SalaryEstimate, InterviewCoachFormData, InterviewCoachResult, CareerCoachFormData, CareerCoachResult, CalendarData } from "@/types/builder";

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

const store = new Map<string, unknown>();

function readJson<T>(key: string): T | null {
  return (store.get(key) as T) ?? null;
}

function writeJson(key: string, value: unknown): void {
  store.set(key, value);
}

function readString(key: string): string | null {
  const v = store.get(key);
  return typeof v === "string" ? v : null;
}

function writeString(key: string, value: string): void {
  store.set(key, value);
}

// ---------- Active resume ID ----------

export function getCurrentResumeId(): string | null {
  return readString("currentResumeId");
}

export function setCurrentResumeId(id: string): void {
  writeString("currentResumeId", id);
}

// ---------- Score / upload ----------

export function getResumeAnalysis(): ResumeAnalysis | null {
  return readJson<ResumeAnalysis>("resumeAnalysis");
}

export function getResumeText(): string {
  return readString("resumeText") ?? "";
}

export function setResumeAnalysis(analysis: ResumeAnalysis, resumeText: string): void {
  writeJson("resumeAnalysis", analysis);
  writeString("resumeText", resumeText);
}

// ---------- Build ----------

export function getParsedResumeForm(): ResumeFormData | null {
  return readJson<ResumeFormData>("parsedResumeForm");
}

export function setParsedResumeForm(form: ResumeFormData): void {
  writeJson("parsedResumeForm", form);
}

export function getBuilderForm(): ResumeFormData | null {
  return readJson<ResumeFormData>("builderForm");
}

export function setBuilderForm(form: ResumeFormData): void {
  writeJson("builderForm", form);
}

export function getBuiltResumeMarkdown(): string | null {
  return readString("builtResumeMarkdown");
}

export function setBuiltResumeMarkdown(markdown: string): void {
  writeString("builtResumeMarkdown", markdown);
  writeString("builtResume", "1");
}

// ---------- Job Match ----------

export function getJobMatchContext(): JobMatchContext | null {
  return readJson<JobMatchContext>("jobMatchContext");
}

export function setJobMatchContext(ctx: JobMatchContext): void {
  writeJson("jobMatchContext", ctx);
}

export function getJobMatchInput(): JobMatchInput | null {
  return readJson<JobMatchInput>("jobMatchInput");
}

export function setJobMatchInput(input: JobMatchInput): void {
  writeJson("jobMatchInput", input);
}

export function getJobMatchResult<T = unknown>(): T | null {
  return readJson<T>("jobMatchResult");
}

export function setJobMatchResult(result: unknown): void {
  writeJson("jobMatchResult", result);
}

// ---------- Cover Letter ----------

export function getCoverLetterForm(): CoverLetterFormData | null {
  return readJson<CoverLetterFormData>("coverLetterForm");
}

export function setCoverLetterForm(form: CoverLetterFormData): void {
  writeJson("coverLetterForm", form);
}

export function getCoverLetterResult(): string | null {
  return readString("coverLetterResult");
}

export function setCoverLetterResult(text: string): void {
  writeString("coverLetterResult", text);
}

// ---------- Salary Estimator ----------

export function getSalaryEstimatorForm(): SalaryEstimatorFormData | null {
  return readJson<SalaryEstimatorFormData>("salaryEstimatorForm");
}

export function setSalaryEstimatorForm(form: SalaryEstimatorFormData): void {
  writeJson("salaryEstimatorForm", form);
}

export function getSalaryEstimatorResult(): SalaryEstimate | null {
  return readJson<SalaryEstimate>("salaryEstimatorResult");
}

export function setSalaryEstimatorResult(result: SalaryEstimate): void {
  writeJson("salaryEstimatorResult", result);
}

export function getSalaryEstimatorAnalysis(): string | null {
  return readString("salaryEstimatorAnalysis");
}

export function setSalaryEstimatorAnalysis(text: string): void {
  writeString("salaryEstimatorAnalysis", text);
}

// ---------- Interview Coach ----------

export function getInterviewCoachForm(): InterviewCoachFormData | null {
  return readJson<InterviewCoachFormData>("interviewCoachForm");
}

export function setInterviewCoachForm(form: InterviewCoachFormData): void {
  writeJson("interviewCoachForm", form);
}

export function getInterviewCoachResult(): InterviewCoachResult | null {
  return readJson<InterviewCoachResult>("interviewCoachResult");
}

export function setInterviewCoachResult(result: InterviewCoachResult): void {
  writeJson("interviewCoachResult", result);
}

export function getInterviewCoachAnalysis(): string | null {
  return readString("interviewCoachAnalysis");
}

export function setInterviewCoachAnalysis(text: string): void {
  writeString("interviewCoachAnalysis", text);
}

// ---------- Career Coach ----------

export function getCareerCoachForm(): CareerCoachFormData | null {
  return readJson<CareerCoachFormData>("careerCoachForm");
}

export function setCareerCoachForm(form: CareerCoachFormData): void {
  writeJson("careerCoachForm", form);
}

export function getCareerCoachResult(): CareerCoachResult | null {
  return readJson<CareerCoachResult>("careerCoachResult");
}

export function setCareerCoachResult(result: CareerCoachResult): void {
  writeJson("careerCoachResult", result);
}

export function getCareerCoachAnalysis(): string | null {
  return readString("careerCoachAnalysis");
}

export function setCareerCoachAnalysis(text: string): void {
  writeString("careerCoachAnalysis", text);
}

// ---------- Calendar ----------

export function getCalendarData(): CalendarData | null {
  return readJson<CalendarData>("calendarData");
}

export function setCalendarData(data: CalendarData): void {
  writeJson("calendarData", data);
}

// ---------- Reset ----------

export function clearPipeline(): void {
  store.clear();
}

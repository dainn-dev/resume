export interface WorkEntry {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface EducationEntry {
  school: string;
  degree: string;
  graduationYear: string;
  gpa?: string;
}

export interface ResumeFormData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn?: string;
  github?: string;
  summary: string;
  workEntries: WorkEntry[];
  educationEntries: EducationEntry[];
  technicalSkills: string;
  softSkills: string;
  certifications: string;
  languages: string;
  projects: string;
}

export interface CoverLetterFormData {
  jobTitle: string;
  company: string;
  jobDescription: string;
  aboutYourself: string;
  tone: "Professional" | "Enthusiastic" | "Concise";
}

export interface BuildApiResponse {
  success: boolean;
  data?: { markdown: string };
  error?: string;
}

export interface CoverLetterApiResponse {
  success: boolean;
  data?: { text: string };
  error?: string;
}

export interface SalaryEstimatorFormData {
  jobTitle: string;
  industry: string;
  experience: string;
  location: string;
  skills: string;
  education: string;
}

export interface SalaryEstimate {
  minSalary: number;
  maxSalary: number;
  medianSalary: number;
  currency: string;
  alternativeCurrency?: string;
  minSalaryAlt?: number;
  maxSalaryAlt?: number;
  medianSalaryAlt?: number;
  confidence: string;
  factors: string[];
  marketInsights: string;
}

export interface SalaryEstimatorApiResponse {
  success: boolean;
  data?: { estimate: SalaryEstimate; analysis: string };
  error?: string;
}

export interface InterviewCoachFormData {
  jobTitle: string;
  company: string;
  jobDescription: string;
  interviewType: "behavioral" | "technical" | "mixed";
  resumeSummary: string;
}

export interface InterviewQuestion {
  category: string;
  question: string;
  tip: string;
}

export interface InterviewCoachResult {
  questions: InterviewQuestion[];
  keyStrengths: string[];
  commonPitfalls: string[];
  closingQuestions: string[];
}

export interface InterviewCoachApiResponse {
  success: boolean;
  data?: { result: InterviewCoachResult; analysis: string };
  error?: string;
}

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

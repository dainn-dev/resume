export interface Tip {
  problem: string;
  suggestion: string;
}

export interface SectionAnalysis {
  score: number;
  label: string;
  tips: Tip[];
}

export interface ResumeAnalysis {
  overallScore: number;
  overallSummary: string;
  sections: {
    contactInfo: SectionAnalysis;
    summary: SectionAnalysis;
    workExperience: SectionAnalysis;
    education: SectionAnalysis;
    skills: SectionAnalysis;
    formatting: SectionAnalysis;
  };
}

export interface AnalyzeApiResponse {
  success: boolean;
  data?: ResumeAnalysis;
  resumeText?: string;
  error?: string;
}

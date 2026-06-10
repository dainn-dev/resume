export interface KeywordMatch {
  matched: string[];
  missing: string[];
}

export interface JobMatchSuggestion {
  area: string;
  improvement: string;
}

export interface JobMatchAnalysis {
  jobTitle: string;
  company: string;
  matchScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  suggestions: JobMatchSuggestion[];
  keywordMatch: KeywordMatch;
}

export interface JobMatchApiResponse {
  success: boolean;
  data?: JobMatchAnalysis;
  jobDescription?: string;
  error?: string;
}

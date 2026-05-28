export interface Benefit {
  name: string;
  highlight: boolean;
  category: string | null;
}

export interface CompanyInfo {
  name: string;
  rating: number | null;
  employeeCount: number | null;
  industry: string | null;
  headquarters: string | null;
  benefits: Benefit[] | null;
}

export interface ReviewItem {
  source: string;
  reviewerName: string | null;
  reviewerPosition: string | null;
  rating: number | null;
  pros: string | null;
  cons: string | null;
  date: string | null;
  url: string | null;
}

export interface SourceStatus {
  source: string;
  status: "ok" | "error" | "blocked";
  reviewCount: number;
  error: string | null;
}

export interface CompanyReviewResponse {
  info: CompanyInfo;
  reviews: ReviewItem[];
  sources: SourceStatus[];
  fromCache: boolean;
  limitApplied: number;
  totalAvailable: number;
}

export interface TopTechCompany {
  name: string;
  rating: number | null;
  industry: string | null;
  headquarters: string | null;
  summary: string | null;
  perks: string[];
}

export interface TopTechResponse {
  companies: TopTechCompany[];
  region: string;
  fromCache: boolean;
}

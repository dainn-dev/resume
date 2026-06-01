import type { ResumeFormData } from "@/types/builder";

export type PortfolioTheme = "minimal" | "modern" | "classic";

export const PORTFOLIO_THEMES: { id: PortfolioTheme; label: string; blurb: string }[] = [
  { id: "minimal", label: "Minimal", blurb: "Clean, light, content-first." },
  { id: "modern", label: "Modern", blurb: "Bold gradient header, dark accents." },
  { id: "classic", label: "Classic", blurb: "Serif, traditional résumé look." },
];

// Premium-side portfolio record (matches backend PortfolioDto).
export interface Portfolio {
  id: string;
  subdomain: string;
  resumeId: string;
  resumeTitle: string | null;
  theme: PortfolioTheme;
  status: "Pending" | "Approved" | "Rejected";
  hideContact: boolean;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// Public, unauthenticated payload (matches backend PublicPortfolioDto).
export interface PublicPortfolio {
  theme: PortfolioTheme;
  hideContact: boolean;
  resume: ResumeFormData;
}

export interface SubdomainAvailability {
  available: boolean;
  reason: string | null;
}

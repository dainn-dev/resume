// Central SEO/site constants. The app is served at dresume.dainn.online (portfolios live on the
// other *.dainn.online subdomains); override per-deployment with NEXT_PUBLIC_SITE_URL.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dresume.dainn.online").replace(/\/$/, "");

export const SITE_NAME = "DResume";

export const SITE_TAGLINE = "AI Resume Scoring, Builder & Career Coach";

export const SITE_DESCRIPTION =
  "DResume is an AI-powered platform to score, build, and improve your résumé, match it to jobs, " +
  "write cover letters, estimate salaries, and coach your career — in English and Vietnamese.";

export const SITE_KEYWORDS = [
  "resume builder",
  "AI resume",
  "resume score",
  "CV builder",
  "cover letter generator",
  "job match",
  "salary estimator",
  "career coach",
  "ATS resume",
  "résumé checker",
  "tạo CV",
  "đánh giá CV",
  "viết CV AI",
];

// Public, indexable routes on the main app domain (used by sitemap + robots).
export const PUBLIC_PATHS = ["/", "/login", "/register", "/help", "/privacy", "/terms"];

// App-only / auth-gated route prefixes that must never be indexed.
export const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/build",
  "/account",
  "/admin",
  "/billing",
  "/results",
  "/job-match",
  "/cover-letter",
  "/salary-estimator",
  "/interview-coach",
  "/career-coach",
  "/calendar",
  "/company-review",
  "/portfolio",
  "/verify-email",
  "/auth/",
];

export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

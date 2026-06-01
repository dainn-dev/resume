import { NextRequest, NextResponse } from "next/server";

// Subdomains that are the main app (or infra), never a portfolio. "dresume" is the app's own
// host (dresume.dainn.online) — without it the whole app would be rewritten to a portfolio 404.
// Extend per-deployment via RESERVED_SUBDOMAINS (comma-separated) without a code change.
const DEFAULT_RESERVED = ["www", "app", "api", "admin", "dresume"];
const RESERVED_SUBS = new Set(
  [
    ...DEFAULT_RESERVED,
    ...(process.env.RESERVED_SUBDOMAINS ?? process.env.NEXT_PUBLIC_RESERVED_SUBDOMAINS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ],
);

const BASE_DOMAIN =
  process.env.PORTFOLIO_BASE_DOMAIN ??
  process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN ??
  "dainn.online";

// Returns the portfolio subdomain for a Host header, or null if this is the main app.
// Handles `<sub>.dainn.online` (prod) and `<sub>.localhost[:port]` (dev).
function extractSub(host: string): string | null {
  const hostname = host.split(":")[0].toLowerCase();

  let sub: string | null = null;
  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    sub = hostname.slice(0, -(BASE_DOMAIN.length + 1));
  } else if (hostname.endsWith(".localhost")) {
    sub = hostname.slice(0, -".localhost".length);
  }

  if (!sub) return null;
  // Only a single label maps to a portfolio (e.g. "anhnh", not "a.b").
  if (sub.includes(".")) return null;
  if (RESERVED_SUBS.has(sub)) return null;
  return sub;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const sub = extractSub(host);
  if (!sub) return NextResponse.next();

  // On a portfolio subdomain, every (non-excluded) path renders that portfolio.
  const url = req.nextUrl.clone();
  url.pathname = `/portfolio/${sub}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Exclude API proxy routes, Next internals and static files so they resolve normally
  // even when served from a portfolio subdomain.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.png|robots.txt|sitemap.xml).*)"],
};

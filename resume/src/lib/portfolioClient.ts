import type { Portfolio, PortfolioTheme, SubdomainAvailability } from "@/types/portfolio";

interface Envelope<T> { success: boolean; data?: T; error?: string }

async function readEnvelope<T>(res: Response): Promise<{ ok: boolean; data?: T; error?: string }> {
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (res.ok && body?.success) return { ok: true, data: body.data };
  return { ok: false, error: body?.error ?? `Request failed (${res.status}).` };
}

// Returns the user's portfolio, or null if they don't have one yet.
export async function fetchMyPortfolio(): Promise<Portfolio | null> {
  const res = await fetch("/api/portfolios", { cache: "no-store" });
  const r = await readEnvelope<Portfolio | null>(res);
  return r.ok ? (r.data ?? null) : null;
}

export async function checkSubdomain(subdomain: string): Promise<SubdomainAvailability> {
  const res = await fetch(`/api/portfolios/check?subdomain=${encodeURIComponent(subdomain)}`, { cache: "no-store" });
  const r = await readEnvelope<SubdomainAvailability>(res);
  return r.ok && r.data ? r.data : { available: false, reason: r.error ?? "Could not check availability." };
}

export interface CreatePortfolioInput { subdomain: string; resumeId: string; theme: PortfolioTheme }
export interface UpdatePortfolioInput {
  subdomain?: string;
  resumeId?: string;
  theme?: PortfolioTheme;
  hideContact?: boolean;
}

export async function createPortfolio(input: CreatePortfolioInput): Promise<{ ok: boolean; data?: Portfolio; error?: string }> {
  const res = await fetch("/api/portfolios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readEnvelope<Portfolio>(res);
}

export async function updatePortfolio(input: UpdatePortfolioInput): Promise<{ ok: boolean; data?: Portfolio; error?: string }> {
  const res = await fetch("/api/portfolios", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readEnvelope<Portfolio>(res);
}

export async function deletePortfolio(): Promise<boolean> {
  const res = await fetch("/api/portfolios", { method: "DELETE" });
  const r = await readEnvelope<unknown>(res);
  return r.ok;
}

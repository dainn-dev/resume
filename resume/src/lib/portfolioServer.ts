import { cache } from "react";
import { callBackend } from "@/lib/backend";
import type { PublicPortfolio } from "@/types/portfolio";

interface Envelope<T> { success: boolean; data?: T; error?: string }

// Server-side fetch of a public (Approved-only) portfolio. Wrapped in React cache() so the
// page render, generateMetadata, and the OG image route in one request share a single backend
// call instead of three.
export const getPublicPortfolio = cache(async (subdomain: string): Promise<PublicPortfolio | null> => {
  const res = await callBackend<Envelope<PublicPortfolio>>(
    `/api/public/portfolio/${encodeURIComponent(subdomain)}`,
  );
  if (!res.ok || !res.data?.success || !res.data.data) return null;
  return res.data.data;
});

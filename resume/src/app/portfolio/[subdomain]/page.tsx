import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { callBackend } from "@/lib/backend";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import type { PublicPortfolio } from "@/types/portfolio";

const BASE_DOMAIN =
  process.env.PORTFOLIO_BASE_DOMAIN ??
  process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN ??
  "dainn.online";

interface Envelope<T> { success: boolean; data?: T; error?: string }

// Server-side fetch of the public (Approved-only) portfolio. Wrapped in React cache() so the
// generateMetadata + page render in the same request share one backend call instead of two.
const getPortfolio = cache(async (subdomain: string): Promise<PublicPortfolio | null> => {
  const res = await callBackend<Envelope<PublicPortfolio>>(
    `/api/public/portfolio/${encodeURIComponent(subdomain)}`,
  );
  if (!res.ok || !res.data?.success || !res.data.data) return null;
  return res.data.data;
});

export async function generateMetadata({ params }: { params: { subdomain: string } }): Promise<Metadata> {
  const portfolio = await getPortfolio(params.subdomain);
  const siteUrl = `https://${params.subdomain}.${BASE_DOMAIN}`;

  if (!portfolio) {
    return { title: { absolute: "Portfolio not found" }, robots: { index: false, follow: false } };
  }

  const r = portfolio.resume;
  const name = r.fullName?.trim() || "Portfolio";
  const title = `${name} — Portfolio`;
  const description = (r.summary?.trim() || `${name}'s professional portfolio.`).slice(0, 160);

  return {
    metadataBase: new URL(siteUrl),
    // Absolute: a portfolio is the user's own site, so don't append the "| DResume" template.
    title: { absolute: title },
    description,
    alternates: { canonical: siteUrl },
    robots: { index: true, follow: true },
    openGraph: {
      type: "profile",
      title,
      description,
      url: siteUrl,
      siteName: name,
      images: [{ url: "/logo.png" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/logo.png"],
    },
  };
}

export default async function PortfolioPage({ params }: { params: { subdomain: string } }) {
  const portfolio = await getPortfolio(params.subdomain);
  if (!portfolio) notFound();

  return (
    <PortfolioRenderer data={portfolio.resume} theme={portfolio.theme} hideContact={portfolio.hideContact} />
  );
}

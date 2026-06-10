import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import { getPublicPortfolio } from "@/lib/portfolioServer";

const BASE_DOMAIN =
  process.env.PORTFOLIO_BASE_DOMAIN ??
  process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN ??
  "dainn.online";

export async function generateMetadata({ params }: { params: { subdomain: string } }): Promise<Metadata> {
  const portfolio = await getPublicPortfolio(params.subdomain);
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
    // Images intentionally omitted — the colocated opengraph-image.tsx generates a per-person
    // OG/Twitter card automatically and Next wires it into both.
    openGraph: {
      type: "profile",
      title,
      description,
      url: siteUrl,
      siteName: name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PortfolioPage({ params }: { params: { subdomain: string } }) {
  const portfolio = await getPublicPortfolio(params.subdomain);
  if (!portfolio) notFound();

  return (
    <PortfolioRenderer data={portfolio.resume} theme={portfolio.theme} hideContact={portfolio.hideContact} />
  );
}

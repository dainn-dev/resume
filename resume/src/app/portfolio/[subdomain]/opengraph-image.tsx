import { ImageResponse } from "next/og";
import { getPublicPortfolio } from "@/lib/portfolioServer";

// Per-person social card rendered at request time. Node runtime (default) so it can reuse the
// cached backend fetch from getPublicPortfolio.
export const runtime = "nodejs";
export const alt = "Portfolio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE_DOMAIN =
  process.env.PORTFOLIO_BASE_DOMAIN ??
  process.env.NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN ??
  "dainn.online";

export default async function OgImage({ params }: { params: { subdomain: string } }) {
  const portfolio = await getPublicPortfolio(params.subdomain);
  const r = portfolio?.resume;
  const name = r?.fullName?.trim() || "Portfolio";
  const headline =
    r?.workEntries?.[0]?.title?.trim() ||
    r?.location?.trim() ||
    "Professional portfolio";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.35)",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            {initials || "•"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
          <div style={{ marginTop: 16, fontSize: 40, color: "rgba(255,255,255,0.9)" }}>{headline}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30 }}>
          <span style={{ color: "rgba(255,255,255,0.95)" }}>
            {params.subdomain}.{BASE_DOMAIN}
          </span>
          <span style={{ color: "rgba(255,255,255,0.7)" }}>Made with DResume</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

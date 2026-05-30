"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Live countdown until a discount ends. Renders nothing when:
 *  - no endDate is set, or
 *  - the endDate is invalid / already past.
 * Returns the formatted remaining time to a render-prop / children-as-text via `label`.
 */
export default function DiscountCountdown({
  endDate,
  className = "",
  label,
}: {
  endDate?: string | null;
  className?: string;
  label?: (remaining: string) => string;
}) {
  // null until mounted on the client — avoids SSR/hydration mismatch.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!endDate || now === null) return null;
  const end = new Date(endDate).getTime();
  if (Number.isNaN(end)) return null;
  const remaining = end - now;
  if (remaining <= 0) return null;

  const text = formatRemaining(remaining);
  return <span className={className}>{label ? label(text) : text}</span>;
}

/** Returns true when a promo end date is set and still in the future (client-side only). */
export function isDiscountActive(endDate?: string | null): boolean {
  if (!endDate) return false;
  const end = new Date(endDate).getTime();
  return !Number.isNaN(end) && end > Date.now();
}

/** True when the quantity cap is set and already reached. */
export function isSoldOut(maxRedemptions?: number | null, redemptions?: number | null): boolean {
  if (maxRedemptions == null) return false; // unlimited
  return (redemptions ?? 0) >= maxRedemptions;
}

/**
 * A promo countdown should show only when an end date is set, still in the future,
 * AND the quantity (if capped) is not exhausted.
 */
export function isPromoLive(promo: {
  endDate?: string | null;
  maxRedemptions?: number | null;
  redemptions?: number | null;
}): boolean {
  return isDiscountActive(promo.endDate) && !isSoldOut(promo.maxRedemptions, promo.redemptions);
}

/** Units left for a capped promo, or null when unlimited. */
export function remainingRedemptions(maxRedemptions?: number | null, redemptions?: number | null): number | null {
  if (maxRedemptions == null) return null;
  return Math.max(0, maxRedemptions - (redemptions ?? 0));
}

/**
 * Whether a tier's discount currently applies (mirrors the backend rule):
 * started, not ended, and not sold out. No constraints = always active.
 */
export function isPromoActive(promo: {
  startDate?: string | null;
  endDate?: string | null;
  maxRedemptions?: number | null;
  redemptions?: number | null;
}): boolean {
  const now = Date.now();
  if (promo.startDate) { const s = new Date(promo.startDate).getTime(); if (!Number.isNaN(s) && now < s) return false; }
  if (promo.endDate) { const e = new Date(promo.endDate).getTime(); if (!Number.isNaN(e) && now > e) return false; }
  if (isSoldOut(promo.maxRedemptions, promo.redemptions)) return false;
  return true;
}

/** Discount % that actually applies right now — 0 once the promo has ended or sold out. */
export function effectiveDiscountPercent(tier: {
  discountPercent: number;
  startDate?: string | null;
  endDate?: string | null;
  maxRedemptions?: number | null;
  redemptions?: number | null;
}): number {
  return isPromoActive(tier) ? tier.discountPercent : 0;
}

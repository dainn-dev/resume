"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/TranslationProvider";

// Maintenance window: 1:00 AM – 7:00 AM Vietnam time (GMT+7), daily.
// The pre-maintenance notice shows during the 0:00–1:00 AM (VN) hour with a
// MM:SS countdown (starting 59:59) until maintenance begins at 1:00 AM.
// Vietnam has no DST, so a fixed +7h offset is always correct.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const NOTICE_FROM_HOUR = 0; // VN hour during which the notice + countdown is shown
const PREVIEW = false; // TEMP: force-show the banner for UI preview — set back to false before shipping.

export default function MaintenanceBanner() {
  const { t } = useTranslation();
  // null = outside the notice window (also the SSR/first-paint value → no hydration mismatch).
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      // Shift the absolute instant into VN wall-clock, then read it via UTC getters.
      const vn = new Date(Date.now() + VN_OFFSET_MS);
      if (PREVIEW || vn.getUTCHours() === NOTICE_FROM_HOUR) {
        const secsIntoHour = vn.getUTCMinutes() * 60 + vn.getUTCSeconds();
        // Seconds until the next hour boundary in VN, capped at 59:59 for display.
        setRemaining(Math.min(3599, 3600 - secsIntoHour));
      } else {
        setRemaining(null);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (remaining === null) return null;

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300">
      <div className="px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <span className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-7.5 12.99A1.5 1.5 0 004.14 19.5h15.72a1.5 1.5 0 001.3-2.57l-7.5-12.99a1.5 1.5 0 00-2.6 0z" />
          </svg>
          <span className="truncate">{t("maintenance.notice")}</span>
        </span>
        <span className="font-mono font-bold tabular-nums shrink-0">{mm}:{ss}</span>
      </div>
    </div>
  );
}

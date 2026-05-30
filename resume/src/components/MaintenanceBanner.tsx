"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/components/TranslationProvider";

// Maintenance window: 2:00 AM – 5:00 AM Vietnam time (GMT+7), daily.
// Two display modes (Vietnam has no DST, so a fixed +7h offset is always correct):
//   • "notice" — during the 1:00–2:00 AM hour: a heads-up with a MM:SS countdown
//     (starting 59:59) until maintenance begins at 2:00 AM.
//   • "active" — during the 2:00–5:00 AM window: maintenance is ongoing.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const NOTICE_HOUR = 1; // VN hour during which the pre-maintenance notice + countdown is shown
const MAINT_START_HOUR = 2; // inclusive
const MAINT_END_HOUR = 5; // exclusive
const PREVIEW = false; // TEMP: force-show the banner for UI preview — set back to false before shipping.

type State = { mode: "notice"; remaining: number } | { mode: "active" } | null;

export default function MaintenanceBanner() {
  const { t } = useTranslation();
  // null = outside both windows (also the SSR/first-paint value → no hydration mismatch).
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    function tick() {
      // Shift the absolute instant into VN wall-clock, then read it via UTC getters.
      const vn = new Date(Date.now() + VN_OFFSET_MS);
      const h = vn.getUTCHours();
      if (PREVIEW || h === NOTICE_HOUR) {
        const secsIntoHour = vn.getUTCMinutes() * 60 + vn.getUTCSeconds();
        // Seconds until the next hour boundary in VN, capped at 59:59 for display.
        setState({ mode: "notice", remaining: Math.min(3599, 3600 - secsIntoHour) });
      } else if (h >= MAINT_START_HOUR && h < MAINT_END_HOUR) {
        setState({ mode: "active" });
      } else {
        setState(null);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (state === null) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300">
      <div className="px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <span className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M10.34 3.94l-7.5 12.99A1.5 1.5 0 004.14 19.5h15.72a1.5 1.5 0 001.3-2.57l-7.5-12.99a1.5 1.5 0 00-2.6 0z" />
          </svg>
          <span className="truncate">{state.mode === "notice" ? t("maintenance.notice") : t("maintenance.active")}</span>
        </span>
        {state.mode === "notice" && (
          <span className="font-mono font-bold tabular-nums shrink-0">
            {String(Math.floor(state.remaining / 60)).padStart(2, "0")}:{String(state.remaining % 60).padStart(2, "0")}
          </span>
        )}
      </div>
    </div>
  );
}

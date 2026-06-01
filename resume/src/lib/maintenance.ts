// Scheduled daily maintenance window: 2:00–5:00 AM Vietnam time (GMT+7).
// Vietnam has no DST, so a fixed +7h offset is always correct.
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const NOTICE_HOUR = 1; // VN hour during which the pre-maintenance notice + countdown shows
export const MAINT_START_HOUR = 2; // inclusive
export const MAINT_END_HOUR = 5; // exclusive

// True when `now` falls inside the scheduled maintenance window. Used to decide whether a 5xx
// from the backend is expected downtime (show the maintenance message) or an unexpected server
// error outside the window (show a generic error message instead).
export function isMaintenanceWindow(now: number = Date.now()): boolean {
  const vn = new Date(now + VN_OFFSET_MS);
  const h = vn.getUTCHours();
  return h >= MAINT_START_HOUR && h < MAINT_END_HOUR;
}

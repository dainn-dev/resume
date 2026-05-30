"use client";

import { useEffect, useState } from "react";
import MaintenancePage from "@/components/MaintenancePage";

// Threshold of consecutive backend 5xx responses before we conclude the
// backend is down and take over the screen with the maintenance page.
const FAILURE_THRESHOLD = 5;

// We only track calls to our own Next.js proxy routes (which forward to the
// .NET backend). Third-party / asset requests must never trip the counter.
function isBackendCall(url: string): boolean {
  try {
    const path = new URL(url, window.location.origin).pathname;
    return path.startsWith("/api/");
  } catch {
    return false;
  }
}

export default function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [down, setDown] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let consecutive5xx = 0;

    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      const [input] = args;
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : "";

      const tracked = isBackendCall(url);

      try {
        const res = await originalFetch(...args);

        if (tracked) {
          if (res.status >= 500 && res.status < 600) {
            consecutive5xx += 1;
            if (consecutive5xx >= FAILURE_THRESHOLD) setDown(true);
          } else {
            // Any non-5xx response means the backend is reachable again.
            consecutive5xx = 0;
          }
        }

        return res;
      } catch (err) {
        // Network-level failures (backend unreachable) count the same as 5xx.
        if (tracked) {
          consecutive5xx += 1;
          if (consecutive5xx >= FAILURE_THRESHOLD) setDown(true);
        }
        throw err;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (down) return <MaintenancePage onRetry={() => window.location.reload()} />;

  return <>{children}</>;
}

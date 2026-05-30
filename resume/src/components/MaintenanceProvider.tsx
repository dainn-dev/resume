"use client";

import { useEffect, useState } from "react";
import MaintenancePage from "@/components/MaintenancePage";

// As soon as a backend call returns HTTP 500, we conclude the backend is down
// and take over the screen with the maintenance page. Only an exact 500 trips it —
// other 5xx (502/503/504) and network-level failures are left alone.
//
// We only track calls to our own Next.js proxy routes (which forward to the
// .NET backend). Third-party / asset requests must never trip the takeover.
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

      const res = await originalFetch(...args);

      // Exactly HTTP 500 from a backend proxy call → take over with maintenance page.
      if (res.status === 500 && isBackendCall(url)) setDown(true);

      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (down) return <MaintenancePage onRetry={() => window.location.reload()} />;

  return <>{children}</>;
}

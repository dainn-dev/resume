"use client";

import { useEffect, useState } from "react";
import MaintenancePage from "@/components/MaintenancePage";

// As soon as a backend call returns any HTTP 5xx (500–599), we conclude the
// backend is down and take over the screen with the maintenance page.
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

      // Any HTTP 5xx from a backend proxy call → take over with maintenance page.
      if (res.status >= 500 && res.status < 600 && isBackendCall(url)) setDown(true);

      return res;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (down) return <MaintenancePage onRetry={() => window.location.reload()} />;

  return <>{children}</>;
}

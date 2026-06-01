"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/components/TranslationProvider";
import { Button } from "@/components/ui/Button";
import { googleCallback } from "@/lib/auth";

function GoogleCallback() {
  const { t } = useTranslation();
  const { setUser, refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke guard — the code is single-use.
    ran.current = true;

    const googleError = params.get("error");
    const code = params.get("code");
    const state = params.get("state");

    if (googleError || !code || !state) {
      router.replace("/login?error=google");
      return;
    }

    void (async () => {
      const result = await googleCallback(code, state);
      if (result.user) {
        setUser(result.user);
        refresh();
        router.replace("/dashboard");
      } else {
        setError(result.error ?? t("auth.googleError"));
      }
    })();
  }, [params, router, setUser, refresh, t]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {error ? (
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
          <Button
            variant="link"
            onClick={() => router.replace("/login")}
          >
            {t("auth.backToLogin")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <svg className="w-5 h-5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t("auth.signingIn")}
        </div>
      )}
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GoogleCallback />
    </Suspense>
  );
}

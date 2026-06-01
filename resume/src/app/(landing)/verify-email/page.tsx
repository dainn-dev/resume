"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "@/components/TranslationProvider";
import { buttonClasses } from "@/components/ui/Button";

function VerifyEmailContent() {
  const { t, mounted } = useTranslation();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = searchParams.get("userId");
    const token = searchParams.get("token");

    if (!userId || !token) {
      setStatus("error");
      setError("Invalid verification link. Missing userId or token.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => null);
          setStatus("error");
          setError(data?.error ?? "Verification failed. The link may have expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setError("Network error. Please try again.");
      });
  }, [searchParams]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between h-14 px-4 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="DResume" width={68} height={32} className="h-8 w-auto" priority />
        </Link>
        <LanguageSwitcher />
      </nav>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            {status === "loading" && (
              <>
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <h1 className="text-xl font-bold text-white mb-2">Verifying your email...</h1>
                <p className="text-gray-400 text-sm">Please wait a moment.</p>
              </>
            )}
            {status === "success" && (
              <>
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Email verified!</h1>
                <p className="text-gray-400 text-sm mb-6">Your account is now active. You can sign in.</p>
                <Link
                  href="/login"
                  className={buttonClasses({ variant: "primary", fullWidth: true })}
                >
                  Sign in
                </Link>
              </>
            )}
            {status === "error" && (
              <>
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Verification failed</h1>
                <p className="text-red-400 text-sm mb-6">{error}</p>
                <Link
                  href="/login"
                  className={buttonClasses({ variant: "secondary", fullWidth: true })}
                >
                  Go to login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

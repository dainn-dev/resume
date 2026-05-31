"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type ReCAPTCHA from "react-google-recaptcha";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/components/TranslationProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Recaptcha, { RECAPTCHA_ENABLED } from "@/components/Recaptcha";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { loginRequest } from "@/lib/auth";

export default function LoginPage() {
  const { t, mounted } = useTranslation();
  const { setUser, refresh, isAuthenticated, mounted: authMounted } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    if (authMounted && isAuthenticated) router.replace("/dashboard");
  }, [authMounted, isAuthenticated, router]);

  // Surface errors bounced back from the Google OAuth callback (?error=...).
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (reason) {
      setError(t("auth.googleError"));
      window.history.replaceState(null, "", "/login");
    }
  }, [t]);

  if (!mounted || !authMounted) return null;
  if (isAuthenticated) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError(t("auth.errorEmailRequired")); return; }
    if (password.length < 6) { setError(t("auth.errorPasswordMin")); return; }
    if (RECAPTCHA_ENABLED && !captchaToken) { setError(t("auth.errorCaptchaRequired")); return; }
    setBusy(true);
    try {
      const result = await loginRequest(email.trim(), password, captchaToken);
      if (result.error) { setError(result.error); return; }
      if (result.requiresTwoFactor) { setError("Two-factor authentication is not yet supported in this UI."); return; }
      if (result.user) {
        setUser(result.user);
        refresh();
        router.push("/dashboard");
      }
    } finally {
      setBusy(false);
      captchaRef.current?.reset();
      setCaptchaToken(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between h-14 px-4 max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="DResume" width={120} height={32} className="h-8 w-auto" priority />
        </Link>
        <LanguageSwitcher />
      </nav>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">{t("auth.loginTitle")}</h1>
            <p className="text-gray-400 text-sm mt-2">{t("auth.loginSubtitle")}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("auth.email")}</label>
                <input
                  type="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("auth.password")}</label>
                <input
                  type="password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Recaptcha ref={captchaRef} onChange={setCaptchaToken} className="flex justify-center" />
              <button
                type="submit"
                disabled={busy || (RECAPTCHA_ENABLED && !captchaToken)}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {busy ? "…" : t("auth.loginButton")}
              </button>
            </form>

            <GoogleSignInButton />

            <p className="text-center text-gray-500 text-xs">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="text-blue-400 hover:text-blue-300">{t("auth.registerLink")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

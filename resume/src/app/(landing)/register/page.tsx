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
import { registerRequest } from "@/lib/auth";

export default function RegisterPage() {
  const { t, mounted } = useTranslation();
  const { isAuthenticated, mounted: authMounted } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    if (authMounted && isAuthenticated) router.replace("/dashboard");
  }, [authMounted, isAuthenticated, router]);

  if (!mounted || !authMounted) return null;
  if (isAuthenticated) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!name.trim()) { setError(t("auth.errorNameRequired")); return; }
    if (!email.trim()) { setError(t("auth.errorEmailRequired")); return; }
    if (password.length < 6) { setError(t("auth.errorPasswordMin")); return; }
    if (password !== confirm) { setError(t("auth.errorPasswordMismatch")); return; }
    if (RECAPTCHA_ENABLED && !captchaToken) { setError(t("auth.errorCaptchaRequired")); return; }
    setBusy(true);
    try {
      const result = await registerRequest(name.trim(), email.trim(), password, captchaToken);
      if (!result.ok) { setError(result.error ?? "Registration failed."); return; }
      setSuccess(result.message ?? "Account created. Check your email to verify the address, then sign in.");
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
            <h1 className="text-2xl font-bold text-white">{t("auth.registerTitle")}</h1>
            <p className="text-gray-400 text-sm mt-2">{t("auth.registerSubtitle")}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
              )}
              {success && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">
                  {success}{" "}
                  <Link href="/login" className="underline">Sign in</Link>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("auth.name")}</label>
                <input
                  type="text"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={t("auth.namePlaceholder")}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
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
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">{t("auth.confirmPassword")}</label>
                <input
                  type="password"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  placeholder={t("auth.confirmPasswordPlaceholder")}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <Recaptcha ref={captchaRef} onChange={setCaptchaToken} className="flex justify-center" />
              <button
                type="submit"
                disabled={busy || (RECAPTCHA_ENABLED && !captchaToken)}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {busy ? "…" : t("auth.registerButton")}
              </button>
            </form>

            <GoogleSignInButton />

            <p className="text-center text-gray-500 text-xs">
              {t("auth.hasAccount")}{" "}
              <Link href="/login" className="text-blue-400 hover:text-blue-300">{t("auth.loginLink")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

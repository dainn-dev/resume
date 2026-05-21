"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/components/TranslationProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const { t, mounted } = useTranslation();
  const { login, isAuthenticated, mounted: authMounted } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authMounted && isAuthenticated) router.replace("/dashboard");
  }, [authMounted, isAuthenticated, router]);

  if (!mounted || !authMounted) return null;
  if (isAuthenticated) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError(t("auth.errorEmailRequired")); return; }
    if (password.length < 6) { setError(t("auth.errorPasswordMin")); return; }
    const name = email.split("@")[0];
    login(name, email);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between h-14 px-4 max-w-6xl mx-auto w-full">
        <Link href="/" className="text-blue-400 font-semibold text-sm">{t("nav.title")}</Link>
        <LanguageSwitcher />
      </nav>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">{t("auth.loginTitle")}</h1>
            <p className="text-gray-400 text-sm mt-2">{t("auth.loginSubtitle")}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            {/* Social login buttons */}
            <div className="space-y-2.5">
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t("auth.continueWithGoogle")}
              </button>
              <button
                onClick={() => signIn("linkedin", { callbackUrl: "/dashboard" })}
                className="w-full flex items-center justify-center gap-3 bg-[#0A66C2] hover:bg-[#004182] text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                {t("auth.continueWithLinkedIn")}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-gray-500 text-xs">{t("auth.orDivider")}</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Email/password form */}
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
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                {t("auth.loginButton")}
              </button>
            </form>

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

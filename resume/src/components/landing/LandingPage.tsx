"use client";

import Link from "next/link";
import { useTranslation } from "@/components/TranslationProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const FEATURES = [
  { key: "feature1", icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3" },
  { key: "feature2", icon: "M12 8V4H8M4 8h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8z" },
  { key: "feature3", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z" },
  { key: "feature4", icon: "M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z" },
  { key: "feature5", icon: "M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
  { key: "feature6", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { key: "feature7", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
];

export default function LandingPage() {
  const { t, mounted } = useTranslation();

  if (!mounted) return null;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <span className="text-blue-400 font-semibold text-sm">{t("nav.title")}</span>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              {t("landing.navLogin")}
            </Link>
            <Link href="/register" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
              {t("landing.navGetStarted")}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            {t("landing.heroSubtitle")}
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link href="/register" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm">
              {t("landing.heroCta")}
            </Link>
            <a href="#features" className="border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 font-medium px-8 py-3 rounded-xl transition-colors text-sm">
              {t("landing.heroCtaSecondary")}
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">{t("landing.featuresTitle")}</h2>
            <p className="text-gray-400">{t("landing.featuresSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, idx) => (
              <div key={f.key} className={`bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-colors ${idx === 6 ? "sm:col-span-2 lg:col-span-1" : ""}`}>
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{t(`landing.${f.key}Title`)}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{t(`landing.${f.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-14">{t("landing.testimonialsTitle")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <p className="text-gray-300 text-sm leading-relaxed italic">&ldquo;{t(`landing.testimonial${i}Quote`)}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                    {t(`landing.testimonial${i}Name`).split(" ").map(w => w[0]).join("")}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{t(`landing.testimonial${i}Name`)}</p>
                    <p className="text-gray-500 text-xs">{t(`landing.testimonial${i}Role`)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">{t("landing.pricingTitle")}</h2>
            <p className="text-gray-400">{t("landing.pricingSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {([
              { name: "Free", price: "$0", period: "", desc: t("landing.pricingFreeTitle"), cta: t("landing.pricingFreeCta"), isPro: false, limits: { resumes: 2, aiCalls: 5, jobMatch: false, coverLetter: false, careerCoach: false, interviewCoach: false, salaryEstimator: false, priorityQueue: false } },
              { name: "Pro", price: "$9.99", period: "/mo", desc: t("landing.pricingProTitle"), cta: t("landing.pricingProCta"), isPro: true, limits: { resumes: 50, aiCalls: 200, jobMatch: true, coverLetter: true, careerCoach: true, interviewCoach: true, salaryEstimator: true, priorityQueue: false } },
              { name: "Enterprise", price: "$29.99", period: "/mo", desc: t("landing.pricingEnterpriseTitle"), cta: t("landing.pricingEnterpriseCta"), isPro: false, limits: { resumes: null, aiCalls: null, jobMatch: true, coverLetter: true, careerCoach: true, interviewCoach: true, salaryEstimator: true, priorityQueue: true } },
            ]).map(plan => (
              <div key={plan.name} className={`relative bg-gray-900 border rounded-2xl p-6 space-y-5 flex flex-col ${plan.isPro ? "border-blue-500 ring-1 ring-blue-500/30" : "border-gray-800"}`}>
                {plan.isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {t("landing.pricingProBadge")}
                  </span>
                )}
                <div>
                  <h3 className="text-white font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-gray-500 text-sm">{plan.period}</span>}
                  </div>
                </div>
                <ul className="text-xs text-gray-300 space-y-2 flex-1">
                  <li>• Resumes: {plan.limits.resumes ?? "Unlimited"}</li>
                  <li>• AI calls/month: {plan.limits.aiCalls ?? "Unlimited"}</li>
                  <li className={plan.limits.jobMatch ? "text-gray-300" : "text-gray-600 line-through"}>• Job Match</li>
                  <li className={plan.limits.coverLetter ? "text-gray-300" : "text-gray-600 line-through"}>• Cover Letter</li>
                  <li className={plan.limits.careerCoach ? "text-gray-300" : "text-gray-600 line-through"}>• Career Coach</li>
                  <li className={plan.limits.interviewCoach ? "text-gray-300" : "text-gray-600 line-through"}>• Interview Coach</li>
                  <li className={plan.limits.salaryEstimator ? "text-gray-300" : "text-gray-600 line-through"}>• Salary Estimator</li>
                  {plan.limits.priorityQueue && <li className="text-amber-300">• Priority queue</li>}
                </ul>
                <Link
                  href="/register"
                  className={`block text-center text-sm font-semibold py-2.5 rounded-lg transition-colors ${
                    plan.isPro
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "border border-gray-700 text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6 bg-gradient-to-b from-blue-600/10 to-transparent border border-blue-500/20 rounded-3xl p-12">
          <h2 className="text-3xl font-bold text-white">{t("landing.ctaTitle")}</h2>
          <p className="text-gray-400">{t("landing.ctaSubtitle")}</p>
          <Link href="/register" className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm">
            {t("landing.ctaButton")}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <p className="text-center text-gray-500 text-xs">{t("landing.footerCopyright")}</p>
      </footer>
    </div>
  );
}

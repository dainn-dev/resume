"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavBar from "@/components/NavBar";
import Sidebar from "@/components/Sidebar";
import AuthGate from "@/components/AuthGate";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import AiLimitBanner from "@/components/AiLimitBanner";
import FeatureGate from "@/components/FeatureGate";
import type { FeatureKey } from "@/lib/accountClient";

// Routes whose access is admin-configurable per plan (/admin/plans). Visiting one without the
// feature shows the upsell card instead of the page.
const FEATURE_BY_PATH: Record<string, FeatureKey> = {
  "/job-match": "jobMatch",
  "/cover-letter": "coverLetter",
  "/career-coach": "careerCoach",
  "/interview-coach": "interviewCoach",
  "/salary-estimator": "salaryEstimator",
  "/calendar": "calendar",
  "/company-review": "companyReview",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const feature = FEATURE_BY_PATH[pathname];

  return (
    <AuthGate>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-60 min-h-screen">
        <NavBar onMenuClick={() => setSidebarOpen(true)} />
        <MaintenanceBanner />
        <AiLimitBanner />
        {feature ? <FeatureGate feature={feature}>{children}</FeatureGate> : children}
      </div>
    </AuthGate>
  );
}

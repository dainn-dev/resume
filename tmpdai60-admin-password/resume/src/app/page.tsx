"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import LandingPage from "@/components/landing/LandingPage";
import MaintenanceBanner from "@/components/MaintenanceBanner";

export default function RootPage() {
  const { isAuthenticated, mounted } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [mounted, isAuthenticated, router]);

  // Always render the landing page so it is server-rendered and fully crawlable. Authenticated
  // users are redirected to /dashboard by the effect above — a brief flash only affects logged-in
  // visitors, who rarely land on "/". Crawlers and logged-out users get the full marketing HTML.
  return (
    <>
      <MaintenanceBanner />
      <LandingPage />
    </>
  );
}

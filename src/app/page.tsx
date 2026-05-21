"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import LandingPage from "@/components/landing/LandingPage";

export default function RootPage() {
  const { isAuthenticated, mounted } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted) return null;
  if (isAuthenticated) return null;

  return <LandingPage />;
}

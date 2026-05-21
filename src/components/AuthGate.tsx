"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mounted } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace("/");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavBar from "@/components/NavBar";
import Sidebar from "@/components/Sidebar";
import AuthGate from "@/components/AuthGate";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import AiLimitBanner from "@/components/AiLimitBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <AuthGate>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-60 min-h-screen">
        <NavBar onMenuClick={() => setSidebarOpen(true)} />
        <MaintenanceBanner />
        <AiLimitBanner />
        {children}
      </div>
    </AuthGate>
  );
}

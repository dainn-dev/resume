"use client";

import NavBar from "@/components/NavBar";
import WorkflowProgress from "@/components/WorkflowProgress";
import AuthGate from "@/components/AuthGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <NavBar />
      <div className="border-b border-gray-800/60 bg-gray-900/30">
        <div className="max-w-5xl mx-auto py-3">
          <WorkflowProgress />
        </div>
      </div>
      {children}
    </AuthGate>
  );
}

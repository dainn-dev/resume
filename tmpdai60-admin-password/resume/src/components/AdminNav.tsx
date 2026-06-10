"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusRing } from "@/components/ui/Button";

const TABS = [
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/plans", label: "Plans" },
  { href: "/admin/bank-accounts", label: "Bank Accounts" },
  { href: "/admin/bank-payments", label: "Bank Payments" },
  { href: "/admin/bug-reports", label: "Bug Reports" },
  { href: "/admin/ai-providers", label: "AI Providers" },
  { href: "/admin/portfolios", label: "Portfolios" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 -mx-4 px-4 py-2 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800 mb-6 overflow-x-auto scrollbar-hide">
      <div className="flex gap-1 min-w-max">
        {TABS.map(tab => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${focusRing} ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

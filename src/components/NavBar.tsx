"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Score Resume", href: "/" },
  { label: "Build Resume", href: "/build" },
  { label: "Job Match", href: "/job-match" },
  { label: "Cover Letter", href: "/cover-letter" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-3xl mx-auto flex items-center justify-between h-14 px-4">
        <span className="text-blue-400 font-semibold text-sm">AI Resume Tools</span>
        <div className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.href === "/" ? pathname === "/" : pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  isActive
                    ? "bg-gray-800 text-white rounded-lg px-4 py-1.5 text-sm font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
                }
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

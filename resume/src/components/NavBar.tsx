"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { useAuth } from "./AuthProvider";
import { focusRing } from "@/components/ui/Button";

export default function NavBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-30">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3 lg:hidden">
          <button
            onClick={onMenuClick}
            className={`p-2 -ml-2 text-gray-400 hover:text-white transition-colors ${focusRing}`}
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link href="/dashboard" className="flex items-center hover:opacity-80 transition-opacity">
            <Image src="/logo.png" alt="DResume" width={68} height={32} className="h-7 w-auto" priority />
          </Link>
        </div>

        <div className="hidden lg:block" />

        <div className="flex items-center gap-3">
          {mounted && <LanguageSwitcher />}
          {mounted && user?.isAdmin && (
            <Link
              href="/admin/analytics"
              className={`text-amber-400 hover:text-amber-300 text-xs font-semibold border border-amber-500/40 hover:border-amber-500 px-2.5 py-1 rounded-lg transition-colors ${focusRing}`}
              title="Admin"
            >
              Admin
            </Link>
          )}
          {mounted && user && (
            <span className="hidden sm:block text-gray-400 text-xs truncate max-w-[180px]" title={user.email}>
              {user.email}
            </span>
          )}
        </div>
      </div>
    </nav>
  );
}

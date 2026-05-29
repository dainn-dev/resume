"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import dynamic from "next/dynamic";

// Lazy-load the modal (and its reCAPTCHA dependency) only when first opened,
// so it isn't bundled into every page's first-load JS.
const ReportBugModalContent = dynamic(() => import("@/components/ReportBugModalContent"), { ssr: false });

interface ReportBugContextValue {
  open: () => void;
}

const ReportBugContext = createContext<ReportBugContextValue>({ open: () => {} });

export function useReportBug() {
  return useContext(ReportBugContext);
}

/**
 * Provides a global Report-a-Bug modal. Any component can call
 * `useReportBug().open()` to launch it — used by the footer, sidebar, and Help Center.
 */
export function ReportBugProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <ReportBugContext.Provider value={{ open }}>
      {children}
      {isOpen && <ReportBugModalContent onClose={close} />}
    </ReportBugContext.Provider>
  );
}

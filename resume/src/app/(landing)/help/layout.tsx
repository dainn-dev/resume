import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Guides and answers for using DResume — scoring résumés, building CVs, job matching, cover letters, salary estimates, and career coaching.",
  alternates: { canonical: "/help" },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}

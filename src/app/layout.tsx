import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import WorkflowProgress from "@/components/WorkflowProgress";
import { TranslationProvider } from "@/components/TranslationProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Resume Tools",
  description: "Score, build, and write cover letters with Claude AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <TranslationProvider>
          <NavBar />
          <div className="border-b border-gray-800/60 bg-gray-900/30">
            <div className="max-w-3xl mx-auto px-6 py-3">
              <WorkflowProgress />
            </div>
          </div>
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}

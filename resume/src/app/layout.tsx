import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TranslationProvider } from "@/components/TranslationProvider";
import MaintenanceProvider from "@/components/MaintenanceProvider";
import AuthProvider from "@/components/AuthProvider";
import { ReportBugProvider } from "@/components/ReportBugModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Resume Tools",
  description: "Score, build, and write cover letters with DResume AI",
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
          <MaintenanceProvider>
            <AuthProvider>
              <ReportBugProvider>
                {children}
              </ReportBugProvider>
            </AuthProvider>
          </MaintenanceProvider>
        </TranslationProvider>
      </body>
    </html>
  );
}

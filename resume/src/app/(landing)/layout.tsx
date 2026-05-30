import MaintenanceBanner from "@/components/MaintenanceBanner";

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MaintenanceBanner />
      {children}
    </>
  );
}

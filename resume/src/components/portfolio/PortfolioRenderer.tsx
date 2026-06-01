import type { ResumeFormData } from "@/types/builder";
import type { PortfolioTheme } from "@/types/portfolio";
import MinimalTheme from "@/components/portfolio/themes/MinimalTheme";
import ModernTheme from "@/components/portfolio/themes/ModernTheme";
import ClassicTheme from "@/components/portfolio/themes/ClassicTheme";

// All theme components render resume fields as plain React text children (auto-escaped) —
// no dangerouslySetInnerHTML — so user-provided content can't inject markup.
export default function PortfolioRenderer({
  data,
  theme,
  hideContact,
}: {
  data: ResumeFormData;
  theme: PortfolioTheme;
  hideContact: boolean;
}) {
  switch (theme) {
    case "modern":
      return <ModernTheme data={data} hideContact={hideContact} />;
    case "classic":
      return <ClassicTheme data={data} hideContact={hideContact} />;
    case "minimal":
    default:
      return <MinimalTheme data={data} hideContact={hideContact} />;
  }
}

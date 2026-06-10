import type { ContactItem } from "@/components/portfolio/shared";

// Renders the header contact row shared by every theme: middot-separated items, where
// linkable ones (email/phone/safe URLs) become anchors. Themes pass their own colors.
export default function ContactLine({
  items,
  className,
  linkClassName,
  sepClassName,
}: {
  items: ContactItem[];
  className?: string;
  linkClassName?: string;
  sepClassName?: string;
}) {
  if (items.length === 0) return null;
  return (
    <p className={className}>
      {items.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-x-2">
          {i > 0 && <span aria-hidden className={sepClassName}>·</span>}
          {c.href ? (
            <a
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className={linkClassName}
            >
              {c.text}
            </a>
          ) : (
            <span>{c.text}</span>
          )}
        </span>
      ))}
    </p>
  );
}
